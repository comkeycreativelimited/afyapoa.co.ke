# COMKEY AFYA POA — FHIR R4 Serialization, Validation & Exchange Specification

**Document Identifier:** `INT-FHIR-R4-2026-V1`  
**Target Platform:** COMKEY AFYA POA Multi-Tenant SaaS HMIS  
**Implementation Guide:** Kenya Core FHIR R4 Implementation Guide (`https://fhir.dha.go.ke/core`)  
**Standard Release:** HL7 FHIR Release 4 (R4)  
**Author:** Principal Healthcare Interoperability Architect  
**Status:** Approved Technical Specification & Implementation Guide  
**Date:** October 2026  

---

## 1. Executive Summary & Regulatory Authority

Under Section 47 of the **Digital Health Act 2023** and the **Kenya Digital Health Architecture (DHA) Enterprise Standards**, all Electronic Health Record (EHR) and Hospital Management Information Systems (HMIS) operating in the Republic of Kenya must support standardized health data exchange.

The Digital Health Agency (DHA) mandates HL7 FHIR R4 as the official syntactic exchange standard for clinical information across the Kenya Health Information Exchange (HIE). COMKEY AFYA POA implements typed serialization, profile validation, SHR bundle compilation, and secure REST exchange operations adhering strictly to the **Kenya Core FHIR Implementation Guide** (`https://fhir.dha.go.ke/core`).

> [!IMPORTANT]
> Generic HL7 FHIR R4 validity does **not** constitute Kenya DHA conformance. All exchanged resources must satisfy Kenyan canonical profiles, national identifier systems (CR ID, PUID, KMFL), and standardized terminology systems (ICD-11 MMS, LOINC, UCUM, KEML).

---

## 2. Canonical Profiles & Verification Boundaries

COMKEY AFYA POA implements typed mapping, validation, and serialization for 14 active Kenya Core profiles. Profiles are grouped into **Verified Active** (fully mapped, validated, and tested) and **Deferred / Unverified** (pending final DHA HIE v2.0 gazettement).

### 2.1 Verified Active Profiles

