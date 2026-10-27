# COMKEY AFYA POA — User Manual: Staff Training & Operational Support Guide

**Document Identifier:** `MANUAL-TRN-SUP-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Head of Healthcare Clinical Operations & User Experience  
**Date of Release:** October 2026  
**Audience:** Clinical Staff, Administrative Leads, System Operators, Support Engineers  

---

## 1. Role-Based Onboarding & Training Pathways

To ensure high clinical adoption and statutory compliance under the Kenya Data Protection Act 2019 and Digital Health Act 2023, every staff member must complete their respective training curriculum prior to account activation.

```
+---------------------------------------------------------------------------------------+
|                       STAFF ROLE-SPECIFIC TRAINING PATHWAYS                           |
+---------------------+-------------------+---------------------+-----------------------+
| 1. RECEPTION        | 2. NURSING/TRIAGE | 3. CLINICIANS       | 4. LABORATORY         |
| - Patient Intake    | - Vital Signs     | - ICD-11 MMS Search | - Specimen Collection |
| - DPA 2019 Consent  | - Auto BMI & MAP  | - CPOE Orders       | - Barcode Accessioning|
| - DHA UPI Resolution| - SATS Acuity     | - Encounter Notes   | - Panic Value Alerts  |
| - MRN Assignment    | - Urgent Triage   | - E-Prescriptions   | - Report Auth         |
+---------------------+-------------------+---------------------+-----------------------+
| 5. PHARMACY         | 6. BILLING        | 7. CLAIMS OFFICERS  | 8. FACILITY ADMIN     |
| - FEFO Batch Pick   | - Invoice Compile | - SHA Eligibility   | - Staff Provisioning  |
| - Expiry Risk Color | - eTIMS Sign      | - SHIF / ECCIF Claim| - License Expiry Alert|
| - Generic Sub       | - M-Pesa Receipts | - Preauthorization  | - Quota Monitoring    |
| - Stock Deduction   | - Cash Handling   | - Remittance Recon  | - Break-Glass Review  |
+---------------------+-------------------+---------------------+-----------------------+
```

### Module 1: Patient Registration & Reception Desk
- **Prerequisites:** Understanding patient privacy under Section 29, 30 & 32 of DPA 2019.
- **Workflow:**
  1. Navigate to `/patients` and click **New Patient Registration**.
  2. Enter full legal names, date of birth, biological sex, and contact phone.
  3. Capture national identity identifier (`KENYA_NATIONAL_ID`).
  4. Record explicit patient consent for data processing (`WRITTEN_FORM` or `VERBAL_RECORDED`).
  5. The system performs probabilistic duplicate detection. If confidence $\ge 70\%$, review matching candidate to prevent duplicate medical records.
  6. Trigger DHA Client Registry lookup to resolve and link canonical Unique Patient Identifier (UPI).

### Module 2: Nursing & Triage
- **Workflow:**
  1. Open `/triage` and locate incoming patient in queue.
  2. Record vitals: Systolic & Diastolic Blood Pressure (mmHg), Pulse Rate (bpm), Respiratory Rate (/min), Body Temperature (°C), Oxygen Saturation ($SpO_2\%$), Weight (kg), and Height (cm).
  3. System automatically calculates **Body Mass Index (BMI)** and **Mean Arterial Pressure (MAP)**.
  4. System computes **South African Triage Scale (SATS)** triage acuity score:
     - **Red (Priority 1):** Immediate resuscitation required.
     - **Orange (Priority 2):** Very urgent; assessment within 10 minutes.
     - **Yellow (Priority 3):** Urgent; assessment within 60 minutes.
     - **Green (Priority 4):** Routine; standard queue.

### Module 3: Clinicians & Medical Officers
- **Workflow:**
  1. Open `/encounters` and select active patient consultation.
  2. Search WHO ICD-11 MMS catalogue using the built-in terminology lookup (e.g., `1F40.0` for *P. falciparum malaria*).
  3. Place Computerized Physician Order Entry (CPOE) orders:
     - Laboratory orders: standard LOINC codes (e.g., `58453-2`).
     - Medication orders: Kenya Essential Medicines List (KEML) or WHO ATC codes with dosage, route, frequency, and duration.
  4. Duplicate order detection: The system prevents duplicate medication orders placed within 24 hours unless an explicit clinical justification is documented.

### Module 4: Laboratory Technologists
- **Workflow:**
  1. Open `/laboratory` worklist to view pending specimen orders.
  2. Click **Collect Specimen**: Select specimen type (e.g., `WHOLE_BLOOD`) and container (e.g., `EDTA_TUBE_LAVENDER`).
  3. System generates a unique Accession Number (`ACC-YYYYMM-XXXXX`) and Barcode (`BC-YYYYMM-XXXXX`).
  4. Acknowledge specimen receipt in lab (`RECEIVED_IN_LAB`).
  5. Enter numerical or qualitative test findings. System evaluates findings against age/sex reference ranges and flags `NORMAL`, `ABNORMAL`, or `CRITICAL_PANIC`.
  6. Panic values trigger an immediate clinical priority alert in the ordering clinician's dashboard.
  7. Finalize and authorize diagnostic report.

### Module 5: Pharmacy & Dispensing
- **Workflow:**
  1. Open `/pharmacy` to view authorized medication orders.
  2. Select active prescription. System displays inventory batches prioritized by **First-Expired, First-Out (FEFO)**.
  3. Review automated color-coded expiry risk:
     - **Red (High Risk):** Expiry $\le 90\text{ days}$.
     - **Amber (Medium Risk):** Expiry $91\text{ to }180\text{ days}$.
     - **Green (Low Risk):** Expiry $> 180\text{ days}$.
  4. Allocate required quantities and record batch lot numbers.
  5. Verify patient counseling points and complete dispensing. Stock is automatically deducted from inventory.

### Module 6: Billing & Invoicing
- **Workflow:**
  1. Open `/billing` to compile encounter charges.
  2. Click **Auto-Compile from Encounter**: system itemizes consultation, lab procedures, and dispensed medications.
  3. Finalize invoice: system signs the invoice with KRA eTIMS cryptographic control code and QR validation string.
  4. Collect payment: process cash, card, or trigger M-Pesa STK push. The system issues an official sequential receipt (`RECEIPT-YYYYMM-XXXXX`).

### Module 7: Social Health Authority (SHA) Claims Officers
- **Workflow:**
  1. Open `/claims` and verify beneficiary eligibility across the 3 funds: Primary Health Care (PHC), Social Health Insurance Fund (SHIF), or Emergency/Critical Illness (ECCIF).
  2. Compile standardized Outpatient or Inpatient eClaim conforming to Kenya Claims Implementation Guide (`fhir.kenyaClaimsIG`).
  3. Verify statutory 90-day submission limit. Claims older than 90 days are blocked with warning flag `BR-CLM-01`.
  4. Submit eClaim to SHA adjudication engine.
  5. Ingest asynchronous webhook callbacks (`CLAIM_PROCESSED`, `ADJUDICATED`, `REMITTANCE_ISSUED`).
  6. Run reconciliation reports matching SHA approved remittances against submitted claims.

---

## 2. Customer Support Tiers & Incident Escalation

```
+---------------------------------------------------------------------------------------+
|                                SUPPORT ESCALATION MATRIX                              |
+------------+------------------------------+---------------+---------------------------+
| TIER       | RESPONSIBILITY               | RESPONSE SLA  | RESOLUTION SLA            |
+------------+------------------------------+---------------+---------------------------+
| Tier 1     | Facility In-House Admin      | $\le 15$ mins | $\le 2$ hours (Config)    |
| (Local)    | Password reset, triage setup |               |                           |
+------------+------------------------------+---------------+---------------------------+
| Tier 2     | COMKEY Technical Support     | $\le 30$ mins | $\le 4$ hours (Functional)|
| (Regional) | Bug reports, billing errors  |               |                           |
+------------+------------------------------+---------------+---------------------------+
| Tier 3     | Core Engineering & Security  | $\le 15$ mins | $\le 1$ hour (P1 Critical)|
| (HQ)       | Database, RLS, SHA outage    |               | $\le 24$ hours (P2 Minor) |
+------------+------------------------------+---------------+---------------------------+
```

### Temporary Support Access Grants
When COMKEY technical engineers require access to troubleshoot facility-specific issues:
1. Hospital administrator navigates to `/facility-admin` $\rightarrow$ **Support Access**.
2. Administrator issues a **Time-Bound Support Token** (maximum duration 24 hours).
3. The platform generates an ephemeral scoped token (stored as SHA-256 hash).
4. All actions performed during support access are logged with `AUTHZ_SUPPORT_ACCESS_USED` and visible in the facility audit log.
5. The administrator can revoke access instantly with one click.
