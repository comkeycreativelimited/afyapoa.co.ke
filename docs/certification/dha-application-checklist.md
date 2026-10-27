# Digital Health Agency (DHA) Kenya — Formal Certification Application Checklist

**Document Identifier:** `DHA-CERT-CHK-2026-V1`  
**Target Solution:** COMKEY AFYA POA (Multi-Tenant SaaS HMIS)  
**Applicant Entity:** COMKEY CREATIVE LIMITED  
**Authority:** Digital Health Agency (DHA), Republic of Kenya  
**Statutory Basis:** Digital Health Act, 2023 (No. 15 of 2023), Part IV; Kenya Gazette Notice on Digital Health Standards  
**Status:** **INTERNAL SUBMISSION-READY BASELINE**  
*(Note: This checklist reflects internal readiness verification against published DHA standards. No official regulator approval, certification number, or formal gazettement has yet been granted.)*

---

## 1. The 4-Phase DHA Certification Framework

The Digital Health Agency certifies digital health solutions through a sequential four-phase gate review:

```
+-----------------------------------------------------------------------------------------------+
|                             DHA 4-PHASE CERTIFICATION LIFECYCLE                               |
+---------------------+-----------------------+------------------------+------------------------+
| PHASE 1:            | PHASE 2:              | PHASE 3:               | PHASE 4:               |
| Self-Assessment &   | Sandbox Interop &     | Security, Privacy &    | Production             |
| Documentation       | Technical Conformance | Infrastructure Audit   | Accreditation          |
+---------------------+-----------------------+------------------------+------------------------+
| - Legal entity docs | - FHIR R4 Bundle test | - OWASP ASVS audit     | - Live facility pilot  |
| - Architecture & DF | - Client Registry CR  | - ISO 27001 assessment | - Certificate issuance |
| - Security policies | - HWR PUID verify     | - DPA DPIA review      | - National register    |
| - DPIA & consent    | - SHA eClaim test     | - Penetration test     |   gazettement          |
+---------------------+-----------------------+------------------------+------------------------+
```

---

## 2. Phase 1: Self-Assessment & Documentation Dossier

