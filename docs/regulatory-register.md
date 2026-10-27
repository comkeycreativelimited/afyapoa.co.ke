# COMKEY AFYYA POA — Master Regulatory & Statutory Compliance Register

**Document Identifier:** `REG-REG-2026-V1`  
**Target Platform:** COMKEY AFYYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Baseline Draft (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026  
**Jurisdiction:** Republic of Kenya

---

## 1. Classification Methodology

To ensure strict legal and architectural rigor, regulatory instruments are categorized into six distinct tiers:
1. **Tier 1: Primary Legislation (Acts of Parliament):** Direct statutory law enacted by Parliament and assented by the President.
2. **Tier 2: Subsidiary Legislation (Regulations & Statutory Instruments):** Gazetted rules, guidelines, and orders having force of law.
3. **Tier 3: Judicial Precedents & Legal Status Tracking:** Decisions of the High Court and Court of Appeal affecting statutory validity and enforcement.
4. **Tier 4: Mandatory Technical Specifications & Interoperability Standards:** Binding technical protocols, schema requirements, and national integration standards.
5. **Tier 5: Operational Guidance & Certification Requirements:** Administrative workflows, UAT criteria, and standard operating procedures.
6. **Tier 6: Contractual & Multi-Tenant SaaS Obligations:** Terms of Service, Business Associate Agreements, Data Processing Agreements, and Payer accreditation contracts.

---

## 2. Tier 1: Primary Legislation (Acts of Parliament)

### 2.1 Digital Health Act, 2023 (No. 15 of 2023)
* **Authority:** Parliament of Kenya / Ministry of Health.
* **Date of Assent / Commencement:** October 19, 2023.
* **Status:** Operational and enforceable under an interim stay of execution granted by the Court of Appeal (pending substantive appeal of the July 2024 High Court judgment).
* **Key Provisions Affecting HMIS SaaS:**
  * **Section 5:** Establishes the Digital Health Agency (DHA) as the lead body corporate to develop, operationalize, and govern digital health.
  * **Section 22:** Designates the Digital Health Agency as the **sole custodian for all health data in Kenya**.
  * **Section 19 & 21:** Mandates classification of health data (sensitive personal data, aggregate data, anonymized data) and establishes the National Health Data Governance Framework.
  * **Part IV:** Mandates that all e-Health solutions, electronic medical records, and digital health software must be certified for safety, interoperability, and security before deployment in health facilities.
  * **Offenses & Penalties:** Unauthorized access, alteration, or interception of health data carries criminal fines up to KES 5,000,000, imprisonment up to 10 years, or both.
* **Impact on COMKEY AFYYA POA:** Mandatory certification via DHA Certification portal before onboarding Kenyan facilities; multi-tenant API integration to national HIE; adherence to DHA data custodianship standards.

### 2.2 Social Health Insurance Act, 2023 (No. 16 of 2023)
* **Authority:** Parliament of Kenya / Social Health Authority (SHA).
* **Date of Assent / Commencement:** October 19, 2023 / Operationalized October 2024.
* **Status:** Operational under Court of Appeal stay orders.
* **Key Provisions Affecting HMIS SaaS:**
  * **Sections 20, 26, & 32:** Establishes the Primary Health Care (PHC) Fund, the Social Health Insurance Fund (SHIF), and the Emergency, Chronic and Critical Illness Fund (ECCIF).
  * **Section 37 & 38:** Mandates digital claims submission, electronic pre-authorization, and automated claims processing through accredited healthcare providers.
  * **Section 47:** Prohibits denial of emergency medical treatment to any individual at any healthcare facility.
* **Impact on COMKEY AFYYA POA:** Architecture must implement multi-scheme billing, pre-authorization workflows, emergency claims fast-track, and integration with the SHA adjudication middleware.

### 2.3 Data Protection Act, 2019 (No. 24 of 2019)
* **Authority:** Office of the Data Protection Commissioner (ODPC).
* **Date of Assent / Commencement:** November 8, 2019 / November 25, 2019.
* **Status:** Active, fully in force, and strictly enforced by the ODPC.
* **Key Provisions Affecting HMIS SaaS:**
  * **Section 2 & 44–46:** Classifies health data as **Sensitive Personal Data**, subject to heightened processing conditions and explicit consent.
  * **Section 18 & 19:** Mandatory registration with the ODPC as a **Data Controller** (facilities) and **Data Processor** (COMKEY SaaS provider).
  * **Section 31:** Mandatory Data Protection Impact Assessment (DPIA) prior to deploying high-risk systems processing sensitive health data on a large scale.
  * **Section 43:** Mandatory notification of personal data breaches to the Data Commissioner within **72 hours** of becoming aware of the breach, and notification to affected data subjects without undue delay.
  * **Section 50:** Authorizes regulation of data localization for strategic sectors.
  * **Administrative Penalties (Section 63):** Penalties up to KES 5,000,000 or 1% of annual gross turnover, whichever is lower. Criminal liabilities apply for unlawful disclosure.
* **Impact on COMKEY AFYYA POA:** Multi-tenant database design with strict tenant isolation, role-based access control (RBAC), end-to-end encryption in transit (TLS 1.3) and at rest (AES-256), automated audit logging, and formal ODPC registration.

### 2.4 Health Act, 2017 (No. 21 of 2017)
* **Authority:** Ministry of Health.
* **Date of Commencement:** June 21, 2017.
* **Status:** Fully in force.
* **Key Provisions Affecting HMIS SaaS:**
  * **Section 10–13:** Duty to maintain medical records; patient rights to access records; strict duty of healthcare personnel to maintain medical confidentiality.
  * **Section 14:** Exceptions to confidentiality (statutory disease reporting, court orders, informed consent).
  * **Section 105–109:** National Health Information System obligations for public and private healthcare facilities.
* **Impact on COMKEY AFYYA POA:** Medical record retention mechanisms, non-repudiation in clinical charting, audit logs of patient record views.

### 2.5 Tax Procedures Act, 2015 (No. 29 of 2015) & Income Tax Act
* **Authority:** Kenya Revenue Authority (KRA).
* **Key Provisions:**
  * **Section 23A of Tax Procedures Act:** Mandates the use of the Electronic Tax Invoice system (eTIMS) for all business transactions.
  * **Section 16(2)(ac) of Income Tax Act:** Disallows any business deduction for expenses not supported by a valid electronic tax invoice generated via eTIMS.
  * **VAT Act, 2013:** Medical services and human medicines are exempt from VAT (First Schedule), but transactions **must still be transmitted through eTIMS** with exempt VAT codes to generate verified invoices and QR codes.
* **Impact on COMKEY AFYYA POA:** HMIS billing modules must integrate with the KRA eTIMS API (OSCU or VSCU) to sign invoices, calculate zero/exempt tax classifications, and stamp invoices with the KRA Control Code and verification QR code.

---

## 3. Tier 2: Subsidiary Legislation (Regulations & Statutory Instruments)

### 3.1 Data Protection (General) Regulations, 2021
* **Authority:** Office of the Data Protection Commissioner (ODPC) / Cabinet Secretary for ICT.
* **Date of Commencement:** February 14, 2022.
* **Critical Mandate — Regulation 26 (Data Localization for Strategic Interests):**
  * **Regulation 26(2)(a):** Specifically lists the **provision of primary or secondary health care** as a designated sector of strategic interest to the state.
  * **Regulation 26(1):** A data controller or data processor processing personal data for healthcare services **SHALL:**
    1. **Process the personal data through a server and data centre located in Kenya; OR**
    2. **Store at least one serving copy of the personal data in a data centre located in Kenya.**
* **Impact on COMKEY AFYYA POA:** If cloud infrastructure (AWS, Azure, GCP) is utilized outside Kenya, the architecture **MUST** maintain an active, synchronized serving copy within a Kenyan data center (e.g., Africa Data Centres, iColo, Safaricom Cloud), or host the primary production cluster directly within Kenya. Pure offshore hosting without a local serving copy is illegal.

### 3.2 Data Protection (Registration of Data Controllers and Data Processors) Regulations, 2022
* Mandates that SaaS providers processing health records on behalf of health facilities must hold a valid ODPC Data Processor Registration Certificate.

### 3.3 Social Health Insurance Regulations, 2024
* Enacted under SHIA 2023. Governs claims management, standard 90-day submission window, accreditation of healthcare providers, tariff schedules, and dispute resolution.

### 3.4 Tax Procedures (Electronic Tax Invoice) Regulations, 2024 / 2020
* Prescribes technical specifications for invoice generation, transmission, security elements (cryptographic hash, QR code), and real-time or batch transmission to KRA.

---

## 4. Tier 3: Judicial Decisions & Legal Status Tracking

### 4.1 High Court Judgment: Joseph Enock Aura & Others v. Cabinet Secretary, Ministry of Health & Others (Consolidated Petitions E565, E577 & E580 of 2023)
* **Date of Decision:** July 12, 2024.
* **Bench:** Three-judge bench (Justices Alfred Mabeya, Freda Mugambi, Robert Limo).
* **Finding:** The High Court declared the Social Health Insurance Act 2023, the Primary Health Care Act 2023, and the Digital Health Act 2023 unconstitutional due to lack of adequate public participation during parliamentary passage.
* **Remedy:** The Court suspended its declaration of invalidity for **120 days** to allow Parliament to conduct public participation and rectify statutory defects.

### 4.2 Court of Appeal Stay Order: Civil Application No. E387 of 2024
* **Date of Decision:** August / September 2024.
* **Bench:** Justices Francis Tuiyott, Abida Ali Aroni, Lydia Achode.
* **Finding:** The Court of Appeal issued an interim **stay of execution** against the High Court judgment pending the hearing and determination of the substantive appeal.
* **Legal Effect:** The Court ruled that suspending the laws abruptly would create extreme regulatory chaos and jeopardize national health services. As a consequence of the stay order, **all provisions of the Digital Health Act 2023, SHIA 2023, and PHC Act 2023 remain in full legal force and effect until the Court of Appeal delivers its final judgment.**

---

## 5. Tier 4: Mandatory Technical Specifications & Interoperability Standards

| Standard / Protocol | Version / Flavor | Issuing Authority | Enforcement Status | System Application in COMKEY AFYYA POA |
| :--- | :--- | :--- | :--- | :--- |
| **HL7® FHIR®** | Release 4 (R4) | HL7 International / DHA Kenya | Mandatory for HIE | Clinical Bundles, Encounter data, Shared Health Record |
| **Kenya Core FHIR IG** | `fhir.dha.go.ke/core` | Digital Health Agency (DHA) | Mandatory | Base resource profiles, identifier patterns, national extensions |
| **Kenya eClaims IG** | `fhir.kenyaClaimsIG` | DHA / SHA | Mandatory | Claims submission, Coverage, Eligibility, Adjudication |
| **Kenya Patient Summary IG** | `fhir.kenyaPSIG` | DHA | Mandatory | Core patient summaries across facilities |
| **WHO ICD-11** | MMS (Mortality/Morbidity) | WHO / Ministry of Health | Mandatory (ICD-10 phased out) | Clinical diagnosis coding, preauthorizations, billing |
| **LOINC** | v2.76+ | Regenstrief Institute / MoH | Mandatory | Diagnostic laboratory orders, results, observations |
| **WHO ICHI** | Beta / National subset | WHO / Ministry of Health | Mandatory | Surgical procedures, clinical interventions |
| **OAuth 2.0 / JWT** | RFC 6749 / RFC 7519 | IETF / DHA HIE | Mandatory | API authentication, tenant token exchange |
| **eTIMS VSCU/OSCU** | v2.0+ API Spec | Kenya Revenue Authority | Mandatory | Automated fiscal invoice signing, QR code generation |

---

## 6. Tier 5: Operational Guidance & Certification Frameworks

* **DHA 4-Phase Qualification Guide:**
  * **Phase 1:** Sandbox verification of OAuth 2.0, multi-tenant headers (`X-Facility-Id`), and FHIR bundle formatting.
  * **Phase 2:** Live UAT demo against the 3 funds (PHC, SHIF, ECCIF) using the official UAT Checklist Matrix (Spreadsheet `1zFOjatVWf3qmHe1LUPQ-gjwJhIDxpPsdqN-CYSSpU38`).
  * **Phase 3:** Non-negotiable DHA technical and security review via `https://certification.dha.go.ke`.
  * **Phase 4:** Production credentials and continuous DHA compliance monitoring.
* **ODPC Healthcare Guidance Notes:**
  * Implementation of Privacy by Design, appointment of Data Protection Officer (DPO), and continuous staff data protection training.

---

## 7. Tier 6: Contractual & Multi-Tenant SaaS Obligations

* **Master SaaS Agreement & Tenant DPA:** Under Section 42 of the Data Protection Act, COMKEY Technologies (as Data Processor) must execute a binding Data Processing Agreement with each tenant health facility (Data Controller).
* **Tenant Isolation Guarantee:** Multi-tenant database must prevent cross-tenant data contamination or inadvertent disclosure.
* **SLA & Uptime Guarantees:** Facilities operate 24/7/365; integration downtime directly impedes emergency patient care and claims processing.
* **SHA Provider Contractual Accreditation:** Facilities contracted by SHA are contractually obligated to use DHA-certified HMIS systems.

---

## 8. Summary Compliance Matrix

| Regulation / Standard | Compliance Requirement | Mandatory Deadlines / Penalties | Risk Level | Mitigation in COMKEY AFYYA POA Architecture |
| :--- | :--- | :--- | :--- | :--- |
| **DPA 2019 Reg 26** | Data localization (Kenya server or serving copy) | Fines up to KES 5M; administrative stop orders | **CRITICAL** | Host in Kenyan data center or implement local synchronized serving copy |
| **DHA 2023 Part IV** | System certification prior to production deployment | Inability to connect to HIE; unlawful deployment | **CRITICAL** | Complete 4-phase DHA qualification pipeline before launch |
| **DPA 2019 Sec 43** | 72-hour breach notification to ODPC | Criminal and civil penalties under Sec 63 | **HIGH** | Automated Security Information & Event Management (SIEM) |
| **SHIA 2024 Regs** | 24-hour ECCIF submission; 90-day standard claims | Claim forfeiture; non-reimbursement of facility | **HIGH** | Automated dispatcher queue with SLA escalation triggers |
| **Tax Procedures Act Sec 23A**| eTIMS electronic tax invoice for all billings | Disallowance of tenant expenses; KRA tax fines | **HIGH** | Integrated eTIMS signing client in billing pipeline |
| **DHA TS Standards** | Mandatory ICD-11, LOINC, and ICHI coding | Claim rejection by SHA automated adjudication | **MEDIUM** | Real-time terminology validation and mapping dictionary |
| **DPA 2019 Sec 30 & 32** | Explicit consent for sensitive health data processing | Invalid processing; fines up to KES 5M | **HIGH** | Statutory consent capture (`patient_consents`), revocation workflow, policy versioning |
| **DPA 2019 Sec 41** | Record-level access audit trails & non-repudiation | Failure to demonstrate accountability to ODPC | **HIGH** | Dedicated access audit logging (`patient_access_logs`) on all patient chart views |
| **DHA 2023 Sec 15** | National Unique Patient Identifier (UPI) resolution | Rejection of unlinked claims by SHA | **HIGH** | DHA Client Registry integration adapter (`IDhaHieClient`) with distinct local vs external verification badges |
| **MPI Data Integrity** | Prevention of clinical record duplication & split charts | Patient safety risk; adverse clinical events | **CRITICAL** | Deterministic National ID rejection, probabilistic demographic candidate scoring (score >= 0.70), and safe non-destructive reconciliation |

---

## 9. Implemented Patient Registration & Identity Compliance Matrix

| Statutory Mandate | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **DPA 2019 Sec 30/32 (Consent)** | `patient_consents` table & `/api/v1/patients/:id/consents` | **IMPLEMENTED** | `apps/api/test/patients.spec.ts` (Consents capture and revocation tests) |
| **DPA 2019 Sec 41 (Access Logging)** | `patient_access_logs` table & `PatientsService.findOne` | **IMPLEMENTED** | `apps/api/test/patients.spec.ts` (Audit trail inspection on record access) |
| **DHA 2023 Sec 15 (UPI Resolution)** | `IDhaHieClient` & `/api/v1/patients/:id/verify-dha` | **IMPLEMENTED (MOCK ADAPTER)** | `packages/integration-adapters/src/dha-hie/mock-dha-hie.client.spec.ts` |
| **DPA 2019 Sec 3 (Data Minimization & Encryption)** | AES-256-GCM + HMAC-SHA256 Blind Indexing | **IMPLEMENTED** | `packages/domain-core/src/crypto.spec.ts` |
| **Kenyan Phone Formatting** | `normalizeKenyanPhone` (+254 standard) | **IMPLEMENTED** | `packages/domain-core/src/crypto.spec.ts` |
| **Safe Deduplication & Reconciliation** | Levenshtein duplicate scoring + non-destructive merge | **IMPLEMENTED** | `apps/api/test/patients.spec.ts` (Merge & candidate detection tests) |
| **Separation of Duties (Reconciliation)** | `PATIENT_RECONCILE` RBAC gate | **IMPLEMENTED** | `apps/api/test/patients.spec.ts` (Clinician 403 vs Admin 200 merge test) |
| **Emergency Care Right (SHIA Sec 47)** | Rapid trauma intake (`UNKNOWN-GENDER-XXXXX`) | **IMPLEMENTED** | `apps/api/test/patients.spec.ts` (Emergency intake test) |

---

## 10. Implemented Reception, Encounter, Triage & Clinical Documentation Compliance Matrix

| Statutory Mandate | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **Kenya Health Act 2017 (Standardized Triage)** | `triage_vitals` table & `/api/v1/encounters/:id/triage` with Kenyan units (mmHg, bpm, °C, SpO2%, kg, cm, mmol/L) | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Triage observations, priority classification, automated BMI calculation) |
| **Clinical Records Immutability (DPA 2019 Sec 25/41)** | `clinical_notes` table; status transitions (`DRAFT` -> `FINALIZED`); strict statutory rejection of direct mutation on finalized notes | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Asserts HTTP 422 with statutory error message on mutation attempts) |
| **Cryptographic Attribution & Signing** | SHA-256 digital signature binding author, encounter, and content upon note finalization | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Digital signature generation & verification) |
| **Statutory Addendum Amendments** | `clinical_note_amendments` table & `/api/v1/encounters/:id/notes/:noteId/amend` | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Addendum creation with mandatory reason >= 10 chars, author attribution, and effective timestamp) |
| **Patient Safety & Adverse Drug Reaction** | `patient_allergies` table & `/api/v1/encounters/patients/:patientId/allergies` | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Drug & food allergy recording with severity and verification status) |
| **Encounter Closure Clinical Safety Guard** | `EncountersService.closeEncounter` draft validation gate | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Asserts HTTP 422 blocking closure if unfinalized draft notes exist) |
| **Encounter Reopening Accountability** | `EncountersService.reopenEncounter` with mandatory clinical/administrative justification | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Reopening justification validation >= 10 chars, audit trail generation) |
| **Clinical Audit Trails (DPA 2019 Sec 41)** | 10 new high-fidelity clinical audit events in `audit_events` | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Audit event generation for encounter creation, triage, note signing, amendment, allergy recording, closure, reopening) |
| **Multi-Tenant RLS Clinical Isolation** | PostgreSQL RLS on `encounters`, `triage_vitals`, `patient_allergies`, `clinical_notes`, `clinical_note_amendments` | **IMPLEMENTED** | `apps/api/test/encounters.spec.ts` (Cross-tenant RLS isolation test) |
| **Digital Health Act 2023 / FHIR R4 Interoperability** | `KenyaCoreObservation`, `KenyaCoreAllergyIntolerance`, `toFHIREncounter`, `toFHIRObservations` (LOINC-coded) | **IMPLEMENTED** | `packages/fhir-models` & `packages/fhir-models/src/kenya-core.ts` |

