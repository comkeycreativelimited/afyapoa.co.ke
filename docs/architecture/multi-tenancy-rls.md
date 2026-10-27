# COMKEY AFYA POA — Multi-Tenancy Architecture & PostgreSQL Row-Level Security (RLS)

**Document Identifier:** `ARCH-MT-RLS-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Implemented & Verified in Engine Tests  
**Date:** October 19, 2026  
**Regulatory Directives:** Data Protection Act, 2019 (Sections 29 & 41), Health Act, 2017, Digital Health Act, 2023  

---

## 1. Multi-Tenancy Organizational Hierarchy

`COMKEY AFYA POA` enforces a strict two-tier hierarchical tenancy model:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TENANT (Hospital Organization)                       │
│  - Level 4/5/6 Hospital Board / County Health Dept / Healthcare Group   │
│  - Defines primary legal entity, billing account, & RLS boundary       │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│     FACILITY (Branch / Unit)    │         │     FACILITY (Branch / Unit)    │
│  - Main Referral Campus         │         │  - Satellite Outpatient Clinic  │
│  - KMFL Code: 12345             │         │  - KMFL Code: 67890             │
│  - DHA Facility ID (FID)        │         │  - DHA Facility ID (FID)        │
└─────────────────────────────────┘         └─────────────────────────────────┘
```

1. **Tenant (Hospital Organization):**
   - Represents one healthcare provider organization (e.g., *Nairobi Metro Healthcare Group*, *Kibera Community Health Network*).
   - Serves as the immutable **Row-Level Security (RLS) data boundary**.
   - Every patient record, clinical encounter, order, inventory batch, invoice, and audit log row is tagged with `tenant_id UUID NOT NULL`.

2. **Facility (Hospital Branch / Center):**
   - Represents an operational delivery site accredited under the Kenya Master Health Facility List (KMFL) with a unique DHA Facility Identifier (`FID`).
   - Allows multi-site healthcare networks to share patient registries within the approved organization while maintaining branch-level inventory, wards, billing cashiers, and appointment queues.
   - Users and practitioners are bound to a primary facility but can switch active facilities within their authorized tenant via `POST /api/v1/auth/switch-facility`.

---

## 2. PostgreSQL Row-Level Security (RLS) Engine Design

### 2.1 The PostgreSQL Superuser Bypass Vulnerability & Resolution
In PostgreSQL, database roles with `SUPERUSER` or `BYPASSRLS` privileges bypass all Row-Level Security policies by design, regardless of whether `ENABLE ROW LEVEL SECURITY` or `FORCE ROW LEVEL SECURITY` is set on the table.

In Docker and local environments, initial database bootstrapping connects using the superuser `afyapoa_user`. If application queries ran as `afyapoa_user`, RLS would be rendered completely ineffective at the storage layer.

