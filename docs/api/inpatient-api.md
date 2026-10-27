# COMKEY AFYA POA — Inpatient ADT, Ward & Bed Management API Documentation

## 1. Overview & Statutory Foundation

The **Inpatient Admission, Discharge, and Transfer (ADT) and Ward/Bed Management Subsystem** implements hospital inpatient workflows grounded in:
1. **Kenya Health Act 2017 (Cap 241) Section 15** governing hospital admissions, inpatient clinical care, and patient rights.
2. **KMPDC Facility Norms and Standards (Levels 4–6)** for acute care wards, intensive care units (ICU/HDU), pediatric wards, and maternity wards.
3. **Optimistic Version Locking & Concurrency Control:** Every bed record contains a sequential `version` integer. All bed state transitions (`VACANT` -> `OCCUPIED` -> `CLEANING` -> `VACANT`) and patient admissions execute within database transactions with concurrency checks to strictly eliminate double-allocation collisions.
4. **State Machine Integrity:** Preserves distinct operational states: `ADMITTED`, `TRANSFERRED`, `DISCHARGED`, and `CANCELLED`.
5. **Multi-Tenant Row-Level Security (RLS):** All queries and mutations are isolated by PostgreSQL RLS with `app.current_tenant_id`.

---

## 2. Authentication & Authorization

All requests require a valid JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
```

### Required Permissions:
- `INPATIENT_READ`: View wards, beds, admissions, bed transfers, and occupancy maps.
- `INPATIENT_ADMIT`: Authorize and execute inpatient admissions.
- `INPATIENT_TRANSFER`: Execute inter-ward or intra-ward bed transfers.
- `INPATIENT_DISCHARGE`: Execute inpatient discharges with mandatory discharge disposition and final diagnosis.
- `INPATIENT_CANCEL`: Void/cancel erroneous admissions with mandatory clinical justification.

---

## 3. Endpoints Specification

### 3.1 Ward & Bed Administration

#### `POST /inpatient/wards`
Configures a new hospital ward.
- **Permission:** `HOSPITAL_ADMIN`, `DOCTOR`
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "code": "WRD-MED-01",
    "name": "General Medical Ward",
    "genderRestriction": "ANY",
    "specialty": "INTERNAL_MEDICINE",
    "floorLocation": "2nd Floor, Wing B",
    "totalBeds": 0
  }
  ```
- **Response `201 Created`:** Returns created ward object.

#### `GET /inpatient/wards`
Retrieves wards with running occupancy metrics (`totalBeds`, `occupiedBeds`, `vacantBeds`, `cleaningBeds`).
- **Permission:** `INPATIENT_READ`
- **Query Parameters:** `facilityId` (optional)

#### `POST /inpatient/beds`
Provisions an inpatient bed station inside a ward.
- **Permission:** `HOSPITAL_ADMIN`
- **Request Body:**
  ```json
  {
    "wardId": "e1f13b65-6e21-4f12-a164-c2c8f8d22391",
    "bedNumber": "BED-101",
    "bedType": "STANDARD",
    "dailyRate": "2500.00"
  }
  ```
- **Response `201 Created`:** Bed record with initial status `VACANT` and `version: 1`.

#### `GET /inpatient/wards/:wardId/beds`
Lists all beds in a ward with status, type, rate, and version.
- **Permission:** `INPATIENT_READ`

#### `PATCH /inpatient/beds/:id/status`
Updates bed status (e.g., from `CLEANING` to `VACANT` after terminal decontamination).
- **Request Body:**
  ```json
  {
    "status": "VACANT",
    "expectedVersion": 1
  }
  ```

---

### 3.2 Inpatient Admission Lifecycle

#### `POST /inpatient/admissions`
Admits a patient to an allocated bed station.
- **Permission:** `INPATIENT_ADMIT`
- **Concurrency Guard:** Verifies that target bed status is `VACANT`. Locks bed, increments `version`, and marks status `OCCUPIED`. Returns `409 Conflict` if bed is already occupied or version changed.
- **Request Body:**
  ```json
  {
    "facilityId": "4c77f3f5-39ea-486f-97d7-c4583adcbcb9",
    "patientId": "b6a718c9-94b1-4f12-8761-d70cb99a1f22",
    "wardId": "e1f13b65-6e21-4f12-a164-c2c8f8d22391",
    "bedId": "73d8b1ca-5541-456c-8e43-851cb99a4c11",
    "admissionType": "EMERGENCY",
    "provisionalDiagnosis": "Acute severe malaria with cerebral complications",
    "admissionDiagnosisIcd11": "1F40",
    "admissionDiagnosisTitle": "Severe malaria",
    "admittingDoctorId": "d8226227-54f9-4525-b4a7-977e232e0a92"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "ad9f8841-8971-45c1-90a2-1cbffc3d9021",
      "admissionNumber": "ADM-202610-0001",
      "status": "ADMITTED",
      "admissionDate": "2026-10-22T15:03:33.120Z",
      "currentBedId": "73d8b1ca-5541-456c-8e43-851cb99a4c11"
    }
  }
  ```

#### `POST /inpatient/admissions/:id/transfer`
Atomically relocates an active inpatient to a new bed or ward.
- **Permission:** `INPATIENT_TRANSFER`
- **Transactional Invariant:** Sets source bed to `CLEANING`, target bed to `OCCUPIED`, and appends an immutable transfer ledger record to `inpatient_bed_transfers`.
- **Request Body:**
  ```json
  {
    "toWardId": "e1f13b65-6e21-4f12-a164-c2c8f8d22391",
    "toBedId": "84c9d2ea-6652-467d-9f54-962dc00b5d22",
    "reason": "Step-down from HDU to general ward post-stabilization"
  }
  ```

#### `POST /inpatient/admissions/:id/discharge`
Finalizes an inpatient admission, authorizes clinical discharge, and releases the bed.
- **Permission:** `INPATIENT_DISCHARGE`
- **Mandatory Requirements:** Requires `dischargeDisposition` (`HOME_IMPROVED`, `TRANSFERRED_OUT`, `AGAINST_MEDICAL_ADVICE`, `DECEASED`, `REFERRED`), `finalDiagnosisIcd11`, and `finalDiagnosisTitle`. Bed status transitions to `VACANT` (or `CLEANING`).
- **Request Body:**
  ```json
  {
    "dischargeDisposition": "HOME_IMPROVED",
    "finalDiagnosisIcd11": "1F40",
    "finalDiagnosisTitle": "Plasmodium falciparum malaria without complications, recovered",
    "dischargeSummaryNotes": "Patient afebrile for 48 hours, oral feeding tolerated, discharge on oral ACT."
  }
  ```

#### `POST /inpatient/admissions/:id/cancel`
Cancels an admission entered in error.
- **Permission:** `INPATIENT_CANCEL`
- **Request Body:**
  ```json
  {
    "cancellationReason": "Patient refused admission, opted for outpatient management at clinic."
  }
  ```
