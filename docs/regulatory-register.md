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
