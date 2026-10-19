# COMKEY AFYA POA — Infrastructure, Hosting, Backup & CI/CD Architecture

**Document Identifier:** `ARCH-INF-2026-V1`  
**System:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Architecture Proposal (Awaiting Approval)  
**Date:** October 19, 2026  
**Infrastructure Frameworks:** Docker, Terraform, GitHub Actions, Sovereign Cloud Hosting  

---

## 1. Hosting Architecture & Data Localization Assessment

### 1.1 Statutory Mandate: Data Protection (General) Regulations, 2021 (Regulation 26)
Under Kenyan law, health data is a designated strategic state interest. Processing personal health data requires:
1. Processing through a server and data center located in Kenya; **OR**
2. Storing at least one active serving copy in a data center located in Kenya.

### 1.2 Evaluation of Hosting Topologies

| Hosting Topology | Architecture Description | Regulatory Compliance (DPA Reg 26) | Latency to Kenyan Facilities | Estimated Infrastructure Cost | Architecture Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option 1: Sovereign Local Cloud (Recommended)** | Primary application servers, PostgreSQL RLS cluster, Redis, and S3 object storage hosted natively within a Kenyan Tier-3 Data Center (e.g., Africa Data Centres ADC Nairobi, iColo MBA1/NBO1, or Safaricom Cloud). | **100% Compliant.** Absolute zero cross-border data transfer exposure. | **Ultra-Low (<15ms)** across Kenyan fiber/cellular networks. | Moderate ($$) | **PRIMARY RECOMMENDATION.** Eliminates regulatory ambiguity, fulfills DHA data custodianship criteria, and delivers lowest latency. |
| **Option 2: Hybrid Sovereign Cloud** | Compute workloads on regional hyperscaler (AWS Cape Town / Azure South Africa North), paired with a dedicated PostgreSQL Read/Write serving replica hosted locally at ADC Nairobi. | **Compliant** via "at least one serving copy" clause of Regulation 26(1). | Low-to-Moderate (40–60ms to South Africa). | High ($$$) | Viable fallback if specialized managed cloud services are strictly required. |
| **Option 3: Pure Offshore Hyperscaler** | Entire infrastructure deployed in AWS Ireland / Frankfurt or Azure Western Europe with zero Kenyan physical footprint. | **NON-COMPLIANT.** Directly violates Regulation 26(1); exposes COMKEY and facilities to administrative fines up to KES 5M. | High (>140ms roundtrip). | Low ($) | **STRICTLY REJECTED.** Illegal under Kenyan data protection laws. |

---

## 2. Infrastructure Topology Diagram (Option 1: Sovereign VPC)

