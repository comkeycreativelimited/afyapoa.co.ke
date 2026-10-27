# COMKEY AFYA POA — Patient Registration & Identity Management API Specification

**Document Identifier:** `API-PATIENTS-2026-V1`  
**Base URL:** `/api/v1/patients`  
**Authentication:** HTTP Bearer JWT (`Authorization: Bearer <jwt_access_token>`)  
**Tenant Isolation:** Enforced via authenticated user session claims and PostgreSQL Row-Level Security (`current_setting('app.current_tenant_id')`).  
**Field Encryption:** Sensitive PII (National ID, Passport, Phone Number) encrypted at rest via AES-256-GCM. Searchable via HMAC-SHA256 blind indexing.

---

## 1. Overview & Regulatory Guarantees

The Patient Registration and Identity Management module exposes 12 RESTful endpoints designed to satisfy Kenyan statutory healthcare and data privacy frameworks:
1. **Kenya Data Protection Act 2019 (Sections 30 & 32):** Explicit consent capturing and revoking for general data processing and health information exchange.
2. **Kenya Data Protection Act 2019 (Section 41):** Immutable access trails logged on every patient record retrieval.
3. **Digital Health Act 2023 (Section 15):** Client Registry (CR) integration and National Unique Patient Identifier (UPI) resolution.
4. **Duplicate Prevention & Patient Safety:** Deterministic and probabilistic candidate matching preventing duplicate chart creation, with non-destructive reconciliation preserving historical MRNs.

---

## 2. Security & Access Control Matrix

