# COMKEY AFYA POA — User Manual: Patient Registration & Identity Management

**Module:** Patient Registration, Master Patient Index & Identity Resolution  
**Document Identifier:** `UM-PAT-001`  
**Target Roles:** Front-Desk Receptionists, Health Records and Information Officers (HRIO), Triage Nurses, Hospital Administrators  
**Applicable Legal Framework:** Kenya Data Protection Act 2019, Digital Health Act 2023, Kenya Health Information System Policy  

---

## 1. Introduction

The Patient Registration and Identity Management module of **COMKEY AFYA POA** serves as the single authoritative Master Patient Index (MPI) for your hospital. It enables frontline healthcare workers to register patients quickly, prevent dangerous duplicate clinical records, securely capture statutory privacy consents, and integrate with Kenya's National Digital Health Agency (DHA) Client Registry to resolve Unique Patient Identifiers (UPI).

---

## 2. Staff Roles and Permissions

Access to patient records is strictly governed by Role-Based Access Control (RBAC):

| Role | Permitted Actions | Restrictions |
| :--- | :--- | :--- |
| **Front-Desk Receptionist** | Patient Search, New Patient Registration, Emergency Intake, Consent Capture. | Cannot reconcile or merge patient records. |
| **Health Records Officer (HRIO)** | All Receptionist actions + Safe Record Reconciliation / Merging, External ID verification. | Requires clinical or administrative justification for merges. |
| **Triage Nurse / Clinician** | Patient Search, Clinical Record Access, Demographics View. | Read-only demographic access; cannot merge records. |
| **Facility Administrator** | Full administrative oversight, duplicate audit reviews, access trail inspections. | Bound by tamper-evident audit logging. |

---

## 3. Standard Patient Registration Workflow

### Step 1: Pre-Registration Search (Always Search First)
Before creating a new patient record, **always** perform a search to avoid duplicate records:
1. Navigate to **Patients** in the main sidebar.
2. In the Search bar, search by:
   - **National ID Number** (e.g. `28495012`) — *Fastest & most accurate*.
   - **Mobile Phone Number** (e.g. `0712345678` or `+254712345678`).
   - **Full Name or MRN** (e.g. `Wanjiku Kamau` or `MRN-202610-0001`).
3. If the patient exists, click their record to open their file. If no matching record is found, proceed to registration.

### Step 2: Demographic Capture
Click **Register New Patient** and complete the form:
- **First Name & Last Name:** Required legal names as appearing on official documents.
- **Date of Birth:** Enter exact date or check *Estimated Age* if the patient is unsure.
- **Gender:** Select `MALE`, `FEMALE`, or `OTHER`.
- **Kenyan Mobile Phone:** Enter standard Kenyan format (e.g., `0712345678` or `+254712345678`). The system automatically validates and converts the number to `+254` E.164 standard.
- **County / Sub-County / Ward:** Select the patient's residential location.
- **Emergency Contact:** Enter primary kin name, relationship (`SPOUSE`, `PARENT`, `SIBLING`, `CHILD`, etc.), and contact phone number.

### Step 3: Statutory Privacy Consent (Kenya DPA 2019)
Under Section 30 of the Kenya Data Protection Act 2019, patients must be informed of and consent to the processing of their health records:
1. Provide the patient with the standard **Hospital Data Protection & Privacy Notice (KE-DPA-2019-V1)**.
2. Ensure the **General Data Processing Consent** toggle is checked.
3. If verbal consent is given (e.g., in assisted registration), document the witness name.

### Step 4: Primary Identifier
Select **KENYA_NATIONAL_ID**, **PASSPORT**, or **BIRTH_CERTIFICATE** and input the number.
- National ID numbers must be 6 to 9 numeric digits.
- The system automatically creates a secure blind index for search while encrypting the raw ID with AES-256-GCM.

Click **Register Patient**. Upon completion, the system issues an authoritative Medical Record Number (e.g. `MRN-202610-0042`).

---

## 4. Emergency Trauma Intake Workflow

When an unconscious, disoriented, or unidentified patient arrives via ambulance or good Samaritan:

