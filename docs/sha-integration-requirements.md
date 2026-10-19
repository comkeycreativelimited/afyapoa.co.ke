# Social Health Authority (SHA) — eClaims & Insurance Integration Requirements

**Document Identifier:** `SHA-INT-2026-V1`  
**Target Platform:** COMKEY AFYYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Baseline Draft (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026  
**Primary Regulatory Authorities:** Social Health Authority (SHA), Digital Health Agency (DHA), Ministry of Health (MoH)

---

## 1. Executive Summary & Legal Framework

The **Social Health Insurance Act, 2023 (No. 16 of 2023)** repeals the National Health Insurance Fund (NHIF) Act and establishes the **Social Health Authority (SHA)** as the state corporation responsible for managing national health insurance in Kenya. The Act is operationalized through the **Social Health Insurance Regulations, 2024**.

For healthcare facilities contracted under SHA and utilizing **COMKEY AFYYA POA**, claims adjudication, beneficiary verification, preauthorization, and billing are no longer executed through legacy disparate portals. They are routed via API directly through the **Kenya Health Information Exchange (HIE)** middleware to the SHA adjudication engine.

### Legal Status & Enforceability:
* **Statutory Act:** Social Health Insurance Act, 2023 (No. 16 of 2023).
* **Judicial Context:** While declared unconstitutional by the High Court in July 2024 alongside the Digital Health Act due to public participation challenges, the Court of Appeal issued a stay of execution pending appeal. Consequently, **the SHA framework and mandatory eClaims integrations remain in full legal force and operation.**

---

## 2. The Three Statutory Healthcare Financing Funds

Under the SHIA 2023, healthcare services in Kenya are funded through three separate statutory funds, each requiring distinct business rules and integration flows in COMKEY AFYYA POA:

```
+---------------------------------------------------------------------------------------------+
|                          SOCIAL HEALTH AUTHORITY (SHA) FINANCING FUNDS                      |
+------------------------------------+-----------------------------------+--------------------+
| 1. Primary HealthCare (PHC) Fund   | 2. Social Health Insurance Fund   | 3. Emergency,      |
|                                    |    (SHIF)                         |    Chronic &       |
|                                    |                                   |    Critical Illness|
|                                    |                                   |    Fund (ECCIF)    |
+------------------------------------+-----------------------------------+--------------------+
| - Health Facility Levels 1, 2 & 3  | - Health Facility Levels 4, 5 & 6 | - All levels (1-6) |
| - Primary Care & Outpatient        | - Secondary & Tertiary Services   | - Emergency Care,  |
| - Financing Model: CAPITATION      | - Inpatient & Specialized OP      |   ICU/HDU, Trauma, |
| - Registration & Panel Matching    | - Financing: Fee-for-Service      |   Oncology, Renal  |
| - No Preauthorization needed       |   (FFS) & Per Diem                | - Fast-track Entry |
|                                    | - Preauthorizations required      | - Doctor Consent   |
|                                    |   for high-cost interventions     |   via OTP          |
|                                    | - Standard 90-day claim window    | - Strict 24-Hour   |
|                                    |                                   |   Claim Submission |
+------------------------------------+-----------------------------------+--------------------+
```

---

## 3. Prerequisite Patient Journey & Eligibility Verification

* **Source:** `https://hie-docs.dha.go.ke/docs/scenarios/overview` & `/eclaims/eligibility`
* **Version/Date Verified:** September 28, 2026 (Accessed October 19, 2026)

Before any clinical encounter or claim creation can occur in COMKEY AFYYA POA, the system must execute the 5-step prerequisite sequence to establish patient identity and financial coverage:

```
[Step 1: Get Access Token] 
  --> POST /api/v1/tenants/token (Client Credentials + Multi-Tenant Facility Header)
[Step 2: Patient Search] 
  --> GET /api/v1/patients?identification_number={ID}&identification_type={TYPE}
  <-- Returns canonical CR Beneficiary ID (cr_id / patient_id) and demographics
[Step 3: Check SHA Eligibility] 
  --> GET /api/v1/patients/eligibility?identification_number={ID}&identification_type={TYPE}
  <-- Returns membership status and active schemes (PHC, SHIF, ECCIF)
[Step 4: Sub-Benefit Coverage] 
  --> GET /api/v1/patients/sub-benefits?patient_id={cr_id}
  <-- Returns list of authorized sub_benefit_codes
[Step 5: Intervention Coverage] 
  --> GET /api/v1/patients/benefits/interventions?patient_id={cr_id}&sub_benefit_code={code}
  <-- Returns detailed intervention list with decision flags
```

### Critical Decision Flags on Interventions:
The response from Step 5 dictates the downstream state machine in the HMIS. Every intervention returned includes:
* `paymentMechanism`: `PER_DIEM` or `FEE_FOR_SERVICE`.
* `needsPreauth`: Boolean (`true` / `false`). Indicates if a prior authorization is mandatory before service delivery.
* `needsManualPreauthApproval`: Boolean (`true` / `false`). If `true`, requires medical board / insurer manual review (Elective Preauth) prior to scheduling.
* `accessPoint`: `IP` (Inpatient), `OP` (Outpatient), or both.
* `fund`: Designates the paying fund (`SHIF`, `PHC`, `ECCIF`).

---

## 4. The Eight Official Integration Scenarios

* **Source:** `https://hie-docs.dha.go.ke/docs/scenarios/overview`

COMKEY AFYYA POA must natively support all eight official clinical integration scenarios defined in the DHA/SHA technical specification:

| Scenario ID | Name | Applicable Fund | Access Point | Payment Mechanism | Preauth Type | Claim Dispatch Trigger |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SC-01** | SHIF IP Per Diem | SHIF | Inpatient | Per Diem | None | Inpatient Discharge |
| **SC-02** | SHIF IP FFS Normal Preauth | SHIF | Inpatient | Fee for Service | Normal Preauth | Inpatient Discharge |
| **SC-03** | SHIF IP FFS Elective Preauth | SHIF | Inpatient | Fee for Service | Elective Preauth | Inpatient Discharge |
| **SC-04** | SHIF OP FFS Elective Preauth | SHIF | Outpatient | Fee for Service | Elective Preauth | Immediate Outpatient Submit |
| **SC-05** | SHIF OP FFS Normal Preauth | SHIF | Outpatient | Fee for Service | Normal Preauth | Immediate Outpatient Submit |
| **SC-06** | UHC / PHC OP Capitation | PHC (UHC) | Outpatient | Capitation | None (Pre-cleared) | Immediate Outpatient Submit |
| **SC-07** | ECCIF Emergency Identified | ECCIF | OP / IP | FFS / Fixed FFS | None (Doctor OTP) | Submit within 24 Hours |
| **SC-08** | ECCIF Emergency Unidentified | ECCIF | OP / IP | FFS / Fixed FFS | None (Doctor OTP) | Submit within 24 Hours |

---

## 5. End-to-End eClaims Processing Lifecycle

```
+------------------------------------------------------------------------------------+
|                          SHA eCLAIMS STATE MACHINE LIFECYCLE                       |
|                                                                                    |
|  [1. Eligibility & Benefit Checks]                                                |
|       GET /api/v1/patients/eligibility & sub-benefits & interventions              |
|                                     |                                              |
|                                     v                                              |
|  [2. Start Visit & Patient Consent]                                                |
|       - OTP Consent via GET contacts & POST /api/v1/claims/otp                     |
|       - Biometrics via POST /api/v1/claims/authorize & iframe fingerprint matcher   |
|       - Visit Creation: POST /api/v1/claims/visit                                  |
|                                     |                                              |
|                                     v                                              |
|  [3. Preauthorization (if required by intervention flags)]                         |
|       - Normal Preauth: POST /api/v1/claims/preauth                                |
|       - Specialized: Surgical, Oncology, Renal, Optical, Imaging                   |
|       - Elective Pre-visit: Pre-authorization submitted prior to visit date       |
|                                     |                                              |
|                                     v                                              |
|  [4. Active Interventions Management]                                              |
|       - Add: POST /api/v1/claims/interventions                                     |
|       - Retire / Switch / Restore interventions during stay                        |
|                                     |                                              |
|                                     v                                              |
|  [5. Billing & Diagnosis Coding]                                                   |
|       - Add Billing Line: POST /api/v1/claims/billing-lines                        |
|       - Combined Billing: POST /api/v1/claims/combined-billing                     |
|       - Diagnoses (ICD-11): POST /api/v1/claims/diagnoses                          |
|       - Supporting Attachments (PDF/Images): POST /api/v1/claims/attachments       |
|       - Previews: GET previewProviderClaim & GET previewPayerClaim                 |
|                                     |                                              |
|                                     v                                              |
|  [6. Claim Dispatch & Discharge]                                                   |
|       - Inpatient: POST /api/v1/claims/discharge_inpatient                         |
|       - Outpatient: POST /api/v1/claims/submit                                     |
|       - Emergency: Direct submission within strict 24-hour SLA                     |
|                                     |                                              |
|                                     v                                              |
|  [7. Asynchronous Adjudication & Status Callbacks]                                 |
|       - Registered Webhook: POST /api/v1/callbacks                                 |
|       - Statuses: Submitted -> Under Review -> Approved / Rejected / Remittance    |
+------------------------------------------------------------------------------------+
```

### 5.1 Preauthorization Workflows
* **Normal Preauth:** Submitted during active care for interventions flagged with `needsPreauth: true` and `needsManualPreauthApproval: false`. Evaluated programmatically by rules engine.
* **Elective Preauth:** For scheduled procedures (`needsManualPreauthApproval: true`), authorization must be requested and approved in advance of visit admission.
* **Specialized Bundles:**
  * **Surgical:** Requires operative notes, surgical code, surgeon PUID, theater booking details.
  * **Oncology:** Requires histology/biopsy report attachment, staging code, chemotherapy/radiotherapy regimen cycle details.
  * **Renal:** Requires dialysis session plan, nephrologist confirmation.
  * **Imaging:** Requires clinical rationale, referring clinician PUID, prior modality reports.
* **Cancellations & Adjustments:** Endpoints allow preauth cancellation (`POST /api/v1/claims/preauth/cancel`) or deletion of mistaken doctor/diagnosis lines prior to claim submission.

### 5.2 ECCIF Emergency Claim Rules (Scenarios 7 & 8)
* **Immediate Admission:** Emergency care cannot be denied or delayed due to lack of identification or pre-authorization.
* **Identification at Entry vs Later:**
  * **Scenario 7:** Patient possesses ID. Regular Client Registry lookup is performed.
  * **Scenario 8:** Patient is unconscious, unidentified, or undocumented. System creates a provisional emergency claim (`identifyUnknownPatient`). When identity is established later, the record is merged to the verified CR ID.
* **Doctor Consent:** Because the patient cannot provide OTP/fingerprint consent, consent is provided by the attending doctor via OTP sent to the clinician's verified mobile phone (`resendDoctorConsent`).
* **Strict Submission Window:** All ECCIF emergency claims **MUST be fully submitted within 24 hours** of presentation to be honored by SHA.

### 5.3 Asynchronous Status Callbacks & Webhook Architecture
* SHA claim adjudication is asynchronous.
* Integrators must register a public HTTPS callback endpoint using:
  * `POST /api/v1/callbacks/endpoints`
  * `POST /api/v1/callbacks/operations`
* **Callback Payloads:** SHA dispatches event notifications when claim states change:
  * `PREAUTH_APPROVED` / `PREAUTH_REJECTED`
  * `CLAIM_PROCESSED` / `CLAIM_DISPUTED`
  * `REMITTANCE_ISSUED`
* **HMIS Invariant:** COMKEY AFYYA POA must provide a webhook ingestion worker that updates the billing ledger and alerts hospital credit controllers without blocking UI threads.

---

## 6. Contractual Timelines & Financial Compliance

1. **Standard Claim Submission Limit:** Under the Social Health Insurance Regulations 2024, healthcare providers must submit completed claims within **ninety (90) days** from the date of patient discharge or service conclusion. Claims submitted after 90 days are barred by statute unless supported by proof of force majeure.
2. **Emergency Claim Submission Limit:** ECCIF claims must be transmitted within **24 hours**.
3. **Pre-Authorization Validity:** Approved elective preauthorizations expire if the patient does not present to the facility within thirty (30) days of approval.
4. **Remittance Advice Reconciliation:** Remittances transmitted via the callback API must automatically reconcile against patient folio accounts, tracking co-payments, deductions, and provider write-offs.

---

## 7. Material Findings Traceability Matrix

| Finding ID | Requirement Domain | Technical / Statutory Reference | Source URL / Authority | Version / Date Verified | Affected COMKEY AFYYA POA Module |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SHA-01** | Statutory Authority | Social Health Insurance Act 2023 (No. 16 of 2023) | Kenya Law / Kenya Gazette | Act of 2023 (Appellate Stay 2024) | Insurance Billing Engine, Accounting Core |
| **SHA-02** | Three Fund Architecture | PHC (Capitation), SHIF (FFS/Per Diem), ECCIF (Emergency) | `https://hie-docs.dha.go.ke/docs/scenarios/overview` | Sept 28, 2026 | Financial Schemes Setup, Benefit Rules |
| **SHA-03** | 5-Step Pre-check | Token -> Patient Search -> Eligibility -> Sub-benefits -> Interventions | `https://hie-docs.dha.go.ke/docs/scenarios/overview` | Sept 28, 2026 | Patient Registration, Billing Clearance |
| **SHA-04** | Intervention Flags | `paymentMechanism`, `needsPreauth`, `needsManualPreauthApproval`, `fund` | `https://hie-docs.dha.go.ke/docs/scenarios/overview` | Sept 28, 2026 | Clinical Order Entry, Billing Validation |
| **SHA-05** | Preauthorization Flow | Normal & Specialized Preauths (Surgical, Oncology, Renal) | `https://hie-docs.dha.go.ke/docs/claims/process/preauths/normalPreauths` | Sept 28, 2026 | Specialized Clinical Desks, Insurance Desk |
| **SHA-06** | 24h Emergency Rule | ECCIF Doctor OTP consent, 24-hour mandatory submission | `https://hie-docs.dha.go.ke/docs/claims/process/emergency/emergencyProcessOverview` | Sept 28, 2026 | Emergency Department Triage & Billing |
| **SHA-07** | Status Callbacks | Asynchronous webhook notifications for adjudication and remittance | `https://hie-docs.dha.go.ke/docs/claims/process/callbacks/callbacksProcessOverview` | Sept 28, 2026 | Outbound/Inbound Webhook Engine, Ledger |
| **SHA-08** | Statutory Deadlines | Standard claims: 90 days; Emergency claims: 24 hours | SHIA Regulations 2024 / DHA GoLive Spec | Regs of 2024 / Sept 28, 2026 | Claims Dispatcher, Revenue Cycle Scheduler |