| Resource Type | Canonical Profile URI | Key Kenya Invariants & Required Bindings | Conformance Status |
| :--- | :--- | :--- | :--- |
| **Patient** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-patient` | `active: boolean` required. Must contain national identifier (`CR_ID` or `PUID`). Name and gender mandatory. | **VERIFIED** |
| **Encounter** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-encounter` | `status`, `class`, and `subject` required. In SHR bundles, must reference valid `EpisodeOfCare`. | **VERIFIED** |
| **EpisodeOfCare** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-episode-of-care` | `status`, `patient`, and `managingOrganization` required. Groups longitudinal encounter continuity. | **VERIFIED** |
| **Practitioner** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner` | Must contain professional registration identifier (`KMPDC` license or national ID). | **VERIFIED** |
| **PractitionerRole** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner-role` | Links Practitioner to Organization with authorized role code (`CLINICIAN`, `PHARMACIST`, etc.). | **VERIFIED** |
| **Organization** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-organization` | Must have KMFL Master Facility List code under `https://kmfl.health.go.ke/facilities`. | **VERIFIED** |
| **Location** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-location` | Physical or logical ward/consultation room linked to managing Organization. | **VERIFIED** |
| **Condition** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-condition` | `code` must be bound to **ICD-11 MMS** (`http://id.who.int/icd/release/11/mms`). Legacy ICD-10 is rejected. | **VERIFIED** |
| **Observation** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-observation` | Vitals and labs must use **LOINC** (`http://loinc.org`). Quantity values must use **UCUM** (`http://unitsofmeasure.org`). | **VERIFIED** |
| **AllergyIntolerance**| `https://fhir.dha.go.ke/core/StructureDefinition/kenya-allergy-intolerance` | `clinicalStatus`, `verificationStatus`, and allergen substance code required. | **VERIFIED** |
| **MedicationRequest** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-request` | `status`, `intent`, `subject`, and medication code bound to **KEML** (Kenya Essential Medicines List). | **VERIFIED** |
| **MedicationDispense**| `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-dispense`| `status`, `subject`, and dispense details linked to authorized MedicationRequest. | **VERIFIED** |
| **Coverage** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-coverage` | Beneficiary coverage linking patient to SHA Member No under `https://sha.go.ke/beneficiary`. | **VERIFIED** |
| **Claim** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-claim` | eClaim package with patient, provider, facility KMFL, diagnosis, and itemized billing lines. | **VERIFIED** |
| **Provenance** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-provenance` | Mandatory attribution resource in SHR bundles identifying authoring practitioner, organization, and timestamp. | **VERIFIED** |
| **Bundle (SHR)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-shr-collection-bundle` | Clinical collection bundle enforcing DHA SHR Invariants 1, 2, and security classification tags. | **VERIFIED** |

### 2.2 Deferred / Unverified Profiles

The following resources are defined in generic HL7 FHIR R4 but have **no gazetted Kenya Core profile** or operational DHA HIE endpoint as of October 2026. They are documented in [docs/open-questions.md](file:///c:/wamp64/www/afya-poa/docs/open-questions.md) and held outside the production validation engine:
- `Immunization` (pending national KEPI registry FHIR specification)
- `Device` (pending PPB medical device registry integration)
- `Media` / `DocumentReference` (radiology and DICOM imaging exchange deferred to DHA Phase 2)
- `QuestionnaireResponse` (patient-reported outcome measures pending community health digitization).

---

## 3. National Identifier & Terminology Systems

### 3.1 Identifier Systems

```typescript
export const FHIR_IDENTIFIER_SYSTEMS = {
  CR_ID: 'https://cr.dha.go.ke/identifiers/cr-id',         // National Client Registry Unique Patient ID
  PUID: 'https://registry.health.go.ke/puid',             // Primary Universal Identifier
  NATIONAL_ID: 'https://registry.health.go.ke/id-numbers', // Kenyan National Identity Card Number
  BIRTH_CERTIFICATE: 'https://registry.health.go.ke/birth-certificates',
  KMFL: 'https://kmfl.health.go.ke/facilities',           // Kenya Master Facility List (MFL Code)
  KMPDC: 'https://kmpdc.go.ke/practitioners',             // Medical Practitioners and Dentists Council License
  PPB: 'https://ppb.go.ke/pharmacists',                   // Pharmacy and Poisons Board License
  NCK: 'https://nckenya.com/nurses',                      // Nursing Council of Kenya Registration
  SHA_BENEFICIARY: 'https://sha.go.ke/beneficiary',       // SHA Member / Household Number
  CLAIM_NUMBER: 'https://sha.go.ke/claims',               // SHA Claim Reference
};
```

### 3.2 Terminology Systems & Deprecation Rules

1. **Diagnostic Coding:**
   - **Mandatory:** WHO **ICD-11 MMS** (`http://id.who.int/icd/release/11/mms`).
   - **Deprecation Error:** Any Condition code utilizing legacy ICD-10 (`http://hl7.org/fhir/sid/icd-10`) is explicitly rejected by the validator with diagnostic error: `"Kenya Core IG mandates ICD-11 MMS (http://id.who.int/icd/release/11/mms). Legacy ICD-10 is deprecated."`
2. **Clinical Observations & Laboratory Tests:**
   - **Mandatory:** **LOINC** (`http://loinc.org`) for observation codes (e.g., `85354-9` for Blood Pressure panel, `8480-6` for Systolic, `8462-4` for Diastolic).
   - **Mandatory:** **UCUM** (`http://unitsofmeasure.org`) for units of measurement (e.g., `mm[Hg]`, `mg/dL`, `Cel`, `kg`).
3. **Pharmaceutical Products:**
   - **Mandatory:** Kenya Essential Medicines List (KEML) under `https://health.go.ke/terminology/keml`.