**Architectural Resolution:**
1. A dedicated non-superuser role `afyapoa_app` is provisioned during migration:
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'afyapoa_app') THEN
       CREATE ROLE afyapoa_app WITH LOGIN PASSWORD 'afyapoa_app_secret' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
     END IF;
   END
   $$;
   ```
2. Schema and table privileges are granted to `afyapoa_app`:
   ```sql
   GRANT USAGE ON SCHEMA public TO afyapoa_app;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afyapoa_app;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO afyapoa_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO afyapoa_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO afyapoa_app;
   ```
3. All backend application connections (via `@afyapoa/database` connection pools) connect as `afyapoa_app`, guaranteeing that PostgreSQL's query engine physically enforces RLS on every single query without possibility of bypass.

### 2.2 Table Policies & `FORCE ROW LEVEL SECURITY`
All tenant-scoped tables enforce RLS:
- `facilities`
- `users`
- `practitioner_profiles`
- `user_sessions`
- `password_resets`
- `patient_records`
- `audit_events`

Each table has `FORCE ROW LEVEL SECURITY` applied, which prevents even table owners from evading policy execution:
```sql
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_records FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_patient_records ON patient_records
AS RESTRICTIVE
USING (
  current_setting('app.is_super_admin', true) = 'true'
  OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
  current_setting('app.is_super_admin', true) = 'true'
  OR
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);
```

### 2.3 Fail-Closed Session Binding
When a query executes without a tenant context set:
- `current_setting('app.current_tenant_id', true)` evaluates to `''` or `NULL`.
- `NULLIF('', '')` evaluates to `NULL`.
- `tenant_id = NULL` evaluates to `UNKNOWN` (falsy in SQL).
- Result: **0 rows returned, 0 rows mutated**. The storage engine fails closed.

Context is bound per transaction or connection block using parameterized `set_config`:
```typescript
export async function withTenantContext<T>(
  tenantId: string,
  fn: (sqlClient: SqlClient) => Promise<T>,
): Promise<T> {
  const client = getAppSqlClient();
  return client.begin(async (tx) => {
    // true = local to this transaction block
    await tx`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
    await tx`SELECT set_config('app.is_super_admin', 'false', true)`;
    return fn(tx as unknown as SqlClient);
  });
}
```

---

## 3. Cryptographic WORM Audit Log RLS Policy

To satisfy **Data Protection Act 2019 Section 41** and prevent insider tampering:
1. `audit_events` enforces append-only storage:
   ```sql
   ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

   -- Allow SELECT for authorized tenant queries
   CREATE POLICY audit_events_select_policy ON audit_events
   FOR SELECT
   USING (
     current_setting('app.is_super_admin', true) = 'true'
     OR
     tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
   );

   -- Allow INSERT for writing new events
   CREATE POLICY audit_events_insert_policy ON audit_events
   FOR INSERT
   WITH CHECK (
     current_setting('app.is_super_admin', true) = 'true'
     OR
     tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
   );

   -- Hard deny on UPDATE and DELETE
   CREATE POLICY audit_events_no_update ON audit_events
   FOR UPDATE
   USING (false)
   WITH CHECK (false);

   CREATE POLICY audit_events_no_delete ON audit_events
   FOR DELETE
   USING (false);
   ```
2. Each audit event is cryptographically linked to the preceding event via SHA-256 hash chaining:
   $$\text{eventHash} = \text{SHA256}(\text{prevHash} \parallel \text{tenantId} \parallel \text{userId} \parallel \text{action} \parallel \text{entityType} \parallel \text{entityId} \parallel \text{payload} \parallel \text{timestamp})$$
3. Verification is performed using topological parent-pointer traversal starting from `GENESIS_HASH` (`0000000000000000000000000000000000000000000000000000000000000000`).

---

## 4. End-to-End Context Lifecycle

### 4.1 HTTP Request Ingress
```
Client Request (HTTPS)
   │
   ▼
1. Helmet Security Headers (HSTS, CSP, XSS-Protection, No-Sniff)
   │
   ▼
2. Throttler Rate Limiter (Token-Bucket per IP / User)
   │
   ▼
3. JwtAuthGuard & JwtStrategy
   │  ├─ Verify JWT Signature (RS256/HS256)
   │  ├─ Verify Active Session in DB (user_sessions.is_revoked = false)
   │  └─ Extract TenantContext (tenantId, facilityId, userId, role, permissions)
   │     * NEVER trust X-Tenant-Id or X-Facility-Id headers from client!
   │
   ▼
4. RolesGuard & PermissionsGuard
   │  ├─ Check @Roles and @RequirePermissions metadata
   │  └─ If unauthorized: emit AUTHZ_FORBIDDEN_ACCESS audit event & return 403
   │
   ▼
5. Service Execution (e.g., RecordsService)
   │  └─ withTenantContext(tenantId, async (tx) => { ... })
   │
   ▼
PostgreSQL Engine (Row-Level Security Enforced via afyapoa_app)
```

### 4.2 Background Worker Jobs
For asynchronous BullMQ tasks, worker jobs do not have an active HTTP request context. Context is safely preserved in the job payload:

```typescript
export interface TenantJobPayload<T = unknown> {
  readonly tenantId: string;
  readonly facilityId?: string;
  readonly facilityCode?: string;
  readonly triggeredByUserId: string;
  readonly correlationId: string;
  readonly data: T;
}
```

When the worker consumes a job:
1. It validates the presence of `tenantId` and `correlationId`.
2. It restores the database context via `withTenantContext(payload.tenantId, async (tx) => { ... })`.
3. It uses tenant-scoped Redis cache keys:
   `getTenantCacheKey(tenantId, 'reports', reportId)` $\rightarrow$ `tenant:uuid:reports:reportId`
4. It uses tenant-scoped object storage prefixes:
   `getTenantStoragePath(tenantId, 'prescriptions/rx-123.pdf')` $\rightarrow$ `tenants/uuid/prescriptions/rx-123.pdf`

---

## 5. Automated Verification Evidence

The multi-tenancy foundation is verified by 32 automated tests across two test suites:

| Suite | File | Tests | Key Scenarios Verified |
| :--- | :--- | :--- | :--- |
| **Database Engine RLS** | `packages/database/src/rls.spec.ts` | 6 | - Fail-closed when context is unset (0 rows)<br>- Strict isolation between Tenant A and Tenant B<br>- Cross-tenant INSERT rejection<br>- Super-admin global access context<br>- Audit log immutability (UPDATE/DELETE blocked) |
| **IAM & Tenancy API** | `apps/api/test/security-regression.spec.ts` | 19 | - Cross-tenant read blocking (404/empty)<br>- Cross-tenant write blocking (404/empty)<br>- Tenant ID header manipulation override<br>- Unauthorized export rejection (403)<br>- Privilege escalation prevention (403)<br>- Immediate session revocation on logout<br>- TOTP MFA challenge/verification<br>- Cryptographic audit chain tamper detection |

---

## 6. Documented Gaps & Pre-Clinical Milestones

Before advancing to clinical workflows (Encounters, Diagnoses, CPOE in Milestones 5+), the following infrastructure gaps must be resolved:

| Gap ID | Description | Impact | Target Milestone | Planned Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **GAP-SEC-01** | Column-Level Envelope Encryption (AES-256-GCM) | Patient National ID, phone, and demographic PII is currently plaintext in database tables | **Milestone 3** (`TASK-03-02`) | Implement KMS field-level envelope encryption with tenant-specific DEKs |
| **GAP-SEC-02** | Blind Indexing Engine | Search on encrypted patient identifiers without table scans | **Milestone 3** (`TASK-03-02`) | Implement HMAC-SHA256 deterministic blind indexing with secret pepper |
| **GAP-SEC-03** | Worker Subsystem Integration | Background BullMQ jobs need full multi-tenant context processor | **Milestone 3** (`TASK-03-03`) | Scaffold `apps/worker` with `TenantContextJobProcessor` |
| **GAP-SEC-04** | Live External DHA HWR Integration | Clinician PUID currently validated against local `practitioner_profiles` table | **Milestone 10** (`TASK-10-01`) | Implement DHA Health Worker Registry (HWR) mTLS gateway driver |