```
+---------------------------------------------------------------------------------------------------+
|                           SOVEREIGN KENYAN VIRTUAL PRIVATE CLOUD (VPC)                            |
|                                                                                                   |
|  [Public Web DMZ Subnet] (CIDR: 10.0.1.0/24)                                                      |
|    - Dual Cloudflare Edge / WAF (DDoS Mitigation, SSL Offloading, WebAuthn Routing)              |
|    - Ingress Application Load Balancers (ALB)                                                     |
|                                     |                                                             |
|                                     v HTTPS (Port 443 / TLS 1.3)                                  |
|  [Private Compute Subnet] (CIDR: 10.0.10.0/24)                                                    |
|    +-----------------------------+               +-----------------------------+                  |
|    | Next.js Web Frontend Pods   |               | NestJS Modular API Pods     |                  |
|    | (Horizontal Auto-Scaling)   |               | (Horizontal Auto-Scaling)   |                  |
|    +-----------------------------+               +-----------------------------+                  |
|                   |                                             |                                 |
|                   +----------------------+----------------------+                                 |
|                                          |                                                        |
|                                          v                                                        |
|    +---------------------------------------------------------------------------+                  |
|    | BullMQ Background Worker Pods (Claims Dispatch, eTIMS Signer, Webhooks)   |                  |
|    +---------------------------------------------------------------------------+                  |
|                                          |                                                        |
|                                          v Private LAN / Strict Security Groups                   |
|  [Isolated Database & Storage Subnet] (CIDR: 10.0.20.0/24)                                        |
|    +-----------------------------+  +-------------------------+  +----------------------------+   |
|    | PostgreSQL 16 (Primary)     |  | Redis 7 Cluster         |  | S3 Object Storage Cluster  |   |
|    | - Synchronous Local Standby |  | - Session Cache         |  | (Encrypted Diagnostic Scans|   |
|    | - Row-Level Security (RLS)  |  | - BullMQ Queue Broker   |  |  and Preauth Attachments)  |   |
|    +-----------------------------+  +-------------------------+  +----------------------------+   |
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Disaster Recovery, Backup Design, and RPO / RTO Targets

### 3.1 Service Level Objectives (SLOs)
* **Recovery Point Objective (RPO):**
  * **Financial & Billing Folios:** **Zero data loss (RPO = 0)** via synchronous database write replication.
  * **Clinical Encounter Notes & EHR:** $\le \mathbf{5\text{ minutes}}$ via continuous Write-Ahead Log (WAL) archiving.
* **Recovery Time Objective (RTO):**
  * **Primary Service Restoration:** $\le \mathbf{30\text{ minutes}}$ using automated container failover and secondary standby database promotion.
  * **Complete Cold Site Disaster Recovery:** $\le \mathbf{2\text{ hours}}$.

### 3.2 Backup Cadence & Verification Strategy
1. **Continuous WAL Archiving:** PostgreSQL streaming WAL records transmitted to an isolated, append-only S3 backup bucket every 60 seconds, enabling Point-in-Time Recovery (PITR) to any second within the past 30 days.
2. **Nightly Full Snapshots:** Automated cryptographic disk snapshot executed daily at 02:00 EAT (UTC+3), encrypted with AES-256-GCM.
3. **Weekly Offline Cold Archive:** Weekly backup exported and mirrored to a secondary geographic facility within Kenya (e.g., Mombasa iColo MBA1 from Nairobi ADC) to protect against metropolitan fiber/power catastrophes.
4. **Automated Recovery Testing:** GitHub Actions runs an automated monthly disaster recovery drill, restoring the latest snapshot into an isolated sandbox environment and executing automated data integrity tests.

---

## 4. Continuous Integration & Continuous Delivery (CI/CD) Architecture

The deployment pipeline is orchestrated via **GitHub Actions** with strict compliance gating:

```
+---------------------------------------------------------------------------------------------+
|                                  GITHUB ACTIONS CI/CD PIPELINE                              |
|                                                                                             |
|  [Stage 1: Lint & Static Code Analysis]                                                     |
|    - TypeScript typecheck (pnpm tsc --noEmit)                                               |
|    - ESLint architectural module boundary checks                                            |
|                                     |                                                       |
|                                     v                                                       |
|  [Stage 2: Test Suite & Conformance Verification]                                           |
|    - Unit & Integration Tests (Vitest / Jest)                                               |
|    - FHIR R4 Schema Conformance Validator (Validates against fhir.dha.go.ke/core)           |
|    - Consumer-Driven Contract Tests (Pact testing against DHA/SHA Mock Adapters)            |
|                                     |                                                       |
|                                     v                                                       |
|  [Stage 3: Security & Compliance Audit]                                                     |
|    - Dependency vulnerability audit (Trivy / Snyk)                                          |
|    - Dockerfile container vulnerability scanning                                            |
|    - Secrets detection (Gitleaks)                                                           |
|                                     |                                                       |
|                                     v                                                       |
|  [Stage 4: Container Build & Provenance]                                                    |
|    - Multi-stage Docker builds for web, api, and worker                                     |
|    - Images signed with Cosign and pushed to private Kenyan container registry               |
|                                     |                                                       |
|                                     v                                                       |
|  [Stage 5: Infrastructure as Code (Terraform)]                                              |
|    - terraform fmt & terraform validate                                                     |
|    - terraform plan against staging/production VPC                                          |
|                                     |                                                       |
|                                     v (Manual Approval Required for Production)             |
|  [Stage 6: Zero-Downtime Deployment]                                                        |
|    - Blue/Green Rolling Container update                                                    |
|    - Automated database migration execution (Prisma / Kysely)                               |
|    - Post-deployment synthetic smoke tests (DHA health checks, eTIMS heartbeat)             |
+---------------------------------------------------------------------------------------------+
```

---

## 5. Infrastructure as Code Blueprint (Terraform Snippet)

The infrastructure is declared immutably under `/deploy/terraform/`:

```hcl
# deploy/terraform/modules/database/main.tf
resource "postgresql_cluster" "primary_db" {
  name             = "comkey-afyapoa-db-prod"
  region           = "ke-nairobi-1" # Sovereign Kenyan Data Center
  version          = "16"
  instance_type    = "db.enterprise.large"
  storage_size_gb  = 500
  storage_type     = "nvme"
  high_availability = true
  
  encrypted        = true
  kms_key_id       = var.sovereign_kms_key_arn

  backup_retention_days = 35
  preferred_backup_window = "23:00-01:00"

  parameters = {
    "rds.force_ssl"               = "1"
    "password_encryption"         = "scram-sha-256"
    "shared_preload_libraries"    = "pgaudit,pg_stat_statements"
    "pgaudit.log"                 = "write, ddl, role"
  }
}
```
