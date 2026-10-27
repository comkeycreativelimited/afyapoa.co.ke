# COMKEY AFYA POA - Clinical Terminology & CPOE Orders API Reference

This document provides the formal REST API contract for Clinical Terminology Management and Computerized Provider Order Entry (CPOE) in **COMKEY AFYA POA**, developed under Kenya Ministry of Health Digital Health Standards, WHO ICD-11 MMS, LOINC v2.76, and Kenya Essential Medicines List (KEML 2023) / WHO ATC.

---

## 1. Governance & Clinical Safety Boundary

> [!IMPORTANT]
> **Clinical Safety & Human Clinician Primacy**:
> 1. **Zero Invented Terminology**: All diagnosis codes and order concepts are strictly validated against active, authorized terminology catalogues. Arbitrary free-text codes or silent substitutions are strictly rejected with HTTP 400.
> 2. **Order Separation of Concerns**: Clinical orders represent clinician ordering intent and are strictly isolated from execution, pharmacy dispensing (`MedicationDispense`), and laboratory result observations (`Observation` / `DiagnosticReport`).
> 3. **No Autonomous Prescribing**: Algorithmic or automated prescribing without clinician review is prohibited. All orders require explicit practitioner attribution.
> 4. **Duplicate Prevention Guard**: Placing a duplicate medication or diagnostic request for the same patient within a 24-hour window returns HTTP 409 Conflict unless accompanied by a mandatory clinician override justification ($\ge 10$ characters).

---

## 2. Terminology Catalogues API

### 2.1 List Terminology Catalogues
- **Endpoint**: `GET /api/v1/terminology/catalogues`
- **Permissions**: `TERMINOLOGY_READ`
- **Query Parameters**:
  - `system`: Filter by `ICD_11_MMS`, `ICD_10`, `LOINC_2_76`, `KEML_2023`, `SNOMED_CT`
  - `status`: Filter by `ACTIVE`, `SUPERSEDED`, `RETIRED`
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "e917d848-1854-46c2-bf72-132d73f47e2a",
      "codingSystem": "ICD_11_MMS",
      "name": "WHO International Classification of Diseases 11th Revision (MMS)",
      "version": "2024-01",
      "uri": "http://id.who.int/icd11/mms",
      "publisher": "World Health Organization",
      "effectiveDate": "2024-01-01",
      "status": "ACTIVE",
      "isAuthorized": true,
      "conceptCount": 6
    }
  ]
}
```

### 2.2 Search Concepts
- **Endpoint**: `GET /api/v1/terminology/concepts/search`
- **Permissions**: `TERMINOLOGY_READ`
- **Query Parameters**:
  - `system`: Required coding system
  - `q`: Search term (code or display prefix)
  - `limit`: Max results (default: 20)
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "31b1c7dc-d4f1-4db5-b827-04875638bb39",
      "codingSystem": "ICD_11_MMS",
      "code": "BA00",
      "display": "Essential hypertension",
      "definition": "High blood pressure without identifiable secondary cause",
      "isLeaf": true,
      "isActive": true
    }
  ]
}
```

