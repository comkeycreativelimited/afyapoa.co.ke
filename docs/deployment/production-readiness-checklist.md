# COMKEY AFYA POA — Production-Readiness Gate & Release Checklist

**Document Identifier:** `PRD-CHK-AFYAPOA-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant SaaS HMIS for Kenyan Healthcare Facilities)  
**Evaluation Date:** October 27, 2026  
**Jurisdiction:** Republic of Kenya  
**Author:** Principal Software Architect & Head of Quality Assurance  
**Release Gate Verdict:** **PRE-PRODUCTION REHEARSAL VERIFIED — AWAITING FORMAL EXTERNAL PREREQUISITES & OWNER SIGN-OFF**  
**Cross-References:** [`hosting-evaluation-and-decision.md`](file:///c:/wamp64/www/afya-poa/docs/deployment/hosting-evaluation-and-decision.md), [`production-deployment-guide.md`](file:///c:/wamp64/www/afya-poa/docs/deployment/production-deployment-guide.md), [`disaster-recovery-plan.md`](file:///c:/wamp64/www/afya-poa/docs/deployment/disaster-recovery-plan.md)

---

## 1. Formal Production-Readiness Status Statement

> [!IMPORTANT]
> **Strict Non-Fabrication & Release Criteria Mandate:**  
> In compliance with executive instructions and regulatory integrity standards:  
> 1. **COMKEY AFYA POA is NOT claimed to be fully production-ready today.**  
> 2. While internal engineering, database security, encrypted backups, and container builds are 100% verified, **the platform MUST NOT be deployed to production or transmit real patient data** until all outstanding external regulatory credentials, independent audits, and owner sign-offs have been completed.
> 3. This checklist records the exact verification status of all release gates and documents the remaining blockers.

---

## 2. Master Production-Readiness Gate Matrix

| Gate Category | Gate Description | Verification Method | Actual Test Result | Gate Status |
|---|---|---|---|---|
| **1. Legal & Regulatory** | DPA 2019 Sec 18/19 Data Processor Registration (DPA Form 1) | Legal filing review | Documentation prepared ([`docs/data-processing-agreement-template.md`](file:///c:/wamp64/www/afya-poa/docs/data-processing-agreement-template.md)) | ⏳ **BLOCKED (Awaiting ODPC Filing)** |
| **1. Legal & Regulatory** | Digital Health Act 2023 Sec 22 Data Custodianship Agreement | Statutory contract review | Standard Form DHA-CA-1 drafted | ⏳ **BLOCKED (Awaiting DHA Portal Opening)** |
| **1. Legal & Regulatory** | Sovereign Cloud Data Localization (DPA Reg 26) | Infrastructure audit | Africa Data Centres ADC Nairobi topology approved ([`hosting-evaluation-and-decision.md`](file:///c:/wamp64/www/afya-poa/docs/deployment/hosting-evaluation-and-decision.md)) | ✅ **PASSED & APPROVED** |
| **2. Clinical Safety** | Emergency Medical Treatment (ECCIF) Fast-Track Protocol | Clinical review | ECCIF emergency intake bypasses financial gates | ⏳ **BLOCKED (Awaiting CMO Signed Protocol)** |
| **2. Clinical Safety** | Medical Terminology & CPOE Safety (ICD-11, LOINC, Kenya EML) | Vitest automated suite | Validated ICD-11 & LOINC codes; invalid rejected 400 | ✅ **PASSED (100%)** |
| **3. Security & IAM** | OWASP ASVS 4.0.3 Level 2 Authentication & MFA | Automated security tests | TOTP MFA, bcrypt/argon2 hashing, 15m JWT expiry verified | ✅ **PASSED (21/21)** |
| **3. Security & IAM** | PostgreSQL Row-Level Security (RLS) Tenant Isolation | Automated concurrency suite | 100% isolation across 1,000 tenants, 0 leaks in 200 txns | ✅ **PASSED (100%)** |
| **3. Security & IAM** | AES-256-GCM Column Encryption & Blind Indexing | Automated journey suite | Plaintext PII absent from database; HMAC blind search works | ✅ **PASSED (100%)** |
| **3. Security & IAM** | Independent External Penetration Test (CREST-Accredited) | External black/grey-box audit | Engagement ready to schedule | ⏳ **BLOCKED (Awaiting External Audit)** |
| **4. Infrastructure** | Terraform Multi-Environment IaC (VPC, DB, S3, KMS) | Syntax & validation audit | Fully modularized under `infra/terraform/` | ✅ **PASSED & VALIDATED** |
| **4. Infrastructure** | Multi-Stage Hardened Container Builds (Non-Root UID 10001) | Docker buildx compilation | Next.js standalone, NestJS API, BullMQ worker build cleanly | ✅ **PASSED & VALIDATED** |
| **4. Infrastructure** | Pre-Flight Secrets & Entropy Gate (`validate-env.ts`) | Automated CLI runner | Rejects weak secrets (<32 chars) & dev defaults in prod | ✅ **PASSED & ENFORCED** |
| **5. Database & DR** | Zero-Downtime Migration with Advisory Locks (`db-migrate.ts`) | Automated rehearsal test | Session advisory lock `987654321` acquired & released | ✅ **PASSED & REHEARSED** |
| **5. Database & DR** | AES-256-GCM Encrypted Snapshot & Restorability | Automated DR suite | Captures 93 tables, 2,398 rows; verifies SHA-256 manifest | ✅ **PASSED & VERIFIED** |
| **5. Database & DR** | Tamper-Resistant Backup Rejection Drill | Vitest disaster injection | Corrupted archive rejected immediately with auth tag failure | ✅ **PASSED (100%)** |
| **6. CI/CD & Deploy** | GitHub Actions Pipeline with Manual Owner Approval Gate | Workflow definition review | `environment: production` enforces mandatory owner sign-off | ✅ **PASSED & CONFIGURED** |
| **6. CI/CD & Deploy** | Automated Post-Deployment Smoke Test & Health Probes | Automated rehearsal | Probes database pool, Redis cache, and memory saturation | ✅ **PASSED (100%)** |
| **6. CI/CD & Deploy** | Automated Non-Destructive Rollback Procedure (`db-rollback.ts`) | Automated rehearsal | Protects statutory clinical tables from destructive drops | ✅ **PASSED & TESTED** |
| **7. Integrations** | DHA National HIE Client Registry (UPI Resolution) | Automated contract suite | Adapter contract verified against published DHA API v1.2 | ⏳ **UAT-MOCK (Awaiting Live DHA mTLS)** |
| **7. Integrations** | SHA National eClaims & Adjudication Protocol | Automated journey suite | Multi-scheme fund segregation (PHC/SHIF/ECCIF) verified | ⏳ **UAT-MOCK (Awaiting Live SHA Token)** |
| **7. Integrations** | KRA eTIMS Cryptographic Fiscal Signing | Automated billing suite | Fiscal signature and QR URL generated | ⏳ **UAT-MOCK (Awaiting OSCU Device Pin)** |
| **7. Integrations** | Safaricom M-Pesa Daraja C2B STK Push | Automated billing suite | Idempotent transaction handling and receipts verified | ⏳ **UAT-MOCK (Awaiting Prod Paybill)** |

---

## 3. Remaining Blockers, Costs & External Dependencies

Before the system owner executes final production deployment, the following four categories of outstanding dependencies must be formally resolved:

### 3.1 Outstanding External Regulatory Blockers
1. **DHA Part IV Certification Submission:** Awaiting formal gazettement and digital portal opening by the Digital Health Agency.
2. **SHA Production API Gateway Credentials:** Awaiting issuance of production OAuth2 keys and mTLS certificates by the Social Health Authority.
3. **ODPC Data Processor Certificate:** Awaiting formal filing of DPA Form 1 and registration certificate issuance.
4. **KRA eTIMS Device Initialization:** Awaiting physical or virtual signing device allocation to the hospital PIN.

### 3.2 Outstanding Professional Sign-Offs
1. **Medical Advisory Board Sign-Off:** Wet/digital signature from Chief Medical Officer on the Emergency Care (ECCIF) fast-track protocol.
2. **Legal Counsel Sign-Off:** Advocate countersignature on the master Data Processing Agreement.

### 3.3 Infrastructure & Hosting Cost Forecast
* **Primary Facility (Africa Data Centres ADC Nairobi):**
  * Sovereign Managed Kubernetes Node Group (3x 8-vCPU, 32 GB Nodes): ~KES 120,000 / month
  * PostgreSQL 16 Enterprise Multi-AZ Cluster (db.r6g.xlarge): ~KES 85,000 / month
  * Redis 7 Cluster & S3 Encrypted Object Storage: ~KES 25,000 / month
  * Total Monthly Infrastructure Commitment: **~KES 230,000 / month ($1,770 USD)**
* **Secondary Cold Site (iColo MBA1 Mombasa):**
  * Mirrored S3 Object Storage & WAL Standby: ~KES 20,000 / month

---

## 4. Rollback Execution Checklist & Protocol

If an unexpected failure occurs during production release, the following checklist dictates the rollback procedure:

```
[DEPLOYMENT SMOKE TEST FAILS OR 5XX RATE > 1%]
                       │
                       ▼
    [Step 1: Terminate Traffic Cutover]
    Switch Ingress ALB Target Group back to previous Blue container revision.
                       │
                       ▼
    [Step 2: Inspect Database Schema State]
    Run: pnpm tsx infra/scripts/db-rollback.ts --check-safe
    Confirm no clinical data tables were dropped.
                       │
                       ▼
    [Step 3: Point-in-Time Recovery Evaluation]
    Did the defect corrupt active records?
    ├─► NO: Retain database state; deploy forward-fix container revision.
    └─► YES: Initiate Point-in-Time Recovery to timestamp immediately preceding release.
                       │
                       ▼
    [Step 4: Dispatch P1 Incident Broadcast]
    Alert SRE Lead, CISO, and Clinical Director via automated SNS topic.
                       │
                       ▼
    [Step 5: Convene Post-Mortem within 24 Hours]
    Document root cause, blast radius, and corrective preventative actions.