| Endpoint | Method | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/patients` | `POST` | `PATIENT_CREATE` | Register new patient with demographics, consent & ID. |
| `/api/v1/patients` | `GET` | `PATIENT_READ` | Search patients with blind-index and partial matching. |
| `/api/v1/patients/check-duplicates` | `POST` | `PATIENT_READ` | Pre-flight duplicate candidate scoring. |
| `/api/v1/patients/emergency-intake` | `POST` | `PATIENT_CREATE` | Emergency trauma intake for unidentified individuals. |
| `/api/v1/patients/reconcile` | `POST` | `PATIENT_RECONCILE` | Safe non-destructive merge of duplicate records. |
| `/api/v1/patients/:id` | `GET` | `PATIENT_READ` | Retrieve patient details and log access trail. |
| `/api/v1/patients/:id` | `PATCH` | `PATIENT_UPDATE` | Update non-identifying demographic attributes. |
| `/api/v1/patients/:id/identifiers` | `POST` | `PATIENT_UPDATE` | Add and provenance-track a national identifier. |
| `/api/v1/patients/:id/verify-dha` | `POST` | `PATIENT_UPDATE` | Query DHA Client Registry and resolve national UPI. |
| `/api/v1/patients/:id/consents` | `POST` | `PATIENT_CONSENT_MANAGE` | Capture new statutory consent directive. |
| `/api/v1/patients/:id/consents/:consentId/revoke` | `POST` | `PATIENT_CONSENT_MANAGE` | Revoke active statutory consent directive. |
| `/api/v1/patients/:id/history` | `GET` | `PATIENT_READ` | Retrieve reconciliation history and access logs. |

---

## 3. Detailed Endpoint Reference

### 3.1 Register Patient
`POST /api/v1/patients`

Registers a patient within the tenant, normalizes Kenyan phone numbers (`+254XXXXXXXXX`), computes HMAC-SHA256 blind indexes, encrypts raw PII with AES-256-GCM, verifies duplicate constraints, and auto-generates a unique Medical Record Number (`MRN-YYYYMM-XXXX`).

#### Request Body (`CreatePatientDto`)
```json
{
  "facilityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "firstName": "Wanjiku",
  "middleName": "Grace",
  "lastName": "Kamau",
  "dateOfBirth": "1994-06-15",
  "isDobEstimated": false,
  "gender": "FEMALE",
  "phone": "+254712345678",
  "email": "wanjiku.kamau@example.co.ke",
  "bloodGroup": "O_POSITIVE",
  "county": "Nairobi",
  "subCounty": "Westlands",
  "ward": "Parklands/Highridge",
  "village": "Mpaka Road",
  "nationality": "KENYAN",
  "maritalStatus": "MARRIED",
  "emergencyContact": {
    "name": "David Kamau",
    "relationship": "SPOUSE",
    "phone": "+254722987654"
  },
  "identifiers": [
    {
      "system": "KENYA_NATIONAL_ID",
      "value": "28495012",
      "isPrimary": true,
      "issuingAuthority": "National Registration Bureau"
    }
  ],
  "consents": [
    {
      "consentType": "GENERAL_DATA_PROCESSING",
      "channel": "WRITTEN_FORM",
      "policyVersion": "KE-DPA-2019-V1"
    }
  ],
  "forceDuplicateOverride": false
}
```

#### Responses
- **`201 Created`**: Patient created successfully.
  ```json
  {
    "success": true,
    "data": {
      "id": "c1f7b8a2-9d8e-4a7b-8c1d-0e2f3a4b5c6d",
      "tenantId": "d0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a",
      "primaryFacilityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "mrn": "MRN-202610-0001",
      "firstName": "Wanjiku",
      "middleName": "Grace",
      "lastName": "Kamau",
      "dateOfBirth": "1994-06-15",
      "gender": "FEMALE",
      "bloodGroup": "O_POSITIVE",
      "phoneMasked": "+254 7XX XXX 678",
      "email": "wanjiku.kamau@example.co.ke",
      "county": "Nairobi",
      "status": "ACTIVE",
      "identityStatus": "LOCAL_ONLY",
      "createdAt": "2026-10-19T11:00:00.000Z"
    }
  }
  ```
- **`400 Bad Request`**: Validation failed (e.g., invalid Kenyan phone format or invalid National ID number).
- **`409 Conflict`**: Duplicate detected. Returns matching candidate details and match vectors:
  ```json
  {
    "success": false,
    "error": {
      "code": "DUPLICATE_PATIENT_DETECTED",
      "message": "Potential duplicate patient detected (Confidence: 85%).",
      "statusCode": 409,
      "details": {
        "candidate": {
          "id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
          "mrn": "MRN-202610-0042",
          "firstName": "Wanjiku",
          "lastName": "Kamau",
          "dateOfBirth": "1994-06-15",
          "gender": "FEMALE",
          "phoneMasked": "+254 7XX XXX 678"
        },
        "score": 0.85,
        "matchReasons": ["EXACT_DOB", "SAME_GENDER", "MATCHING_PHONE"]
      }
    }
  }
  ```

---

### 3.2 Pre-Flight Duplicate Check
`POST /api/v1/patients/check-duplicates`

Allows front-desk staff to score demographic candidates against existing tenant records prior to submitting registration.

#### Request Body (`DuplicateCheckDto`)
```json
{
  "firstName": "Wanjiku",
  "lastName": "Kamau",
  "dateOfBirth": "1994-06-15",
  "gender": "FEMALE",
  "phone": "+254712345678",
  "nationalId": "28495012"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "isDuplicateSuspected": true,
    "highestScore": 0.85,
    "candidates": [
      {
        "patient": {
          "id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
          "mrn": "MRN-202610-0042",
          "firstName": "Wanjiku",
          "lastName": "Kamau",
          "dateOfBirth": "1994-06-15",
          "gender": "FEMALE",
          "phoneMasked": "+254 7XX XXX 678"
        },
        "score": 0.85,
        "matchReasons": ["EXACT_DOB", "SAME_GENDER", "MATCHING_PHONE"]
      }
    ]
  }
}
```

---

### 3.3 Patient Search
`GET /api/v1/patients`

Executes high-performance tenant-isolated patient search with support for exact blind-index lookups and partial demographic matching.

#### Query Parameters (`PatientSearchQueryDto`)
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `q` | `string` | Partial search against first name, last name, or MRN. |
| `mrn` | `string` | Exact Medical Record Number lookup. |
| `nationalId` | `string` | Exact match via HMAC-SHA256 blind index. |
| `phone` | `string` | Exact match via HMAC-SHA256 blind index on normalized phone. |
| `upi` | `string` | National Unique Patient Identifier match. |
| `shaNumber` | `string` | Social Health Authority member number match. |
| `identityStatus`| `string` | Filter by `LOCAL_ONLY`, `VERIFIED_EXTERNAL`, `RECONCILED`. |
| `facilityId` | `UUID` | Filter by primary facility ID. |
| `page` | `integer` | Page index (Default: `1`). |
| `limit` | `integer` | Page size (Default: `20`, Max: `100`). |

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f7b8a2-9d8e-4a7b-8c1d-0e2f3a4b5c6d",
      "mrn": "MRN-202610-0001",
      "firstName": "Wanjiku",
      "lastName": "Kamau",
      "dateOfBirth": "1994-06-15",
      "gender": "FEMALE",
      "phoneMasked": "+254 7XX XXX 678",
      "status": "ACTIVE",
      "identityStatus": "VERIFIED_EXTERNAL",
      "upi": "KE-UPI-2026-90412",
      "dhaCrid": "CR-904128"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

### 3.4 Emergency Trauma Intake
`POST /api/v1/patients/emergency-intake`

Rapid intake workflow for unconscious or unidentified trauma patients. Automatically sets `isEmergencyUnknown: true`, generates alias `UNKNOWN-GENDER-XXXXX`, estimates current year of birth, and captures presenting circumstances.

#### Request Body (`EmergencyIntakeDto`)
```json
{
  "facilityId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "gender": "MALE",
  "estimatedAge": 30,
  "apparentConsciousness": "UNCONSCIOUS",
  "broughtInBy": "E-Plus Ambulance Service",
  "triageNotes": "MVA victim with severe head trauma, non-responsive.",
  "physicalDescription": "Approx 175cm, dark jacket, scar on left forearm."
}
```

#### Response (`201 Created`)
Returns patient record with `firstName: "UNKNOWN"`, `lastName: "MALE-84920"`, `isEmergencyUnknown: true`, and temporary MRN.

---

### 3.5 Safe Non-Destructive Reconciliation
`POST /api/v1/patients/reconcile`

Safely reconciles two confirmed duplicate patient records without hard deletion. The source record's status becomes `MERGED` with `reconciledIntoPatientId` referencing the target survivor record. The target record's status becomes `RECONCILED`. All encounters and identifiers remain linked to their respective records. Requires `PATIENT_RECONCILE` permission.

#### Request Body (`ReconcilePatientDto`)
```json
{
  "sourcePatientId": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
  "targetPatientId": "c1f7b8a2-9d8e-4a7b-8c1d-0e2f3a4b5c6d",
  "reason": "Duplicate registration discovered during national ID verification.",
  "confidenceScore": "0.95"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "sourcePatientId": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
    "targetPatientId": "c1f7b8a2-9d8e-4a7b-8c1d-0e2f3a4b5c6d",
    "status": "CONFIRMED_MERGED",
    "reconciledAt": "2026-10-19T11:30:00.000Z"
  }
}
```

---

### 3.6 Query DHA Client Registry (UPI Resolution)
`POST /api/v1/patients/:id/verify-dha`

Calls the national Digital Health Agency Client Registry adapter using the patient's registered primary identifier (National ID or Passport). If identified, binds the canonical `dhaCrid` and `upi`, updating `identityStatus` from `LOCAL_ONLY` to `VERIFIED_EXTERNAL`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "status": "FOUND",
    "crId": "CR-00294812",
    "upi": "KE-UPI-2026-00294812",
    "identificationType": "national_id",
    "identificationNumber": "28495012",
    "shaNumber": "SHA-902148"
  }
}
```

