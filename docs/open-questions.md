# COMKEY AFYYA POA — Open Questions & Unverified Requirements Register

**Document Identifier:** `OQ-REG-2026-V1`  
**Target Platform:** COMKEY AFYYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Active Open-Questions Register (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026

---

## 1. Principles of this Register

In strict compliance with architectural and regulatory governance directives:
1. **Zero Fabrication:** No technical specification, API endpoint, FHIR profile, JSON payload, legal clause, or certification test has been invented or presumed.
2. **Exclusion of Ambiguity:** Any requirement that cannot be verified directly against active authoritative documentation or statutory instruments is documented here for empirical validation during subsequent phases.
3. **Traceability:** Every open question is assigned an owner, category, impact rating, and resolution path.

---

## 2. Inaccessible & Ambiguous Sources

| Issue ID | Source URL Attempted | Failure / Ambiguity Encountered | Date Attempted | Current Status | Impact on Architecture |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OQ-SRC-01** | `https://afyalink.dha.go.ke/` | HTTP request failed: DNS resolution failure (`dial tcp: lookup afyalink.dha.go.ke: no such host`). | Oct 19, 2026 | **UNAVAILABLE** | Must clarify whether AfyaLink has been rebranded/migrated to `https://afyaconnect.dha.go.ke` or `https://hie-docs.dha.go.ke`. |
| **OQ-SRC-02** | `https://afyaconnect.dha.go.ke` | DNS resolves, but developer registration portal requires verified Kenyan institutional credentials. | Oct 19, 2026 | **PENDING CREDENTIALS** | Sandbox developer keys cannot be auto-provisioned via public API; requires manual onboarding request to `afyaconnect.dha@gmail.com`. |
| **OQ-SRC-03** | `https://new.kenyalaw.org/` | Legal repository search indicates appeal ongoing in Court of Appeal (Civil Application E387 of 2024); final appellate decree date not yet gazetted. | Oct 19, 2026 | **MONITORING** | Substantive constitutional validity remains subject to appellate outcome. |

---

## 3. Technical & Architectural Open Questions

### OQ-TECH-01: Biometric Fingerprint Hardware Driver Interface
* **Domain:** DHA Consent Services / SHA Point-of-Care Authorization
* **Verified Knowledge:** `POST /api/v1/claims/authorize` generates an iframe URL where live fingerprint matching is displayed to the user.
* **Open Question:** What are the physical hardware requirements on client workstations at tenant clinics? Does the DHA iframe interact with devices via the standard WebAuthn browser API, or does it require a proprietary local background agent/service (e.g., SecuGen, DigitalPersona, Morpho USB daemon) installed on Windows/Linux client PCs?
* **Impact:** Affects minimum hardware requirements and client deployment scripts for client clinics.
* **Resolution Strategy:** Request technical hardware specifications from the DHA integration team during developer sandbox onboarding.

### OQ-TECH-02: Multi-Tenant Callback Webhook Dispatch Identification
* **Domain:** Asynchronous SHA Status Callbacks
* **Verified Knowledge:** Integrators register a callback URL using `POST /api/v1/callbacks/endpoints` and subscribe to operations via `POST /api/v1/callbacks/operations`.
* **Open Question:** In a multi-tenant SaaS architecture where COMKEY hosts hundreds of facilities under a single integrator service account, how does the callback payload identify the specific tenant facility? Is the `facility_id` (FR code) embedded in the root JSON body, in custom HTTP headers, or must the system parse the internal `claim_id` to look up the tenant in a global index?
* **Impact:** Inbound webhook router performance and tenant security isolation.
* **Resolution Strategy:** Inspect live sandbox callback payload samples during Phase 1 sandbox testing.

### OQ-TECH-03: Offline Mode & Store-and-Forward Constraints
* **Domain:** Triage, Clinical Consultation, Emergency Care
* **Verified Knowledge:** Clinics in rural or peri-urban Kenya experience intermittent internet connectivity. SHA eligibility checks and visit starts are real-time API calls.
* **Open Question:** What is the official DHA/SHA policy on offline service delivery? If a facility loses connectivity:
  * Can ECCIF emergency encounters be recorded in local offline cache and transmitted retroactively within the 24-hour limit?
  * What cryptographic mechanism or local timestamp is accepted by SHA to prove that an emergency patient presented while offline?
* **Impact:** Local offline-first architecture, local encryption, conflict resolution queues.
* **Resolution Strategy:** Formulate formal architectural clarification query to DHA Technical Standards Committee.

### OQ-TECH-04: KRA eTIMS API Integration Pattern for Health Services
* **Domain:** Hospital Billing & Fiscal Compliance
* **Verified Knowledge:** Section 23A of the Tax Procedures Act mandates eTIMS invoices for all business transactions. Medical services are VAT-exempt under First Schedule, VAT Act.
* **Open Question:** 
  * Does KRA require direct Virtual Sales Control Unit (VSCU) system-to-system integration for multi-tenant HMIS SaaS, or Online Sales Control Unit (OSCU)?
  * How are split bills handled when SHA pays 80% (claims invoice) and the patient pays 20% co-pay in cash? Are two separate eTIMS fiscal invoices generated, or one composite invoice with co-payer breakdown?
* **Impact:** Invoicing data model and billing state machine.
* **Resolution Strategy:** Consult KRA eTIMS technical team and review the latest eTIMS VSCU Technical Specifications (v2.1).

---

## 4. Legal & Regulatory Open Questions

### OQ-LEG-01: Appellate Litigation Outcome & Contingency
* **Domain:** Digital Health Act 2023 & Social Health Insurance Act 2023
* **Verified Knowledge:** The laws are currently operational under an interim stay of execution issued by the Court of Appeal.
* **Open Question:** If the Court of Appeal upholds the High Court's nullification in whole or in part, or orders an extension of parliamentary rectification:
  * What is the fallback integration protocol? Does SHA revert to legacy NHIF e-claim APIs, or maintain the CIHIS bridge?
  * What are the contractual protections for SaaS vendors who invested in DHA-certified interfaces?
* **Impact:** Regulatory stability and enterprise risk planning.
* **Resolution Strategy:** Legal counsel continuous monitoring of Kenya Law court causelists and Ministry of Health gazette notices.

### OQ-LEG-02: Status of Formal Digital Health Regulations
* **Domain:** Digital Health Act 2023 Subsidiary Legislation
* **Verified Knowledge:** The Digital Health Act 2023 provides broad statutory mandates, but specific operational regulations (e.g., precise data retention periods, cross-border research exemptions, specific telemedicine liability rules) were drafted for public review.
* **Open Question:** What is the official gazettement date and final text of the Digital Health (General) Regulations?
* **Impact:** Data retention and purging policies in database schema.
* **Resolution Strategy:** Cross-reference official Kenya Gazette publications.

### OQ-LEG-03: Data Localization Enforcement Mechanics
* **Domain:** Data Protection (General) Regulations 2021, Regulation 26
* **Verified Knowledge:** Processing personal data for health care requires a server in Kenya OR at least one serving copy stored in a data centre in Kenya.
* **Open Question:** For multi-tenant cloud providers (e.g., AWS Cape Town / Dublin or Azure South Africa), does an active database replication replica (Read Replica) hosted at an iColo or Africa Data Centres facility in Nairobi strictly satisfy the statutory definition of "at least one serving copy", or must write master operations occur within Kenya?
* **Impact:** Cloud infrastructure topology, latency, and hosting cost structures.
* **Resolution Strategy:** Submit an advisory request to the Office of the Data Protection Commissioner (ODPC) for formal regulatory guidance.

---

## 5. Summary & Action Plan

| Question ID | Priority | Responsible Role | Target Milestone for Closure |
| :--- | :--- | :--- | :--- |
| **OQ-SRC-01** | High | Lead Compliance Researcher | Discovery Phase Exit |
| **OQ-SRC-02** | Critical | Principal Architect | Pre-Sandbox Qualification |
| **OQ-TECH-01** | High | Principal Architect | Architectural Design (Hardware Spec) |
| **OQ-TECH-02** | High | Backend Integration Lead | Architectural Design (API Gateway) |
| **OQ-TECH-03** | Critical | Principal Architect | Architectural Design (Data Layer) |
| **OQ-TECH-04** | High | Billing & Compliance Lead | Financial Architecture Review |
| **OQ-LEG-01** | Medium | Corporate Legal Counsel | Milestone Gating / Quarterly |
| **OQ-LEG-02** | Medium | Regulatory Compliance Lead | Milestone Gating / Monthly |
| **OQ-LEG-03** | Critical | Cloud Infrastructure Lead | Infrastructure Provisioning Design |
