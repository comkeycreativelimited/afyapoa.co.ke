# COMKEY AFYA POA — Product Requirements Document (PRD)

**Document Identifier:** `PRD-AFYAPOA-2026-V1`  
**Product Name:** COMKEY AFYA POA  
**Classification:** Multi-Tenant Healthcare Management Information System (HMIS) SaaS  
**Target Sector:** Kenyan Healthcare Facilities (Levels 2–6 Dispensaries, Health Centres, Sub-County, County Referral, and National Hospitals)  
**Author:** Principal Software Architect & Healthcare Compliance Researcher  
**Status:** Approved for Implementation Roadmap  
**Date:** October 19, 2026  

---

## 1. Executive Summary & Vision

### 1.1 Product Vision
**COMKEY AFYA POA** is a cloud-first, multi-tenant Health Management Information System (HMIS) specifically engineered for the Kenyan healthcare ecosystem. It provides Kenyan public, faith-based (FBO), and private healthcare facilities (Levels 2 to 6) with an integrated clinical, administrative, and fiscal management platform that guarantees:
1. **Seamless National Integration:** Native bi-directional connectivity with the Digital Health Agency (DHA) Health Information Exchange (HIE) and the Social Health Authority (SHA) eClaims switch.
2. **Absolute Data Sovereignty:** Strict compliance with the Kenya Data Protection Act, 2019 (Regulation 26 data localization) and Ministry of Health data residency mandates.
3. **Fiscal Transparency:** Direct compliance with Kenya Revenue Authority (KRA) eTIMS automated invoice signing (Tax Procedures Act Section 23A).
4. **Offline Operational Continuity:** High-resilience point-of-care emergency intake and clinical capture capable of functioning during internet disruptions.

### 1.2 Target Facilities & Scope
* **Level 2 (Dispensaries & Clinics):** Outpatient triage, basic clinical notes, essential drug dispensing, SHA Primary Healthcare Fund (PHC) billing, eTIMS fiscalization.
* **Level 3 (Health Centres & Maternity Homes):** Level 2 scope + observation beds, maternity/delivery records, basic laboratory testing, SHA SHIF benefit management.
* **Level 4 & 5 (Sub-County & County Referral Hospitals):** Level 3 scope + multi-specialty inpatient wards, theatre/surgical scheduling, specialized diagnostic laboratory, radiology, pharmacy inventory management, Emergency Chronic & Critical Illness Fund (ECCIF) 24-hour emergency claims.
* **Level 6 (National Referral & Teaching Hospitals):** Multi-facility tenant hierarchy, complex sub-specialty clinics, residency/intern supervision, intensive care units (ICU/HDU), high-throughput automated laboratory instrumentation, automated national registry sync.

---

## 2. Regulatory & Statutory Alignment

| Regulation / Act | Governing Body | Impact on COMKEY AFYA POA | System Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Digital Health Act, 2023** | Digital Health Agency (DHA) | Mandates integration with the National HIE, adoption of Kenya Core FHIR R4 profiles, and sync with CR, FR, and HWR master registries. | Dedicated DHA HIE Adapter with mandatory `X-Facility-Id` and `X-PUID` headers, FHIR R4 SHR Collections, and OTP/biometric patient consent. |
| **Social Health Insurance Act, 2023** | Social Health Authority (SHA) | Replaces NHIF with three statutory funds: Primary Healthcare Fund (PHC), Social Health Insurance Fund (SHIF), and Emergency, Chronic & Critical Illness Fund (ECCIF). | Automated 5-step SHA eligibility verification, digital preauthorization requests, 24-hour ECCIF emergency submission watcher, and status callbacks. |
| **Data Protection Act, 2019** | Office of the Data Protection Commissioner (ODPC) | Sections 25–30 (Principles), Section 41 (Data Security), Section 43 (72h breach notice), Reg 26 (Data Localization). | AES-256-GCM field encryption, HMAC-SHA256 blind indexing, PostgreSQL RLS tenant isolation, WORM audit trails, Kenyan Tier-3 cloud hosting. |
| **Tax Procedures Act, 2015 (Sec 23A)** | Kenya Revenue Authority (KRA) | All commercial and private hospital invoices must generate cryptographically signed eTIMS fiscal invoices with QR codes. | Asynchronous eTIMS background signing queue, fiscal receipt buffer, offline signature buffering. |
| **Health Act, 2017 & Standards** | Ministry of Health (MoH) / KMPDC | Patient right to emergency medical treatment (Article 43 Constitution), clinical auditability, professional licensing verification. | Unrestricted emergency admission bypass, mandatory clinician PUID licensing checks, indelible clinical notes. |

