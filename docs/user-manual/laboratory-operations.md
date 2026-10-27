# COMKEY AFYA POA — Laboratory Operations & Clinical User Manual

**Document Identifier:** `SOP-LAB-OPS-2026-V1`  
**System:** COMKEY AFYA POA Laboratory Information System (LIS)  
**Standard Compliance:** ISO 15189:2022 (Medical Laboratories — Requirements for Quality and Competence), KMLTTB Cap 253A, Kenya Digital Health Act 2023.  
**Target Roles:** Phlebotomists, Laboratory Technologists, Senior Reviewers, Consultant Pathologists, Outpatient/Inpatient Clinicians.

---

## 1. Phlebotomy & Specimen Collection Standard Operating Procedure (SOP)

### 1.1 Patient Positive Identification
1. Always confirm patient identity using **two independent statutory identifiers**:
   - Full Legal Name (verified against Patient Master Index).
   - System MRN (`MRN-YYYY-XXXX`) or National ID / DHA UPI.
2. In the Laboratory Workbench, navigate to the **Incoming Orders & Phlebotomy Queue** tab.
3. Review active orders flagged for the patient. Verify priority indicator:
   - `STAT`: Emergency / immediate collection (turnaround target $< 30$ mins).
   - `URGENT`: High priority (turnaround target $< 60$ mins).
   - `ROUTINE`: Standard queue.

### 1.2 Specimen Draw & Receptacle Selection
1. Select the statutory tube or container recommended by the test catalogue:
   - **EDTA K2 (Lavender Top):** Complete Blood Count (CBC), Hemoglobin, Blood Film for Malaria.
   - **SST II Advance with Gel (Gold/Yellow Top):** Renal Function Tests (Creatinine, Urea, Electrolytes), Liver Function Tests, Lipids.
   - **Sodium Citrate 3.2% (Light Blue Top):** Coagulation studies (PT/INR, APTT).
   - **Sterile Specimen Cup:** Urinalysis and Microbiological culture.
2. Click **Collect Specimen** in the action menu:
   - Enter anatomical collection site (e.g., *Left Median Cubital Vein*).
   - Confirm actual volume drawn in mL (e.g., $4.0\text{ mL}$).
   - Click **Confirm Collection**.
3. **Automated System Actions:**
   - The system immediately mints a unique accession number (`ACC-YYYYMM-XXXXX`) and barcode (`BC-YYYYMM-XXXXX`).
   - One collection tube and safety needle are automatically decremented from the facility's consumable stock.
   - Print and affix barcode label to the primary collection tube in the presence of the patient.

---

## 2. Specimen Reception & Pre-Analytical Quality Control

### 2.1 Laboratory Bench Handover
1. Transport specimens to the laboratory within standard cold-chain parameters ($2^\circ\text{C} - 8^\circ\text{C}$ or controlled ambient $20^\circ\text{C} - 25^\circ\text{C}$).
2. Access the **Accession & Specimen Tracking** tab.
3. Scan the barcode or search accession number.
4. Click **Receive in Lab** to stamp physical bench arrival time for Turnaround-Time (TAT) calculations.

### 2.2 Specimen Rejection Workflow (ISO 15189 Pre-Analytical Quality Gate)
If a specimen fails quality inspection upon visual or centrifugal examination:
1. Click **Reject Specimen**.
2. Select the standardized rejection category:
   - `HEMOLYZED`: Gross hemolysis interfering with spectrophotometric assays.
   - `CLOTTED`: Micro-clots or macro-clots in anticoagulant tubes.
   - `INSUFFICIENT_VOLUME`: Quantity Not Sufficient (QNS) for automated run.
   - `INCORRECT_CONTAINER`: Wrong anticoagulant or preservative used.
   - `LEAKING_CONTAINER`: Compromised seal / biohazard risk.
   - `MISLABELED`: Discrepancy between tube barcode and clinical requisition.
