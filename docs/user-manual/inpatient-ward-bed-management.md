# COMKEY AFYA POA — User Manual: Inpatient Ward & Bed Management

## 1. Introduction & Operational Scope

This Standard Operating Procedure (SOP) manual guides admission clerks, ward charge nurses, attending clinicians, and medical records officers in utilizing the **Inpatient ADT and Ward/Bed Management Subsystem** in COMKEY AFYA POA.

The module enforces:
1. **Health Act 2017 (Cap 241) Section 15** governing hospital admissions, inpatient clinical care, and patient rights.
2. **KMPDC Facility Norms and Standards (Levels 4–6)** for acute medical, surgical, pediatric, maternity, and critical care units (ICU/HDU).
3. **Optimistic Version Locking & Concurrency Control:** Prevents double-allocation collisions through atomic database transactions.
4. **State Machine Integrity:** Clearly separates `ADMITTED`, `TRANSFERRED`, `DISCHARGED`, and `CANCELLED` patient stays.
5. **Bed Sanitation & Maintenance Workflow:** Automates the transition of beds to `CLEANING` upon patient transfer or discharge prior to becoming `VACANT`.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-INP-01: Inpatient Admission Workflow
1. **Verification of Admitting Order:**
   - From the Emergency Department or Outpatient Consultation queue, verify that the medical officer has entered an admission order with an ICD-11 provisional diagnosis.
2. **Ward & Bed Selection:**
   - Open the **Inpatient Ward Map**.
   - Select the target ward matching the patient's specialty (`INTERNAL_MEDICINE`, `SURGICAL`, `PEDIATRICS`, `MATERNITY`, `ICU`, `HDU`).
   - Check gender restrictions: verify male patients are allocated only to `MALE` or `ANY` wards, and female patients to `FEMALE` or `ANY` wards.
   - Choose a green `VACANT` bed station.
3. **Executing Admission:**
   - Enter the patient's MRN, admitting practitioner, admission type (`EMERGENCY`, `ELECTIVE`, `NEWBORN`, `TRANSFER_IN`), and provisional diagnosis.
   - Click **Authorize Admission**.
   - The system executes a transactional lock, transitions the bed status to `OCCUPIED`, increments the bed version counter, and issues an official admission number (`ADM-YYYYMM-XXXX`).

---

### SOP-INP-02: Patient Bed & Ward Transfer Workflow
1. **Clinical Indication for Transfer:**
   - Patient condition improves requiring step-down from ICU/HDU to a general medical/surgical ward, or patient requires isolation.
2. **Selecting Destination Bed:**
   - Open the active admission record in the **Inpatient Roster**.
   - Click **Transfer Bed**.
   - Select the destination ward and an available `VACANT` bed.
   - Enter the mandatory clinical justification (e.g. *Step-down from ICU to General Male Medical Ward post-extubation*).
3. **Atomic Relocation Execution:**
   - Click **Execute Bed Transfer**.
   - The system atomically releases the original bed to `CLEANING`, reserves and marks the destination bed as `OCCUPIED`, and records an immutable entry in the `inpatient_bed_transfers` audit ledger.
   - Environmental services / housekeeping receives notification that the source bed requires terminal decontamination.

---

### SOP-INP-03: Terminal Bed Cleaning & Reset to Vacant
1. Following patient transfer or discharge, the bed displays yellow `CLEANING` status.
2. Housekeeping staff conducts terminal disinfection adhering to infection prevention protocols.
3. Once the bed is prepared with fresh linen, the ward charge nurse clicks **Mark Cleaned**.
4. The system updates the bed status to green `VACANT`, making it immediately eligible for new admissions.

---

### SOP-INP-04: Inpatient Discharge Workflow
1. **Attending Clinician Authorization:**
   - The primary attending consultant authorizes clinical discharge in the patient's electronic medical record.
2. **Mandatory Documentation:**
   - The discharging doctor enters:
     - **Discharge Disposition:** `HOME_IMPROVED`, `TRANSFERRED_OUT`, `AGAINST_MEDICAL_ADVICE`, `DECEASED`, or `REFERRED`.
     - **Final Diagnosis:** Confirmed WHO ICD-11 code and diagnostic title.
     - **Discharge Summary:** Comprehensive instructions, discharge medications, and follow-up appointment date.
3. **Executing Discharge:**
   - Click **Sign & Finalize Discharge**.
   - The admission status advances to `DISCHARGED`.
   - The allocated bed is automatically released to `CLEANING`.
   - The inpatient claim is unlocked for billing clearance and SHA eClaims submission.

---

### SOP-INP-05: Cancelling Erroneous Admissions
1. If an admission order was created in error or the patient leaves prior to physical ward intake, click **Cancel Admission**.
2. Enter the mandatory clinical/administrative justification ($\ge 10$ characters).
3. The admission status is marked `CANCELLED`, the bed is reset to `VACANT`, and an immutable audit event (`INPATIENT_ADMISSION_CANCELLED`) is logged.