---

## 11. Implemented Clinical Terminology & CPOE Ordering Compliance Matrix

| Statutory Mandate / Clinical Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **Kenya MOH Standard Diagnostic System (DHA TS)** | `terminology_catalogues`, `terminology_concepts`, `diagnoses` tables with WHO ICD-11 MMS (Release 2024-01) & legacy ICD-10 cross-compatibility | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Terminology validation, search, and diagnosis recording tests) |
| **Zero Invented Terminology Codes Constraint** | `TerminologyService.validateConcept` strict validation gate | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Asserts HTTP 400 Bad Request on invented/unauthorized code strings) |
| **Versioned Catalogue Imports & Provenance** | `/api/v1/terminology/catalogues/import` with canonical URIs, publisher, and effective dates | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Import LOINC catalogue with concept verification) |
| **Kenya Essential Medicines List (KEML 2023 / WHO ATC)** | `medication_requests` table with posology, route, frequency, quantity, duration, and substitution rules | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Medication request placement with KEML formulary codes) |
| **Kenya Diagnostic Standard (LOINC v2.76)** | `service_requests` table with specimen protocols, priority triage (ROUTINE, URGENT, STAT), and clinical indication | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Laboratory service request placement with authentic LOINC codes) |
| **Accidental Duplicate Order Safeguard** | SHA-256 fingerprinting `(tenantId, patientId, type, itemCode)` within 24h window | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Asserts HTTP 409 Conflict on duplicate; verifies override with rationale >= 10 chars) |
| **Order Review & Clinician Authorization** | `/api/v1/orders/:id/authorize` with practitioner digital countersignature | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Order status transition ACTIVE -> AUTHORIZED) |
| **Statutory Order Cancellation Rationale** | `/api/v1/orders/:id/cancel` requiring clinical justification >= 10 characters | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Rejection on short reason; success on valid justification with audit log) |
| **Order Amendments & Audit Provenance** | `/api/v1/orders/:id/amend` creating replacement order and linking superseded order | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Order amendment test with superseded link verification) |
| **Separation of Clinical Ordering from Execution** | Architectural isolation of `clinical_orders` from pharmacy dispensing and lab observations | **IMPLEMENTED** | `packages/domain-core` and database schema design |
| **Prohibition of Autonomous Prescribing** | Strict clinician attribution requirement; zero automated treatment recommendations | **IMPLEMENTED** | System architectural policy; verified in manual and automated suites |
| **Multi-Tenant RLS Order Isolation** | PostgreSQL RLS on `diagnoses`, `clinical_orders`, `medication_requests`, `service_requests` | **IMPLEMENTED** | `apps/api/test/orders.spec.ts` (Tenant B blocked from reading or cancelling Tenant A orders) |