---

### 3.7 Capture & Revoke Statutory Consent
- `POST /api/v1/patients/:id/consents`: Creates an explicit consent directive under Kenya DPA 2019.
- `POST /api/v1/patients/:id/consents/:consentId/revoke`: Revokes an active consent with mandatory `revocationReason`.

---

## 4. Error Codes & Handling

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `PATIENT_NOT_FOUND` | 404 Not Found | Patient UUID does not exist within the tenant. |
| `DUPLICATE_IDENTIFIER` | 409 Conflict | Primary identifier (National ID) already registered in tenant. |
| `DUPLICATE_PATIENT_DETECTED` | 409 Conflict | Probabilistic match score $\ge 0.70$. |
| `INVALID_PHONE_NUMBER` | 400 Bad Request | Phone is not a valid 9-to-12 digit Kenyan mobile number. |
| `INVALID_IDENTIFIER` | 400 Bad Request | National ID is not a valid 6-to-9 digit integer. |
| `UNAUTHORIZED_ACCESS` | 401 Unauthorized | Bearer token missing, invalid, or expired. |
| `FORBIDDEN` | 403 Forbidden | User lacks permission (e.g. attempting merge without `PATIENT_RECONCILE`). |
| `CLIENT_REGISTRY_ERROR`| 502 Bad Gateway | National DHA Client Registry failed or timed out. |
