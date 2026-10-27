# COMKEY AFYA POA — Phased Technical Delivery Roadmap

**Document Identifier:** `ARCH-RDM-2026-V1`  
**System:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Architecture Proposal (Awaiting Approval)  
**Date:** October 19, 2026  

---

## 1. Roadmap Overview & Milestones

The technical delivery of COMKEY AFYA POA is structured into eight progressive phases designed to deliver verifiable clinical and compliance value while mitigating regulatory and technical risks:

```
+---------------------------------------------------------------------------------------------------+
|                               PHASED DELIVERY ROADMAP MILESTONES                                  |
|                                                                                                   |
|  [Phase 0: Foundations & Scaffolding]                                       (Weeks 1-2 | Effort: S)|
|    - Monorepo, Docker, CI/CD linting, OTel baseline, Prisma schema migrations                     |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 1: Multi-Tenancy & Core Security]                                   (Weeks 3-4 | Effort: M)|
|    - PostgreSQL RLS, TenantContextInterceptor, RBAC, Field Encryption, WORM Audit Logs            |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 2: Master Registries & Consent Subsystem]                           (Weeks 5-6 | Effort: L)|
|    - DHA Client Registry search, OTP/Biometric consent flows, Emergency consent bypass            |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 3: Clinical EHR & FHIR R4 SHR Synchronization]                      (Weeks 7-9 | Effort: XL|
|    - Outpatient/Inpatient charting, ICD-11, LOINC, PPB pharmacy, FHIR R4 Bundle generator        |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 4: Billing Folios & KRA eTIMS Invoicing]                            (Weeks 10-11| Effort: M|
|    - Real-time billing folios, co-pays, KRA VSCU API fiscal signing, QR codes                    |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 5: SHA eClaims Orchestration Engine]                                (Weeks 12-15| Effort: XL|
|    - Implementation of 8 Official Scenarios, Preauthorizations, 24h ECCIF watcher, Callbacks      |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 6: DHA UAT Demo & Formal Certification]                             (Weeks 16-17| Effort: L|
|    - Complete official DHA UAT Matrix, schedule demo, secure DHA Certificate of Conformance       |
|                                     |                                                             |
|                                     v                                                             |
|  [Phase 7: Production Launch & Facility Pilot]                              (Weeks 18-20| Effort: M|
|    - Deployment to Sovereign Kenyan Data Center, onboard first 3 pilot facilities                 |
+---------------------------------------------------------------------------------------------------+
```

*Effort Scale: Small (S: 1–2 weeks), Medium (M: 2–3 weeks), Large (L: 3–4 weeks), Extra-Large (XL: 4–6 weeks).*

---

## 2. Phase Breakdown & Acceptance Criteria

### Phase 0: Project Setup, Monorepo Scaffolding & CI/CD
* **Status:** **COMPLETED & VERIFIED (Milestone 1)**
* **Estimated Effort:** Small (S) | **Duration:** Completed
* **Dependencies:** Approved System Architecture.
* **Deliverables Implemented:**
  * Turborepo + pnpm monorepo structure with `apps/web` (Next.js 15), `apps/api` (NestJS 10), `apps/worker` (BullMQ), `apps/mock-server`, and shared packages (`packages/config`, `packages/logger`, `packages/domain-core`, `packages/fhir-models`, `packages/database`, `packages/integration-adapters`, `packages/ui`).
  * Docker Compose local development environment (PostgreSQL 16 with RLS extensions, Redis 7 with AOF persistence).
  * GitHub Actions CI pipeline (`.github/workflows/ci.yml`) running TypeScript typecheck, unit tests, and production builds.
  * Database migration and synthetic seed tooling generating 3 demonstration facilities with zero real patient data.
* **Verification Evidence:**
  1. `pnpm build` executes cleanly with 11/11 successful builds.
  2. `pnpm test` executes cleanly with 14/14 successful test suites passing 100%.
  3. `pnpm typecheck` executes cleanly with 18/18 tasks successful.
  4. Docker Compose containers `afyapoa-postgres` and `afyapoa-redis` healthy; migrations applied and synthetic seed completed.
  5. API `/health/readiness` and OpenAPI `/api/docs` verified live.

---