---

## 12. Implemented Laboratory Information System (LIS) Compliance Matrix

| Statutory Mandate / Clinical Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **ISO 15189:2022 (Clause 5.3 & 5.4 Pre-Analytical Quality)** | `lab_specimens` table with unique accessioning (`ACC-YYYYMM-XXXXX`), barcodes (`BC-YYYYMM-XXXXX`), pre-analytical rejection categories (`HEMOLYZED`, `CLOTTED`, `QNS`), and automated recollection (`-R`) | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Accessioning, physical bench receipt, pre-analytical rejection, and recollection tests) |
| **Zero Invented Reference Ranges / Diagnostic Thresholds** | `lab_reference_ranges` requiring explicit citation of authoritative sources (WHO, KEMRI, CDC) and version tags; automated flagging without synthetic ranges | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Reference range provenance verification and automated critical alert tests) |
| **Two-Tier Governance (KMLTTB Cap 253A)** | Technologist entry vs. Pathologist authorization; `LAB_TECH` role lacks `LAB_RESULT_AUTHORIZE`; only authorized Pathologists/Clinicians can issue final reports | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Asserts HTTP 403 Forbidden on unauthorized result authorization) |
| **Preservation of Corrected / Amended Result History** | `lab_results` status `CORRECTED` with mandatory clinical reason ($\ge 10$ chars), linking prior and revised results; `diagnostic_reports` status `AMENDED` | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Immutable audit trail tests for corrected results and amended reports) |
| **Failure Scenarios & Safety Interlocks** | Rejection of specimen draw on cancelled orders (HTTP 400), invalid state transition prevention, duplicate accession protection | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Cancelled order collection block and invalid transition tests) |
| **Consumable Inventory Decrement (ISO 15189 Clause 5.3.2)** | `lab_consumables` & `lab_consumable_deductions` tracking blood collection tubes, safety needles, test cassettes with reorder alerts | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Automated inventory deduction upon specimen collection) |
| **Laboratory Turnaround-Time (TAT) Quality Indicators** | `/api/laboratory/metrics/operational` calculating duration across 4 standard milestones (Order $\rightarrow$ Draw $\rightarrow$ Receipt $\rightarrow$ Result $\rightarrow$ Sign-off) | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Milestone TAT and abnormal distribution calculations) |
| **Kenya Core FHIR R4 Laboratory Profiles** | `KenyaCoreSpecimen`, `KenyaCoreObservation`, `KenyaCoreDiagnosticReport` with LOINC, SNOMED, and Kenyan extension mappings | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (FHIR R4 Specimen, Observation, and DiagnosticReport tests) |
| **Multi-Tenant RLS Laboratory Isolation** | Hard PostgreSQL Row-Level Security on 7 laboratory tables (`lab_test_catalog`, `lab_reference_ranges`, `lab_specimens`, `lab_results`, `diagnostic_reports`, `lab_consumables`, `lab_consumable_deductions`) | **IMPLEMENTED** | `apps/api/test/laboratory.spec.ts` (Tenant B blocked from viewing or authorizing Tenant A laboratory records) |

