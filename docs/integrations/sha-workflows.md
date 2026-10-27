# SHA Integration Workflows Specification (COMKEY AFYA POA)

**Document Reference:** `DOC-INT-SHA-2026-V1`  
**Applicable Statutes:** Social Health Insurance Act (SHIA) 2023, Social Health Insurance Regulations 2024, Digital Health Act (DHA) 2023  
**Status:** Approved & Verified Implementation  
**Monorepo Location:** `packages/domain-core`, `packages/database`, `packages/integration-adapters`, `apps/api`, `apps/mock-server`

---

## 1. Platform & Architectural Boundaries

A critical requirement of DHA and SHA integration is distinguishing the roles of public health portals, developer portals, and runtime API gateways:

```
+-------------------------------------------------------------------------------+
|                             PLATFORM TOPOLOGY                                 |
+-------------------------------------------------------------------------------+
|                                                                               |
|   1. AfyaLink Portal (Historical NHIF)                                        |
|      - Status: DEPRECATED / SUNSET                                            |
|      - Scope: Legacy NHIF card-based claims. Not valid for SHIA 2023 runtime. |
|                                                                               |
|   2. AfyaConnect Developer Portal                                             |
|      - Status: ONBOARDING, SPECIFICATION & CREDENTIAL MANAGEMENT ONLY         |
|      - Scope: Developer registration, mTLS certificate issuance, OAuth client |
|        credentials provisioning, tariff documentation, and sandbox registration.|
|      - Operational API Runtime: AfyaConnect does NOT process claim payloads.  |
|                                                                               |
|   3. DHA Health Information Exchange (DHA HIE / SHA Gateway)                  |
|      - Status: ACTIVE RUNTIME API GATEWAY                                     |
|      - Scope: Executes all runtime HTTP operations for:                       |
|        * Beneficiary eligibility & coverage checks (PHC, SHIF, ECCIF)          |
|        * Pre-authorization lifecycle                                          |
|        * Claim submission, adjudication, batch status, and discharge          |
|        * Webhook callbacks & push notifications                               |
+-------------------------------------------------------------------------------+
```

---

## 2. Statutory Integration Scenarios (SC-01 to SC-08)

COMKEY AFYA POA explicitly implements the eight statutory scenarios defined in SHA Regulations 2024:

| Scenario Code | Fund | Access Point | Payment Mechanism | Description & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **`SC-01`** | **SHIF** | Inpatient (`IP`) | Per-Diem / Case-Rate | Standard medical/surgical inpatient admission. Requires pre-authorization for surgical/high-cost procedures, daily bed tracking, and mandatory inpatient discharge summary before claim acceptance. |
| **`SC-02`** | **SHIF** | Inpatient (`IP`) | Fee-for-Service / Case-Rate | Specialized surgical procedures & oncology care. Mandatory pre-authorization (`PREAUTH_SURGICAL`, `PREAUTH_ONCOLOGY`), pathology/histology attachment, and discharge summary. |
| **`SC-03`** | **SHIF** | Outpatient (`OP`) | Fee-for-Service | Specialized outpatient clinics (Renal Dialysis, Chemotherapy, Specialized Diagnostics). Validates benefit caps and remaining sessions. |
| **`SC-04`** | **ECCIF** | Emergency (`EMERGENCY`) | Fee-for-Service | Emergency medical stabilization & critical resuscitation. **Exempt from pre-authorization**. Must be submitted within **24 hours** of encounter start. Initial stabilization covered regardless of member contribution status. |
| **`SC-05`** | **ECCIF** | Inpatient (`IP`) | Case-Rate | Emergency admission resulting from trauma or acute life-threatening catastrophe. Transition from emergency stabilization to ICU/HDU bed. |
| **`SC-06`** | **PHC** | Outpatient (`OP`) | Capitation | Level 2 (Dispensary) and Level 3 (Health Centre) outpatient visits. Primary care bundle covered under facility capitation arrangement. Verified via SHA Member Number or CR ID. |
| **`SC-07`** | **PHC** | Outpatient (`OP`) | Capitation | Primary maternal, neonatal, and child health services (ANC, PNC, EPI Immunizations). Zero copay for beneficiary. |
| **`SC-08`** | **SHIF** | Outpatient / Pharmacy | FFS / Prescribed Tariff | Chronic disease management and specialized medication dispensing (hypertension, diabetes, sickle cell). Enforces formulary validation and dispensing limits. |

---

## 3. Statutory Business Rules & Pre-Submission Validation

Before any claim can transition from `DRAFT` to `QUEUED`, COMKEY AFYA POA executes deterministic statutory checks:

1. **Statutory 90-Day Submission Deadline (SHIA 2023 Section 34):**
   - For all non-ECCIF claims (`PHC`, `SHIF`), the claim must be submitted within 90 days from the service completion date. Claims exceeding 90 days are rejected with `STATUTORY_DEADLINE_EXCEEDED` and cannot be queued without an official SHA late-submission waiver.
