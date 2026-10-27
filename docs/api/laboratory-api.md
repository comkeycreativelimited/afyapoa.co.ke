# COMKEY AFYA POA — Laboratory Information Module API Specification

**Document Identifier:** `API-SPEC-LAB-2026-V1`  
**Base URL:** `http://localhost:4000/api/laboratory`  
**Security & Governance:** JWT Bearer Token, Tenant Isolation via PostgreSQL Row-Level Security (`app.current_tenant_id`), Role-Based Access Control (RBAC), ISO 15189 / KMLTTB / Kenya MOH Standards.  
**Standard Coding Systems:** LOINC v2.76, SNOMED CT, WHO Guidelines on Diagnostic Reference Ranges.  
**Two-Tier Authorization Governance:** Technologists enter analytical results; only Pathologists and authorized Clinicians can verify, authorize, or sign diagnostic reports.

---

## 1. Overview of Endpoints

| HTTP Method | Route | Permission Required | Summary |
| :--- | :--- | :--- | :--- |
| `POST` | `/seed` | `LAB_ADMIN` | Seed standard Kenya MOH lab test catalog, reference ranges, and consumables idempotently. |
| `GET` | `/catalog` | `LAB_READ` | Search and list active lab test catalog items and reference ranges. |
| `POST` | `/specimens/collect` | `LAB_ORDER_EXECUTE` | Collect specimen, generate accession number (`ACC-YYYYMM-XXXXX`) and barcode, decrement inventory. |
| `PATCH` | `/specimens/:id/receive` | `LAB_ORDER_EXECUTE` | Acknowledge physical receipt of specimen in the laboratory bench. |
| `POST` | `/specimens/:id/reject` | `LAB_REJECT` | Reject specimen due to pre-analytical errors (ISO 15189) with optional recollection order. |
| `GET` | `/worklist` | `LAB_READ` | Retrieve departmental bench worklists filtered by status and department. |
| `POST` | `/results` | `LAB_WRITE` | Enter analytical test result with automated abnormal and critical threshold evaluation. |
| `PATCH` | `/results/:id/verify` | `LAB_RESULT_AUTHORIZE` | Supervisor/Pathologist analytical verification with cryptographic signature. |
| `POST` | `/results/:id/correct` | `LAB_WRITE` | Correct an analytical result with mandatory justification ($\ge 10$ chars), preserving prior history. |
| `GET` | `/results/order/:orderId` | `LAB_READ` | Retrieve all analytical results linked to a clinical order. |
| `POST` | `/reports` | `LAB_WRITE` | Compile diagnostic report linking encounter, order, and analytical results. |
| `PATCH` | `/reports/:id/authorize`| `LAB_RESULT_AUTHORIZE` | Authorize diagnostic report, sign with digital signature, transition clinical order to COMPLETED. |
| `POST` | `/reports/:id/amend` | `LAB_RESULT_AUTHORIZE` | Amend a finalized diagnostic report with clinical audit justification ($\ge 10$ chars). |
| `GET` | `/metrics/operational` | `LAB_READ` | Retrieve turnaround times (TAT) across 4 milestones, abnormal distribution, and inventory alerts. |
| `GET` | `/consumables` | `LAB_READ` | List laboratory consumables, stock on hand, and reorder alerts. |
| `POST` | `/consumables/deduct` | `LAB_WRITE` | Manually or automatically deduct consumable units with audit tracking. |
| `GET` | `/fhir/specimens/:id` | `LAB_READ` | Export specimen conforming to Kenya Core Specimen FHIR R4 profile. |
| `GET` | `/fhir/observations/:id`| `LAB_READ` | Export result conforming to Kenya Core Observation FHIR R4 profile. |
| `GET` | `/fhir/diagnostic-reports/:id` | `LAB_READ` | Export report conforming to Kenya Core DiagnosticReport FHIR R4 profile. |

---

## 2. Detailed Endpoint Specifications

### 2.1 Catalogue Management & Seeding

#### `POST /seed`
*Seeds Kenya MOH standard laboratory test catalogue (Hemoglobin 718-7, WBC 6690-2, Creatinine 2160-0, Glucose 2345-7, Malaria Ag 57021-8, Urinalysis 24357-6, Lipid Cholesterol 2093-3) with explicit WHO reference range versions and standard consumables.*

