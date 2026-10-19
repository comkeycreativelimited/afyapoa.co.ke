# Digital Health Agency (DHA) Kenya — Architectural & Compliance Requirements Specification

**Document Identifier:** `DHA-REQ-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Baseline Draft (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026  
**Primary Regulatory Authorities:** Digital Health Agency (DHA), Ministry of Health (MoH), Social Health Authority (SHA)

---

## 1. Executive Summary & Legal Mandate

The **Digital Health Act, 2023 (No. 15 of 2023)** establishes the legal framework for the development, operationalization, and regulation of Kenya's Comprehensive Integrated Health Information System (CIHIS), colloquially referred to as the "Digital Health Superhighway". Under the Act, the **Digital Health Agency (DHA)** is established as a body corporate (**Section 5**) and designated as the sole **custodian for all health data in Kenya** (**Section 22**).

For **COMKEY AFYYA POA**, a multi-tenant Software-as-a-Service (SaaS) Hospital Management Information System (HMIS), adherence to DHA standards is not merely best practice; it is a statutory prerequisite for market entry, facility operation, and integration with national health financing mechanisms (including the Social Health Authority).

### Regulatory Status Distinction:
* **Binding Law:** Digital Health Act 2023, Data Protection Act 2019, Health Act 2017. (Currently enforceable under appellate stay granted by the Court of Appeal following the High Court's conditional suspension in July 2024).
* **Technical Specifications:** DHA Health Information Exchange (HIE) API Specifications (v1.x), HL7® FHIR® R4 Profiles (`fhir.dha.go.ke/core`, `fhir.kenyaClaimsIG`, `fhir.kenyaPSIG`, `fhir.kenyaEmergencyIG`), WHO ICD-11, Regenstrief LOINC, WHO ICHI.
* **Operational Guidance:** DHA 4-Phase Certification Guide, Go-Live Protocol, UAT Checklist.
* **Contractual Requirements:** SHA Healthcare Provider Integration Contracts, Master Tenant Business Associate Agreements (BAA).

---

## 2. System Architecture & The Kenya Health Information Exchange (HIE)

The Kenya National Health Information Exchange (HIE) is an enterprise service middleware governed by the DHA. It provides centralized registries, data mediation, and interoperability endpoints linking electronic medical record (EMR/HMIS) systems, diagnostic platforms, pharmacies, and payers.

```
+-----------------------------------------------------------------------------------+
|                        COMKEY AFYYA POA (Multi-Tenant SaaS)                       |
|  [Tenant Facility 1]   [Tenant Facility 2]   [Tenant Facility N]                  |
|          \                     |                     /                            |
|           +--------------------+--------------------+                             |
|                                |                                                  |
|                   [Central HIE Integration Broker]                                |
|        (Scopes Requests with X-Facility-Id: FID-XX-XXXXXX-X & fr-code)             |
+--------------------------------+--------------------------------------------------+
                                 | HTTPS / TLS 1.3 / OAuth 2.0
                                 v
+-----------------------------------------------------------------------------------+
|                        DHA KENYA HIE MIDDLEWARE PLATFORM                          |
|  - Authentication Gateway (/api/v1/tenants/token)                                 |
|  - Enterprise Master Patient Index / Client Registry (/api/v1/patients)           |
|  - Master Facility List / Facility Registry (FR Code Lookup)                      |
|  - Health Worker Registry (Practitioner PUID Verification)                        |
|  - Shared Health Record (SHR) (FHIR R4 Bundles & Query Engine)                    |
|  - Terminology Service (TS) (ICD-11, LOINC, ICHI, National HPT Dictionary)        |
|  - Consent & Authorization Engine (OTP SMS Gateway & Biometric Verification)      |
+--------------------------------+--------------------------------------------------+
                                 |
                                 v
+-----------------------------------------------------------------------------------+
|                         SOCIAL HEALTH AUTHORITY (SHA)                             |
|  - Primary HealthCare Fund (PHC) | SHIF | Emergency & Critical Illness (ECCIF)    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Functional Requirements & API Contracts

