# COMKEY AFYA POA — Operational Runbook: National Registry Synchronization & Resilient Operations

**Document Identifier:** `RUNBOOK-REG-SYNC-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Kenyan Multi-Tenant HMIS SaaS)  
**Applicability:** Facility Administrators, Records Officers, SREs, and DevOps Engineers  
**Regulatory Baseline:** Digital Health Act 2023, Kenya Core FHIR IG v1.0, KMFL v2.0, HWR Standards  
**Last Updated:** October 21, 2026  

---

## 1. Overview & Architectural Principles

COMKEY AFYA POA integrates with national Kenyan healthcare registries to provide unified patient identification, facility verification, clinician license attestation, and standardized terminology mapping.

### 1.1 Covered Registries
1. **Client Registry (CR / MPI):** Master Patient Index maintained by the Digital Health Agency (DHA). Maps National ID, Alien ID, Birth Certificate, and Passport to authoritative CR ID and Unique Personal Identifier (UPI).
2. **Master Facility List (KMFL):** Ministry of Health facility master registry. Validates facility regulatory status, operational level (Level 2 to Level 6), county, and ownership.
3. **Health Worker Registry (HWR / HRH):** Regulatory board database (KMPDC, Nursing Council of Kenya, Pharmacy and Poisons Board). Validates Practitioner Universal ID (PUID), license status (ACTIVE, SUSPENDED, REVOKED), and validity dates.
4. **Terminology Catalogue (TS):** Centralized clinical nomenclature service validating Kenya Essential Medicines List (KEML), WHO ICD-11 MMS diagnostic codes, and LOINC laboratory concepts.

### 1.2 Freshness Thresholds & Provenance
Every synchronized entity is cached in the multi-tenant `registry_sync_records` table with cryptographic provenance:
* **Client Registry (CR):** Freshness TTL = **6 hours**.
* **Master Facility List (KMFL):** Freshness TTL = **24 hours**.
* **Health Worker Registry (HWR):** Freshness TTL = **12 hours**.
* **Terminology Catalogues:** Freshness TTL = **7 days**.
* **Provenance Metadata:** Remote endpoint, synchronization timestamp, acting user ID, incremental entity version, and SHA-256 payload digest (`sha256:...`).

---

## 2. Synchronization Operations

### 2.1 Scheduled Synchronization
Background workers automatically scan for expired or stale cache records on a periodic schedule:
* Automated queue: `JobQueueName.REGISTRY_SYNC` (`registry-sync`).
* Concurrency: Configured per-tenant worker pool with multi-tenant row-level isolation.
* Dry-run auditing: Reconciliation reports generated prior to live record updates.

### 2.2 Manual Synchronization Trigger
Authorized personnel with permission `REGISTRY_SYNC_TRIGGER` can invoke synchronous refresh via REST API:

#### Client Registry Lookup / Refresh
```http
POST /api/v1/registry/sync/client
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "nationalId": "12345678",
  "facilityCode": "FID-01-000101-1",
  "forceRefresh": true
}
```

#### Facility Registry Verification
```http
POST /api/v1/registry/sync/facility
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "kmflCode": "FID-01-000101-1",
  "forceRefresh": false
}
```

#### Health Worker License Verification
```http
POST /api/v1/registry/sync/health-worker
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "puid": "PUID-KMPDC-A0001",
  "forceRefresh": true
}
```

#### Terminology Concept Validation
```http
POST /api/v1/registry/sync/terminology
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "system": "http://id.who.int/icd/release/11/mms",
  "code": "1B10",
  "forceRefresh": false
}
```

### 2.3 Cache Invalidation
When an authoritative upstream registry broadcasts an update or during manual operational triage:
```http
POST /api/v1/registry/cache/invalidate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "registryType": "FACILITY_REGISTRY",
  "recordKey": "FID-01-000101-1"
}
```
This transitions the record status to `STALE` and resets its `expiresAt` timestamp, forcing the subsequent query to perform a fresh remote query.

---

## 3. Resilient Integration Operations

### 3.1 Circuit Breakers
To prevent cascade failures during external DHA gateway downtime, each registry is guarded by an isolated circuit breaker:
* **Failure Threshold:** 3 consecutive failures.
* **Circuit State Transition:** `CLOSED` $\rightarrow$ `OPEN`.
* **Fast-Fail Behavior:** When `OPEN`, all requests immediately fail with HTTP 503 (`ServiceUnavailableException`) without network overhead.
* **Reset Timeout:** 5,000 ms (configurable via environment).
* **Probe Recovery:** Upon timeout expiration, the breaker transitions to `HALF_OPEN`. If the single probe succeeds, it resets to `CLOSED`; if the probe fails, it trips back to `OPEN`.

### 3.2 Bounded Retries & Exponential Backoff
Failed transient operations execute up to 3 bounded retries using jittered exponential backoff:
$$T_{\text{backoff}} = \min(60000, 1000 \times 2^{\text{attempt}} \pm \text{random}(0, 250))\text{ ms}$$

### 3.3 Dead-Letter Queue (DLQ) Management
When a queued job exhausts all 3 retry attempts, it transitions to `JobStatus.DEAD_LETTER` in queue `JobQueueName.DEAD_LETTER`.

#### Inspecting Failed Jobs
Authorized operators with `REGISTRY_REPLAY_MANAGE` can inspect dead-letter jobs:
```http
GET /api/v1/registry/resilience/dlq?limit=20
Authorization: Bearer <JWT_TOKEN>
```
Returns failed jobs with decrypted payload previews, failure reasons, and stack traces.

#### Replaying a Dead-Letter Job
Once upstream connectivity is restored or payload errors corrected:
```http
POST /api/v1/registry/resilience/dlq/:jobId/replay
Authorization: Bearer <JWT_TOKEN>
```
The job is re-enqueued into `JobQueueName.REGISTRY_SYNC` with reset retry counters and audit logging.

---

## 4. Offline Handling & Risk Controls

### 4.1 Digital Health Act Section 47 Offline Invariant
> **CRITICAL INVARIANT:** Never allow queued data to appear externally verified before the verification has actually succeeded.

When a healthcare facility operates in disconnected/offline mode:
1. Patient records created offline receive local identifier (`mrn`).
2. Identity status is explicitly marked as `UNVERIFIED_OFFLINE` / `PENDING_VERIFICATION`.
3. The system **never** fabricates or assumes a synthetic DHA CR ID or UPI.
4. Clinical care proceeds unhindered pursuant to Section 47 of the Digital Health Act (right to emergency care).
5. Upon connectivity restoration, background reconciliation submits the patient for official DHA CR deduplication and updates the record to `VERIFIED_EXTERNAL`.

### 4.2 Prohibited Offline Operations (Financial & Statutory Gating)
Operations that require live external authorization cannot be queued offline because doing so creates unacceptable financial fraud or regulatory liability:
* `SHA_CLAIM_SUBMIT`: Social Health Authority claims submission.
* `SHA_PREAUTH_REQUEST`: Live pre-authorization requests.
* `SHA_BENEFIT_OVERRIDE`: Exceeding statutory benefit limits.
* `BIOMETRIC_CONSENT_VERIFY`: Patient biometric verification override.
* `KRA_ETIMS_FISCAL_SIGN`: Real-time cryptographic fiscal invoice signing.

Attempting to queue these operations offline throws a strict `ForbiddenException` (`[OFFLINE_RISK_GUARD]`).

### 4.3 Encrypted Storage & Retention Policy
* **Payload Encryption:** All queued payloads containing sensitive personal data (PII/PHI) are encrypted at rest using AES-256-GCM with PBKDF2 key derivation.
* **Retention Policy:**
  * Completed Jobs: Retained for **14 days** for reconciliation auditing, then automatically purged.
  * Dead-Letter Jobs: Retained for **30 days** to allow human investigation and incident post-mortems.
  * Audit Logs: Retained permanently in immutable append-only WORM storage (7-year statutory medical record requirement).

---

## 5. Safe Handling of Changed or Retired Records

Upstream registries regularly update or revoke records. COMKEY AFYA POA safely synchronizes these changes without corrupting historical clinical or financial data:
1. **Suspended / Revoked Practitioner:**
   * Health Worker Registry marks license status as `SUSPENDED` or `REVOKED`.
   * Synchronization marks the local sync status as `RETIRED`.
   * Future prescribing and order signing permissions are immediately blocked.
   * **Historical integrity preserved:** Previous encounters, consultation notes, and prescriptions authored by this practitioner remain intact and legally attributable.
2. **Closed / De-registered Facility:**
   * Master Facility List marks facility as `INACTIVE` / `RETIRED`.
   * Synchronization de-activates the facility profile (`active: false`).
   * New encounter admissions are blocked at that facility.
   * **Historical integrity preserved:** Past claims, billings, and laboratory specimens remain unchanged.
3. **Deprecated Diagnostic Concepts:**
   * Terminology Service deprecates obsolete codes (e.g., legacy ICD-10 codes).
   * Synchronization flags the concept as `DEPRECATED`.
   * New clinical encounters must use modern ICD-11 MMS codes.
   * Past patient problem lists maintain historical context with deprecation warnings.

---

## 6. Integration Health Monitoring & Incident Triage

### 6.1 Operational Health Metrics
To monitor real-time integration status, query the health endpoint:
```http
GET /api/v1/registry/resilience/health
Authorization: Bearer <JWT_TOKEN>
```
Response:
```json
{
  "success": true,
  "data": {
    "circuits": {
      "CLIENT_REGISTRY": { "state": "CLOSED", "consecutiveFailures": 0 },
      "FACILITY_REGISTRY": { "state": "CLOSED", "consecutiveFailures": 0 },
      "HEALTH_WORKER_REGISTRY": { "state": "CLOSED", "consecutiveFailures": 0 },
      "TERMINOLOGY_CATALOGUE": { "state": "CLOSED", "consecutiveFailures": 0 }
    },
    "metrics": {
      "CLIENT_REGISTRY": { "totalRequests": 1420, "successCount": 1418, "failureCount": 2, "avgDurationMs": 42 },
      "FACILITY_REGISTRY": { "totalRequests": 310, "successCount": 310, "failureCount": 0, "avgDurationMs": 18 }
    },
    "activeAlerts": [],
    "timestamp": "2026-10-21T11:30:00.000Z"
  }
}
```

### 6.2 High-Priority Alert Escalation
When any registry experiences **5 consecutive persistent failures**, the system automatically generates an operational alert:
* **Audit Action:** `REGISTRY_PERSISTENT_FAILURE_ALERT`.
* **Severity:** `HIGH`.
* **Escalation SLA:** SRE must acknowledge within 15 minutes during operational hours (7 AM – 9 PM EAT).

### 6.3 Incident Triage Checklist
1. **Check Circuit Breaker:** Inspect if the registry breaker is `OPEN`.
2. **Review Upstream Status:** Verify DHA Status Portal (`https://status.dha.go.ke`).
3. **Inspect Credentials:** Verify DHA OAuth 2.0 client credentials and renewal status. If `AUTH_FAILED` (401) is received, re-issue client tokens via DHA Portal.
4. **Inspect DLQ:** Query `/api/v1/registry/resilience/dlq` to review root-cause errors.
5. **Execute Dry-Run Reconciliation:** Run `/api/v1/registry/reconcile` with `dryRun: true` to evaluate pending changes before committing live updates.