4. **Security Classifications:**
   - Resources must carry DHA confidentiality tags under `http://terminology.hl7.org/CodeSystem/v3-Confidentiality` (e.g., `N` for Normal, `R` for Restricted).

---

## 4. Shared Health Record (SHR) Collection Bundle Invariants

In compliance with DHA HIE exchange rules, the Kenya SHR Collection Bundle (`type: collection`) must strictly satisfy the following structural invariants:

1. **SHR Invariant 1 (EpisodeOfCare Linking):**
   Every `Encounter` resource in the bundle **must** contain an `episodeOfCare` reference pointing to an `EpisodeOfCare` resource included within the same bundle.
2. **SHR Invariant 2 (Clinical Context Reference):**
   Every clinical resource (`Condition`, `Observation`, `AllergyIntolerance`, `MedicationRequest`, `MedicationDispense`) in the bundle **must** contain an `encounter` reference pointing to an `Encounter` resource included within the same bundle.
3. **Provenance Attribution:**
   The bundle **must** contain a `Provenance` resource whose `target` array references every clinical and encounter resource in the bundle, identifying the authoring clinician (`agent.who`) and facility (`agent.onBehalfOf`).
4. **Security Classification:**
   The Bundle `meta.security` array must contain an authorized confidentiality coding (`N` or `R`).

---

## 5. Documented Exchange Operations

The COMKEY AFYA POA FHIR Gateway exposes standard REST endpoints under `/api/v1/fhir`:

```
POST /api/v1/fhir/$validate
POST /api/v1/fhir/bundles/shr
GET  /api/v1/fhir/patients/:id/$export
GET  /api/v1/fhir/claims/:id/$export
GET  /api/v1/fhir/metadata
```

> [!NOTE]
> All FHIR endpoints bypass internal API response envelope wrappers (`{ success: true, data: ... }`) and return raw FHIR R4 JSON payloads with `Content-Type: application/fhir+json; charset=utf-8`.

### 5.1 Conformance Validation (`POST /api/v1/fhir/$validate`)
- **Query Parameter:** `profile` (optional; if omitted, inferred from `resource.meta.profile[0]`).
- **Request Body:** Any FHIR R4 resource or Bundle.
- **Success Response (`200 OK`):** `OperationOutcome` with severity `information` and issue code `informational`.
- **Failure Response (`422 Unprocessable Entity`):** `OperationOutcome` detailing every structural, profile, terminology, or invariant violation with precise JSONPath locations (e.g., `Condition.code.coding[0].system`).

### 5.2 SHR Bundle Ingestion (`POST /api/v1/fhir/bundles/shr`)
- **Mandatory Headers:**
  - `Authorization: Bearer <JWT>`
  - `X-Facility-Id: <KMFL_CODE>` (MFL code of submitting facility)
  - `X-Consent-Token: <UUID>` (Signed patient consent token per DHA Consent Services)
  - `X-PUID: <PUID>` (Primary Universal Identifier of patient)
- **Idempotency & Duplicate Handling:**
  Every inbound SHR payload is digested using SHA-256 (`crypto.createHash('sha256').update(rawBody).digest('hex')`).
  - If a payload digest has already been ingested, the gateway returns `200 OK` with an `OperationOutcome` indicating:
    `"Duplicate submission detected. Original ingestion acknowledged with identical payload digest."` and avoids duplicate database insertions.
- **Validation Ingestion:**
  The bundle is validated against `https://fhir.dha.go.ke/core/StructureDefinition/kenya-shr-collection-bundle`. If any SHR invariant fails, the request is rejected with `422 Unprocessable Entity`.
- **Response (`201 Created`):**
  ```json
  {
    "resourceType": "Bundle",
    "type": "transaction-response",
    "entry": [
      {
        "response": {
          "status": "201 Created",
          "location": "Bundle/shr-uuid"
        }
      }
    ]
  }
  ```

