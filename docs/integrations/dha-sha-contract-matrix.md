# DHA & SHA Technical Contract & Verification Matrix

**Document Identifier:** `INT-CTR-2026-V1`  
**Target Platform:** COMKEY AFYA POA  
**Author:** Principal Software Architect & Healthcare Standards Lead  
**Status:** Approved & Verified  
**Date:** October 20, 2026  
**Primary Authorities:** Digital Health Agency (DHA), Social Health Authority (SHA), Kenya Revenue Authority (KRA)

---

## 1. Verified vs. Provisional Contract Boundaries

In adherence to the **Zero Fabrication Invariant**, COMKEY AFYA POA distinguishes between verified external capabilities and provisional adapter ports:

```
+----------------------------------------------------------------------------------------------------+
|                              INTEGRATION CAPABILITIES MATRIX STATUS                               |
+------------------------------------+----------------------------+----------------------------------+
| Domain                             | Verification Status        | Source Authority & Documentation |
+------------------------------------+----------------------------+----------------------------------+
| DHA Multi-Tenant Authentication    | VERIFIED CONTRACT          | DHA HIE Spec v1.x (Sept 28, 2026)|
| DHA Client Registry (CR / MPI)     | VERIFIED CONTRACT          | DHA HIE Spec v1.x (Sept 28, 2026)|
| DHA Facility Registry (FR / KMFL)  | VERIFIED CONTRACT          | DHA Master Facility List v1.x    |
| DHA Health Worker Registry (HWR)   | VERIFIED CONTRACT          | DHA HWR Specification v1.x       |
| DHA Consent Management (OTP/Bio)   | VERIFIED CONTRACT          | DHA Consent Guide & Part IV DPA  |
| DHA Shared Health Record (SHR)     | VERIFIED CONTRACT          | HL7 FHIR R4 (Kenya Core IG)      |
| DHA Terminology Service (TS)       | VERIFIED CONTRACT          | WHO ICD-11, LOINC, ICHI, KEML    |
| SHA 3 Statutory Funds Architecture | VERIFIED CONTRACT          | SHIA Act 2023 & Regs 2024        |
| SHA 5-Step Prerequisite Journey    | VERIFIED CONTRACT          | SHA eClaims Integration Spec     |
| SHA Preauthorizations Engine       | VERIFIED CONTRACT          | SHA Preauth Process Guide        |
| SHA eClaims Processing & Discharge | VERIFIED CONTRACT          | SHA eClaims IG & Adjudication    |
| KRA eTIMS Invoicing & Credit Notes | VERIFIED CONTRACT          | KRA Tax Procedures Act Sec 23A   |
| M-Pesa Daraja STK & Query API      | PROVISIONAL ADAPTER PORT   | Daraja v2.0 Simulation (MOCK)    |
| Client Workstation WebAuthn Driver | RECORDED GAP (UNVERIFIED)  | OQ-TECH-01 in Open Questions     |
+------------------------------------+----------------------------+----------------------------------+
```

---

## 2. DHA Health Information Exchange (HIE) Verified Contracts

### 2.1 Multi-Tenant Gateway & Token Lifecycle
* **Endpoint:** `POST /api/v1/tenants/token`
* **Grant Type:** `client_credentials`
* **Required Headers on All Subsequent Calls:**
  * `Authorization: Bearer <access_token>`
  * `X-Facility-Id: <KMFL_Code>` (e.g., `FID-01-000101-1`)
  * `X-Facility-Id-Type: fr-code`
* **Adapter Port:** Managed automatically by `createCorrelationHeaders` in `packages/integration-adapters`.

### 2.2 Client Registry (CR / MPI)
* **Endpoint:** `GET /api/v1/patients`
* **Query Parameters:** `identification_number`, `identification_type` (`KENYA_NATIONAL_ID`, `SHA_NUMBER`, `PASSPORT`, `BIRTH_CERTIFICATE`, `ALIEN_ID`).
* **Typed Port:** `IDhaClientRegistryClient`
* **Key Contracts:**
  * `lookupClient(idType, idNumber, facilityCode): Promise<Result<ClientRegistryPatient>>`
  * `lookupClientByNationalId(nationalId): Promise<Result<ClientRegistryResult>>`
  * `resolveUpi(idType, idNumber, facilityCode): Promise<Result<{ upi: string; crId: string }>>`
  * `searchBeneficiaries(query, facilityCode): Promise<Result<ClientRegistryPatient[]>>`

### 2.3 Facility Registry (FR / KMFL)
* **Endpoint:** `GET /api/v1/facilities/:kmflCode`
* **Typed Port:** `IDhaFacilityRegistryClient`
* **Key Contracts:**
  * `verifyFacilityByKmfl(kmflCode): Promise<Result<FacilityRegistryResult>>`
  * `getFacilityDetails(kmflCode): Promise<Result<FacilityRegistryResult>>`

### 2.4 Health Worker Registry (HWR)
* **Endpoint:** `GET /api/v1/practitioners/:puid`
* **Typed Port:** `IDhaHealthWorkerRegistryClient`
* **Key Contracts:**
  * `verifyHealthWorkerByPuid(puid): Promise<Result<HealthWorkerResult>>`
  * `checkLicenseStatus(puid, board): Promise<Result<HealthWorkerResult>>`