---

## 3. Persona Profiles & User Journeys

### 3.1 Personas
1. **P1: Hospital Triage Nurse (Faith)**  
   * *Goal:* Rapidly record patient vitals, verify SHA active insurance status, check patient consent, and assign emergency triage acuity (Manchester/Emergency Severity Index).
   * *Pain Points:* Slow internet freezing the check-in screen; confusing OTP consent delays during trauma admissions.
2. **P2: Medical Officer / Surgeon (Dr. Otieno)**  
   * *Goal:* View comprehensive past longitudinal history from DHA Shared Health Record (SHR), capture clinical encounters with standardized ICD-11 codes, and order lab/pharmacy items.
   * *Pain Points:* Unfamiliarity with 7-character ICD-11 alphanumeric codes; lost lab results; tedious preauthorization paperwork.
3. **P3: Chief Pharmacist (Wanjiku)**  
   * *Goal:* Verify e-prescriptions, perform drug-allergy and contraindication cross-checks, dispense medications, track batch expiry, and maintain FEFO inventory.
   * *Pain Points:* Stock-outs of essential national list drugs; mismatched unit prices on SHA co-pays.
4. **P4: Hospital Billing & Claims Officer (Kipchoge)**  
   * *Goal:* Collate encounter bills, submit eClaims to SHA within statutory deadlines, ensure KRA eTIMS invoices are signed, and reconcile remittances.
   * *Pain Points:* Forfeiture of ECCIF claims exceeding 24 hours; high claim rejection rates due to missing diagnostic attachments.
5. **P5: Hospital Administrator / Medical Superintendent (Dr. Amina)**  
   * *Goal:* Monitor facility occupancy, clinician productivity, revenue cycle health, statutory compliance, and DHA sync status.
   * *Pain Points:* Cross-tenant data leakage fears; lack of real-time visibility into claim rejections.
6. **P6: SaaS Platform Super-Administrator (Comkey SRE)**  
   * *Goal:* Onboard new facility tenants, manage tenant subscription tiers, monitor infrastructure health, and maintain uptime SLAs.

---

## 4. Functional Requirements by Domain

### 4.1 Tenancy & Identity Access Management (IAM)
* **FR-TEN-01:** The system shall support hierarchical multi-tenancy, isolating facility data by unique `tenant_id` at the database engine layer using PostgreSQL Row-Level Security (RLS).
* **FR-TEN-02:** Facilities shall be identified by official Ministry of Health Kenya Master Health Facility List (KMFL) codes (`FID-XX-XXXXXX-X`).
* **FR-IAM-01:** System users shall authenticate via OAuth 2.0 / OIDC with Time-Based One-Time Password (TOTP) Multi-Factor Authentication (MFA).
* **FR-IAM-02:** Role-Based Access Control (RBAC) and Attribute-Based Access Control (ABAC) shall govern permissions across roles: `FACILITY_ADMIN`, `TRIAGE_NURSE`, `CLINICIAN`, `LAB_TECH`, `PHARMACIST`, `BILLING_CLERK`, `RECORDS_OFFICER`, and `SUPER_ADMIN`.
* **FR-IAM-03:** All practicing clinicians must have their national regulatory board license verified against the DHA Health Worker Registry (HWR) and assigned a verified `X-PUID`.

### 4.2 Patient Registration & Master Patient Index (MPI)
* **FR-PAT-01:** Patient registration shall capture demographic data: Full Name, Date of Birth, Biological Sex, Phone Number, County of Residence, and National Identifier (National ID, Alien ID, Birth Certificate No, Passport, or NEMIS ID).
* **FR-PAT-02:** Patient National ID and Phone Number shall be encrypted at rest using AES-256-GCM and indexed for exact-match retrieval via HMAC-SHA256 blind indexing.
* **FR-PAT-03:** The system shall integrate with the DHA Client Registry (CR) to verify and resolve the national Client Registry Identifier (`X-CRID`).
* **FR-PAT-04:** For unidentified/unconscious emergency patients, the system shall assign a temporary `UNKNOWN-EMERGENCY-[UUID]` identifier, allowing immediate clinical care without blocking registration.