3. Enter mandatory descriptive notes explaining the defect.
4. If recollection is required, leave **Trigger Immediate Recollection** checked.
5. **System Response:**
   - The rejected specimen is locked with status `REJECTED`.
   - A linked recollection requisition (`ACC-YYYYMM-XXXXX-R`) is dispatched to the phlebotomy queue.
   - An alert is logged for the ordering clinician with the rejection justification.

---

## 3. Bench Worklist & Analytical Result Entry

### 3.1 Departmental Bench Worklist
1. Select the relevant bench tab:
   - `HEMATOLOGY`
   - `CLINICAL_CHEMISTRY`
   - `PARASITOLOGY`
   - `MICROBIOLOGY`
   - `URINALYSIS`
2. Locate the accessioned specimen and click **Enter Result**.

### 3.2 Automated Abnormal & Panic Threshold Indicators
The LIS evaluates test results against configured reference ranges with recorded clinical provenance (WHO / KEMRI):
- **`NORMAL` (Emerald):** Within normal demographic reference range.
- **`LOW` / `HIGH` (Amber):** Outside normal boundaries.
- **`CRITICAL_LOW` / `CRITICAL_HIGH` (Pulsing Red Alert):** Life-threatening panic value (e.g., Hemoglobin $\le 7.0\text{ g/dL}$, Potassium $< 2.8\text{ mmol/L}$, Malaria Ag *Positive*).
- Technologists cannot override automated critical flagging. Critical results trigger immediate notification badges on clinician dashboards.

---

## 4. Two-Tier Review, Authorization & Report Delivery

### 4.1 Strict Multi-Tier Separation of Duties
- **Bench Technologists (`LAB_TECH`):** Authorized to collect specimens, receive tubes, enter analytical values, and flag preliminary reports (`LAB_WRITE`).
- **Pathologists & Authorized Clinicians (`LAB_RESULT_AUTHORIZE`):** Only senior pathologists can review, digitally sign, and issue `FINAL` diagnostic reports.

### 4.2 Pathologist Sign-Off Procedure
1. Navigate to the **Pathologist Review & Sign-Off** queue.
2. Review aggregated results, instrument calibration flags, and patient clinical history.
3. Enter narrative impression and recommendations:
   - Example: *"Severe microcytic hypochromic anemia (Hb 6.4 g/dL) secondary to confirmed P. falciparum malaria. Stat blood transfusion preparedness and IV artesunate recommended."*
4. Enter digital cryptographic sign-off token (`SIG-PATH-XXXX`).
5. Click **Authorize & Sign Final Report**.
6. The underlying clinical order is transitioned to `COMPLETED`.

### 4.3 Result Correction & Amendment Audit Trail
If a result requires revision following analyzer recalibration or senior review:
1. Select the result and click **Correct / Amend**.
2. Enter the updated analytical value.
3. Enter a **mandatory clinical justification** (minimum 10 characters).
4. The system preserves the original result as `CORRECTED` with full audit history, displaying both prior and corrected values in the audit register.

---

## 5. Turnaround-Time (TAT) & Inventory Quality Monitoring

### 5.1 Operational Milestones Monitored
The LIS calculates real-time duration across 4 standard ISO 15189 milestones:
1. **Order to Collection:** Requisition timestamp $\rightarrow$ Phlebotomy timestamp (Target $< 20$ mins).
2. **Collection to Receipt:** Phlebotomy timestamp $\rightarrow$ Lab arrival timestamp (Target $< 15$ mins).
3. **Receipt to Result Entry:** Bench arrival $\rightarrow$ Instrument result entry (Target $< 30$ mins).
4. **Result Entry to Sign-Off:** Preliminary entry $\rightarrow$ Pathologist authorization (Target $< 15$ mins).
5. **Total Operational TAT:** Target $< 60$ minutes for STAT/OPD panels.

### 5.2 Consumable Reorder Alerts
When inventory for collection tubes, lancets, or rapid test cassettes falls below the configured safety threshold (`quantity_on_hand <= reorder_level`), the LIS displays an urgent procurement warning banner.