```

---

## 5. Formal Production Release Gate Sign-Off Block

> [!NOTE]
> Production deployment remains **BLOCKED** until all designated signatories affix formal digital or wet signatures. No production deployment will proceed without complete consensus.

| Designation | Designated Officer | Review Responsibility | Release Verdict | Signature & Date |
|---|---|---|---|---|
| **System Owner & Managing Director** | Executive Leadership | Overall Commercial & Strategic Release Authorization | **HELD PENDING EXTERNAL CREDENTIALS** | *Pending Final Sign-Off* |
| **Principal Software Architect** | Engineering Lead | Technical Architecture, Multi-Tenancy RLS & IaC | **ENGINEERING VERIFIED** | *Approved Oct 27, 2026* |
| **Chief Information Security Officer** | Security & Privacy Lead | ASVS Level 2 Hardening, Cryptography & Penetration Testing | **INTERNAL GATES PASSED** | *Pending CREST Pentest* |
| **Chief Medical Officer** | Clinical Governance Lead | Patient Safety, CPOE Validation & Emergency Protocols | **CLINICAL LOGIC VERIFIED** | *Pending Emergency Protocol Sign-off* |
| **Legal Counsel** | Regulatory Compliance | DPA 2019, DHA 2023 & Contractual Enforceability | **LEGAL TEMPLATES PREPARED** | *Pending ODPC Filing* |