### Phase 1: Multi-Tenancy Isolation, Security & WORM Audit Logging
* **Status:** **COMPLETED & VERIFIED (Milestones 2 & 3)**
* **Estimated Effort:** Medium (M) | **Duration:** Completed
* **Dependencies:** Phase 0.
* **Deliverables Implemented:**
  * PostgreSQL Row-Level Security (RLS) migrations and `tenant_isolation_policy` across all tenant tables.
  * NestJS `TenantContextInterceptor` injecting `app.current_tenant_id` into transactions.
  * Asymmetric JWT authentication (RS256) with role-based access control (RBAC).
  * AES-256-GCM field-level encryption with HMAC-SHA256 blind indexing for patient identification numbers.
  * Append-only `system_audit_logs` table with DB-level triggers blocking `UPDATE` or `DELETE`.
* **Verification Evidence:**
  1. `apps/api/test/security-regression.spec.ts` (34 tests passing cleanly).
  2. `apps/api/test/auth.spec.ts` (14 tests passing cleanly).
  3. Tenant A users blocked from viewing Tenant B records even without `WHERE tenant_id`.
  4. Immutable WORM audit triggers prevent any modifications to audit records.

---

### Phase 2: Patient Registration, DHA Registries & Consent Subsystem
* **Status:** **COMPLETED & VERIFIED (Milestone 4)**
* **Estimated Effort:** Large (L) | **Duration:** Completed
* **Dependencies:** Phase 1.
* **Deliverables Implemented:**
  * DHA HIE Adapter client (`IDhaHieClient`) with Mock and Sandbox drivers.
  * Patient search and validation against the DHA Client Registry (`GET /api/v1/patients`).
  * Visit-scoped patient consent workflows:
    * Standard OTP flow (`GET contacts`, `POST otp`, `POST verify`).
    * Biometric iframe integration (`POST /api/v1/claims/authorize`).
    * Emergency incapacitated patient bypass (`emergency = 1`).
    * Minor / Dependant representative routing (`representative_cr_id`).
* **Verification Evidence:**
  1. `apps/api/test/patients.spec.ts` (16 tests passing cleanly).
  2. Patient identification numbers encrypted with AES-256-GCM and indexed via HMAC-SHA256.
  3. Emergency override workflow logs mandatory justification to immutable audit trail.

---

### Phase 3: Clinical EHR, Vocabularies, Orders, Lab & Pharmacy Dispensing
* **Status:** **COMPLETED & VERIFIED (Milestones 5, 6, 7 & 8)**
* **Estimated Effort:** Extra-Large (XL) | **Duration:** Completed
* **Dependencies:** Phase 2.
* **Deliverables Implemented:**
  * Outpatient consultation, triage, and Inpatient admission charting interfaces in Next.js web client (`/encounters`, `/laboratory`, `/pharmacy`).
  * WHO ICD-11 MMS clinical diagnosis search engine with local typeahead caching.
  * CPOE Order routing for LOINC-coded lab investigations and KEML 2023 / PPB-coded pharmacy prescriptions with 24h duplicate prevention.
  * ISO 15189:2022 Laboratory Information Subsystem (`/laboratory`): barcode accessioning, age/sex reference ranges, critical alerts, two-tier review, pre-analytical rejection recollection, and 4-milestone TAT monitoring (`apps/api/test/laboratory.spec.ts`).
  * PPB Cap 244 Pharmacy & Medication-Dispensing Subsystem (`/pharmacy`): KEML 2023 catalogue, PPB drug schedules, supplier registries, FEFO batch allocation engine (`allocateBatchesFEFO`), atomic stock deduction with pessimistic row locking (`SELECT ... FOR UPDATE`), partial dispensing (`FULL`, `PARTIAL`, `BALANCE_COMPLETION`), controlled returns ($\ge 10$ chars justification), bedside administration tracking, inventory valuation, and expiry risk monitoring (`apps/api/test/pharmacy.spec.ts`).
  * HL7® FHIR® R4 Serializers for `Encounter`, `Condition`, `Observation`, `Specimen`, `DiagnosticReport`, `MedicationRequest`, `Medication`, `MedicationDispense`, and `MedicationAdministration`.
