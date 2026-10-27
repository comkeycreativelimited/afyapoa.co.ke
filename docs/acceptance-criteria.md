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
* **Status:** **VERIFIED & PASSING** (See [Tenant Isolation Evidence](file:///c:/wamp64/www/afya-poa/docs/security/tenant-isolation-evidence.md))
* **AC-02-01 (Database Engine Row-Level Security Isolation):**
  * *Given* two distinct hospital tenants (`Tenant A` with KMFL `12345` and `Tenant B` with KMFL `67890`),
  * *When* a user belonging to `Tenant A` queries the database via an application connection where `SET LOCAL app.current_tenant_id = 'tenant-a-id'` is executed,
  * *Then* the query result must return ONLY rows matching `tenant_id = 'tenant-a-id'`. Any direct attempt to query `tenant-b` rows must return an empty set or throw a security violation, even if the raw SQL query omits the `WHERE tenant_id = ...` clause.
  * *Verification Status:* **PASSED** (`packages/database/src/rls.spec.ts` & `apps/api/test/security-regression.spec.ts`).
* **AC-02-02 (MFA & Session Enforcement):**
  * *Given* a registered user with valid username and password,
  * *When* the user submits valid primary credentials,
  * *Then* the system issues an ephemeral partial session token and requires a valid 6-digit TOTP code before granting full JWT access and refresh tokens.
  * *Verification Status:* **PASSED** (`apps/api/test/security-regression.spec.ts`).
* **AC-02-03 (Clinician PUID License Validation):**
  * *Given* a clinician attempting to sign an e-prescription or clinical encounter note,
  * *When* the clinician's profile lacks a verified DHA HWR `X-PUID` or their regulatory license is expired,
  * *Then* the system prevents final signature and alerts the user to update their regulatory credentials.
  * *Verification Status:* **PASSED** (`apps/api/test/security-regression.spec.ts`).

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
* **AC-08-01 (FEFO Batch Allocation & Immutable Stock Deduction):**
  * *Given* two active inventory batches of Amoxicillin 500mg (Batch A expiring in 3 months, Batch B expiring in 12 months),
  * *When* the pharmacist dispenses 30 capsules against an authorized clinical order,
  * *Then* the system allocates stock from Batch A first, decrements available batch quantity atomically within a database transaction, and records an immutable `DISPENSE` entry in `pharmacy_stock_movements`.
* **AC-08-02 (Pessimistic Concurrency & Negative Stock Blocking):**
  * *Given* an inventory batch with a remaining balance of 10 tablets,
  * *When* two pharmacists simultaneously attempt to dispense 10 tablets from the same batch,
  * *Then* the first transaction acquires a row-level lock (`SELECT ... FOR UPDATE`), completes successfully, and the second transaction is rejected with an HTTP 409 Conflict error, strictly preventing negative stock.
* **AC-08-03 (Partial Dispensing & Remaining Balance Tracking):**
  * *Given* an active prescription order for 60 tablets of Artemether + Lumefantrine,
  * *When* the pharmacy only has 20 tablets in stock and executes a partial dispensation,
  * *Then* the system records a `PARTIAL` dispense for 20 units, marks the order as partially fulfilled with 40 remaining, and permits subsequent `BALANCE_COMPLETION` dispensing when new stock is received.
* **AC-08-04 (Controlled Medication Returns & Justification Length Gate):**
  * *Given* a previously dispensed medication package,
  * *When* a return or reversal is submitted with a clinical justification under 10 characters,
  * *Then* the request is rejected with HTTP 400 Bad Request; and when submitted with $\ge 10$ characters, the batch stock is incremented via an auditable `RETURN` movement record.
* **AC-08-05 (Bedside Administration & HL7 FHIR R4 Serialization):**
  * *Given* an inpatient medication administration event,
  * *When* a ward nurse records the administered dose, route, site, and timestamp,
  * *Then* the record is linked to the patient and encounter, and serializes conformantly to HL7 FHIR R4 `MedicationAdministration` alongside `Medication` and `MedicationDispense` resources.

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

### Milestone 13: Expanded Hospital Operations (Phase 2 Approved Operations)
* **AC-13-01 (Inpatient ADT Lifecycle & State Machine):**
  * *Given* an admitted inpatient with provisional ICD-11 diagnosis,
  * *When* the patient is discharged with final diagnosis and disposition (`HOME_IMPROVED`, `TRANSFERRED_OUT`, `AGAINST_MEDICAL_ADVICE`, `DECEASED`, `REFERRED`),
  * *Then* the admission status updates to `DISCHARGED` and the allocated bed is immediately released to `CLEANING` / `VACANT`.
* **AC-13-02 (Ward & Bed Concurrency with Optimistic Locking):**
  * *Given* an inpatient bed in status `VACANT` with version $N$,
  * *When* two clinicians simultaneously attempt to admit different patients into the same bed,
  * *Then* the first transaction succeeds and increments the bed version to $N+1$ while marking it `OCCUPIED`; the second transaction is rejected with an optimistic concurrency locking conflict (`409 Conflict`), strictly preventing bed double-allocation.
* **AC-13-03 (Operating Theatre Scheduling & Slot Overlap Prevention):**
  * *Given* an operating theatre suite booked for a surgical case from 08:00 to 10:30,
  * *When* a user attempts to schedule a second procedure in the same theatre suite overlapping that time window (e.g., 09:30 to 11:30),
  * *Then* the booking is rejected with `409 Conflict: Theatre suite is already booked for this time slot`.
* **AC-13-04 (WHO 3-Stage Safe Surgery Checklist Attestation):**
  * *Given* an active surgical booking in `PREOP` status,
  * *When* the perioperative team completes Sign-In (before anesthesia), Time-Out (before skin incision), and Sign-Out (before leaving theatre),
  * *Then* each stage captures digital attestations, practitioner PUIDs, and timestamps, preventing procedure closure without verified checklists.
* **AC-13-05 (Maternity Labor & Delivery Partograph Documentation):**
  * *Given* a parturient admitted to the labor ward,
  * *When* the midwife documents the delivery (mode, outcome, estimated blood loss in ml, perineal tear grade, and partograph progression),
  * *Then* an immutable delivery record is created in `maternity_deliveries` linked to the maternal admission file.
* **AC-13-06 (Newborn Intake, APGAR Scoring & Auto-Provisioned Patient MRN):**
  * *Given* a live delivery record,
  * *When* the neonatal nurse enters birth order, APGAR scores at 1, 5, and 10 minutes, and birth weight in grams,
  * *Then* the system automatically provisions a new child patient record in the master registry with a unique sequential MRN (`MRN-NB-YYYYMM-XXXX`) linked to the delivery record.
* **AC-13-07 (Radiology Orders, PACS Integration & Specialist Confidentiality):**
  * *Given* an imaging order marked `isConfidentialSpecialist: true`,
  * *When* a clinician lacking `RADIOLOGY_SPECIALIST_READ` authorization attempts to view the order or radiologist report,
  * *Then* the request is rejected with `403 Forbidden`, while authorized radiologists can review PACS DICOM Study Instance UIDs and author signed or amended reports.
* **AC-13-08 (KMFL-Aware Referrals & Closed-Loop Counter-Referrals):**
  * *Given* a patient requiring tertiary referral,
  * *When* the referring clinician selects an authorized KMFL destination facility and dispatches the referral with transport logistics,
  * *Then* an official `REF-YYYYMM-XXXX` voucher is generated, and upon tertiary care completion, the receiving specialist records counter-referral clinical advice returning the referral to `COMPLETED`.
* **AC-13-09 (Outpatient Appointments & Practitioner Double-Booking Prevention):**
  * *Given* a clinician scheduled for a clinic consultation between 09:00 and 09:30,
  * *When* a receptionist attempts to book a second patient for that same clinician in an overlapping window,
  * *Then* the booking is rejected with `409 Conflict: Practitioner is already booked for this consultation window`.
* **AC-13-10 (Medical Supplies Procurement, Dual Sign-off & GRN Quality Inspection):**
  * *Given* a purchase order created by a procurement officer,
  * *When* an independent administrator conducts dual-sign approval and the warehouse storekeeper processes incoming inventory via a Goods Received Note (GRN) with QA inspection, batch logging, expiry tracking, and storage bin allocation,
  * *Then* inventory balances update automatically with full batch-level traceability.
* **AC-13-11 (Private Insurance Adapters, Eligibility & Preauthorizations):**
  * *Given* an active private insurance policy for Jubilee, AAR, APA, Britam, or Old Mutual,
  * *When* real-time eligibility is checked or procedure preauthorization is requested,
  * *Then* the adapter calculates patient copay obligations, deducts remaining benefit limits, and tracks underwriter approval codes.
* **AC-13-12 (Staff Rosters, Departmental Hierarchy & Shift Publishing):**
  * *Given* a monthly departmental roster in `DRAFT` status,
  * *When* shifts (`MORNING`, `AFTERNOON`, `NIGHT`, `ON_CALL`, `OFF_DUTY`, `LEAVE`) are allocated to personnel and formally published by the head of department,
  * *Then* the roster status advances to `PUBLISHED` and generates an immutable `ROSTER_PUBLISHED` audit event.

---

### Milestone 14: Platform Administration & SaaS Subscriptions
* **AC-14-01 (Automated Tenant Provisioning):**
  * *Given* a super-admin approving a new Level 4 hospital subscription,
  * *When* tenant provisioning is triggered via `POST /api/v1/platform/tenants/onboard`,
  * *Then* the system initializes the tenant record, sets up its KMFL configuration, enables the respective feature flags (Inpatient, Theatre, Lab, Pharmacy), and provisions admin credentials within $\le 30\text{ seconds}$.
* **AC-14-02 (Tenant Usage & Quota Monitoring):**
  * *Given* a tenant on the "Level 4 Standard" subscription plan with a monthly quota of 2,500 encounters,
  * *When* the encounter count reaches $80\%$,
  * *Then* the hospital administrator receives automated quota alerts and warning flags on the usage dashboard.
* **AC-14-03 (Server-Side Entitlement & Quota Enforcement):**
  * *Given* a tenant whose subscription tier does not include private insurance integration or whose encounter quota is exceeded,
  * *When* attempting to invoke restricted domain APIs,
  * *Then* the API enforces rejection server-side with HTTP 403 Forbidden or HTTP 400 Bad Request, guaranteeing that hidden UI elements are never relied upon as security controls.
* **AC-14-04 (Subscription Lifecycle Transitions & Capacity Guard):**
  * *Given* a hospital administrator attempting to downgrade their plan to a tier with fewer allowed staff accounts than currently active,
  * *When* submitting the downgrade request,
  * *Then* the server blocks the downgrade with a descriptive error message until surplus staff accounts are deactivated.
* **AC-14-05 (Platform Invoicing with 16% Kenyan VAT):**
  * *Given* a platform invoice generated for a hospital tenant,
  * *When* calculating the line item balances,
  * *Then* the invoice computes 16% standard VAT, enforces idempotency via `idempotencyKey`, and generates a sequential tracking number (`INV-SAAS-YYYYMM-XXXXX`).
* **AC-14-06 (Idempotent M-Pesa SaaS Fee Collection):**
  * *Given* a hospital finance officer paying a platform invoice via M-Pesa STK push,
  * *When* submitting the payment request with an idempotency key,
  * *Then* the payment adapter processes the charge once, marks the invoice as `PAID`, and rejects any duplicate payment attempts.
* **AC-14-07 (5-Stage Dunning & Statutory Patient Safety Safeguard):**
  * *Given* recurring payment failures on an overdue platform invoice,
  * *When* dunning progresses through `INITIAL_FAILURE`, `GRACE_DAY_3`, `WARNING_DAY_7`, `RESTRICTED_DAY_14`, and `SUSPENDED_DAY_30`,
  * *Then* commercial modifications (upgrades, new staff) are restricted, but clinician read access to active emergency patient records is strictly protected and never disabled under Section 7 of the Kenya Health Act 2017.
* **AC-14-08 (Subscription Revenue Reporting & Reconciliation):**
  * *Given* active and past subscriptions across all tenants,
  * *When* the super admin queries subscription reports and triggers reconciliation,
  * *Then* the system accurately computes MRR and ARR, matches completed payments against invoices, and outputs a balanced reconciliation audit.
* **AC-14-09 (Platform Health & National Gateway Monitoring):**
  * *Given* platform operations,
  * *When* super admins query `/platform/health/status` and `/platform/metrics/integrations`,
  * *Then* real-time component health and national gateway metrics (DHA HIE, SHA Claims, KRA eTIMS, M-Pesa) report latency percentiles and uptime.
* **AC-14-10 (Administrative Support Cases & Message Threads):**
  * *Given* an administrative issue logged by a hospital administrator,
  * *When* support tickets are submitted and responded to,
  * *Then* the platform maintains a threaded conversation with category, priority, and status transitions.
* **AC-14-11 (Controlled, Auditable Support Access Grants):**
  * *Given* a hospital administrator authorizing temporary support access,
  * *When* issuing a grant,
  * *Then* the platform generates a time-bound (max 24h) cryptographic bearer token (stored as a SHA-256 hash), permits scoped access, and allows immediate revocation.
* **AC-14-12 (Tenant Offboarding & Statutory 10-Year Data Retention):**
  * *Given* an offboarding request from a departing facility,
  * *When* offboarding is initiated and completed,
  * *Then* the platform schedules a statutory 10-year clinical data retention archive (Health Act 2017), generates a sealed encrypted data export bundle with SHA-256 checksum, and transitions the tenant to archived status.

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
* **Status:** **VERIFIED & PASSING** (See [Comprehensive QA Evidence Report](file:///c:/wamp64/www/afya-poa/docs/test-evidence/comprehensive-qa-report.md))
* **AC-16-01 (High-Throughput Concurrency Benchmark):**
  * *Given* a load test simulation of a 500-bed hospital workload (25 concurrent workers, 150 operations) and a 1,000-tenant SaaS scenario (200 cross-tenant transactions),
  * *When* generating mixed clinical traffic (patient search, encounter lookup, order queries, and rapid cross-tenant interleaving),
  * *Then* the 1,000-tenant p95 response time remains $\le 15\text{ ms}$ with zero cross-tenant data leakage, and the overall service achieves $100\%$ availability with $0\%$ error rate.
  * *Verification Status:* **PASSED** ([`apps/api/test/performance-capacity.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/performance-capacity.spec.ts)).
* **AC-16-02 (Disaster Recovery, Cryptographic Backups & Restoration):**
  * *Given* an encrypted AES-256-GCM logical backup archive with SHA-256 manifest integrity hashing,
  * *When* simulating catastrophic data purge and executing disaster recovery restoration,
  * *Then* the cluster restores $100\%$ row parity across all clinical tables, maintains active Row-Level Security (`relrowsecurity = true`), detects archive bit tampering, and verifies unbroken SHA-256 WORM audit trail continuity.
  * *Verification Status:* **PASSED** ([`apps/api/test/backup-restoration.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/backup-restoration.spec.ts)).
* **AC-16-03 (Synthetic Patient Journey & Failure-Injection Verification):**
  * *Given* an uninterrupted synthetic patient journey across 15 standard clinical stages and 5 adverse scenarios (rejection, timeout, duplicate submission, connectivity loss, and mock distinction),
  * *When* executing the automated journey and injecting upstream 504 timeouts, 503 outages, and 429 rate limits,
  * *Then* the system degrades gracefully with structured failure responses, persists offline records locally, enforces duplicate barriers, and completes all 20 stages without unhandled crashes.
  * *Verification Status:* **PASSED** ([`apps/api/test/synthetic-patient-journey.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/synthetic-patient-journey.spec.ts) & [`apps/api/test/failure-injection-resilience.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/failure-injection-resilience.spec.ts)).