---

## 13. Implemented Pharmacy & Medication-Dispensing Compliance Matrix (Milestone 8)

| Statutory Mandate / Clinical Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **Kenyan Pharmacy and Poisons Board (PPB Cap 244)** | `pharmacy_products`, `pharmacy_suppliers`, `pharmacy_batches` with drug scheduling (`PART_1_POISON`, `PART_2_POISON`, `CONTROLLED_NARCOTIC`, `OVER_THE_COUNTER`) and supplier premise licensing (`PPB/PREM/...`) | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Catalogue seeding, supplier listing, and product registration tests) |
| **Kenya Essential Medicines List (KEML 2023 8th Edition)** | Master catalogue seeding aligned with WHO ATC codes, posology, routes, strengths, and standard dispensing units | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (KEML master catalogue seeding and filtering) |
| **First-Expiring, First-Out (FEFO) Batch Allocation** | `allocateBatchesFEFO` in `@afyapoa/domain-core` and database queries sorting by `expiry_date ASC` | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (FEFO automatic earliest-batch selection without manual batch specification) |
| **Multi-Tier Partial Dispensing & Balance Tracking** | `DispenseType` (`FULL`, `PARTIAL`, `BALANCE_COMPLETION`) with real-time remaining balance calculations | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Partial dispensation and subsequent balance fulfillment tests) |
| **Concurrency & Negative Inventory Safeguards** | Database transaction row locks (`SELECT ... FOR UPDATE`) preventing negative stock and race conditions during concurrent requests | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Simultaneous concurrent requests verify exactly 1 succeeds and 1 fails without negative inventory) |
| **Safety Interlocks & Cancelled Order Protection** | Strict check against `clinical_orders.status = 'CANCELLED'` prior to dispensing | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Dispense attempt on cancelled order rejected with HTTP 400 Bad Request) |
| **Controlled Returns & Reversals (PPB Cap 244)** | `/pharmacy/dispense/return` mandating $\ge 10$ character clinical justification, restoring batch stock, and recording `RETURN_TO_STOCK` in audit ledger | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Reversal rejected on short reason; success on valid justification with batch restoration) |
| **Inter-Facility Stock Transfers** | `/pharmacy/inventory/transfer` with paired dual-movement audit records (`TRANSFER_OUT` and `TRANSFER_IN`) | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Inter-facility transfer test with origin deduction and destination credit) |
| **Controlled Stock Adjustments & Reconciliation** | `/pharmacy/inventory/adjust` with audit reasons (`ADJUSTMENT_DAMAGE`, `ADJUSTMENT_EXPIRED`, `ADJUSTMENT_DISCREPANCY`) and negative stock prevention | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Damaged stock adjustment and negative balance rejection) |
| **5 Rights Bedside Medication Administration** | `medication_administrations` table and `/pharmacy/administration` endpoint for ward nurses with dose, route, site, and observation notes | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Bedside nurse administration recording and encounter history retrieval) |
| **Inventory Valuation & Expiry Alerts** | Acquisition cost, retail price, gross margin metrics, and near-expiry risk categorization (< 90, 60, 30 days) | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Valuation calculation, expiry alerts, and low-stock threshold queries) |
| **HL7 FHIR R4 Interoperability (Kenya Core)** | `toFHIRMedication`, `toFHIRMedicationDispense`, `toFHIRMedicationAdministration` conforming to Kenya Core digital health profiles | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (FHIR R4 resource export and validation tests) |
| **Multi-Tenant RLS Pharmacy Isolation** | Hard PostgreSQL Row-Level Security on 7 pharmacy tables (`pharmacy_products`, `pharmacy_suppliers`, `pharmacy_batches`, `pharmacy_stock_movements`, `medication_dispenses`, `medication_dispense_items`, `medication_administrations`) | **IMPLEMENTED** | `apps/api/test/pharmacy.spec.ts` (Tenant B blocked from accessing Tenant A batches; unauthorized roles blocked from dispensing or administering) |
---

## 14. Implemented Patient Billing, KRA eTIMS Fiscalization & Payment Processing Compliance Matrix (Milestone 9)