### 2.3 Validate Terminology Code
- **Endpoint**: `POST /api/v1/terminology/concepts/validate`
- **Permissions**: `TERMINOLOGY_READ`
- **Request Body**:
```json
{
  "codingSystem": "ICD_11_MMS",
  "code": "BA00"
}
```
- **Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "valid": true,
    "concept": {
      "code": "BA00",
      "display": "Essential hypertension",
      "codingSystem": "ICD_11_MMS",
      "isActive": true
    }
  }
}
```

### 2.4 Import Versioned Catalogue
- **Endpoint**: `POST /api/v1/terminology/catalogues/import`
- **Permissions**: `TERMINOLOGY_MANAGE` (Superadmin / MOH Informatics)
- **Request Body**:
```json
{
  "codingSystem": "LOINC_2_76",
  "name": "LOINC Diagnostic Observations v2.76",
  "version": "2.76",
  "uri": "http://loinc.org",
  "publisher": "Regenstrief Institute",
  "effectiveDate": "2024-01-01",
  "concepts": [
    {
      "code": "2160-0",
      "display": "Creatinine in serum/plasma",
      "isLeaf": true,
      "properties": { "specimen": "SERUM", "scale": "Qn" }
    }
  ]
}
```
- **Response**: `201 Created`

---

## 3. Diagnoses Entry & Management API

### 3.1 Record Encounter Diagnosis
- **Endpoint**: `POST /api/v1/orders/diagnoses`
- **Permissions**: `DIAGNOSIS_WRITE`
- **Request Body**:
```json
{
  "encounterId": "5fbe9182-5953-4bf0-a292-132d73f47e2a",
  "codingSystem": "ICD_11_MMS",
  "code": "BA00",
  "display": "Essential hypertension",
  "diagnosisType": "CONFIRMED",
  "clinicalStatus": "ACTIVE",
  "verificationStatus": "CONFIRMED",
  "certainty": "CONFIRMED",
  "isPrimary": true,
  "notes": "BP consistently elevated across two visits: 154/98 mmHg."
}
```
- **Response**: `201 Created`
- **Errors**:
  - `400 Bad Request`: If code does not exist in authorized catalogue.
  - `409 Conflict`: If diagnosis code has already been recorded for this encounter.

### 3.2 List Encounter Diagnoses
- **Endpoint**: `GET /api/v1/orders/encounters/:encounterId/diagnoses`
- **Permissions**: `DIAGNOSIS_READ`
- **Response**: `200 OK`

### 3.3 Update Diagnosis Status
- **Endpoint**: `PUT /api/v1/orders/diagnoses/:id/status`
- **Permissions**: `DIAGNOSIS_WRITE`
- **Request Body**:
```json
{
  "clinicalStatus": "RESOLVED",
  "verificationStatus": "CONFIRMED",
  "notes": "Patient completed course of treatment. Vitals normal."
}
```
- **Response**: `200 OK`

### 3.4 Export FHIR R4 Condition
- **Endpoint**: `GET /api/v1/orders/diagnoses/:id/fhir`
- **Permissions**: `DIAGNOSIS_READ`
- **Response**: `200 OK` (Standard FHIR R4 Condition with Kenya Core profile).

---

## 4. Computerized Provider Order Entry (CPOE) API

### 4.1 Create Medication Request
- **Endpoint**: `POST /api/v1/orders/medications`
- **Permissions**: `CLINICAL_ORDER_WRITE`
- **Request Body**:
```json
{
  "encounterId": "5fbe9182-5953-4bf0-a292-132d73f47e2a",
  "priority": "ROUTINE",
  "clinicalIndication": "Essential hypertension stage 2",
  "medicationCode": "C09AA02",
  "medicationName": "Enalapril maleate 10mg tablet",
  "codingSystem": "KEML_2023",
  "dosage": "10mg",
  "dosageUnit": "mg",
  "route": "ORAL",
  "frequency": "OD",
  "duration": 30,
  "durationUnit": "DAYS",
  "quantity": 30,
  "quantityUnit": "TABLETS",
  "instructions": "Take once daily in the morning with a full glass of water.",
  "substitutionAllowed": true
}
```
- **Response**: `201 Created`
- **Duplicate Protection**:
  - If identical medication is ordered within 24 hours, returns `409 Conflict`:
```json
{
  "statusCode": 409,
  "message": "Potential accidental duplicate order detected for Enalapril maleate 10mg tablet (C09AA02) within 24 hours. Clinician override justification required."
}
```
  - To override, supply `duplicateOverrideJustification` ($\ge 10$ chars):
```json
{
  "duplicateOverrideJustification": "Intentional dose titration from 5mg to 10mg daily as per treatment protocol."
}
```

### 4.2 Create Diagnostic Service Request (Lab / Radiology)
- **Endpoint**: `POST /api/v1/orders/services`
- **Permissions**: `CLINICAL_ORDER_WRITE`
- **Request Body**:
```json
{
  "encounterId": "5fbe9182-5953-4bf0-a292-132d73f47e2a",
  "orderType": "LAB_SERVICE_REQUEST",
  "priority": "ROUTINE",
  "clinicalIndication": "Baseline renal function prior to ACEi initiation",
  "serviceCode": "2160-0",
  "serviceName": "Creatinine in serum/plasma",
  "codingSystem": "LOINC_2_76",
  "category": "LABORATORY",
  "specimenType": "SERUM",
  "clinicalNotes": "Check eGFR and potassium."
}
```
- **Response**: `201 Created`

### 4.3 Review & Authorize Order
- **Endpoint**: `POST /api/v1/orders/:id/authorize`
- **Permissions**: `CLINICAL_ORDER_AUTHORIZE`
- **Request Body**:
```json
{
  "authorizationSignature": "SIG-DR-OTIENO-7F4B21A"
}
```
- **Response**: `200 OK` (Order status transitions from `ACTIVE` or `DRAFT` to `AUTHORIZED`).

### 4.4 Cancel Clinical Order
- **Endpoint**: `POST /api/v1/orders/:id/cancel`
- **Permissions**: `CLINICAL_ORDER_CANCEL`
- **Request Body**:
```json
{
  "reason": "Patient developed mild urticaria; switching antihypertensive class to ARB."
}
```
- **Validation**: `reason` must be at least 10 characters long.
- **Response**: `200 OK` (Order status transitions to `CANCELLED`).

### 4.5 Amend Clinical Order
- **Endpoint**: `POST /api/v1/orders/:id/amend`
- **Permissions**: `CLINICAL_ORDER_WRITE`
- **Request Body**:
```json
{
  "reason": "Dose titrated downwards to 5mg due to orthostatic lightheadedness.",
  "revisedOrderPayload": {
    "priority": "ROUTINE",
    "clinicalIndication": "Titrated dose",
    "medicationCode": "C09AA02",
    "medicationName": "Enalapril maleate 10mg tablet",
    "codingSystem": "KEML_2023",
    "dosage": "5mg",
    "route": "ORAL",
    "frequency": "OD",
    "duration": 30,
    "quantity": 30
  }
}
```
- **Response**: `200 OK` (Original order marked `AMENDED` with `superseded_by_order_id` pointing to newly created replacement order).

### 4.6 Export FHIR R4 Order
- **Endpoint**: `GET /api/v1/orders/:id/fhir`
- **Permissions**: `CLINICAL_ORDER_READ`
- **Response**: `200 OK` (`MedicationRequest` or `ServiceRequest` JSON resource conforming to Kenya MOH FHIR profiles).