### 4.3 Encounter Management & Clinical Triage
* **FR-ENC-01:** Encounters shall be categorized into: `OUTPATIENT`, `INPATIENT`, `EMERGENCY`, `MATERNITY`, and `SPECIALIST_CLINIC`.
* **FR-ENC-02:** Triage shall capture standard vital signs: Blood Pressure (Systolic/Diastolic), Heart Rate, Respiratory Rate, Temperature, SpO2, Weight, Height, and Blood Glucose, with automatic BMI calculation and pediatric z-score alerts.
* **FR-ENC-03:** Triage shall assign an acuity triage score (Level 1: Resuscitation to Level 5: Non-Urgent).
* **FR-ENC-04:** For emergency encounters, the system shall automatically initiate a 24-hour statutory countdown timer for ECCIF claim generation and notification.

### 4.4 Clinical Documentation & Medical Orders
* **FR-CLN-01:** Clinicians shall record clinical notes using SOAP structure (Subjective, Objective, Assessment, Plan).
* **FR-CLN-02:** All diagnostic coding shall strictly enforce the WHO ICD-11 coding taxonomy. The system shall provide an intelligent auto-complete search engine matching colloquial clinical terms to formal ICD-11 codes.
* **FR-CLN-03:** The system shall support computerized physician order entry (CPOE) for laboratory investigations (coded with LOINC) and procedures (coded with ICHI).
* **FR-CLN-04:** Clinical notes once finalized and signed by a clinician shall become immutable. Revisions must be recorded as append-only addenda with timestamps and clinician digital signatures.

### 4.5 Laboratory Management
* **FR-LAB-01:** Laboratory orders shall generate unique barcoded accession numbers for specimen collection (blood, urine, CSF, sputum, tissue).
* **FR-LAB-02:** Laboratory technicians shall record specimen receipt, rejection criteria (hemolyzed, clotted, insufficient volume), and test execution status.
* **FR-LAB-03:** Test results shall include quantitative values, qualitative assessments, reference ranges based on patient age/sex, and automated critical value flags (e.g., severe hypoglycemia, critical troponin).
* **FR-LAB-04:** Results must be electronically authorized by a verified lab technologist/pathologist before publishing to the patient's EHR and DHA Shared Health Record.

### 4.6 Pharmacy & Medication Dispensing
* **FR-PHM-01:** E-prescriptions shall be transmitted in real-time to the outpatient/inpatient pharmacy queue upon clinician signature.
* **FR-PHM-02:** The pharmacy module shall perform automated drug-drug interaction (DDI) checks, dosage range validation, and known allergy alerts prior to dispensing.
* **FR-PHM-03:** Inventory tracking shall enforce First-Expiry, First-Out (FEFO) batch management, tracking lot numbers, national drug regulatory codes (PPB), and expiry dates.
* **FR-PHM-04:** Stock-out alerts shall trigger when inventory levels drop below tenant-configurable reorder points.

### 4.7 Billing, SHA eClaims & KRA eTIMS
* **FR-BIL-01:** The billing engine shall maintain dynamic charge masters supporting multi-payer fee schedules (Cash/M-Pesa, SHA PHC, SHA SHIF, SHA ECCIF, and Private Insurers).
* **FR-BIL-02:** The system shall integrate with Safaricom Daraja M-Pesa C2B and STK Push APIs for automated cash collection and real-time ledger settlement.
* **FR-BIL-03:** For all SHA patients, the system shall execute real-time 5-step eligibility verification (CRID query, active membership, benefit balance, referral authorization, and biometrics/OTP).
* **FR-BIL-04:** Claims shall be compiled into FHIR R4 `Claim` bundles and submitted electronically to the SHA claims switch via asynchronous BullMQ queues.
* **FR-BIL-05:** Every commercial patient transaction shall generate a KRA eTIMS electronic tax invoice with Control Code and QR code via background integration workers.