| Statutory Mandate / Financial Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **Kenyan VAT Act (First Schedule) & KRA eTIMS (TPA Section 23A)** | Configurable tax framework mapping medical services & human medicines to VAT Exempt (`TaxCode.E`), Zero-Rated (`TaxCode.B`), and Administrative/Medico-Legal items to 16% standard rated (`TaxCode.A`) | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Consultation tariff exempt verification, administrative certificate 16% VAT calculation test) |
| **KRA Electronic Tax Invoice Management System (eTIMS) Signatures** | Automated fiscalization upon invoice finalization with unique control codes (`KRA-ETIMS-...`), verification QR links, and offline buffering fallback (`EtimsStatus.BUFFERED`) | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Invoice finalization, eTIMS signature issuance, and verification URL tests) |
| **KRA Statutory Credit Notes (Invoice Cancellation)** | Controlled cancellation of finalized invoices emitting compliant negative Credit Notes (`InvoiceType.CREDIT_NOTE`) preserving audit linkage to original invoice | **IMPLEMENTED** | `packages/domain-core`, `apps/api/src/billing/billing.service.ts` (`cancelInvoice` emits Credit Note with eTIMS control code) |
| **Financial Immutability & Anti-Tampering (DPA 2019 / PFMA)** | Strict rejection of silent edits or line deletions on finalized invoices; zero hard-deletion of payment or invoice records | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Asserts HTTP 400 Bad Request on attempting to add or remove lines from finalized invoices) |
| **Segregation of Duties (Internal Financial Controls)** | Cashier discount discretion capped at $\le \text{KES } 1,000$; waivers/discounts $> \text{KES } 1,000$ marked `PENDING_APPROVAL` requiring supervisor/admin countersignature | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Minor discount auto-approved; large waiver requires admin approval; cashier self-approval blocked with HTTP 403) |
| **Clinical Encounter & Departmental Linkage** | Auto-aggregation of billable items from active clinical encounters, authorized laboratory service requests, and pharmacy medication dispenses into unified draft bills | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Auto-aggregation of encounter consultation, LOINC lab order, and KEML dispense lines) |
| **Separation of Patient Billing from SHA Claims** | Separate tracking of patient out-of-pocket payable liability versus SHA social health reimbursement coverage amounts on each line item and invoice totals | **IMPLEMENTED** | `packages/domain-core` (`calculateLineItemTotals`, `calculateInvoiceTotals`), `apps/api/test/billing.spec.ts` |
| **Idempotency & Duplicate Payment Prevention** | Unique constraint on `(tenant_id, idempotency_key)` and transactional `SELECT ... FOR UPDATE` invoice row-locking; duplicate submissions safely return original payment with `isDuplicateReplay: true` | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Immediate duplicate payment re-submission returns identical payment without double deduction) |
| **M-Pesa Adapter Isolation (Zero Hardcoded Daraja Credentials)** | Isolated port `IMpesaPaymentClient` with simulated development adapter (`MockMpesaPaymentClient`) generating `QAA...` receipt numbers and `isSimulated: true` flags | **IMPLEMENTED** | `packages/integration-adapters`, `apps/api/test/billing.spec.ts` (M-Pesa STK push simulation test) |
| **Controlled Payment Reversals & Refunds** | Segregation of duties: Cashier forbidden from refunding payments (HTTP 403); authorized admin refund creates immutable `payment_reversals` record and restores invoice `balance_due` | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Cashier refund blocked; Admin reversal succeeds, payment marked REVERSED, invoice balance restored) |
| **Patient Account Statements & Debtor Aging** | Chronological ledger statement generation with running balance; tenant-aware debtor aging analysis (0-30, 31-60, 61-90, 90+ days) and collection breakdown | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Chronological statement ledger test, financial reporting endpoint) |
| **Daily Shift Reconciliation & Cash Drawer Variance** | Cashier opening float registration, physical cash count upon closing, automated variance flagging (`DISCREPANCY_FLAGGED`), and mandatory supervisor signoff | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Shift opening, discrepancy detection upon closing, cashier signoff blocked, supervisor signoff verified) |
| **Multi-Tenant RLS Financial Security** | Hard PostgreSQL Row-Level Security on 8 billing tables (`billing_service_catalogue`, `invoices`, `invoice_line_items`, `invoice_adjustments`, `payments`, `payment_allocations`, `payment_reversals`, `daily_reconciliations`) | **IMPLEMENTED** | `apps/api/test/billing.spec.ts` (Tenant B clinician blocked with 404 from viewing Tenant A invoices; query isolation verified) |

---

## 15. Implemented External Healthcare Integration Framework & Local Mock Services Compliance Matrix (Milestone 10)

| Statutory Mandate / National Integration Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **DHA Multi-Tenancy Header Scoping (CIHIS Protocol)** | `createCorrelationHeaders` in `packages/integration-adapters` dynamically injecting `X-Facility-Id` (KMFL) and `X-Facility-Id-Type: fr-code` on every outbound call | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` |
| **DHA Master Registries (CR, FR, HWR)** | Typed ports `IDhaClientRegistryClient`, `IDhaFacilityRegistryClient`, `IDhaHealthWorkerRegistryClient` with UPI resolution, national ID lookup, KMFL accreditation, and practitioner PUID verification | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (CR, FR, HWR positive and unindexed queries) |
| **DHA Patient Consent Framework (DPA 2019 Part IV)** | Visit-scoped time-bound consent lifecycle via `IDhaConsentClient` (contacts -> OTP dispatch -> OTP verify `123456` -> `X-Consent-Token` issuance -> emergency doctor override -> visit closeout) | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` (Full consent lifecycle tests) |
| **DHA Shared Health Record (HL7® FHIR® R4 Ingestion & Query)** | `ingestClinicalBundle` and `queryPatientRecords` enforcing strict `X-Consent-Token` and `X-PUID` verification; collection bundle references EpisodeOfCare & Encounter | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` (Ingestion blocked without consent token; success with valid token) |
| **DHA Terminology Service (TS)** | `IDhaTerminologyClient` validating WHO ICD-11 (diagnoses), LOINC (laboratories), WHO ICHI (interventions), and KEML/PPB codes | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` (ICD-11 BA00 and 1B10 concept verification) |
| **SHA 3 Statutory Healthcare Funds (SHIA 2023)** | Multi-fund eligibility verification across Primary HealthCare (PHC capitation), Social Health Insurance Fund (SHIF fee-for-service / per diem), and Emergency Fund (ECCIF 24h rule) | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Active contributor across 3 funds, exhausted entitlement detection) |
| **SHA 5-Step Prerequisite Journey** | Sequential journey: Token -> Patient Search -> Eligibility (`/api/v1/patients/eligibility`) -> Sub-Benefits (`/sub-benefits`) -> Interventions (`/benefits/interventions`) with preauth & payment flags | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` (5-step prerequisite tests) |
| **SHA Preauthorizations Engine** | `IShaPreauthClient` supporting Normal, Elective, Surgical, Oncology, Renal, and Imaging preauthorizations with algorithmic approval and pre-admission cancellation | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Preauth submit, status query, and pre-admission cancellation tests) |
| **SHA eClaims Adjudication & Idempotency** | Real-time claim submission (`/api/v1/claims/submit`) and Inpatient Discharge (`/discharge_inpatient`); duplicate submissions barred by HTTP 409 Conflict | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Successful adjudication and 409 DUPLICATE_SUBMISSION rejection tests) |
| **Controlled 3-Tier Operational Modes (MOCK / UAT / PROD)** | `createIntegrationClients` instantiating synthetic in-memory adapters for `MOCK`, sandbox HTTP clients for `UAT`, and verified gateways for `PROD` | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (MOCK, UAT, PROD instantiation tests) |
| **Production Safety Guard (Zero Accidental Prod Calls)** | `assertSafeEnvironment` strictly blocking automated tests (`NODE_ENV === 'test'`) or non-production modes from dispatching requests to verified production hostnames (`api.hie.dha.go.ke`, etc.) | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Asserts immediate abort when PROD mode or prod URL is requested in tests) |
| **Resilient HTTP Integration & Circuit Breaking** | `ResilientHttpClient` with configurable timeout (`AbortController`), bounded retries with exponential backoff & jitter, and circuit breaker tripping after 5 failures | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Retry recovery on transient 503, circuit breaker trips and fast-fails) |
| **PHI & Secret Log Sanitization (DPA 2019 Sec 30)** | `sanitizeForLogging` redacting authentication secrets, OTP codes, unrestricted clinical summaries, and diagnoses arrays to metadata markers before logging | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts` (Verifies `[REDACTED_SECRET]`, `[PROTECTED_CLINICAL_PAYLOAD]`, `[PROTECTED_CLINICAL_ARRAY]`) |
| **Provisional M-Pesa Adapter Boundary** | Isolated port `IMpesaPaymentClient` with simulated development gateway to prevent fabrication of unverified Daraja credentials | **IMPLEMENTED** | `packages/integration-adapters/src/index.spec.ts`, `apps/mock-server/src/index.spec.ts` (STK push, query, phone validation) |
| **Comprehensive Synthetic Mock Server** | Standalone Express simulator (`apps/mock-server`) exposing all documented DHA/SHA routes, clearly stamping `isSynthetic: true` and supporting deterministic `X-Mock-Scenario` fault headers | **IMPLEMENTED** | `apps/mock-server/src/index.spec.ts` (25 passing contract/endpoint tests) |

