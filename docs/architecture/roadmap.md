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
* **Estimated Effort:** Small (S) | **Duration:** 2 Weeks
* **Dependencies:** Approved System Architecture.
* **Deliverables:**
  * Turborepo + pnpm monorepo structure with `apps/web`, `apps/api`, `apps/worker`, and shared packages (`packages/fhir-types`, `packages/database`, `packages/logger`, `packages/validation`).
  * Docker Compose local development environment (PostgreSQL 16, Redis 7, MinIO).
  * GitHub Actions CI pipeline running TypeScript typechecks, ESLint module boundary enforcement, and unit tests.
* **Acceptance Criteria:**
  1. `pnpm build` and `pnpm test` execute cleanly across all monorepo packages.
  2. Automated migration runner initializes local database with PostgreSQL extensions (`uuid-ossp`, `pgcrypto`).
  3. Pre-commit hooks block any secret or unencrypted credential commit.

---

### Phase 1: Multi-Tenancy Isolation, Security & WORM Audit Logging
* **Estimated Effort:** Medium (M) | **Duration:** 2 Weeks
* **Dependencies:** Phase 0.
* **Deliverables:**
  * PostgreSQL Row-Level Security (RLS) migrations and `tenant_isolation_policy` across all tenant tables.
  * NestJS `TenantContextInterceptor` injecting `app.current_tenant_id` into transactions.
  * Asymmetric JWT authentication (RS256) with role-based access control (RBAC).
  * AES-256-GCM field-level encryption with HMAC-SHA256 blind indexing for patient identification numbers.
  * Append-only `system_audit_logs` table with DB-level triggers blocking `UPDATE` or `DELETE`.
* **Acceptance Criteria:**
  1. Automated test verifies that User from Tenant A receives an empty result set when querying records of Tenant B, even when omitting `WHERE tenant_id`.
  2. Modifying or deleting a row in `system_audit_logs` throws an unhandled database exception.
  3. Encrypted patient national IDs can be located via exact-match blind index search in $<10\text{ms}$.

---

### Phase 2: Patient Registration, DHA Registries & Consent Subsystem
* **Estimated Effort:** Large (L) | **Duration:** 2 Weeks
* **Dependencies:** Phase 1.
* **Deliverables:**
  * DHA HIE Adapter client (`IDhaHieClient`) with Mock and Sandbox drivers.
  * Patient search and validation against the DHA Client Registry (`GET /api/v1/patients`).
  * Visit-scoped patient consent workflows:
    * Standard OTP flow (`GET contacts`, `POST otp`, `POST verify`).
    * Biometric iframe integration (`POST /api/v1/claims/authorize`).
    * Emergency incapacitated patient bypass (`emergency = 1`).
    * Minor / Dependant representative routing (`representative_cr_id`).
* **Acceptance Criteria:**
  1. Successful query of test patient demographics in DHA Sandbox using `client_id` and `X-Facility-Id` header.
  2. Mock/Sandbox OTP verification returns valid `consent_token` and `visit_id`.
  3. Attempting to start a visit without verified consent fails with an explicit validation error.

---

### Phase 3: Clinical EHR, Vocabularies & FHIR R4 SHR Synchronization
* **Estimated Effort:** Extra-Large (XL) | **Duration:** 3 Weeks
* **Dependencies:** Phase 2.
* **Deliverables:**
  * Outpatient consultation and Inpatient admission charting interfaces in Next.js web client.
  * WHO ICD-11 MMS clinical diagnosis search engine with local typeahead caching.
  * LOINC-coded laboratory orders and PPB/HPT-coded pharmacy prescription entries.
  * HL7® FHIR® R4 Collection Bundle serializer implementing mandatory invariants:
    * `Encounter` references `EpisodeOfCare`.
    * All `Observation` and `Condition` resources reference `Encounter`.
    * Confidentiality and sensitivity markings (`meta.security`: `N`, `R`, `HIV`, `PSY`).
  * BullMQ worker queue (`shr-bundle-sync`) for asynchronous SHR ingestion (`POST /shr/bundles`).
* **Acceptance Criteria:**
  1. Serialized FHIR R4 Bundle validates 100% against the official HL7 FHIR validator and Kenya Core IG.
  2. Clinical bundle successfully ingested into DHA Sandbox with HTTP 201/200 response.
  3. Background sync job retries automatically on simulated network drop with exponential backoff.

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