### 4.8 DHA Health Information Exchange (HIE) Sync
* **FR-HIE-01:** Patient consent for Shared Health Record (SHR) access shall be managed via verified DHA OTP or biometric verification flows.
* **FR-HIE-02:** Finalized clinical encounters shall be transformed into standard FHIR R4 DocumentReference / Bundle resources and transmitted to the DHA SHR repository.
* **FR-HIE-03:** The system shall handle DHA Terminology Service (TS) updates, caching ICD-11, LOINC, and ICHI concept maps locally with weekly delta syncs.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance & Scalability
* **NFR-PER-01:** 95th percentile (p95) API response time for clinical read/write operations shall be $\le 200\text{ ms}$ under normal operational load.
* **NFR-PER-02:** Point-of-sale receipt and invoice generation shall complete in $\le 500\text{ ms}$.
* **NFR-PER-03:** The system architecture shall horizontally scale to support at least 500 concurrent hospital tenants and 10,000 active clinical users without service degradation.

### 5.2 Reliability & Availability
* **NFR-REL-01:** The cloud platform shall guarantee $99.9\%$ monthly operational uptime (excluding scheduled maintenance windows communicated 48 hours in advance).
* **NFR-REL-02:** Recovery Point Objective (RPO) shall be $\le 5\text{ minutes}$ for clinical data and $0\text{ seconds}$ (zero data loss) for financial and billing transactions.
* **NFR-REL-03:** Recovery Time Objective (RTO) shall be $\le 30\text{ minutes}$ for service restoration from automated cloud snapshots.

### 5.3 Security & Data Protection
* **NFR-SEC-01:** All traffic in transit shall be encrypted with TLS 1.3 with forward secrecy. All storage volumes shall be encrypted with AES-256.
* **NFR-SEC-02:** Tenant isolation shall be guaranteed at the database engine level via PostgreSQL Row-Level Security (RLS). Cross-tenant queries must fail closed.
* **NFR-SEC-03:** Audit logs shall be write-once, read-many (WORM), cryptographically chained via SHA-256 hashes, and stored for a minimum statutory retention period of 7 years.
* **NFR-SEC-04:** All primary and secondary data storage shall remain within the territorial boundaries of the Republic of Kenya in compliance with DPA Regulation 26(2).

### 5.4 Usability & Accessibility
* **NFR-USA-01:** The web interface shall follow WCAG 2.1 Level AA accessibility guidelines.
* **NFR-USA-02:** The UI shall be fully responsive across desktop workstations, tablets (ward rounds), and mobile browsers (nurse triage).
* **NFR-USA-03:** Clinical entry workflows shall require no more than 3 clicks from patient selection to clinical notes capture.

---

## 6. System Boundaries & External Interfaces

```
+----------------------------------------------------------------------------------------------------+
|                                      COMKEY AFYA POA CLOUD HMIS                                    |
|                                                                                                    |
|   +-----------------------+     +-----------------------+     +--------------------------------+   |
|   |   Next.js 15 PWA      | <-> |  NestJS API Monolith  | <-> | PostgreSQL 16 (RLS + AES-256)  |   |
|   | (Tailwind, shadcn/ui) |     | (Modular Domains)     |     | Redis 7 (BullMQ Workers)       |   |
|   +-----------------------+     +-----------------------+     +--------------------------------+   |
|                                             |                                                      |
+---------------------------------------------|------------------------------------------------------+
                                              | Outbound HTTPS / mTLS
              +-------------------------------+-------------------------------+
              |                               |                               |
              v                               v                               v
+---------------------------+   +---------------------------+   +---------------------------+
|      DHA HIE GATEWAY      |   |     SHA eCLAIMS SWITCH    |   |     KRA eTIMS GATEWAY     |
| - Client Registry (CR)    |   | - Eligibility Check       |   | - Fiscal Invoice Signing  |
| - Facility Registry (FR)  |   | - Benefit Validation      |   | - Control Code Generation |
| - Health Worker Reg (HWR) |   | - Preauthorizations       |   | - QR Code Payload Signing |
| - Shared Health Rec (SHR) |   | - Claims Submission       |   |                           |
| - Terminology Service(TS) |   | - Remittance Advice       |   |                           |
+---------------------------+   +---------------------------+   +---------------------------+
```