---

## 16. Implemented SHA End-to-End Integration Workflows Compliance Matrix (Milestone 11)

| Statutory Mandate / SHA Standard | System Component | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- |
| **SHIA 2023 3 Statutory Healthcare Funds** | Multi-fund eligibility verification across Primary Healthcare Fund (`PHC`), Social Health Insurance Fund (`SHIF`), and Emergency Fund (`ECCIF`) with active status verification | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`verifies SHA beneficiary eligibility across PHC, SHIF, ECCIF`), `packages/domain-core/src/claims.spec.ts` |
| **8 Statutory Scenarios (SC-01 to SC-08)** | Full domain modeling & workflow execution for inpatient, specialized outpatient, emergency resuscitation, capitation, MCH, and chronic care dispensing | **IMPLEMENTED** | `packages/domain-core/src/claims.ts`, `apps/api/test/claims.spec.ts` |
| **Statutory 90-Day Submission Deadline (SHIA Sec 34)** | Automated domain validator enforcing $T \le T_{\text{serviceEnd}} + 90\text{ days}$ for all non-ECCIF claims; late submissions blocked from queuing | **IMPLEMENTED** | `packages/domain-core/src/claims.spec.ts` (Asserts `STATUTORY_VIOLATION` on day 91), `apps/api/test/claims.spec.ts` |
| **Emergency 24-Hour Submission Window (ECCIF)** | Enforces emergency encounter claims (`SC-04`) submitted within 24 hours of encounter start time | **IMPLEMENTED** | `packages/domain-core/src/claims.spec.ts` (Asserts `STATUTORY_VIOLATION` for emergency submission after 25 hours) |
| **Mandatory Practitioner Digital Signature & PUID** | Enforces attending practitioner holding verified KMPDC/COC/NCKE PUID on all claim items and inpatient discharge summaries | **IMPLEMENTED** | `packages/domain-core/src/claims.spec.ts`, `apps/api/test/claims.spec.ts` |
| **WHO ICD-11 Diagnostic Syntax Enforcement** | Enforces primary diagnosis mapped to WHO ICD-11 code syntax before claim queuing | **IMPLEMENTED** | `packages/domain-core/src/claims.spec.ts`, `apps/api/test/claims.spec.ts` |
| **Inpatient Discharge Requirement** | Inpatient claims (`IP`) mandate discharge summary (`dischargeDate`, `dischargeDisposition`, `finalDiagnosisIcd11`, `attendingPractitionerPuid`) before acceptance | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`submits inpatient discharge summary and transitions claim to ACCEPTED`) |
| **Pre-Authorization Lifecycle** | Submission, tariff ceiling check, committee referral handling, and cancellation before admission | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`submits pre-authorization`, `cancels pending pre-authorization`) |
| **Duplicate Claim & Financial Submission Prevention** | SHA-256 fingerprinting on `(tenantId, facilityId, patientId, claimNumber, version, totalAmountKES, itemsDigest)`; duplicate dispatches blocked with `DUPLICATE_SUBMISSION_PREVENTED` | **IMPLEMENTED** | `packages/domain-core/src/claims.spec.ts`, `apps/api/test/claims.spec.ts` (`blocks duplicate claim submission with identical fingerprint`) |
| **Separation of Clinical Records & Financial Claims** | Clinical encounters, observations, and notes stored immutably in EHR tables; financial claims stored in distinct `sha_claims` tables; zero alteration of clinical facts to pass financial rules | **IMPLEMENTED** | `packages/database/src/schema.ts` (`encounters` vs `sha_claims`), `apps/api/src/claims/claims.service.ts` |
| **Supporting Clinical Documentation Attachments** | Secure document upload (`OPERATIVE_NOTES`, `BIOPSY_HISTOLOGY`, `DISCHARGE_SUMMARY`) linking MIME types, file size, SHA attachment IDs, and trace IDs | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`uploads supporting clinical documentation`) |
| **Corrected Claims Resubmission & Explicit Versioning** | Rejection workflow generating incremented claim versions (`v2`, `v3`) with reason tracking while preserving audit lineage of original rejected claim | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`creates corrected claim resubmission with incremented version number`) |
| **Asynchronous Webhook Callback Engine** | Ingestion of `CLAIM_PROCESSED`, `PREAUTH_APPROVED`, and `REMITTANCE_ISSUED` into `sha_callback_events` with tenant isolation and audit logging | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`ingests CLAIM_PROCESSED webhook and transitions claim to ADJUDICATED`) |
| **Safe Timeout Probing & Reconciliation** | Probes pending `SUBMITTED` claims against DHA/SHA Gateway status endpoint to resolve ambiguous timeouts without duplicate billing risk | **IMPLEMENTED** | `apps/api/test/claims.spec.ts` (`probes pending submissions and updates status upon reconciliation`) |
| **Multi-Tenant RLS Database Isolation** | Hard PostgreSQL Row-Level Security on 6 SHA tables (`sha_preauthorizations`, `sha_claims`, `sha_claim_items`, `sha_claim_submissions`, `sha_claim_attachments`, `sha_callback_events`) | **IMPLEMENTED** | `packages/database/src/migrate.ts` (RLS policies enabled and forced), `apps/api/test/claims.spec.ts` |

---

## 17. FHIR R4 Serialization, Validation & Exchange Compliance Matrix (Milestone 12)

Grounded in the **Digital Health Act 2023**, the **Kenya Core FHIR Implementation Guide (`https://fhir.dha.go.ke/core`)**, and the verified **DHA HIE v1.0 specifications**.

