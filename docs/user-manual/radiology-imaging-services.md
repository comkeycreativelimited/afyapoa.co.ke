# COMKEY AFYA POA — User Manual: Radiology & Imaging Services

## 1. Introduction & Statutory Standards

This Standard Operating Procedure (SOP) manual instructs radiographers, consultant radiologists, medical officers, and hospital records staff on the **Radiology and Diagnostic Imaging Module** in COMKEY AFYA POA.

The module enforces:
1. **Radiation Protection Act (Cap 243)** governing ionizing radiation safety and diagnostic imaging requisitions.
2. **Kenya Data Protection Act 2019 Section 44** safeguarding sensitive specialist clinical information.
3. **Specialist Confidentiality Gate:** When an order is designated `isConfidentialSpecialist: true`, view access is restricted to practitioners holding `RADIOLOGY_SPECIALIST_READ`. Non-authorized staff are denied access.
4. **PACS DICOM Integration:** Connects electronic imaging orders and radiologist interpretation reports to external Picture Archiving and Communication Systems via standard DICOM `StudyInstanceUID`.
5. **Immutable Amendment Trails:** Prevents unrecorded overwrites by mandating formal amendment workflows and audit logging once a report is finalized.

---

## 2. Standard Operating Procedures (SOPs)

### SOP-RAD-01: Ordering Diagnostic Imaging Investigations
1. **Initiating Requisition:**
   - From an active outpatient or inpatient clinical encounter, click **Order Diagnostic Imaging**.
2. **Specifying Imaging Requirements:**
   - Select **Modality**: `XRAY`, `ULTRASOUND`, `CT_SCAN`, `MRI`, `MAMMOGRAPHY`, or `FLUOROSCOPY`.
   - Specify **Anatomical Site**: (e.g. *Chest PA & Lateral*, *Abdomen & Pelvis CT with contrast*).
   - Enter **Clinical Indication**: Concise summary of clinical question and diagnostic justification.
   - Select **Urgency**: `ROUTINE`, `URGENT`, or flashing `STAT`.
3. **Flagging Confidential Specialist Information:**
   - If the scan involves sensitive clinical contexts (e.g. non-accidental trauma, sensitive oncology, forensic radiology), toggle **Confidential Specialist Record**.
   - Click **Submit Imaging Requisition**.
   - An official requisition number (`RAD-YYYYMM-XXXX`) is issued and transmitted to the Radiology Worklist.

---

### SOP-RAD-02: Performing Scans & Associating PACS DICOM Studies
1. The radiographer selects the patient on the modality worklist console.
2. After acquiring images, the DICOM study is pushed to the hospital PACS server.
3. On COMKEY AFYA POA, the radiographer inputs or verifies the PACS DICOM **Study Instance UID** (e.g. `1.2.840.113619.2.55.3.604688319.821...`).
4. Requisition status updates to `IN_PROGRESS`.

---

### SOP-RAD-03: Authoring & Signing Diagnostic Reports
1. **Radiologist Interpretation:**
   - The consultant radiologist opens the examination record and views images via the integrated zero-footprint DICOM viewer.
2. **Report Drafting:**
   - Enter structured narrative **Findings** (systematic anatomical description).
   - Enter concise diagnostic **Impression** (clinical conclusion and differential diagnoses).
3. **Finalization:**
   - Click **Sign & Finalize Report**.
   - The report status transitions to `FINAL`, issuing sequential report number (`RPT-YYYYMM-XXXX`).
   - The ordering doctor receives notification, and the imaging order status transitions to `COMPLETED`.

---

### SOP-RAD-04: Amending Finalized Radiology Reports
1. If additional clinical facts emerge or a secondary review identifies an amended finding:
2. Open the finalized report and click **Amend Report**.
3. Enter the amended narrative findings and impression.
4. Provide a mandatory **Amendment Reason** ($\ge 10$ characters).
5. Click **Submit Amended Report**.
6. The report status updates to `AMENDED`, stamping an immutable audit trail (`RADIOLOGY_REPORT_AMENDED`) while preserving the original report history.
