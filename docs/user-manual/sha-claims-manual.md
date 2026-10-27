# SHA Claims & Pre-Authorization User Manual (COMKEY AFYA POA)

**Target Audience:** Clinicians, Medical Officers, Billing Officers, Hospital Administrators  
**Applicable Regulations:** Social Health Insurance Act 2023 & Regulations 2024  
**Module:** `AFYA-POA-SHA-CLAIMS`

---

## 1. Overview & Role Responsibilities

The Social Health Authority (SHA) integration in COMKEY AFYA POA coordinates patient eligibility verification, pre-authorization, diagnostic attachment management, and statutory claim submission.

### User Roles & Permissions:
* **Clinician (`CLINICIAN`):**
  - Verify patient eligibility & benefit packages (`SHA_CLAIM_READ`).
  - Request pre-authorizations for specialized procedures (`SHA_PREAUTH_MANAGE`).
  - Attach operative notes, histology reports, and imaging (`SHA_CLAIM_SUBMIT`).
  - Authorize and sign inpatient discharge summaries.
* **Billing Clerk (`BILLING_CLERK`):**
  - Review queued claim lines and tariff amounts (`SHA_CLAIM_READ`).
  - Submit outpatient and capitation claims to SHA adjudication (`SHA_CLAIM_SUBMIT`).
  - Prepare corrected claim resubmissions for rejected claims (`SHA_CLAIM_SUBMIT`).
* **Facility Administrator (`FACILITY_ADMIN`):**
  - Run timeout reconciliation probes (`SHA_CLAIM_RECONCILE`).
  - Audit SHA callback logs and remittance advice.

---

## 2. Step-by-Step Clinical & Billing Workflows

### 2.1 Beneficiary Eligibility & Coverage Verification
1. Open the patient visit or encounter in AFYA POA.
2. Select **Check SHA Eligibility** (`POST /api/v1/claims/eligibility`).
3. Enter either:
   - **SHA Member Number** (e.g. `SHA-00998877`), or
   - **DHA Civil Registration ID (CR ID)**, or
   - **National ID / Alien ID / Passport Number**.
4. The system queries the DHA HIE Gateway and returns:
   - Membership Status (`ACTIVE` / `INACTIVE`).
   - Fund Coverages: Primary Healthcare Fund (`PHC`), Social Health Insurance Fund (`SHIF`), Emergency, Chronic and Critical Illness Fund (`ECCIF`).
   - Active Emt-point Facility Level and primary healthcare network.

### 2.2 Sub-Benefit Validation & Tariff Lookup
1. Prior to scheduling specialized services, select **Validate Benefit** (`POST /api/v1/claims/benefits/validate`).
2. Specify the Fund (`SHIF`), Sub-Benefit Code (`SURG-MAJ-01`), and Intervention (`INTERV-HERNIA-01`).
3. Verify:
   - Whether the service requires mandatory pre-authorization.
   - Prescribed statutory tariff ceiling (KES).
   - Remaining session or annual benefit balance.

### 2.3 Pre-Authorization Request (Specialized / Inpatient Care)
1. For surgical interventions, specialized oncology, or critical care, navigate to **Pre-Authorizations**.
2. Click **New Pre-Authorization** (`POST /api/v1/claims/preauth`).
3. Select the patient, attending clinician PUID, fund, intervention, and requested amount.
4. Upload initial clinical workup (radiology report, biopsy findings).
5. Submit the pre-auth request. The SHA adjudication engine evaluates the request and returns either:
   - `APPROVED`: Pre-authorization reference code assigned.
   - `REFERRED_TO_COMMITTEE`: Requires secondary clinical review by SHA Medical Board.
   - `REJECTED`: Decision rationale logged for appeal.

### 2.4 Preparing & Validating an Inpatient Claim
1. Open the inpatient encounter.
2. Ensure all diagnostic and therapeutic line items are entered (bed days, surgical fees, laboratory tests, dispensed pharmaceuticals).
3. Click **Prepare Claim** (`POST /api/v1/claims`).
4. System executes automated statutory checks:
   - **90-Day Rule:** Validates that service completion date is within 90 days.
   - **PUID Verification:** Confirms all attending practitioners hold verified PUIDs.
   - **ICD-11 Syntax:** Validates primary and secondary diagnosis codes.
5. If successful, the claim transitions to `QUEUED`. If errors exist, it remains in `DRAFT` with detailed guidance.

### 2.5 Clinical Attachments
1. For claims requiring clinical evidence (operative notes, lab confirmations), click **Add Attachment** (`POST /api/v1/claims/:id/attachments`).
2. Select document type (`OPERATIVE_NOTES`, `BIOPSY_HISTOLOGY`, `DISCHARGE_SUMMARY`).
3. Upload the document (PDF, PNG, JPEG). The system uploads the file to the DHA secure document store and links the trace ID to the claim.

### 2.6 Inpatient Discharge & Automated Acceptance
1. When the patient is clinically cleared for discharge, the attending medical officer selects **Discharge & Submit Claim** (`POST /api/v1/claims/:id/discharge`).
2. Input:
   - Discharge Date & Time.
   - Discharge Disposition (`HOME`, `TRANSFERRED_LEVEL_5`, `DECEASED`).
   - Final ICD-11 Diagnosis.
   - Discharge Summary Notes & Digital Signature.
3. The system transmits the complete discharge payload and claim items to SHA, receiving an immediate `ACCEPTED` status and unique `shaTrackingNumber`.

### 2.7 Corrected Claims & Resubmission (Handling Rejections)
1. If a claim receives `REJECTED` status from the adjudication engine:
   - The rejection reason and statutory error codes are displayed prominently on the claim dashboard.
2. The clinician or billing officer clicks **Prepare Corrected Claim** (`POST /api/v1/claims/:id/resubmit`).
3. Enter:
   - **Correction Reason** (e.g. *Updated ICD-11 code and attached histology report*).
   - Updated billing lines or corrected diagnostic codes.
4. The system creates a new version of the claim (`v2`, `v3`) while preserving the original rejected claim and audit history.
5. The corrected claim can be reviewed and dispatched once validated.
