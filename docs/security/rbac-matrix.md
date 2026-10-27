# COMKEY AFYA POA — Role-Based & Attribute-Based Access Control (RBAC/ABAC) Matrix

**Document Identifier:** `SEC-RBAC-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Implemented & Enforced in Code  
**Date:** October 19, 2026  
**Regulatory Directives:** Health Act 2017, Digital Health Act 2023, Kenya Medical Practitioners and Dentists Council (KMPDC) Regulations, Nursing Council of Kenya (NCK) Rules  

---

## 1. System Roles Directory

`COMKEY AFYA POA` defines 9 distinct operational roles categorized into Platform, Administrative, Clinical, and Allied Healthcare cadres:

| Role Identifier | Cadre Category | Primary Operational Scope | MFA Requirement |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Platform SaaS | Global multi-tenant onboarding, platform telemetry, cross-tenant audit verification | **Mandatory** |
| `FACILITY_ADMIN` | Hospital Admin | Hospital user provisioning, staff role assignment, facility configuration | **Mandatory** |
| `DOCTOR` | Clinical | Outpatient/inpatient consultation, clinical diagnosis, CPOE orders, e-prescribing | Policy-Enforced |
| `CLINICAL_OFFICER` | Clinical | Outpatient consultation, primary diagnosis, lab/radiology orders, prescribing | Policy-Enforced |
| `NURSE` | Nursing & Triage | Patient vital signs triage, emergency intake, ward observations, medication admin | Standard |
| `PHARMACIST` | Pharmacy | Prescription dispensing, stock management, drug utilization review | Standard |
| `LAB_TECHNOLOGIST` | Laboratory | Specimen accessioning, diagnostic testing, lab result entry & release | Standard |
| `RECEPTIONIST` | Front Office | Patient registration, national ID intake, appointment scheduling | Standard |
| `CASHIER` | Revenue Cycle | Patient invoicing, M-Pesa/cash payment collection, receipt issuance | Standard |

---

## 2. Granular Permissions Catalog

The system enforces 20 discrete permissions defined in `@afyapoa/domain-core`:

```typescript
export enum Permission {
  // Tenant & System Administration
  TENANT_MANAGE = 'tenant:manage',
  FACILITY_MANAGE = 'facility:manage',
  USER_MANAGE = 'user:manage',
  ROLE_ASSIGN = 'role:assign',
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',

  // Clinical & Patient Operations
  PATIENT_REGISTER = 'patient:register',
  PATIENT_READ = 'patient:read',
  PATIENT_WRITE = 'patient:write',
  ENCOUNTER_CREATE = 'encounter:create',
  CLINICAL_DOCUMENT = 'clinical:document',
  SENSITIVE_RECORDS_VIEW = 'clinical:sensitive-view',

  // Diagnostic & Ancillary Services
  LAB_ORDER = 'lab:order',
  LAB_EXECUTE = 'lab:execute',
  PHARMACY_ORDER = 'pharmacy:order',
  PHARMACY_DISPENSE = 'pharmacy:dispense',

  // Billing & Regulatory Claims
  BILLING_CREATE = 'billing:create',
  PAYMENT_COLLECT = 'payment:collect',
  CLAIMS_SUBMIT = 'claims:submit',
  REPORTS_VIEW = 'reports:view',
}
```

---

## 3. RBAC Entitlement Matrix

The following table documents the exact role-to-permission entitlement mapping codified in `ROLE_PERMISSIONS`:

| Permission | `SUPER_ADMIN` | `FACILITY_ADMIN` | `DOCTOR` | `CLINICAL_OFFICER` | `NURSE` | `PHARMACIST` | `LAB_TECH` | `RECEPTIONIST` | `CASHIER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `tenant:manage` | **X** | — | — | — | — | — | — | — | — |
| `facility:manage` | **X** | **X** | — | — | — | — | — | — | — |
| `user:manage` | **X** | **X** | — | — | — | — | — | — | — |
| `role:assign` | **X** | **X** | — | — | — | — | — | — | — |
| `audit:read` | **X** | **X** | — | — | — | — | — | — | — |
| `audit:export` | **X** | **X** | — | — | — | — | — | — | — |
| `patient:register` | — | — | — | — | **X** | — | — | **X** | — |
| `patient:read` | — | — | **X** | **X** | **X** | **X** | **X** | **X** | **X** |
| `patient:write` | — | — | **X** | **X** | **X** | — | — | **X** | — |
| `encounter:create` | — | — | **X** | **X** | **X** | — | — | **X** | — |
| `clinical:document` | — | — | **X** | **X** | **X** | — | — | — | — |
| `clinical:sensitive-view` | — | — | **X** | **X** | — | — | — | — | — |
| `lab:order` | — | — | **X** | **X** | — | — | — | — | — |
| `lab:execute` | — | — | — | — | — | — | **X** | — | — |
| `pharmacy:order` | — | — | **X** | **X** | — | — | — | — | — |
| `pharmacy:dispense` | — | — | — | — | — | **X** | — | — | — |
| `billing:create` | — | — | **X** | **X** | — | **X** | **X** | — | **X** |
| `payment:collect` | — | — | — | — | — | — | — | — | **X** |
| `claims:submit` | — | **X** | — | — | — | — | — | — | **X** |
| `reports:view` | **X** | **X** | **X** | **X** | **X** | **X** | **X** | — | **X** |