### 3.1 Authentication & Multi-Tenancy Architecture
* **Source:** `https://hie-docs.dha.go.ke/docs/authentication/process/facility-identification` & `/auth`
* **Version/Date Verified:** September 28, 2026 (Accessed October 19, 2026)
* **API Endpoint:** `POST /api/v1/tenants/token`
* **Protocol:** OAuth 2.0 Client Credentials Grant.
* **Credentials:** Issued per developer organization (`client_id`, `client_secret`).
* **Multi-Tenant Facility Scoping Specification:**
  * Single-facility systems use a facility-scoped token embedding the `facility_id` claim.
  * **Multi-tenant SaaS platforms (such as COMKEY AFYYA POA)** hold a service-account / organization token with **no** facility claim embedded.
  * For multi-tenant calls, the originating health facility **MUST** be supplied dynamically on **every HTTP request** using two mandatory headers:
    1. `X-Facility-Id`: The health facility's unique registry identifier from the Kenya Master Facility List (KMFL / FR), e.g., `FID-47-115307-8`.
    2. `X-Facility-Id-Type`: The identifier taxonomy type. Currently, **only** `fr-code` is accepted.
  * **Precedence Rule:** If both a JWT facility claim and the `X-Facility-Id` header pair are present, the headers take absolute precedence. If either header is missing, the request fails or reverts to the JWT claim.
* **Affected Modules in COMKEY AFYYA POA:** Security & Identity Service, API Gateway Outbound Middleware, Tenant Registry Manager.

---

### 3.2 Master Health Registries
The DHA architecture defines three authoritative single sources of truth. All COMKEY AFYYA POA transactions must validate entities against these registries:

#### A. Client Registry (CR) / Master Patient Index (MPI)
* **Source:** `https://hie-docs.dha.go.ke/docs/registries/gettingStarted/introduction` & `/registries/client-registry`
* **Endpoint:** `GET /api/v1/patients`
* **Inputs:** `identification_number` (National ID, Passport, Birth Certificate No, Alien Card, or SHA ID) and `identification_type`.
* **Output:** National Beneficiary CR ID (`id` / `patient_id`) and master demographic payload.
* **Architecture Rule:** Local patient records in COMKEY AFYYA POA must store the canonical DHA `cr_id` alongside the local database UUID. All downstream HIE and SHA calls must reference this `cr_id`.

#### B. Facility Registry (FR) / Master Facility List (KMFL)
* Identifies healthcare institutions across levels 1 through 6.
* Provides the canonical `FID` code required for token routing and claims attribution.

#### C. Health Worker Registry (HWR)
* Validates professional licensure, active practice status, and council registration (Kenya Medical Practitioners and Dentists Council - KMPDC, Nursing Council of Kenya - NCK, Pharmacy and Poisons Board - PPB).
* Exposes the Practitioner Unique Identifier (`X-PUID`), mandatory for clinical reads, prescription signing, and emergency case doctor consent.
* **Affected Modules:** Patient Registration / Triage, Staff & HR Credentialing, Facility Setup.

---

### 3.3 Patient Consent Management Framework
* **Source:** `https://hie-docs.dha.go.ke/docs/consent/getting-started/intro` & `/docs/sharedHealthRecord/gettingStarted/intro`
* **Binding Mandate:** Section 3 & Part IV of Digital Health Act 2023; Data Protection Act 2019 Sections 30 & 32.
* **Core Principle:** In accordance with Kenyan data protection laws, health records in the national Shared Health Record (SHR) cannot be accessed without explicit, time-bound, visit-scoped patient consent.

#### A. Consent Lifecycle & Workflows
1. **Pre-Check Open Consent:**
   * Query `GET /shr/open-visits?patient_id={cr_id}&facility_id={fr_code}`.
   * If an active visit exists, reuse the open `visit_id` and refresh the token via `POST /shr/consents/{visit_id}/refresh`.
2. **Initiate Consent (Standard OTP Flow):**
   * Fetch registered contacts via `GET /api/v1/patients/contacts`.
   * Display masked phone numbers (e.g., `+254714***898`) to patient; confirm choice and extract `contact_id`.
   * Trigger OTP dispatch via `POST /api/v1/claims/otp` (or `POST /shr/consents`).
   * Verify patient-provided OTP via `POST /shr/consents/{consent_id}/verify` using `otp_record` and OTP code.
   * **Receipt:** Returns `consent_token` (must be attached to header `X-Consent-Token` on subsequent clinical reads) and `visit_id`.
3. **Biometric Consent Flow:**
   * Invoke `POST /api/v1/claims/authorize` with biometric parameter payload.
   * Status transitions to `PENDING`. Middleware returns an iframe URL for physical fingerprint capture and live matcher validation.
   * Upon successful match, status updates to `AUTHORIZED` (standard visit) or `AUTHORIZED_PENDING_VISIT` (elective intervention).