- **Headers:** `Authorization: Bearer <Admin_JWT>`
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "success": true,
    "testsInserted": 7,
    "consumablesInserted": 6
  }
}
```

#### `GET /catalog`
*Query active laboratory tests with reference ranges, departments, and LOINC codes.*

- **Query Parameters:**
  - `department` (optional): `HEMATOLOGY`, `CLINICAL_CHEMISTRY`, `PARASITOLOGY`, `MICROBIOLOGY`, `URINALYSIS`.
  - `search` (optional): Filter by test name or LOINC code.
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "7a355f3a-bf41-471a-8bb7-d86bceca2a91",
      "testCode": "718-7",
      "codingSystem": "LOINC",
      "testName": "Hemoglobin (Blood)",
      "department": "HEMATOLOGY",
      "specimenType": "WHOLE_BLOOD",
      "suggestedContainer": "EDTA_TUBE_LAVENDER",
      "targetTatMinutes": 45,
      "referenceRanges": [
        {
          "gender": "MALE",
          "lowNumeric": "13.0000",
          "highNumeric": "18.0000",
          "criticalLowNumeric": "7.0000",
          "criticalHighNumeric": null,
          "unit": "g/dL",
          "source": "WHO Guidelines on Hemoglobin Concentrations 2024",
          "sourceVersion": "v3.2.1"
        }
      ]
    }
  ]
}
```

---

### 2.2 Specimen Accessioning & Quality Management

#### `POST /specimens/collect`
*Acknowledge specimen draw, generate accession number and barcode, and automatically deduct consumable tubes.*

- **Request Body:**
```json
{
  "orderId": "198193b3-9b0d-45fb-8079-0eafc2e72a31",
  "patientId": "43a4ecaf-c7f8-4e6e-b652-2083c24f3a93",
  "specimenType": "WHOLE_BLOOD",
  "containerType": "EDTA_TUBE_LAVENDER",
  "volumeMl": 4.0,
  "collectionSite": "Left antecubital fossa",
  "notes": "Smooth draw, non-traumatic puncture"
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "specimen": {
      "id": "58e11832-4a84-43aa-acdf-9b0eb3cc4380",
      "accessionNumber": "ACC-202610-00041",
      "barcode": "BC-202610-00041",
      "status": "COLLECTED",
      "collectedAt": "2026-10-20T02:48:53.882Z"
    },
    "consumableDeduction": {
      "itemCode": "VAC-EDTA-LAV",
      "quantityDeducted": 1,
      "newQuantityOnHand": 41
    }
  }
}
```

#### `POST /specimens/:id/reject`
*Reject a specimen due to pre-analytical errors (ISO 15189) and trigger automatic recollection order.*