| Checkpoint | Published DHA Requirement | Implementing Evidence / Artifact | Verification State | Responsible Lead |
|---|---|---|---|---|
| **P1-01** | Legal entity certificate of incorporation and tax compliance certificate (KRA PIN) | COMKEY CREATIVE LIMITED company registration documents and valid Tax Compliance Certificate | `VERIFIED INTERNALLY` | Legal Counsel |
| **P1-02** | Master System Architecture & Data Flow Diagrams | Full multi-tenant microservices architecture, network boundaries, and national HIE gateway diagrams in [`docs/architecture/overview.md`](file:///c:/wamp64/www/afya-poa/docs/architecture/overview.md) | `VERIFIED INTERNALLY` | Chief Architect |
| **P1-03** | Data Protection Impact Assessment (DPIA) covering health data processing | Full DPIA covering patient demographics, clinical notes, multi-tenant database isolation, and encryption in [`docs/dpia-template.md`](file:///c:/wamp64/www/afya-poa/docs/dpia-template.md) | `AWAITING EXTERNAL DPO SIGN-OFF` | Data Protection Officer |
| **P1-04** | Master Data Processing Agreement (DPA) Template for onboarded health facilities | Standardized Controller-Processor agreement in [`docs/data-processing-agreement-template.md`](file:///c:/wamp64/www/afya-poa/docs/data-processing-agreement-template.md) compliant with DPA 2019 | `VERIFIED INTERNALLY` | Legal Counsel |
| **P1-05** | Statutory Retention & Disposal Schedule | 10-year clinical data retention schedule, immutable WORM audit logs, and disposal protocols in [`docs/retention-schedule.md`](file:///c:/wamp64/www/afya-poa/docs/retention-schedule.md) | `VERIFIED INTERNALLY` | Compliance Officer |
| **P1-06** | Information Security Policy & Incident Response Runbook | Formal incident response procedure, 72-hour ODPC notification tracker, and role runbooks in [`docs/security/incident-response.md`](file:///c:/wamp64/www/afya-poa/docs/security/incident-response.md) | `VERIFIED INTERNALLY` | CISO |
| **P1-07** | Comprehensive User Manuals across all clinical departments | 16 dedicated clinical user manuals covering Outpatient, Inpatient, Triage, CPOE, Laboratory, Pharmacy, Billing, Claims in [`docs/user-manual/`](file:///c:/wamp64/www/afya-poa/docs/user-manual/) | `VERIFIED INTERNALLY` | Product Manager |

---

## 3. Phase 2: Sandbox Interoperability & Conformance Verification

| Checkpoint | Published DHA Requirement | Implementing Evidence / Artifact | Verification State | Responsible Lead |
|---|---|---|---|---|
| **P2-01** | HL7® FHIR® R4 Profiling (`fhir.dha.go.ke/core`) | Validated implementation of Kenya Core Patient, Encounter, Condition, DiagnosticReport profiles; bundle validator passes in [`apps/api/test/fhir-conformance.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/fhir-conformance.spec.ts) | `INTERNALLY TESTED & PASSING` | Interoperability Lead |
| **P2-02** | DHA Enterprise Master Patient Index / Client Registry (CR) Lookup | Automated lookup via national ID, UPI assignment, probabilistic duplicate resolution in [`apps/api/test/synthetic-patient-journey.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/synthetic-patient-journey.spec.ts) | `UAT-VERIFIED (MOCK DRIVER)` | Integration Lead |
| **P2-03** | Health Worker Registry (HWR) Practitioner PUID Verification | Practitioner `X-PUID` verification and license expiry enforcement in [`apps/api/test/security-regression.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/security-regression.spec.ts) | `UAT-VERIFIED (MOCK DRIVER)` | Integration Lead |
| **P2-04** | Master Facility List (KMFL / FR) Validation | Validation of facility registration code (`FID-XX-XXXXXX-X`) on all outbound payloads in [`packages/integration-adapters/src/index.spec.ts`](file:///c:/wamp64/www/afya-poa/packages/integration-adapters/src/index.spec.ts) | `INTERNALLY TESTED & PASSING` | Platform Lead |
| **P2-05** | National Terminology Service (WHO ICD-11, LOINC, Kenya EML) | Enforcement of verified codes from authoritative catalogues; rejection of unlisted codes in [`apps/api/test/orders.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/orders.spec.ts) | `INTERNALLY TESTED & PASSING` | Clinical Informaticist |
| **P2-06** | Social Health Authority (SHA) eClaims Transmission | Kenya Claims IG (`fhir.kenyaClaimsIG`) eClaim compilation, submission fingerprinting, and webhook callback in [`apps/api/test/synthetic-patient-journey.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/synthetic-patient-journey.spec.ts) | `UAT-VERIFIED (MOCK DRIVER)` | Claims Architect |
| **P2-07** | Patient Consent Capture & OTP SMS Verification | Channel-aware consent recording (`WRITTEN_FORM`, `OTP_SMS`) and verification before record exchange in [`apps/api/test/patients.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/patients.spec.ts) | `UAT-VERIFIED (MOCK DRIVER)` | UI/UX & Security Lead |

---

## 4. Phase 3: Security, Privacy & Sovereign Infrastructure Audit

| Checkpoint | Published DHA Requirement | Implementing Evidence / Artifact | Verification State | Responsible Lead |
|---|---|---|---|---|
| **P3-01** | Multi-Tenant Data Isolation (PostgreSQL Row-Level Security) | Engine-enforced tenant segregation (`relrowsecurity = true` in `pg_class`), verified across 200 cross-tenant concurrent transactions with zero leaks in [`apps/api/test/performance-capacity.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/performance-capacity.spec.ts) | `INTERNALLY TESTED & PASSING` | Database Architect |
| **P3-02** | Cryptographic Protection of Sensitive Health Data at Rest & in Transit | TLS 1.3 enforced for all network ingress; AES-256-GCM column encryption with HMAC blind indexing for patient phone and national ID in [`apps/api/test/synthetic-patient-journey.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/synthetic-patient-journey.spec.ts) | `INTERNALLY TESTED & PASSING` | Security Officer |
| **P3-03** | Immutable WORM Audit Trail | PostgreSQL trigger-enforced immutable `audit_events` table; SHA-256 cryptographic linkage linking each block to previous block in [`packages/database/src/migration.spec.ts`](file:///c:/wamp64/www/afya-poa/packages/database/src/migration.spec.ts) | `INTERNALLY TESTED & PASSING` | Platform Architect |
| **P3-04** | Role-Based & Attribute-Based Access Control (RBAC/ABAC) | 9 role profiles, 28 granular permissions, emergency break-glass protocol, and path traversal prevention in [`apps/api/test/security-regression.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/security-regression.spec.ts) | `INTERNALLY TESTED & PASSING` | Security Engineer |
| **P3-05** | Sovereign Data Hosting within Kenya | Deployment configuration targeting Kenyan Tier III carrier-neutral data center infrastructure (Nairobi / Mombasa) in [`docs/architecture/infrastructure-hosting-cicd.md`](file:///c:/wamp64/www/afya-poa/docs/architecture/infrastructure-hosting-cicd.md) | `AWAITING CONTRACT EXECUTION` | Infrastructure Lead |
| **P3-06** | Disaster Recovery & Backup Restoration Assurance | AES-256-GCM encrypted logical backup snapshot, SHA-256 tamper rejection, and 100% parity disaster restoration in [`apps/api/test/backup-restoration.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/backup-restoration.spec.ts) | `INTERNALLY TESTED & PASSING` | DevOps Lead |

---

## 5. Phase 4: Production Accreditation & Gazettement

| Checkpoint | Published DHA Requirement | Current Readiness Status | Prerequisites Remaining |
|---|---|---|---|
| **P4-01** | Production DHA Gateway Credentials Issuance | `AWAITING DHA SANDBOX SIGN-OFF` | Completion of formal DHA Phase 2 sandbox interoperability evaluation |
| **P4-02** | Formal Third-Party Security Penetration Test Report | `ENGAGEMENT PENDING` | Scheduling of CREST-accredited independent external audit for Q1 2027 |
| **P4-03** | Pilot Facility Onboarding & Field Evaluation | `PILOT CANDIDATE IDENTIFIED` | Execution of pilot facility agreement with Level 4 hospital partner |
| **P4-04** | Formal DHA Certificate of Compliance & Gazettement | `AWAITING REGULATOR APPLICATION SUBMISSION` | Opening of official DHA online certification portal for software vendors |