4. **Exceptions & Special Flows:**
   * **Incapacitated / Point-of-Care Emergency:** Set `emergency = 1` and provide `incapacity_reason`. No OTP is dispatched; consent is approved on the spot, yielding immediate read authorization.
   * **Dependants & Minors:** Route OTP to verified guardian/proxy by passing `cr_id` (minor) with `representative_cr_id` and `representative_relationship` (`Healthcare Proxy`, `Sibling`, `Principal`, `Other`).
   * **Explicit Patient Refusal:** Must call verify with `consent_decision = "Reject"` and `rejection_reason`. System must record auditable rejection rather than abandoning the request as pending.
   * **Visit Close-Out:** Call `POST /shr/visits/{visit_id}/close` upon discharge.
* **Affected Modules:** Front-Desk / Triage, Clinical Consultation View, Emergency Triage, Audit Logging.

---

### 3.4 Shared Health Record (SHR) Clinical Data Exchange
* **Source:** `https://hie-docs.dha.go.ke/docs/sharedHealthRecord/gettingStarted/intro` & `/sharedhealthrecord`
* **Standard:** HL7® FHIR® Release 4 (R4).

#### A. Ingestion (Clinical Writes)
* **Endpoint:** `POST /shr/bundles`
* **Payload:** FHIR Collection `Bundle` containing clinical records generated during encounter.
* **Referencing Invariants (Strict Conformance):**
  1. The Bundle **MUST** contain an `Encounter` resource that references the visit's `EpisodeOfCare`.
  2. Every clinical resource in the Bundle (`Observation`, `Condition`, `MedicationRequest`, `Procedure`, `DiagnosticReport`) **MUST** contain a direct reference to that `Encounter`.
* **Validation:** Payload must be valid FHIR R4 JSON; semantic conformance is validated upstream by the DHA validation engine.

#### B. Querying (Clinical Reads)
* **General Read:** `GET /shr/patient-records?cr_id={cr_id}&practitioner_id={puid}&resources={comma_separated_types}` with header `X-Consent-Token`.
* **FHIR-Conformant Targeted Reads:**
  * `GET /shr/Observation?patient={cr_id}` — requires `X-Consent-Token` and `X-PUID`.
  * `GET /shr/ServiceRequest?performer:Organization={fr_code}` — query inbound facility referrals (no patient consent token required as query is scoped to organization).

#### C. Confidentiality & Security Labeling
* All clinical bundles written to or read from the SHR carry security tags under `Resource.meta.security`:
  * **Confidentiality:** `N` (Normal), `R` (Restricted).
  * **Sensitivity Codes:** Must be assigned and respected for stigmatized conditions:
    * `HIV`: Human Immunodeficiency Virus records
    * `PSY`: Psychiatric and mental health notes
    * `SUD`: Substance use disorder records
    * `RH`: Reproductive health
* **Affected Modules:** Electronic Health Record (EHR) Core, Doctor's Clinical Notes, Pharmacy Dispensation, Laboratory Information System (LIS).

---

### 3.5 Terminology Service (TS)
* **Source:** `https://hie-docs.dha.go.ke/docs/terminologyService/gettingStarted/intro`
* **Mandatory Vocabularies:**
  * **Diagnoses & Conditions:** World Health Organization (WHO) **ICD-11** (International Classification of Diseases, 11th Revision). Legacy ICD-10 is deprecated for national exchange.
  * **Laboratory Tests & Clinical Observations:** **LOINC** (Logical Observation Identifiers Names and Codes).
  * **Clinical Interventions & Procedures:** WHO **ICHI** (International Classification of Health Interventions).
  * **Pharmaceuticals & Technologies:** Ministry of Health Kenya National Health Products and Technologies (HPT) Catalog and PPB Drug Codes via Open Concept Lab (OCL).
* **Affected Modules:** Clinical Diagnosis Picker, Lab Test Master Catalog, Pharmacy Master Catalog, Billing Coders.

---

## 4. DHA 4-Phase Certification & Compliance Lifecycle

* **Source:** `https://hie-docs.dha.go.ke/docs/goLive` & `https://certification.dha.go.ke`
* **Legal Authority:** Digital Health Act 2023 Section 5 & Part IV.
* **Certification Body:** Digital Health Agency Certification Secretariat (`certification@dha.go.ke`, `afyaconnect.dha@gmail.com`).

