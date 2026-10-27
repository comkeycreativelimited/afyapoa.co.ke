# COMKEY AFYA POA — Reception, Encounter, Triage & Clinical Documentation API Specification

**Document Identifier:** `API-ENCOUNTERS-2026-V1`  
**Base URL:** `/api/v1/encounters`  
**Authentication:** HTTP Bearer JWT (`Authorization: Bearer <jwt_access_token>`)  
**Tenant Isolation:** Enforced via authenticated user session claims and PostgreSQL Row-Level Security (`current_setting('app.current_tenant_id')`).  
**Clinical Immutability:** Finalized clinical notes cannot be mutated in place; amendments require dedicated addendum records with full provenance.

---

## 1. Overview & Regulatory Guarantees

The Reception, Encounter, Triage, and Outpatient Clinical Documentation module exposes RESTful endpoints supporting:
1. **Patient Queue & Encounter Registration:** Registration of walk-in and appointment encounters with Kenyan department classifications and priority ranking.
2. **Standardized Triage & Physiological Measurements:** Observation capture using standard Kenyan medical units (mmHg, bpm, breaths/min, °C, %, kg, cm, kg/m², mmol/L), AVPU scale, and automatic BMI computation.
3. **Structured Clinical Notes (SOAP, H&P, Consultation):** Author attribution, effective vs. entry timestamps, and draft iteration.
4. **Digital Signature & Immutability:** Finalization with SHA-256 digital signature binding author and encounter; strict HTTP 422 blocking of direct edits on finalized notes.
5. **Formal Clinical Amendments:** Versioned addenda recording clinical justification ($\ge 10$ chars), author attribution, and effective timestamp.
6. **Patient Allergy Safety:** Tracking drug, food, and environmental allergens with severity classification and clinical verification.
7. **Encounter Closure & Reopening Rules:** Guaranteed closure validation (blocking closure when unfinalized draft notes exist) and audit-trailed reopening requiring clinical justification ($\ge 10$ chars).
8. **FHIR R4 Interoperability:** Clean translation to standard FHIR R4 Encounter, Observation (with verified LOINC codes), and AllergyIntolerance resources.

---

## 2. Security & Access Control Matrix