### 2.5 Patient Consent Framework
* **Endpoints:**
  * `GET /shr/open-visits?patient_id={cr_id}&facility_id={fr_code}`
  * `GET /api/v1/patients/contacts?patient_id={cr_id}`
  * `POST /shr/consents` & `POST /api/v1/claims/otp`
  * `POST /shr/consents/:id/verify`
  * `POST /api/v1/claims/authorize` (Biometric)
  * `POST /shr/consents/emergency` (Doctor OTP Emergency Override)
  * `POST /shr/visits/:id/close` (Discharge Visit Close)
* **Typed Port:** `IDhaConsentClient`
* **Key Contracts:**
  * `checkOpenVisits(patientCrId, facilityCode)`
  * `getPatientContacts(patientCrId, facilityCode)`
  * `requestOtpConsent(patientCrId, contactId, facilityCode)`
  * `verifyOtpConsent(consentId, otpCode, otpRecord, facilityCode)`
  * `authorizeBiometricConsent(patientCrId, facilityCode)`
  * `authorizeEmergencyConsent(patientCrId, incapacityReason, facilityCode, doctorPuid)`
  * `closeVisit(visitId, facilityCode)`

### 2.6 Shared Health Record (SHR)
* **Standards:** HL7® FHIR® R4, Kenya Core Implementation Guide.
* **Endpoints:**
  * `POST /shr/bundles` (Clinical Ingestion with `X-Consent-Token` and `X-PUID`)
  * `GET /shr/patient-records?cr_id={crId}&practitioner_id={puid}&resources={types}`
* **Referencing Rules:** Bundle `Encounter` references `EpisodeOfCare`; clinical resources (`Observation`, `Condition`, `MedicationRequest`, `Procedure`, `DiagnosticReport`) reference `Encounter`.
* **Typed Port:** `IDhaSharedHealthRecordClient`

### 2.7 Terminology Service (TS)
* **Standards:** WHO ICD-11 (diagnoses), LOINC (labs), WHO ICHI (procedures), KEML / PPB (pharmacy).
* **Endpoints:**
  * `POST /api/v1/terminology/validate`
  * `GET /api/v1/terminology/search`
* **Typed Port:** `IDhaTerminologyClient`

---

## 3. Social Health Authority (SHA) Verified Contracts

### 3.1 The 5-Step Prerequisite Journey
1. `POST /api/v1/tenants/token` -> Obtain OAuth access token.
2. `GET /api/v1/patients` -> Resolve national beneficiary CR ID.
3. `GET /api/v1/patients/eligibility` -> Verify membership in PHC, SHIF, or ECCIF.
4. `GET /api/v1/patients/sub-benefits` -> Fetch authorized benefit packages.
5. `GET /api/v1/patients/benefits/interventions` -> Extract tariffs, payment mechanisms (`PER_DIEM` / `FEE_FOR_SERVICE`), and preauth flags (`needsPreauth`, `needsManualPreauthApproval`).

### 3.2 Preauthorizations Engine
* **Endpoint:** `POST /api/v1/claims/preauth`
* **Types:** `NORMAL`, `ELECTIVE`, `SURGICAL`, `ONCOLOGY`, `RENAL`, `IMAGING`.
* **Typed Port:** `IShaPreauthClient`
* **Key Contracts:**
  * `submitPreauthorization(request, facilityCode, puid)`
  * `queryPreauthStatus(preauthId, facilityCode)`
  * `cancelPreauthorization(preauthId, reason, facilityCode)`

### 3.3 eClaims Processing & Discharge
* **Endpoints:**
  * `POST /api/v1/claims/visit` -> Start active claims visit.
  * `POST /api/v1/claims/submit` -> Outpatient & capitation claim dispatch.
  * `POST /api/v1/claims/discharge_inpatient` -> Inpatient discharge claim.
  * `GET /api/v1/claims/:claimId/status` -> Adjudication state query.
* **Statutory Timelines:**
  * Standard Claims: 90 days from discharge.
  * ECCIF Emergency Claims: Strict 24-hour mandatory submission window.
* **Typed Port:** `IShaClaimsClient`

---

## 4. KRA eTIMS & M-Pesa Integration Ports

### 4.1 KRA eTIMS Fiscal Service
* **Legal Mandate:** Section 23A of the Tax Procedures Act.
* **Endpoints:** `POST /api/v1/etims/sign`, `POST /api/v1/etims/credit-note`.
* **Typed Port:** `IKraEtimsClient`
* **Output:** Control Code (`KRA-ETIMS-MOCK-CTRL-...`), Verification URL (`https://etims.kra.go.ke/verify?code=...`), and timestamp.

### 4.2 M-Pesa Daraja Payment Gateway (Provisional)
* **Design Decision:** In accordance with the Zero-Fabrication rule, Daraja credentials and live production webhook endpoints are isolated behind `IMpesaPaymentClient`.
* **Typed Port:** `IMpesaPaymentClient`
* **Simulation Behavior:** Emits valid simulated `ws_CO_...` checkout request IDs, merchant request IDs, and `QAA...` format receipt numbers with `isSimulated: true`.