* **Verification Evidence:**
  1. `apps/api/test/encounters.spec.ts` (15 tests passing cleanly).
  2. `apps/api/test/orders.spec.ts` (25 tests passing cleanly).
  3. `apps/api/test/laboratory.spec.ts` (25 tests passing cleanly).
  4. `apps/api/test/pharmacy.spec.ts` (28 tests passing cleanly).
  5. Total workspace integration tests: **157/157 passing (100% pass rate)**.

---

### Phase 4: Billing Folios, Tariffs & KRA eTIMS Fiscal Signing
* **Estimated Effort:** Medium (M) | **Duration:** 2 Weeks
* **Dependencies:** Phase 3.
* **Deliverables:**
  * Real-time billing folio manager calculating gross charges, payer coverage splits, and patient co-pays.
  * Master facility tariff catalog supporting Cash, Private Insurance, PHC Capitation, and SHIF tariffs.
  * KRA eTIMS VSCU client (`IKraEtimsClient`) mapping items to eTIMS classification codes.
  * Asynchronous BullMQ worker (`etims-fiscal-signing`) stamping invoices with KRA Control Code & QR Code.
* **Acceptance Criteria:**
  1. Split-billing folio correctly computes 100% capitated primary care vs co-pay fee-for-service items.
  2. Mock/Sandbox eTIMS signing returns valid cryptographic control code and verifiable QR image URL.
  3. Medical services correctly tagged with `EXEMPT` VAT classification in fiscal transmission payloads.

---

### Phase 5: SHA eClaims Orchestration & 24h Emergency Queue
* **Estimated Effort:** Extra-Large (XL) | **Duration:** 4 Weeks
* **Dependencies:** Phase 3, Phase 4.
* **Deliverables:**
  * SHA eClaims Adapter client (`IShaClaimsClient`) implementing the 8 Official Integration Scenarios:
    * `Scenario 1`: SHIF IP Per Diem
    * `Scenario 2`: SHIF IP FFS Normal Preauth
    * `Scenario 3`: SHIF IP FFS Elective Preauth
    * `Scenario 4`: SHIF OP FFS Elective Preauth
    * `Scenario 5`: SHIF OP FFS Normal Preauth
    * `Scenario 6`: UHC / PHC OP Capitation
    * `Scenario 7`: ECCIF Emergency Identified
    * `Scenario 8`: ECCIF Emergency Unidentified
  * Specialized preauthorization modules (Surgical, Oncology, Renal, Optical, Imaging).
  * Automated 24-hour countdown SLA watcher for ECCIF emergency claims with SMS doctor reminders.
  * Webhook listener and queue processor for asynchronous adjudication callbacks (`PREAUTH_APPROVED`, `REMITTANCE_ISSUED`).
* **Acceptance Criteria:**
  1. Automated test suite executes all 8 integration scenarios end-to-end against mock/sandbox endpoints.
  2. ECCIF claim older than 18 hours triggers high-priority alert to hospital claims director.
  3. Webhook callback updates billing folio ledger and creates reconciliation records automatically.

---

### Phase 6: DHA UAT Demo & Formal Certification Pipeline
* **Estimated Effort:** Large (L) | **Duration:** 2 Weeks
* **Dependencies:** Phase 5.
* **Deliverables:**
  * Completion of the official DHA User Acceptance Testing (UAT) Checklist Spreadsheet (`1zFOjatVWf3qmHe1LUPQ-gjwJhIDxpPsdqN-CYSSpU38`).
  * Live UAT demonstration with the DHA / AfyaConnect integration team across all 3 funds (PHC, SHIF, ECCIF).
  * Submission of system architecture, security audit, and DPIA to the DHA Certification Secretariat (`https://certification.dha.go.ke`).
  * Receipt of formal **DHA Certificate of Conformance**.
* **Acceptance Criteria:**
  1. Zero critical defects identified during official DHA UAT live demo.
  2. Formal sign-off and issuance of Production Environment API Client Credentials by DHA.

---

### Phase 7: Production Launch, Sovereign Infrastructure & Pilot Rollout
* **Estimated Effort:** Medium (M) | **Duration:** 2 Weeks
* **Dependencies:** Phase 6.
* **Deliverables:**
  * Terraform provisioning of Production VPC in Kenyan Tier-3 Data Center (e.g., Africa Data Centres Nairobi).
  * Blue/Green deployment of production containers.
  * Formal Data Processor Registration with the Office of the Data Protection Commissioner (ODPC).
  * Controlled onboarding of three pilot healthcare facilities (1 Level 3 Health Centre, 1 Level 4 Sub-County Hospital, 1 Level 5 County Referral Hospital).