| Endpoint | Method | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/encounters` | `POST` | `ENCOUNTER_CREATE` | Register walk-in outpatient or emergency encounter. |
| `/api/v1/encounters/appointment` | `POST` | `ENCOUNTER_CREATE` | Register planned appointment encounter. |
| `/api/v1/encounters` | `GET` | `ENCOUNTER_READ` | List encounters with status, department, and priority filtering. |
| `/api/v1/encounters/:id` | `GET` | `ENCOUNTER_READ` | Retrieve encounter details with vitals, notes, and allergies. |
| `/api/v1/encounters/:id/status` | `PATCH` | `ENCOUNTER_UPDATE` | Transition encounter lifecycle state. |
| `/api/v1/encounters/:id/triage` | `POST` | `ENCOUNTER_UPDATE` | Capture triage physiological vitals and priority. |
| `/api/v1/encounters/:id/notes` | `POST` | `CLINICAL_NOTE_CREATE` | Create draft clinical note (SOAP, H&P, Consultation). |
| `/api/v1/encounters/:id/notes/:noteId` | `PATCH` | `CLINICAL_NOTE_UPDATE` | Update draft clinical note (blocked if finalized). |
| `/api/v1/encounters/:id/notes/:noteId/finalize` | `POST` | `CLINICAL_NOTE_SIGN` | Finalize and digitally sign clinical note. |
| `/api/v1/encounters/:id/notes/:noteId/amend` | `POST` | `CLINICAL_NOTE_AMEND` | Record formal clinical addendum amendment. |
| `/api/v1/encounters/patients/:patientId/allergies` | `POST` | `ALLERGY_MANAGE` | Document patient allergy and adverse reaction. |
| `/api/v1/encounters/patients/:patientId/allergies` | `GET` | `ENCOUNTER_READ` | Retrieve active patient allergy records. |
| `/api/v1/encounters/:id/close` | `POST` | `ENCOUNTER_CLOSE` | Close encounter (validates no unfinalized draft notes). |
| `/api/v1/encounters/:id/reopen` | `POST` | `ENCOUNTER_REOPEN` | Reopen closed encounter with mandatory justification. |

---

## 3. Detailed Endpoint Reference

### 3.1 Register Walk-In Encounter
`POST /api/v1/encounters`

Creates an active walk-in encounter in `ARRIVED` status and queues the patient for triage or consultation.

#### Request Body (`CreateEncounterDto`)
```json
{
  "facilityId": "f7a62799-a864-42b7-a89e-4eec03d092d6",
  "patientId": "e2a149c4-a690-4dc2-965a-c5ee9ad32d91",
  "encounterType": "WALK_IN",
  "priority": "URGENT",
  "serviceDepartment": "OPD_GENERAL",
  "reasonForVisit": "Acute persistent cough and evening fever for 5 days",
  "attendingPractitionerId": "b6a71e41-0f77-4b8c-b035-ff6d932b7ea2"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "c1388b48-18e0-410f-8f85-48b48f6cb3f9",
    "encounterNumber": "ENC-202610-0042",
    "status": "ARRIVED",
    "priority": "URGENT",
    "serviceDepartment": "OPD_GENERAL",
    "startTime": "2026-10-19T14:15:00.000Z",
    "createdAt": "2026-10-19T14:15:00.000Z"
  }
}
```

---

### 3.2 Capture Triage Vitals
`POST /api/v1/encounters/:id/triage`

Documents objective triage vital signs with Kenyan units and automatically updates the encounter priority. Automatically computes BMI ($kg/m^2$) from weight and height.

#### Request Body (`RecordTriageVitalsDto`)
```json
{
  "priority": "URGENT",
  "systolicBp": 128,
  "diastolicBp": 82,
  "heartRate": 88,
  "respiratoryRate": 18,
  "temperature": 37.8,
  "oxygenSaturation": 97,
  "weightKg": 70.0,
  "heightCm": 175.0,
  "bloodGlucose": 5.8,
  "avpu": "ALERT",
  "triageNotes": "Febrile, oriented x3, mild respiratory distress."
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "e5b88f3a-2311-477c-a4ec-b82b9e6c4a11",
    "encounterId": "c1388b48-18e0-410f-8f85-48b48f6cb3f9",
    "priority": "URGENT",
    "systolicBp": 128,
    "diastolicBp": 82,
    "heartRate": 88,
    "respiratoryRate": 18,
    "temperature": "37.8",
    "oxygenSaturation": 97,
    "weightKg": "70.00",
    "heightCm": "175.0",
    "bmi": "22.9",
    "bloodGlucose": "5.80",
    "avpu": "ALERT",
    "assessedAt": "2026-10-19T14:20:00.000Z"
  }
}
```

---

### 3.3 Create Draft Clinical Note
`POST /api/v1/encounters/:id/notes`

Creates a draft clinical note attributed to the authenticated practitioner.

#### Request Body (`CreateClinicalNoteDto`)
```json
{
  "noteType": "SOAP_NOTE",
  "subjective": "Patient reports productive cough, chest tightness, fever for 5 days. Denies haemoptysis.",
  "objective": "Febrile (37.8 C). Bilateral rhonchi in lower lung bases. SpO2 97% on room air.",
  "assessment": "Community-acquired lower respiratory tract infection; differential includes acute bronchitis.",
  "plan": "1. Sputum analysis and CBC\n2. Oral Amoxicillin/Clavulanic acid 625mg PO TID x 7d\n3. Review after 3 days or immediately if dyspnea worsens."
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "d8213b3e-5231-4a3d-b2a1-fa552d88a101",
    "status": "DRAFT",
    "noteType": "SOAP_NOTE",
    "authorId": "b6a71e41-0f77-4b8c-b035-ff6d932b7ea2",
    "effectiveTime": "2026-10-19T14:30:00.000Z",
    "createdAt": "2026-10-19T14:30:00.000Z"
  }
}
```

---

### 3.4 Finalize & Digitally Sign Clinical Note
`POST /api/v1/encounters/:id/notes/:noteId/finalize`

Finalizes the note, locks in-place edits permanently, and computes a cryptographic digital signature.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "d8213b3e-5231-4a3d-b2a1-fa552d88a101",
    "status": "FINALIZED",
    "signedById": "b6a71e41-0f77-4b8c-b035-ff6d932b7ea2",
    "signedAt": "2026-10-19T14:40:00.000Z",
    "digitalSignature": "4f8a7e...[sha256 hex signature]"
  }
}
```

---

### 3.5 Amend Finalized Note with Addendum
`POST /api/v1/encounters/:id/notes/:noteId/amend`