Any software vendor seeking to deploy an HMIS to health facilities in Kenya must successfully complete the formal 4-phase DHA qualification pipeline:

```
+-----------------------------------------------------------------------------------+
|                        DHA 4-PHASE CERTIFICATION PIPELINE                         |
|                                                                                   |
|  [Phase 1: Development & Sandbox Testing]                                         |
|    - Implement OAuth 2.0 token management & multi-tenant headers                  |
|    - Build FHIR R4 Bundle parsers and serializers                                 |
|    - Connect to HIE sandbox environment                                           |
|                                     |                                             |
|                                     v                                             |
|  [Phase 2: User Acceptance Testing (UAT)]                                         |
|    - Complete official DHA UAT Checklist Matrix (Spreadsheet 1zFOjatVW...)        |
|    - Live demo with DHA / AfyaConnect Integration Team across 3 Funds:            |
|        * Primary HealthCare (PHC) Capitation                                      |
|        * Social Health Insurance Fund (SHIF) Inpatient/Outpatient                 |
|        * Emergency & Critical Illness (ECCIF) 24h Emergency submission           |
|                                     |                                             |
|                                     v                                             |
|  [Phase 3: Formal DHA Certification Review]                                       |
|    - Non-negotiable review by DHA Technical and Security Committees               |
|    - Security audit, data protection compliance verification, and interop review   |
|    - Issuance of DHA Certificate of Conformance                                   |
|                                     |                                             |
|                                     v                                             |
|  [Phase 4: Production Launch & Monitoring]                                        |
|    - Issuance of Production API Client Credentials                                |
|    - Controlled rollout across tenant facilities                                  |
|    - Periodic compliance and data governance monitoring by DHA                   |
+-----------------------------------------------------------------------------------+
```

---

## 5. Material Findings Traceability Matrix

| Finding ID | Requirement Domain | Technical / Statutory Reference | Source URL / Authority | Version / Date Verified | Affected COMKEY AFYYA POA Module |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DHA-01** | Multi-Tenant Headers | Header pair: `X-Facility-Id` & `X-Facility-Id-Type: fr-code` | `https://hie-docs.dha.go.ke/docs/authentication/process/facility-identification` | v1.x / Sept 28, 2026 | Outbound API Client, Tenant Context Service |
| **DHA-02** | Master Registries | `GET /api/v1/patients`, `FID`, `X-PUID` | `https://hie-docs.dha.go.ke/docs/registries/gettingStarted/introduction` | v1.x / Sept 28, 2026 | Registration, Patient Demographics, Staff Credentials |
| **DHA-03** | Visit-Bound Consent | `POST /shr/consents`, `X-Consent-Token`, OTP & Biometrics | `https://hie-docs.dha.go.ke/docs/consent/getting-started/intro` | v1.x / Sept 28, 2026 | Triage, Consent Verification, EHR Core |
| **DHA-04** | SHR FHIR Structure | `POST /shr/bundles`, Collection Bundle, Encounter linking | `https://hie-docs.dha.go.ke/docs/sharedHealthRecord/gettingStarted/intro` | FHIR R4 / Sept 28, 2026 | Clinical Encounter Module, FHIR Converter |
| **DHA-05** | Security Labels | `meta.security`: `N`, `R`, `HIV`, `PSY`, `SUD` | `https://hie-docs.dha.go.ke/docs/sharedHealthRecord/gettingStarted/intro` | Sept 28, 2026 | Access Control Engine, Clinical Audit Log |
| **DHA-06** | Terminology Standard | ICD-11 (Diagnoses), LOINC (Lab), ICHI (Procedures) | `https://hie-docs.dha.go.ke/docs/terminologyService/gettingStarted/intro` | WHO / Sept 28, 2026 | Clinical Coding, Laboratory Catalog, Billing Master |
| **DHA-07** | 4-Phase Certification | Sandbox -> UAT Demo -> DHA Review -> Production | `https://hie-docs.dha.go.ke/docs/goLive` & `https://certification.dha.go.ke` | Sept 28, 2026 | Release Engineering, Quality Assurance, Compliance |
| **DHA-08** | Data Custodianship | Digital Health Act 2023 Section 22 (DHA is central custodian) | Kenya Gazette / Kenya Law / DHA Act No. 15 of 2023 | Act of 2023 (Appellate Stay 2024) | Data Governance, Export/Backup Protocols |
