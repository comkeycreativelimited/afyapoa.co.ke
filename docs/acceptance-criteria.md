# COMKEY AFYA POA — Testable Acceptance Criteria & Verification Gates

**Document Identifier:** `AC-AFYAPOA-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Approved for Implementation Roadmap  
**Date:** October 19, 2026  

---

## 1. Scope & Verification Framework

This document defines the formal, testable acceptance criteria for every major capability of **COMKEY AFYA POA**. All criteria are formulated using **Given-When-Then (Gherkin)** behavioral specifications, accompanied by verification gates that must pass prior to promotion across development, staging, UAT, and production environments.

---

## 2. Milestone Acceptance Criteria

### Milestone 1: Repository & Engineering Foundation
* **AC-01-01 (Monorepo Build & Cache):**
  * *Given* a clean checkout of the repository with Node.js 20 LTS and pnpm,
  * *When* `pnpm install` and `pnpm build` are executed,
  * *Then* all packages (`apps/web`, `apps/api`, `packages/domain-core`, `packages/database`, `packages/fhir-models`) compile with zero TypeScript errors, and Turborepo caches all artifacts with $\ge 90\%$ cache hit on second run.
* **AC-01-02 (CI Pipeline & Linting):**
  * *Given* a Pull Request opened against `main`,
  * *When* GitHub Actions runs the verification workflow,
  * *Then* ESLint, Prettier, TypeScript strict check, and unit tests run in parallel and pass within $\le 5$ minutes.

---

### Milestone 2: Tenant Isolation, Authentication & Authorization
* **AC-02-01 (Database Engine Row-Level Security Isolation):**
  * *Given* two distinct hospital tenants (`Tenant A` with KMFL `12345` and `Tenant B` with KMFL `67890`),
  * *When* a user belonging to `Tenant A` queries the database via an application connection where `SET LOCAL app.current_tenant_id = 'tenant-a-id'` is executed,
  * *Then* the query result must return ONLY rows matching `tenant_id = 'tenant-a-id'`. Any direct attempt to query `tenant-b` rows must return an empty set or throw a security violation, even if the raw SQL query omits the `WHERE tenant_id = ...` clause.
* **AC-02-02 (MFA & Session Enforcement):**
  * *Given* a registered user with valid username and password,
  * *When* the user submits valid primary credentials,
  * *Then* the system issues an ephemeral partial session token and requires a valid 6-digit TOTP code before granting full JWT access and refresh tokens.
* **AC-02-03 (Clinician PUID License Validation):**
  * *Given* a clinician attempting to sign an e-prescription or clinical encounter note,
  * *When* the clinician's profile lacks a verified DHA HWR `X-PUID` or their regulatory license is expired,
  * *Then* the system prevents final signature and alerts the user to update their regulatory credentials.

---

### Milestone 3: Core Database & Shared Infrastructure
* **AC-03-01 (WORM Audit Trail Tamper Evidence):**
  * *Given* an existing audit log entry in the `audit_events` table with an established SHA-256 hash chain,
  * *When* an administrative user attempts to execute an `UPDATE` or `DELETE` SQL statement against the `audit_events` table,
  * *Then* the PostgreSQL database trigger immediately raises an exception and aborts the transaction (`FORBIDDEN: audit_events rows are immutable`).
* **AC-03-02 (KMS Envelope Encryption):**
  * *Given* a sensitive demographic field (e.g., patient phone number or national identity number),
  * *When* written to the database,
  * *Then* the field is encrypted with AES-256-GCM using a tenant-specific data key, and a database administrator inspecting raw storage sees only ciphertext with an initialization vector (IV) and authentication tag.

---

### Milestone 4: Patient Registration & Identity Management
* **AC-04-01 (Deterministic Blind Index Search):**
  * *Given* a registered patient whose National ID is stored encrypted via AES-256-GCM,
  * *When* a triage nurse searches for the patient by entering their exact 8-digit National ID,
  * *Then* the system computes the HMAC-SHA256 blind index using the KMS pepper, executes an indexed lookup on `national_id_bindex`, and retrieves the patient record in $\le 50\text{ ms}$ without decrypting the entire table.
* **AC-04-02 (DHA Client Registry Verification):**
  * *Given* an active internet connection to the DHA HIE gateway,
  * *When* a patient provides their National ID during registration,
  * *Then* the system queries the DHA Client Registry (CR), populates the verified national `X-CRID`, and prompts the user to verify demographics.
* **AC-04-03 (Emergency Unknown Patient Intake):**
  * *Given* an unconscious, trauma patient arriving without identification documents,
  * *When* the triage nurse selects "Emergency Unknown Intake",
  * *Then* the system generates an immediate temporary `UNKNOWN-EMERGENCY-[UUID]` record and admits the patient in $<5$ seconds without blocking care.

---

### Milestone 5: Encounters, Triage & Clinical Documentation
* **AC-05-01 (Vital Signs & Acuity Stratification):**
  * *Given* a patient at the triage desk,
  * *When* the nurse enters vital signs (e.g., Blood Pressure $80/50$, Heart Rate $130$, SpO2 $88\%$),
  * *Then* the system automatically highlights severe abnormal ranges in red and assigns an acuity score of Emergency Level 1/2.
* **AC-05-02 (24-Hour ECCIF Countdown SLA Watcher):**
  * *Given* an emergency triage encounter created for an ECCIF-eligible patient,
  * *When* the encounter is saved,
  * *Then* a BullMQ background job is enqueued with a 24-hour statutory deadline, triggering warning alerts at 6h, 12h, and 18h if the clinical note and claim remain unsubmitted.
* **AC-05-03 (Clinical Note Immutability & Addenda):**
  * *Given* a doctor has finalized and electronically signed a clinical encounter note,
  * *When* the doctor or another clinician attempts to modify the text,
  * *Then* the original note remains unchanged, and the system requires saving modifications as a timestamped "Clinical Addendum" signed by the attending practitioner.

---

### Milestone 6: Diagnoses, Terminology & Clinical Orders
* **AC-06-01 (Mandatory ICD-11 Validation):**
  * *Given* a doctor recording a primary assessment or discharge diagnosis,
  * *When* typing symptoms or colloquial conditions (e.g., "typhoid fever"),
  * *Then* the auto-suggest engine presents valid WHO ICD-11 codes (e.g., `1A07 Typhoid fever`), and saving without an official ICD-11 code is blocked for SHA claims.
* **AC-06-02 (CPOE Order Routing):**
  * *Given* a signed prescription or lab investigation order,
  * *When* the doctor submits the order,
  * *Then* the system automatically splits and routes the items to the respective Pharmacy and Laboratory worklists in real-time.

---

### Milestone 7: Laboratory Management
* **AC-07-01 (Specimen Accessioning & Barcode Generation):**
  * *Given* an active lab investigation order,
  * *When* the lab technician clicks "Collect Specimen",
  * *Then* a unique 12-character barcode identifier (Code 128 / QR) is generated, linking the sample tube to the patient encounter and test catalog.
* **AC-07-02 (Critical Value Automated Notification):**
  * *Given* a lab test result entered with a critical physiological value (e.g., Serum Potassium $6.8\text{ mmol/L}$ or Hemoglobin $4.5\text{ g/dL}$),
  * *When* the technician authorizes the result,
  * *Then* the system flags the result in bold red and dispatches an immediate high-priority push notification and SMS to the ordering clinician.

---

### Milestone 8: Pharmacy & Medication Dispensing
* **AC-08-01 (Drug-Drug Interaction & Allergy Interception):**
  * *Given* a patient with a documented penicillin allergy,
  * *When* a clinician prescribes Amoxicillin,
  * *Then* a modal alert intercepts the prescription displaying a "Severe Allergy Warning: Patient has documented penicillin anaphylaxis", requiring an override reason if forced.
* **AC-08-02 (FEFO Dispensing & Inventory Deduct):**
  * *Given* two inventory batches of Paracetamol (Batch A expiring in 30 days, Batch B expiring in 180 days),
  * *When* the pharmacist dispenses 20 tablets,
  * *Then* the system automatically deducts stock from Batch A first, updating the digital stock ledger.

---

### Milestone 9: Patient Billing & Payments
* **AC-09-01 (M-Pesa STK Push Integration):**
  * *Given* an outstanding bill of KES 1,500,
  * *When* the cashier enters the patient's Safaricom phone number and triggers STK Push,
  * *Then* the patient receives a PIN prompt on their handset, and upon successful entry, the Daraja C2B webhook clears the bill and issues a receipt in $\le 5\text{ seconds}$.
* **AC-09-02 (KRA eTIMS Automated Signing):**
  * *Given* any generated patient invoice or cash receipt,
  * *When* the transaction is committed,
  * *Then* the background BullMQ worker compiles the eTIMS payload, receives a signed KRA Control Code, and stamps the official fiscal QR code onto the printable invoice.

---

### Milestone 10: DHA/SHA Mock Services & Integration Framework
* **AC-10-01 (Hexagonal Driver Switching):**
  * *Given* an environment configuration `INTEGRATION_DRIVER=MOCK`,
  * *When* any DHA HIE or SHA eClaims endpoint is invoked,
  * *Then* the system routes the request to an in-memory synthetic simulator that responds in $<10\text{ ms}$ with valid FHIR bundles and mock approval codes without making outbound network calls.
* **AC-10-02 (Contract Testing Against DHA Schemas):**
  * *Given* the official DHA FHIR R4 schema definitions,
  * *When* the automated contract test suite executes,
  * *Then* all serialized JSON payloads generated by `packages/fhir-models` validate against DHA JSON schemas with $100\%$ schema conformance.

---

### Milestone 11: SHA Eligibility & Claims
* **AC-11-01 (5-Step Eligibility Verification):**
  * *Given* a patient presenting with an SHA member card number,
  * *When* the triage officer verifies eligibility,
  * *Then* the system queries the SHA gateway and displays: (1) Active Membership Status, (2) Fund Category (PHC, SHIF, or ECCIF), (3) Remaining Benefit Balance, (4) Preauthorization Requirements, and (5) Co-pay amounts.
* **AC-11-02 (FHIR R4 Claim Compilation & Asynchronous Dispatch):**
  * *Given* an encounter bill with verified ICD-11 diagnosis, itemized pharmacy and lab charges,
  * *When* the billing officer clicks "Submit SHA Claim",
  * *Then* a FHIR R4 `Claim` bundle is generated and queued in BullMQ with an exponential backoff retry policy (5 retries with jitter).

---

### Milestone 12: FHIR Exchange & Shared Health Records (SHR)
* **AC-12-01 (Patient Consent Lifecycle via OTP):**
  * *Given* a request to query a patient's historical records from the DHA National Shared Health Record,
  * *When* the clinician initiates the SHR request,
  * *Then* the DHA gateway sends a 6-digit OTP to the patient's registered mobile number; the clinician cannot view the external SHR until the patient provides and enters the valid OTP.
* **AC-12-02 (Clinical Encounter SHR Publishing):**
  * *Given* a completed patient encounter with verified patient consent,
  * *When* the encounter is closed,
  * *Then* the system compiles a FHIR R4 `Composition` bundle and transmits it to the DHA SHR repository, recording the national transaction reference ID.

---

### Milestone 13: Expanded Hospital Operations
* **AC-13-01 (Inpatient Bed Management & Transfer):**
  * *Given* an admitted inpatient,
  * *When* the patient is transferred from the Emergency Ward to the Male Surgical Ward (Bed 12),
  * *Then* Bed 12 status changes to `OCCUPIED`, the previous emergency bed is marked `NEEDS_CLEANING`, and the daily bed rate updates on the patient's running bill.
* **AC-13-02 (Surgical Theatre Scheduling):**
  * *Given* an elective surgery scheduled for Theatre 1 at 10:00 AM,
  * *When* a surgeon attempts to schedule a second procedure in Theatre 1 at 10:30 AM,
  * *Then* the system prevents the booking with a "Theatre Conflict Alert" displaying the overlapping case.

---

### Milestone 14: Platform Administration & SaaS Subscriptions
* **AC-14-01 (Automated Tenant Provisioning):**
  * *Given* a super-admin approving a new Level 4 hospital subscription,
  * *When* tenant provisioning is triggered,
  * *Then* the system initializes the tenant record, sets up its KMFL configuration, enables the respective feature flags (Inpatient, Theatre, Lab, Pharmacy), and provisions admin credentials within $\le 30\text{ seconds}$.
* **AC-14-02 (Tenant Usage & Quota Monitoring):**
  * *Given* a tenant on the "Basic Level 2" subscription plan with a monthly quota of 1,000 encounters,
  * *When* the encounter count reaches $80\%$,
  * *Then* the hospital administrator receives automated email/SMS quota alerts.

---

### Milestone 15: Security, Compliance & Certification-Readiness
* **AC-15-01 (Automated 72-Hour ODPC Incident Notification):**
  * *Given* a detected high-severity data breach incident,
  * *When* the Incident Commander sets the incident status to `BREACH_CONFIRMED`,
  * *Then* the system automatically generates an encrypted, standardized DPA Form 1 notification draft addressed to the ODPC and initiates a 72-hour countdown tracker.
* **AC-15-02 (DHA Pre-UAT Automated Test Suite):**
  * *Given* the complete DHA certification test checklist (CR query, FR verify, HWR lookup, OTP consent, SHR push, Terminology search),
  * *When* the automated pre-UAT test suite is run,
  * *Then* all simulated scenarios pass with $100\%$ green results and produce an auditable PDF compliance report.

---

### Milestone 16: Performance Testing, Deployment & Operational Handover
* **AC-16-01 (High-Throughput Concurrency Benchmark):**
  * *Given* a load test simulation of 2,000 concurrent clinicians across 100 hospital tenants,
  * *When* generating mixed traffic (patient registration, triage vitals, clinical note saving, and billing),
  * *Then* the API p95 response time remains $\le 200\text{ ms}$, CPU utilization remains $\le 70\%$, and zero deadlocks occur in PostgreSQL.
* **AC-16-02 (Disaster Recovery & Point-In-Time Recovery):**
  * *Given* a simulated database corruption or host failure,
  * *When* the disaster recovery procedure is initiated using continuous WAL archives,
  * *Then* the cluster is restored to a functioning state within $\le 30\text{ minutes}$ (RTO) with zero financial transaction data loss (RPO = 0).