* **Acceptance Criteria:**
  1. Live production claim successfully submitted to SHA and acknowledged within $<2\text{ seconds}$.
  2. Zero cross-tenant data leakage observed during multi-facility pilot.
  3. 99.9% uptime maintained over the 30-day initial pilot monitoring window.

---

## 3. 16-Milestone Implementation Status Matrix

| Milestone | Title & Core Scope | Status | Automated Test Evidence | Frontend & Integration Surface |
| :--- | :--- | :---: | :--- | :--- |
| **M1** | Repository & Engineering Foundation | **COMPLETED & VERIFIED** | Turborepo, Docker Compose, Vitest, TypeScript typecheck | Base monorepo, pnpm packages |
| **M2** | Tenant Isolation, Auth & RBAC | **COMPLETED & VERIFIED** | `apps/api/test/auth.spec.ts` (14), `security-regression.spec.ts` (34) | RS256 JWT, RLS interceptors |
| **M3** | Core Database & Shared Infrastructure | **COMPLETED & VERIFIED** | `apps/api/test/shared-infrastructure.spec.ts` (10) | Drizzle ORM, Redis caching, WORM logs |
| **M4** | Patient Registration & Identity Management | **COMPLETED & VERIFIED** | `apps/api/test/patients.spec.ts` (16) | AES-256-GCM + Blind Index, Consent |
| **M5** | Encounters, Triage & Clinical Documentation | **COMPLETED & VERIFIED** | `apps/api/test/encounters.spec.ts` (15) | NEWS2 scoring, SOAP charting, vitals |
| **M6** | Diagnoses, Terminology & Clinical Orders | **COMPLETED & VERIFIED** | `apps/api/test/orders.spec.ts` (25) | ICD-11 search, CPOE orders, 24h duplicate guard |
| **M7** | Laboratory Management | **COMPLETED & VERIFIED** | `apps/api/test/laboratory.spec.ts` (25) | LIS Accessioning, Barcoding, 2-tier review, TAT |
| **M8** | Pharmacy & Medication Dispensing | **COMPLETED & VERIFIED** | `apps/api/test/pharmacy.spec.ts` (28) | FEFO allocation, stock movements, bedside admin |
| **M9** | Patient Billing & Payments | Planned | — | Charge master, M-Pesa STK push, eTIMS |
| **M10** | DHA/SHA Integration Adapters & Mock Drivers | **COMPLETED & VERIFIED** | `packages/integration-adapters/src/index.spec.ts` (29) | Hexagonal mock drivers, fault injection, rate limits |
| **M11** | SHA Eligibility & eClaims Orchestration | **COMPLETED & VERIFIED** | `apps/api/test/insurance.spec.ts` (24) | 8 official scenarios, preauth, ECCIF, callbacks |
| **M12** | DHA FHIR R4 SHR Serialization & Exchange | **COMPLETED & VERIFIED** | `apps/api/test/fhir-conformance.spec.ts` (13), validator (16) | Kenya Core FHIR profiles, $validate, $export, SHR |
| **M13** | National Registry Synchronization & Resilient Operations | **COMPLETED & VERIFIED** | `apps/api/test/registry-resilience.spec.ts` (25) | CR, KMFL, HWR, TS, circuit breakers, DLQ, AES-256-GCM |
| **M14** | Patient Billing, Folios & eTIMS Invoicing | Planned | — | Charge master, M-Pesa STK push, eTIMS fiscal invoices |
| **M15** | Inpatient & Theatre Operations | Planned | — | Bed management, surgical checklists, ward admissions |
| **M16** | SaaS Administration & Subscriptions | Planned | — | Tenant provisioning, plan management |
| **M17** | Security & Certification-Readiness | Planned | — | Automated DHA UAT checklist evidence |
| **M18** | Performance & Operational Handover | Planned | — | Load testing, sovereign Kenyan deployment |

**Current Platform Test Metric:** **336/336 Automated Tests Passing (100% Pass Rate)** across monorepo (`apps/api` 232 tests, `@afyapoa/database` 34 tests, `@afyapoa/domain-core` 41 tests, `@afyapoa/integration-adapters` 29 tests).