---

## 4. Attribute-Based Access Control (ABAC) Rules

In addition to static RBAC permissions, runtime access decisions evaluate dynamic context attributes:

### 4.1 Clinician PUID & Regulatory Board Validation
To sign an electronic prescription, diagnostic order, or clinical encounter note:
1. **Practitioner Profile Verification:** The user must have an active record in `practitioner_profiles`.
2. **National Health Worker Registry (HWR) ID:** A valid `puid` must be present.
3. **Board Verification:** The clinician's licensing board must match their cadre:
   - `DOCTOR` $\rightarrow$ `KMPDC` (Kenya Medical Practitioners and Dentists Council)
   - `CLINICAL_OFFICER` $\rightarrow$ `COC` (Clinical Officers Council)
   - `NURSE` $\rightarrow$ `NCK` (Nursing Council of Kenya)
   - `PHARMACIST` $\rightarrow$ `PPB` (Pharmacy and Poisons Board)
4. **License Expiry Check:** `license_expiry` must be strictly in the future ($\text{license\_expiry} > \text{CURRENT\_DATE}$). If expired, clinical signing is blocked and an alert is raised.

### 4.2 Facility Branch Scoping
- In multi-branch hospital networks, users operate within their active `facilityId`.
- Operational queues (e.g., triage worklist, active dispensary queue, cash drawer) filter records matching the practitioner's active facility.
- Clinicians authorized across multiple branches can switch active facility context using `POST /api/v1/auth/switch-facility`, which re-issues an updated token with the target branch's `facilityId` and KMFL code.

### 4.3 Stigmatized Condition Sensitivity Gate
- Clinical encounters or observations flagged as sensitive (`HIV`, `PSY`, `SUD`, `RH`) require the `clinical:sensitive-view` permission.
- General nursing, laboratory, and billing staff attempting to inspect sensitive notes are restricted from viewing clinical narratives, and every sensitive read event logs an explicit `RECORD_READ` audit entry referencing the attending practitioner and patient consent status.

---

## 5. Server-Side Enforcement Architecture

All API endpoints enforce authorization via NestJS Guards and Reflectors:

```typescript
@Controller('api/v1/records')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RecordsController {
  @Get('export')
  @RequirePermissions(Permission.AUDIT_EXPORT)
  async exportRecords(@Req() req: Request) { ... }
}
```

1. **`JwtAuthGuard`:** Validates session and constructs verified `req.user: TenantContext`.
2. **`RolesGuard`:** Reads `@Roles(...)` metadata. If role is not authorized, emits `AUTHZ_FORBIDDEN_ACCESS` and throws `ForbiddenException`.
3. **`PermissionsGuard`:** Reads `@RequirePermissions(...)` metadata. Evaluates `req.user.permissions.includes(requiredPermission)`. If missing, emits `AUTHZ_FORBIDDEN_ACCESS` and throws `ForbiddenException`.
4. **Header Spoofing Neutralization:** Even if an incoming request provides `X-Tenant-Id: <another-tenant-id>`, `JwtStrategy` explicitly discards client headers and populates `req.user.tenantId` exclusively from the signed JWT claim.