- **Request Body:**
```json
{
  "rejectionReason": "HEMOLYZED",
  "rejectionNotes": "Gross 4+ hemolysis visible on plasma separation",
  "recollectionRequired": true
}
```
- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "rejectedSpecimen": {
      "id": "d6621ddf-b032-48e8-b369-1b81f2d29c18",
      "status": "REJECTED",
      "rejectionReason": "HEMOLYZED"
    },
    "recollectionSpecimen": {
      "id": "4cb10e71-9cb1-4fa2-bf42-990a1f2b4c11",
      "accessionNumber": "ACC-202610-00042-R",
      "barcode": "BC-202610-00042-R",
      "status": "PENDING_COLLECTION"
    }
  }
}
```

---

### 2.3 Result Entry, Auto-Flagging & Two-Tier Review

#### `POST /results`
*Enter analytical findings. Evaluates abnormal indicator without inventing thresholds.*

- **Request Body:**
```json
{
  "specimenId": "58e11832-4a84-43aa-acdf-9b0eb3cc4380",
  "orderId": "198193b3-9b0d-45fb-8079-0eafc2e72a31",
  "testCatalogId": "7a355f3a-bf41-471a-8bb7-d86bceca2a91",
  "numericValue": 6.2,
  "unit": "g/dL",
  "notes": "Rerun on Sysmex XN-550 confirms severe microcytic anemia"
}
```
- **Response (201 Created):**
```json
{
  "statusCode": 201,
  "data": {
    "id": "814b1f1b-7ffa-4258-83b4-a22ee6773c02",
    "testCode": "718-7",
    "testName": "Hemoglobin (Blood)",
    "numericValue": "6.2000",
    "unit": "g/dL",
    "abnormalFlag": "CRITICAL_LOW",
    "status": "PRELIMINARY",
    "referenceSource": "WHO Guidelines on Hemoglobin Concentrations 2024",
    "referenceSourceVersion": "v3.2.1"
  }
}
```

#### `PATCH /results/:id/verify`
*Authorized Pathologist verification.*

- **Request Body:**
```json
{
  "status": "VERIFIED",
  "verifierRole": "SENIOR_CLINICIAN_PATHOLOGIST",
  "verificationSignature": "SIG-ECDSA-VERIFY-DR-OTIENO-2026",
  "notes": "Correlated with severe pallor and microcytosis"
}
```

#### `POST /results/:id/correct`
*Correct a result with immutable history.*

- **Request Body:**
```json
{
  "numericValue": 6.6,
  "correctionReason": "Analyzer micro-cuvette recalibration adjustment confirmed on rerun"
}
```

---

### 2.4 Diagnostic Reports & Clinician Delivery

#### `POST /reports`
*Compile diagnostic report linking results.*

- **Request Body:**
```json
{
  "orderId": "198193b3-9b0d-45fb-8079-0eafc2e72a31",
  "encounterId": "0838035f-11ff-4e56-9143-43b3b37ababc",
  "patientId": "43a4ecaf-c7f8-4e6e-b652-2083c24f3a93",
  "title": "Complete Hematology & Malaria Rapid Diagnostic Panel",
  "conclusion": "Severe microcytic anemia with active Plasmodium falciparum malaria infection",
  "resultIds": ["814b1f1b-7ffa-4258-83b4-a22ee6773c02"]
}
```

#### `PATCH /reports/:id/authorize`
*Pathologist final authorization; marks order as `COMPLETED`.*

- **Request Body:**
```json
{
  "authorizationSignature": "SIG-PATHOLOGIST-FINAL-SIGN-OFF-2026",
  "conclusion": "Severe anemia secondary to falciparum malaria. Immediate IV artesunate and transfusion recommended."
}
```

---

### 2.5 Operational Quality & Turnaround Time (TAT)

#### `GET /metrics/operational`
*Retrieve quality indicators and turnaround times across 4 clinical milestones.*

- **Response (200 OK):**
```json
{
  "statusCode": 200,
  "data": {
    "specimensTotal": 142,
    "specimensCompleted": 138,
    "specimensRejected": 4,
    "reportsFinalized": 136,
    "tatAverages": {
      "averageOrderToCollectionMinutes": 14,
      "averageCollectionToReceiptMinutes": 9,
      "averageReceiptToResultMinutes": 21,
      "averageResultToAuthorizationMinutes": 11,
      "averageTotalTatMinutes": 55
    },
    "abnormalDistribution": {
      "NORMAL": 98,
      "ABNORMAL": 18,
      "LOW": 11,
      "HIGH": 8,
      "CRITICAL_LOW": 5,
      "CRITICAL_HIGH": 2
    },
    "inventory": {
      "totalConsumables": 18,
      "lowStockCount": 2,
      "lowStockAlerts": [
        {
          "itemCode": "VAC-EDTA-LAV",
          "name": "BD Vacutainer K2 EDTA 4.0mL",
          "quantityOnHand": 41,
          "reorderLevel": 50,
          "unitOfMeasure": "tubes"
        }
      ]
    }
  }
}
```

---

### 2.6 External Device & Analyzer Interface Architecture

Under ISO 15189 Clause 5.3, automated laboratory analyzers interface through dedicated middleware to maintain specimen chain of custody and instrument calibration integrity:

1. **Physical / Network Layer:**
   - TCP/IP sockets over dedicated Laboratory VLAN (10.20.0.0/24) isolated from general hospital WiFi.
   - RS-232 serial interfaces via Ethernet terminal servers for legacy instrumentation.
2. **Protocol Standards:**
   - **ASTM E1381 / E1394:** Standard communication protocol for automated hematology (e.g. Sysmex XN series) and clinical chemistry analyzers (e.g. Roche Cobas, Beckman Coulter).
   - **HL7 v2.5.1 LRI (Laboratory Results Interface):** Bidirectional messaging using `OML^O21` (Lab Order) and `ORU^R01` (Unsolicited Observation Result).
3. **Safety & Quality Gateways:**
   - In absence of verified physical device specifications, analyzer results are received into an isolated staging buffer where technologist verification (`LAB_WRITE`) is mandatory before pathologist clinical review (`LAB_RESULT_AUTHORIZE`).