| FHIR Profile / Capability | Canonical Profile URI / Standard | DHA Status | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **Kenya Core Patient Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-patient` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (tests 1, 2), `apps/api/test/fhir-conformance.spec.ts` (validate, export) |
| **Kenya Core Encounter Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-encounter` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (tests 3, 4), `apps/api/test/fhir-conformance.spec.ts` (export) |
| **Kenya Core Observation Profile (Vitals & Labs)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-observation` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (tests 5, 6), `apps/api/test/fhir-conformance.spec.ts` (LOINC & UCUM) |
| **Kenya Core Condition Profile (Diagnoses)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-condition` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (tests 7, 8), `apps/api/test/fhir-conformance.spec.ts` (ICD-11 MMS) |
| **Kenya Core AllergyIntolerance Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-allergy-intolerance` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (test 9), `apps/api/test/fhir-conformance.spec.ts` (export) |
| **Kenya Core Claim Profile (eClaims)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-claim` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (test 10), `apps/api/test/fhir-conformance.spec.ts` (claim export) |
| **Kenya Core Provenance Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-provenance` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (test 13), `apps/api/test/fhir-conformance.spec.ts` (SHR Provenance) |
| **Kenya Core SHR Collection Bundle Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-collection-bundle` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (tests 14, 15, 16), `apps/api/test/fhir-conformance.spec.ts` |
| **Kenya Core Practitioner Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core PractitionerRole Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner-role` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts` |
| **Kenya Core Organization Profile (Facilities)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-organization` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core Location Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-location` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts` |
| **Kenya Core MedicationRequest Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-request` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core MedicationDispense Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-dispense` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `apps/api/test/pharmacy.spec.ts` |
| **Kenya Core MedicationAdministration Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-administration` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `apps/api/test/pharmacy.spec.ts` |
| **Kenya Core Medication Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `apps/api/test/pharmacy.spec.ts` |
| **Kenya Core ServiceRequest Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-service-request` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core Specimen Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-specimen` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core DiagnosticReport Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-diagnostic-report` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core Coverage Profile (SHA Benefits)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-coverage` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core ClaimResponse Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-claim-response` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts` |
| **Kenya Core Consent Profile (DPA 2019)** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-consent` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts`, `packages/fhir-models/src/mappers.ts` |
| **Kenya Core AuditEvent Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-audit-event` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/types.ts` |
| **Kenya Core Transaction Bundle Profile** | `https://fhir.dha.go.ke/core/StructureDefinition/kenya-transaction-bundle` | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/bundle.ts` (`buildKenyaTransactionBundle`) |
| **DHA SHR Invariant 1 (Mandatory Encounter)** | Encounter with `episodeOfCare` required in all SHR Collection Bundles | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (Asserts 422 if missing Encounter) |
| **DHA SHR Invariant 2 (Encounter Referencing)** | All clinical items (`Observation`, `Condition`, `MedicationRequest`, etc.) must reference Encounter | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/validator.spec.ts` (test 16) |
| **DHA SHR Invariant 3 (Provenance Attestation)** | Must include author practitioner PUID and organization KMFL in Provenance | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` |
| **Security Confidentiality & Sensitivity Tags** | `meta.security` confidentiality codes (`N`, `R`, `V`) and sensitive categories (`HIV`, `PSY`, `SUD`, `RH`) | **VERIFIED** | **IMPLEMENTED** | `@afyapoa/fhir-models/src/canonical.ts`, `apps/api/test/fhir-conformance.spec.ts` |
| **WHO ICD-11 MMS Mandatory Diagnostic Binding** | `http://id.who.int/icd/release/11/mms` syntax enforcement; legacy ICD-10 flagged as deprecated | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (tests ICD-11 200, ICD-10 422) |
| **LOINC & UCUM Clinical Observation Binding** | `http://loinc.org` and `http://unitsofmeasure.org` mandatory for vitals & lab results | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (test Blood Pressure LOINC/UCUM) |
| **FHIR $validate Exchange Operation** | `POST /api/v1/fhir/$validate` with actionable `OperationOutcome` & JSONPath diagnostics | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (tests valid 200, invalid 422) |
| **FHIR Patient SHR $export Operation** | `GET /api/v1/fhir/patients/:id/$export` exporting conformant SHR Collection Bundle | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (patient export tests) |
| **FHIR Claim $export Operation** | `GET /api/v1/fhir/claims/:id/$export` exporting conformant KenyaCoreClaim | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (claim export tests) |
| **DHA HIE Security Headers & Auth Verification** | `X-Facility-Id` (KMFL), `X-Facility-Id-Type` (fr-code), `X-Consent-Token`, `X-PUID` | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (tests 400 when missing headers) |
| **Safe Duplicate Ingestion & Idempotency** | SHA-256 payload digest preventing duplicate side-effects with idempotent acknowledgment | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (tests duplicate bundle 200 ACK) |
| **Tamper-Evident SHA-256 Audit Trail** | WORM audit log recording validation, ingestion, duplicate attempts, and export | **VERIFIED** | **IMPLEMENTED** | `apps/api/test/fhir-conformance.spec.ts` (audit hash chaining verified) |
| **Unverified / Deferred FHIR Profiles** | `Immunization`, `Device`, `Media`, `DocumentReference`, `QuestionnaireResponse` | **UNVERIFIED** | **DEFERRED** | Documented in `docs/open-questions.md`; not accepted by current DHA HIE v1.0 specifications |
---

## 18. National Registry Synchronization & Resilient Operations Compliance Matrix (Milestone 13)

Grounded in the **Digital Health Act 2023 (Section 22, 28, 47)**, the **Kenya Master Health Facility List (KMFL) v2.0 Specifications**, the **Kenya Health Worker Registry (HWR) Data Standards**, and the **DHA Health Information Exchange (HIE) v1.0 Interoperability Directives**.

| Operation / Invariant | Statutory Authority & Standard | DHA Requirement | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **Client Registry (CR / MPI) Sync** | DHA 2023 Sec 22; DHA CR Spec v1.0 | Bi-directional identity verification, CR ID and UPI mapping, patient identity status transition | **IMPLEMENTED** | `packages/database/src/schema.ts` (`registrySyncRecords`), `apps/api/test/registry-resilience.spec.ts` (test 1) |
| **Facility Registry (KMFL) Sync** | KMFL v2.0; Health Act 2017 Sec 105 | Authoritative Master Facility List synchronization, level, county, and active status validation | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 2) |
| **Health Worker Registry (HWR) Sync** | KMPDC / NCNA / PPB Statutory Boards; HWR Spec v1.0 | Practitioner Universal ID (PUID) attestation, active practicing license verification, board validation | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 3) |
| **Terminology Catalogue Sync** | DHA TS Architecture; WHO ICD-11; LOINC; KEML 2023 | Centralized concept validation, code system canonical resolution, deprecated concept identification | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 4) |
| **Version & Freshness Tracking** | DHA Interoperability Directive Sec 4.2 | Freshness TTL enforcement (CR 6h, KMFL 24h, HWR 12h, Terminology 7d), version incrementing | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (tests 5, 6) |
| **Cache Invalidation & Freshness Bypass** | Enterprise Resilience Pattern; DHA Cache Policy | Explicit invalidation endpoint (`POST /registry/cache/invalidate`), immediate `forceRefresh` bypass | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 7) |
| **Safe Handling of Retired Facilities** | KMFL De-registration Policy; DHA Data Integrity | Closed facilities marked `RETIRED` with historical claims and billing records preserved intact | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 9) |
| **Safe Handling of Suspended Workers** | KMPDC Act Cap 253; Health Act 2017 | Suspended practitioner profiles marked `RETIRED` while preserving historical clinical encounters | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 8) |
| **Authorization-Aware Access Controls** | DPA 2019 Sec 18; DHA 2023 Sec 47 | Granular permissions (`REGISTRY_SYNC_TRIGGER`, `REGISTRY_SYNC_READ`, `REGISTRY_REPLAY_MANAGE`) | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (tests 10, 11, 12) |
| **Offline Handling & Unverified Patient Isolation** | DHA 2023 Sec 47 (Emergency Care / Offline Invariant) | Offline patients strictly isolated in `UNVERIFIED_OFFLINE` / `PENDING_VERIFICATION` without assigning fake CR ID | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 13) |
| **Risk Gating (Prohibited Offline Operations)** | SHA 2023 Sec 37, 38; KRA eTIMS Sec 23A | Strict prohibition of queuing live authorization operations (`SHA_CLAIM_SUBMIT`, `SHA_PREAUTH_REQUEST`, `BIOMETRIC_CONSENT_VERIFY`) offline | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 14) |
| **AES-256-GCM Encrypted Storage for Queued Payloads** | DPA 2019 Sec 41, 44; DHA Security Baseline | Sensitive queue payloads encrypted at rest; retention policy: 14 days completed, 30 days DLQ | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 15) |
| **Bounded Retries with Exponential Backoff & Jitter** | Resilient Microservices Specification; DHA Integration Rulebook | Max 3 attempts, exponential backoff ($1000 \times 2^{\text{attempt}} \pm \text{jitter}$), DLQ transition on exhaustion | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 16) |
| **Dead-Letter Queue (DLQ) & Failed-Job Inspection** | ITIL Incident & Problem Management; DHA Auditing | Failed jobs quarantined to `DEAD_LETTER` with encrypted payload inspection and diagnostic root-cause | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 17) |
| **Safe DLQ Replay & Reconciliation** | Financial & Clinical Reconciliation Guideline | Authorized manual replay of failed jobs (`POST /registry/resilience/dlq/:id/replay`) with audit trail | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 18) |
| **Circuit Breakers for External Outages** | Circuit Breaker Pattern (Martin Fowler); DHA Gateway QoS | Fast-fail 503 after 3 consecutive failures; 5-second reset timeout; single-probe `HALF_OPEN` recovery | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (tests 19, 20) |
| **Expired Credentials Handling** | OAuth 2.0 RFC 6749; DHA HIE Security Spec | Clear propagation of `AUTH_FAILED` (HTTP 401) without crashing workers or leaking tokens | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 21) |
| **Safe Replay & Dry-Run Reconciliation** | Enterprise Data Quality & Reconciliation SOP | Preview stale/conflicting records without database updates (`POST /registry/reconcile` with `dryRun: true`) | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (tests 22, 23) |
| **Integration Health Monitoring Dashboard** | ISO/IEC 27001 Operational Monitoring; DHA Portal | Per-registry uptime, circuit breaker states, latency percentiles, active operational alerts | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 24) |
| **Operational Alerts for Persistent Failures** | SRE Alerting SLA; DHA Escalation Directive | Automated high-priority operational alert generated upon reaching 5 consecutive failures | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (test 25) |
| **Tamper-Evident SHA-256 Provenance & Audit Trail** | DPA 2019 Sec 43; DHA Audit Trail Standard | Immutable SHA-256 digest on synced payloads, recording source system, remote URL, user, and timestamp | **IMPLEMENTED** | `apps/api/test/registry-resilience.spec.ts` (tests 1, 8, 16, 18, 20, 25) |

