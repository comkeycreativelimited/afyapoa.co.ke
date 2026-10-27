# COMKEY AFYA POA — Radiology & Authorized Diagnostic Imaging API Documentation

## 1. Overview & Regulatory Directives

The **Radiology and Diagnostic Imaging Module** handles computerized orders, radiologist diagnostic interpretation, PACS integration, and specialist privacy protections under:
1. **Radiation Protection Act (Cap 243)** of the Laws of Kenya.
2. **Kenya Data Protection Act 2019 Section 44** protecting sensitive specialist clinical information.
3. **Specialist Confidentiality Protection:** When an imaging order is designated `isConfidentialSpecialist: true` (e.g. sensitive oncology scans, forensic imaging, pediatric non-accidental trauma), read access is strictly barred unless the requesting clinician possesses the elevated `RADIOLOGY_SPECIALIST_READ` permission. Non-specialist clinicians attempting access receive `403 Forbidden`.
4. **PACS DICOM Interoperability:** Orders and reports link directly to external Picture Archiving and Communication Systems (PACS) using standardized DICOM `StudyInstanceUID` attributes.
5. **Audited Amendment Trail:** Once a diagnostic report is finalized by a consultant radiologist, subsequent corrections require a formal amendment action with immutable reasoning logged in the report and audit trail.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Permissions:
- `RADIOLOGY_READ`: View routine, non-confidential imaging orders and finalized reports.
- `RADIOLOGY_ORDER`: Order diagnostic imaging investigations (clinicians, medical officers).
- `RADIOLOGY_REPORT_WRITE`: Author, sign, and amend diagnostic imaging reports (radiologists).
- `RADIOLOGY_SPECIALIST_READ`: Authorization gate required to view confidential specialist scans and reports.

---

## 3. Endpoints Specification

### 3.1 Imaging Orders

#### `POST /radiology/orders`
Submits an electronic imaging investigation requisition.
- **Permission:** `RADIOLOGY_ORDER`
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "encounterId": "f3499542-098b-429b-aa72-abf0a249b01b",
    "modality": "CT_SCAN",
    "bodySite": "Brain / Head without Contrast",
    "clinicalIndication": "Headache and right-sided focal neurological deficit post road traffic accident",
    "urgency": "STAT",
    "isConfidentialSpecialist": false,
    "orderingDoctorId": "d8226227-54f9-4525-b4a7-977e232e0a92"
  }
  ```
- **Response `201 Created`:** Order record with `orderNumber` (e.g. `RAD-202610-0001`) and status `REQUESTED`.

#### `GET /radiology/orders`
Lists imaging orders for the facility. Orders marked confidential are masked or omitted for users lacking `RADIOLOGY_SPECIALIST_READ`.
- **Permission:** `RADIOLOGY_READ`

#### `GET /radiology/orders/:id`
Retrieves full details of a specific imaging order.
- **Security Guard:** If `order.isConfidentialSpecialist === true`, verifies user holds `RADIOLOGY_SPECIALIST_READ` permission. Returns `403 Forbidden` if missing.

---

### 3.2 Diagnostic Reports & PACS DICOM Linking

#### `POST /radiology/reports`
Submits and finalizes a diagnostic report authored by a radiologist.
- **Permission:** `RADIOLOGY_REPORT_WRITE`
- **Request Body:**
  ```json
  {
    "orderId": "9b18274a-1122-3344-5566-778899aabbcc",
    "findings": "Volumetric non-contrast CT of the brain demonstrates normal ventricular size and basal cisterns. No acute intracranial hemorrhage or mass effect.",
    "impression": "Normal non-contrast brain CT scan. No acute intracranial pathology.",
    "status": "FINAL",
    "pacsStudyInstanceUid": "1.2.840.113619.2.55.3.604688319.821.1729609200.101"
  }
  ```
- **Response `201 Created`:** Finalized diagnostic report with sequential reference (e.g. `RPT-202610-0001`). Order status transitions to `COMPLETED`.

#### `GET /radiology/reports/:id`
Reads a diagnostic imaging report. Enforces specialist confidentiality check if the underlying order was marked confidential.

#### `POST /radiology/reports/:id/amend`
Submits an addendum or amended interpretation to an already finalized report.
- **Permission:** `RADIOLOGY_REPORT_WRITE`
- **Audit Preservation:** Transitions report status to `AMENDED`, appends the amendment text and reason, and emits an immutable `RADIOLOGY_REPORT_AMENDED` event to the cryptographic audit trail.
- **Request Body:**
  ```json
  {
    "amendedFindings": "Addendum: Small 2mm subdural collection identified on high-window bone reformat in left frontal convexity.",
    "amendedImpression": "Minute traumatic subdural hygroma/hemorrhage left frontal; recommend repeat scan in 48h if symptoms persist.",
    "amendmentReason": "Detailed re-examination after clinical query from neurosurgical registrar."
  }
  ```