Records a legally compliant addendum attached to the finalized note. The original note content remains untouched.

#### Request Body (`AmendClinicalNoteDto`)
```json
{
  "reason": "Chest X-ray report reviewed post-consultation showing right lower lobe opacity.",
  "addendumText": "Addendum: CXR confirmed right lower lobe consolidation consistent with bacterial pneumonia. Add Azithromycin 500mg PO OD x 3d to cover atypicals."
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "id": "a91823bb-7123-4819-bf91-c1928374a222",
    "clinicalNoteId": "d8213b3e-5231-4a3d-b2a1-fa552d88a101",
    "reason": "Chest X-ray report reviewed post-consultation showing right lower lobe opacity.",
    "addendumText": "Addendum: CXR confirmed right lower lobe consolidation consistent with bacterial pneumonia...",
    "amendedById": "b6a71e41-0f77-4b8c-b035-ff6d932b7ea2",
    "amendedAt": "2026-10-19T15:10:00.000Z"
  }
}
```

---

### 3.6 Close Encounter
`POST /api/v1/encounters/:id/close`

Transitions encounter to `COMPLETED` and sets `endTime`. If any draft notes remain open, the operation is blocked with HTTP 422.

#### Request Body (`CloseEncounterDto`)
```json
{
  "closureSummary": "Patient triaged, examined, prescribed oral antibiotics, and discharged home in stable condition."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "c1388b48-18e0-410f-8f85-48b48f6cb3f9",
    "status": "COMPLETED",
    "endTime": "2026-10-19T15:15:00.000Z",
    "closureSummary": "Patient triaged, examined, prescribed oral antibiotics, and discharged home in stable condition."
  }
}
```

#### Error Response: Unfinalized Draft Notes (`422 Unprocessable Entity`)
```json
{
  "statusCode": 422,
  "message": "Encounter cannot be closed because 1 draft clinical note(s) are pending finalization or discard."
}
```

---

### 3.7 Reopen Encounter
`POST /api/v1/encounters/:id/reopen`

Reopens a completed or cancelled encounter with an auditable justification ($\ge 10$ characters).

#### Request Body (`ReopenEncounterDto`)
```json
{
  "reopeningReason": "Patient returned 45 minutes later reporting acute medication allergy reaction."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "c1388b48-18e0-410f-8f85-48b48f6cb3f9",
    "status": "REOPENED",
    "reopenedById": "b6a71e41-0f77-4b8c-b035-ff6d932b7ea2",
    "reopenedAt": "2026-10-19T16:00:00.000Z",
    "reopeningReason": "Patient returned 45 minutes later reporting acute medication allergy reaction."
  }
}
```

---

## 4. FHIR R4 Interoperability Mapping

The module provides direct mappings to standard FHIR R4 resources:

| Afya Poa Entity | FHIR R4 Resource | Standard Coding / LOINC |
| :--- | :--- | :--- |
| `encounters` | `Encounter` | Status: `in-progress` / `finished`; Class: `AMB` (ambulatory) |
| `triage_vitals.systolicBp` | `Observation` | LOINC `8480-6` (Systolic blood pressure, unit: `mmHg`) |
| `triage_vitals.diastolicBp` | `Observation` | LOINC `8462-4` (Diastolic blood pressure, unit: `mmHg`) |
| `triage_vitals.heartRate` | `Observation` | LOINC `8867-4` (Heart rate, unit: `/min`) |
| `triage_vitals.respiratoryRate` | `Observation` | LOINC `9279-1` (Respiratory rate, unit: `/min`) |
| `triage_vitals.temperature` | `Observation` | LOINC `8310-5` (Body temperature, unit: `Cel`) |
| `triage_vitals.oxygenSaturation`| `Observation` | LOINC `2708-6` (Oxygen saturation, unit: `%`) |
| `triage_vitals.weightKg` | `Observation` | LOINC `29463-7` (Body weight, unit: `kg`) |
| `triage_vitals.heightCm` | `Observation` | LOINC `8302-2` (Body height, unit: `cm`) |
| `triage_vitals.bmi` | `Observation` | LOINC `39156-5` (Body mass index, unit: `kg/m2`) |
| `triage_vitals.bloodGlucose` | `Observation` | LOINC `2339-0` (Glucose in blood, unit: `mmol/L`) |
| `patient_allergies` | `AllergyIntolerance` | SNOMED / FHIR AllergyIntolerance Category & Criticality |