---

## 19. Phase 2 Hospital Operations Statutory & Clinical Quality Compliance Matrix

Grounded in the **Health Act 2017 (Cap 241)**, the **Kenya Medical Practitioners and Dentists Council (KMPDC) Facility Norms and Standards (Levels 4–6)**, the **Nursing Council of Kenya (NCK) Standards of Nursing Practice**, the **WHO Guidelines for Safe Surgery**, the **Kenya National Clinical Guidelines for Maternal & Newborn Health**, and the **Kenya National Referral Strategy (2014–2020 & 2023–2030)**.

| Domain Module / Invariant | Statutory Authority & Standard | Kenyan Regulatory & Clinical Directive | Implementation Status | Evidence & Test Suite |
| :--- | :--- | :--- | :--- | :--- |
| **1. Inpatient Admission, Discharge & Transfer (ADT)** | Health Act 2017 Sec 15; KMPDC Hospital Rules | Preserves explicit distinction between `ADMITTED`, `TRANSFERRED`, and `DISCHARGED`. Admitting diagnosis ICD-11 binding. Automated bed release to `VACANT` upon transfer/discharge. | **IMPLEMENTED** | `apps/api/src/inpatient/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 1, 2, 3) |
| **2. Ward & Bed Management (Concurrency & Locking)** | KMPDC Hospital Norms; ISO 9001 Clinical Care | Optimistic version locking preventing double-allocation collisions. Bed status transitions (`VACANT` -> `OCCUPIED` -> `CLEANING`). Mixed/gender-specific ward safety. | **IMPLEMENTED** | `apps/api/src/inpatient/beds.service.ts`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 4, 5) |
| **3. Operating Theatre & Procedure Scheduling** | WHO Safe Surgery Checklist; KMPDC Surgical Standards | Slot overlap conflict detection and concurrency control. Enforces WHO 3-stage surgical checklist (Sign In, Time Out, Sign Out) with electronic attestation. | **IMPLEMENTED** | `apps/api/src/theatre/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 6, 7, 8) |
| **4. Maternity & Newborn Workflows** | MOH Maternal & Perinatal Death Surveillance; KMPDC Norms | Partograph tracking (cervical dilation, descent, contractions, fetal heart rate), APGAR scoring at 1/5/10 min, automatic provisioning of linked newborn MRN. | **IMPLEMENTED** | `apps/api/src/maternity/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 9, 10) |
| **5. Radiology & Confidential Specialist Imaging** | Radiation Protection Act (Cap 243); DPA 2019 Sec 44 | DICOM PACS Study Instance UID linking, radiologist report sign-off, amended addendum trail, and RBAC specialist authorization guard (`RADIOLOGY_SPECIALIST_READ`). | **IMPLEMENTED** | `apps/api/src/radiology/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 11, 12, 13, 14) |
| **6. Referrals & Counter-Referrals** | Kenya National Referral Strategy; KMFL Facility Registry | Outbound/inbound KMFL-aware dispatch, transport/ambulance logistics, urgency prioritization, and specialist counter-referral clinical feedback tracking. | **IMPLEMENTED** | `apps/api/src/referrals/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 15, 16) |
| **7. Appointments & Practitioner Scheduling** | KMPDC Code of Professional Conduct; Patient Charter | Practitioner double-booking conflict guards, status progression (`SCHEDULED` -> `CHECKED_IN` -> `IN_CONSULTATION` -> `COMPLETED`), cancellations. | **IMPLEMENTED** | `apps/api/src/appointments/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 17, 18) |
| **8. Medical Supplies & Procurement Intake** | Pharmacy and Poisons Act (Cap 244); Public Procurement Act | Dual-sign purchase order approval, Goods Received Note (GRN) with QA inspection, batch/lot tracking, expiry tracking, and designated storage bin allocation. | **IMPLEMENTED** | `apps/api/src/procurement/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 19, 20) |
| **9. Private Insurance Adapters** | Insurance Regulatory Authority (IRA) Guidelines | Pluggable adapters for Jubilee, AAR, APA, Britam, and Old Mutual. Real-time eligibility check, copay obligation calculation, remaining limits, preauthorization. | **IMPLEMENTED** | `apps/api/src/insurance/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 21, 22, 23) |
| **10. Staff Rosters & Departmental Assignments** | Employment Act 2007; NCK / KMPDC Staffing Norms | Multi-department organization, monthly roster management, shift distribution (`MORNING`, `AFTERNOON`, `NIGHT`, `ON_CALL`, `OFF`), and publishing audit trail. | **IMPLEMENTED** | `apps/api/src/rosters/`, `apps/api/test/hospital-operations-phase2.spec.ts` (tests 24, 25) |
| **11. Multi-Tenant RLS & Isolation** | Data Protection Act 2019 Sec 18; DHA 2023 Sec 22 | PostgreSQL native Row-Level Security (`tenant_isolation_policy`) guarantees Tenant B cannot view or mutate Tenant A clinical/operational records under any scenario. | **IMPLEMENTED** | `packages/database/src/schema.ts`, `apps/api/test/hospital-operations-phase2.spec.ts` (test 28) |