### 5.3 Patient SHR Export (`GET /api/v1/fhir/patients/:id/$export`)
- **Query Parameter:** `since` (optional ISO 8601 timestamp for differential export).
- **Security:** Requires permission `FHIR_EXPORT`.
- **Response (`200 OK`):** A fully-formed Kenya SHR Collection Bundle (`type: collection`) containing:
  - Patient resource
  - EpisodeOfCare resources
  - Encounters
  - Conditions (ICD-11 coded)
  - Observations (LOINC coded)
  - Allergies
  - Prescriptions and Dispenses
  - Provenance attribution resource.

### 5.4 Claim FHIR Export (`GET /api/v1/fhir/claims/:id/$export`)
- **Response (`200 OK`):** A Kenya Core Claim resource with `type: collection`, itemized billing details, diagnosis coding, and SHA coverage references.

### 5.5 CapabilityStatement (`GET /api/v1/fhir/metadata`)
- Returns the official FHIR `CapabilityStatement` declaring support for FHIR R4, REST mode `server`, security specifications, and supported resource interactions.

---

## 6. Actionable Error Reporting & OperationOutcome Parsing

All validation errors are formatted strictly as FHIR R4 `OperationOutcome` resources. Each issue includes:
- `severity`: `"fatal"` | `"error"` | `"warning"` | `"information"`
- `code`: e.g., `"structure"`, `"value"`, `"code-invalid"`, `"invariant"`, `"duplicate"`
- `diagnostics`: Human-readable explanation of why the validation failed and how to remediate it.
- `expression`: Array of JSONPath selectors pointing to the offending node (e.g., `["Encounter.episodeOfCare"]`, `["Observation.valueQuantity.unit"]`).

### Error Mapping Reference

| Issue Code | Condition | Example Diagnostic Message | Remediation Action |
| :--- | :--- | :--- | :--- |
| `structure` | Missing mandatory field | `Missing mandatory field 'active'` | Include `"active": true` in the Patient resource. |
| `code-invalid` | Terminology system mismatch | `Kenya Core IG mandates ICD-11 MMS. Legacy ICD-10 is deprecated.` | Update diagnostic code to official WHO ICD-11 URI. |
| `value` | Missing valid identifier | `Kenya Patient must contain at least one valid national identifier` | Supply a CR ID (`https://cr.dha.go.ke/identifiers/cr-id`) or PUID. |
| `invariant` | Invariant violation | `Kenya SHR Invariant 1 Violation: Encounter 'enc-1' must reference an EpisodeOfCare` | Add `"episodeOfCare": [{"reference": "EpisodeOfCare/..."}]` to the Encounter. |

---

## 7. Data Provenance & Tamper-Evident Audit Trail

Every FHIR exchange event (validation, ingestion, export, duplicate rejection) is recorded in the platform's immutable, tamper-evident audit log:
- **Audit Event Types:**
  - `FHIR_RESOURCE_VALIDATED`
  - `FHIR_BUNDLE_INGESTED`
  - `FHIR_BUNDLE_EXPORTED`
  - `FHIR_EXCHANGE_DUPLICATE_DETECTED`
- **Recorded Attributes:** Tenant facility ID, authenticated user ID, client IP address, resource type, canonical profile, payload SHA-256 hash, and validation status (`PASSED` | `FAILED`).
- **Integrity Guarantee:** Audit entries are chained using SHA-256 block hashing preventing retroactive tampering or deletion.

---

## 8. Conformance & Conformance Testing Matrix

Automated verification is maintained via comprehensive unit and end-to-end integration tests:
- **Unit Conformance Suite:** `packages/fhir-models/src/validator.spec.ts` (17 tests covering base structure, profile matching, identifier systems, terminology systems, ICD-10 rejection, and bundle invariants).
- **E2E Conformance Suite:** `apps/api/test/fhir-conformance.spec.ts` (13 tests covering live HTTP API endpoints, authentication, headers, duplicate deduplication, 422 rejections, and audit logging).

For detailed execution evidence, refer to [docs/test-evidence/fhir-conformance-report.md](file:///c:/wamp64/www/afya-poa/docs/test-evidence/fhir-conformance-report.md).