1. Click **Emergency Trauma Intake** (the red emergency banner on the Patients screen).
2. Specify the apparent gender (`MALE`, `FEMALE`, or `UNKNOWN`).
3. Enter an estimated age (e.g., `35`).
4. Select consciousness level (`UNCONSCIOUS`, `ALTERED`, `CONSCIOUS_UNCOMMUNICATIVE`).
5. Record who brought the patient (e.g. `E-Plus Ambulance Service Crew 4`).
6. Enter distinguishing physical markers (e.g. scars, tattoos, clothing).
7. Click **Generate Emergency Intake Record**.

The system immediately generates an intake chart with alias `UNKNOWN-MALE-XXXXX` and temporary MRN so clinical orders, laboratory investigations, and blood cross-matching can proceed without delay.

> **Important:** Once the patient's identity is verified, an authorized Records Officer can reconcile the emergency chart into the patient's permanent record.

---

## 5. Duplicate Detection & Prevention

To prevent split medical records and drug-allergy blind spots, COMKEY AFYA POA employs two layers of duplicate protection:

1. **Deterministic Rejection:** If an incoming patient has the exact same National ID as an existing active record in your facility, registration is blocked with an alert.
2. **Probabilistic Scoring:** The system compares name spelling (using phonetic and edit distance algorithms), date of birth, gender, and phone number:
   - If the match confidence is **70% or higher**, the registration is paused and a list of existing matching patients is displayed.
   - **Review Candidates:** Carefully compare demographic details with the patient at the desk.
   - **Legitimate Namesake:** If you confirm the patient is genuinely a different individual (e.g. father and son sharing similar names), check the **Force Override Duplicate Check** checkbox and record your justification.

---

## 6. DHA Client Registry Verification (National UPI)

COMKEY AFYA POA integrates with the National Digital Health Agency (DHA) Client Registry to support national health interoperability and Social Health Authority (SHA) claims.

### Understanding Patient Identity Badges
- **`LOCAL_ONLY` (Amber Badge):** Patient is registered locally in your hospital, but has not yet been linked to the national registry.
- **`VERIFIED_EXTERNAL` (Green Badge):** Patient identity has been verified against the DHA Client Registry. A national Unique Patient Identifier (`UPI`) and Client Registry ID (`CRID`) are bound to the chart.
- **`RECONCILED` (Blue Badge):** Patient is an active survivor record following a duplicate merge.
- **`MERGED` (Gray Badge):** Historical duplicate record; points to the active survivor chart.

### How to Verify a Patient with DHA
1. Open the patient's profile.
2. In the **Identity & National Registry** section, locate the **DHA Verification** card.
3. Click **Verify with DHA Client Registry**.
4. The system sends an authenticated query to the national registry using the patient's National ID or Passport.
5. When verified, the patient's badge updates to `VERIFIED_EXTERNAL`, and their official National UPI is displayed.

---

## 7. Safe Non-Destructive Record Reconciliation

When two charts for the same patient exist in the system (e.g., an emergency intake chart and an earlier outpatient chart):

1. **Who Can Merge:** Only users with the `RECORDS_OFFICER` or `FACILITY_ADMIN` role possessing the `PATIENT_RECONCILE` permission can execute a merge.
2. **Initiate Merge:**
   - Navigate to **Patients -> Reconcile Records**.
   - Select the **Secondary (Duplicate) Patient** to be closed.
   - Select the **Primary (Surviving) Patient** to retain.
   - Review both charts side by side.
   - Enter a clear administrative justification (e.g., *"Merged Trauma Intake MRN-202610-0091 into verified record MRN-202610-0012 following family identification and national ID verification"*).
3. **Execute Merge:** Click **Confirm Non-Destructive Reconciliation**.

### What Happens Behind the Scenes?
- **No data is deleted.**
- The secondary record is updated to `MERGED` status with a direct link to the survivor chart.
- The primary record is updated to `RECONCILED` status.
- All historical identifiers, visit records, and audit events remain intact and auditable.

---

## 8. Privacy & Statutory Access Auditing (DPA 2019 Sec 41)

In compliance with Kenya Data Protection Act 2019 Section 41:
- Every time a staff member views or searches a patient record, an immutable access log entry is recorded with the practitioner ID, timestamp, IP address, and access purpose (`CLINICAL_TREATMENT`, `TRIAGE`, `BILLING`, etc.).
- Patients have the right to request a copy of their record access history.
- If a patient revokes their consent for data processing or health information exchange, the revocation is timestamped with the provided reason and applied immediately to future national exchange workflows.