2. **Emergency 24-Hour Submission Window (ECCIF):**
   - Emergency claims under `ECCIF` (`SC-04`) must be submitted within 24 hours of encounter start.
3. **Mandatory Practitioner Digital Signature & PUID:**
   - Every claim and inpatient discharge record must link to an authenticated practitioner registered with KMPDC / COC / NCKE with a verified `PUID` (Practitioner Unique Identifier).
4. **ICD-11 Diagnostic Coding:**
   - Primary diagnosis must conform to WHO ICD-11 system syntax (e.g., `1A00` for Cholera, `DA24.0` for Peptic Ulcer Disease).
5. **Inpatient Discharge Requirement:**
   - For inpatient claims (`accessPoint: 'IP'`), claims cannot be accepted without an official discharge record containing `dischargeDate`, `dischargeDisposition`, `finalDiagnosisIcd11`, and `attendingPractitionerPuid`.
6. **Separation of Clinical Records and Financial Claims:**
   - Clinical encounters, diagnoses, and lab results are immutable clinical facts. Financial claims link to clinical facts but are stored in distinct database tables (`sha_claims`, `sha_claim_items`, `sha_claim_submissions`). Clinical records are never altered to satisfy financial adjudication rules.

---

## 4. Claim Lifecycle State Machine

The claim lifecycle maintains explicit, versioned states matching the verified SHA contract:

```
                     +---------------------------------------+
                     |                 DRAFT                 |
                     | (Clinician prepares bill & diagnoses) |
                     +-------------------+-------------------+
                                         |
                                         | Pre-submission validation
                                         v
                     +---------------------------------------+
                     |                QUEUED                 |
                     | (Validated & waiting for SHA dispatch)|
                     +-------------------+-------------------+
                                         |
                                         | Outbound HTTP dispatch (shaClaimsClient.submitClaim)
                                         v
                     +---------------------------------------+
                     |               SUBMITTED               |
                     |  (Outbound dispatch sent with traceId)|
                     +-------------------+-------------------+
                                         |
                    +--------------------+--------------------+
                    |                                         |
                    | SHA HTTP 202 / 200                      | SHA HTTP 400 / 422
                    v                                         v
+---------------------------------------+ +---------------------------------------+
|             ACKNOWLEDGED              | |               REJECTED                |
|  (SHA assigns visitId/trackingNumber) | | (Validation error: code/reason logged)|
+-------------------+-------------------+ +-------------------+-------------------+
                    |                                         |
                    | Adjudication complete                   | Corrective action taken
                    v                                         v
+---------------------------------------+ +---------------------------------------+
|               ACCEPTED                | |            DRAFT (v2 Resubmission)     |
| (Adjudication engine approves lines)  | | (Increment version, preserve audit)   |
+-------------------+-------------------+ +---------------------------------------+
                    |
                    | Settlement / Remittance webhook
                    v
+---------------------------------------+
|                 PAID                  |
| (Financial settlement completed)      |
+---------------------------------------+
```

---

## 5. Duplicate Prevention & Idempotency Fingerprinting

To prevent double-billing and duplicate financial submissions, COMKEY AFYA POA computes a deterministic SHA-256 fingerprint for every outbound submission payload:

$$\text{Fingerprint} = \text{SHA-256}(\text{tenantId} \parallel \text{facilityId} \parallel \text{patientId} \parallel \text{claimNumber} \parallel \text{version} \parallel \text{totalAmountKES} \parallel \text{itemsDigest})$$

- If an identical fingerprint is detected on a claim currently in `SUBMITTED`, `ACKNOWLEDGED`, or `ACCEPTED` status, further dispatch attempts are aborted with `DUPLICATE_SUBMISSION_PREVENTED`.
- Unique database index `sha_claims_tenant_claim_version_idx` guarantees that versioned claim numbers (`claimNumber`, `version`) are globally unique per tenant.

---

## 6. Timeout Handling & Batch Reconciliation

When network latency, gateway timeouts (`HTTP 504`), or dropped TCP connections occur during claim submission:

1. **State Preservation:** The claim remains in `SUBMITTED` status with its unique `correlationId` and outbound timestamp.
2. **Safe Probing (`POST /claims/reconcile`):**
   - The reconciliation engine queries the DHA/SHA Gateway (`GET /api/v1/claims/:claimNumber/status` or `POST /api/v1/claims/batch-status`).
   - If SHA confirms receipt and returns a tracking number, COMKEY AFYA POA transitions the claim to `ACKNOWLEDGED` or `ACCEPTED`.
   - If SHA reports no record found and the probe window has elapsed, the claim is safely unqueued for operator review or re-dispatch.
3. **Webhook Callback Ingestion (`POST /claims/callbacks`):**
   - Asynchronous determination events (`PREAUTH_APPROVED`, `CLAIM_PROCESSED`, `REMITTANCE_ISSUED`) are ingested into `sha_callback_events`, verified against tenant context, and applied idempotently.
