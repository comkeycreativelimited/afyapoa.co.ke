# COMKEY AFYYA POA — Architectural & Compliance Assumptions Register

**Document Identifier:** `ASM-REG-2026-V1`  
**Target Platform:** COMKEY AFYYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Baseline Draft (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026

---

## 1. Purpose of this Document

This document records the foundational technical, legal, operational, and financial assumptions governing the research, discovery, and future architecture planning of **COMKEY AFYYA POA**. Every assumption is explicitly defined, bounded, justified by regulatory or engineering precedent, and tied to risk mitigation strategies should the assumption fail.

---

## 2. Core Architectural & Regulatory Assumptions

### ASM-01: Multi-Tenancy Isolation & Central HIE Gateway Model
* **Assumption Statement:** COMKEY AFYYA POA will operate as a true multi-tenant SaaS. A single centralized integration gateway service account will manage the connection to the DHA Health Information Exchange (HIE), dynamically passing each tenant facility's KMFL code via `X-Facility-Id` and `X-Facility-Id-Type: fr-code` headers on every outbound request.
* **Justification:** DHA HIE documentation explicitly provides this architecture for multitenant HMIS platforms (`https://hie-docs.dha.go.ke/docs/authentication/process/facility-identification`), eliminating the operational overhead of managing individual OAuth 2.0 client keys per health facility.
* **Failure Condition & Mitigation:** If DHA restricts service-account multitenancy or requires separate client certificates per facility, the API client module will fall back to a per-tenant credential vault (e.g., HashiCorp Vault) storing tenant-specific JWT keys.

### ASM-02: Legal & Statutory Continuity under Appellate Stay
* **Assumption Statement:** The Digital Health Act, 2023, the Social Health Insurance Act, 2023, and the Primary Health Care Act, 2023 remain in full operational force and legal effect throughout the architecture and development phases by virtue of the Court of Appeal's stay of execution in Civil Application No. E387 of 2024.
* **Justification:** The Court of Appeal confirmed that healthcare operations cannot be subjected to regulatory voids, staying the High Court's order of unconstitutionality.
* **Failure Condition & Mitigation:** If the Court of Appeal ultimately nullifies specific clauses without parliamentary remediation, the architecture will maintain modular abstraction layers between the core HMIS and external payer integrations, allowing rapid rollback to legacy NHIF or private payer protocols without rewriting core EHR logic.

### ASM-03: Data Localization & Sovereign Residency Compliance
* **Assumption Statement:** COMKEY AFYYA POA will satisfy Regulation 26 of the Data Protection (General) Regulations, 2021 by ensuring either that its primary database cluster is physically hosted in Kenya (e.g., Africa Data Centres Nairobi, iColo, Safaricom Cloud) OR that an active, encrypted real-time serving copy is stored within a Kenyan tier-3 data center.
* **Justification:** Regulation 26(2)(a) specifically designates primary and secondary healthcare as a strategic sector requiring servers or a serving copy within Kenya.
* **Failure Condition & Mitigation:** If overseas hosting without local residency is attempted, the system risks administrative fines up to KES 5,000,000 and stop-processing orders from the ODPC. Architecting for local hosting from Day 0 eliminates this legal exposure.

### ASM-04: Mandatory Adoption of ICD-11 & National Vocabularies
* **Assumption Statement:** All tenant healthcare facilities onboarded onto COMKEY AFYYA POA will capture clinical diagnoses using WHO ICD-11. Legacy ICD-10 will only be supported as a historical reference/cross-walk and will not be transmitted on new claims to SHA.
* **Justification:** The DHA Terminology Service (TS) documentation states that ICD-11, LOINC, and ICHI are the official mandatory national standards for the Shared Health Record and SHA adjudication.
* **Failure Condition & Mitigation:** Clinicians unfamiliar with ICD-11 may experience coding friction. The system will implement an intelligent auto-suggest mapping engine that translates common clinical shorthand and legacy terms to standardized ICD-11 codes.

### ASM-05: Health Worker Registry (HWR) PUID Availability
* **Assumption Statement:** Every prescribing physician, surgeon, and authorized nurse at tenant facilities will be duly registered and assigned a verified Practitioner Unique Identifier (`X-PUID`) in the DHA Health Worker Registry (HWR) via their respective regulatory boards (KMPDC, NCK, PPB).
* **Justification:** DHA SHR clinical reads and specialized SHA surgical/emergency claims mandate the transmission of the attending clinician's `X-PUID`.
* **Failure Condition & Mitigation:** In facilities where clinicians await license renewal or registry indexing, a provisional credentialing workflow must alert the hospital administrator while preventing claim submission failures.

### ASM-06: KRA eTIMS System-to-System Fiscal Invoicing
* **Assumption Statement:** In accordance with Section 23A of the Tax Procedures Act, 2015, all private and mission healthcare facilities must generate electronic tax invoices with KRA Control Codes for all billing transactions, even though medical services are exempt from VAT.
* **Justification:** Section 16(2)(ac) of the Income Tax Act disallows tax deductions for business expenses lacking eTIMS validation; KRA requires eTIMS compliance across all registered business entities.
* **Failure Condition & Mitigation:** Disconnected or delayed eTIMS integration exposes tenant facilities to tax compliance penalties. The billing subsystem will incorporate an asynchronous eTIMS transmission queue with auto-retry and offline fiscal buffer signing.

### ASM-07: Internet Connectivity & Hybrid Edge Resilience
* **Assumption Statement:** While COMKEY AFYYA POA is a cloud SaaS, health facilities require continuous local operational uptime. The architecture must assume periodic WAN/broadband outages in typical Kenyan hospital environments.
* **Justification:** Clinical care and emergency triage cannot halt when internet service providers experience fiber cuts or downtime.
* **Failure Condition & Mitigation:** The platform will design a lightweight, browser-based offline caching and local store-and-forward architecture for emergency triage and vital signs capture, synchronizing with the central cloud once connectivity is restored.

### ASM-08: Database Engine-Enforced Multi-Tenancy (PostgreSQL RLS)
* **Assumption Statement:** Multi-tenant isolation will be enforced fundamentally at the PostgreSQL storage engine level via Row-Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) and transaction-scoped context variables (`SET LOCAL app.current_tenant_id = :tenantId`), rather than relying solely on application-level ORM filters.
* **Justification:** Architectural Decision ADR-002; healthcare multi-tenancy breaches incur catastrophic statutory penalties under DPA 2019. Engine-level RLS prevents accidental data bleeding from misconfigured SQL queries or developer error.
* **Failure Condition & Mitigation:** In high-concurrency environments, connection-pooling switch leakage could theoretically cross-contaminate sessions if pool resets fail. The database layer uses strict transaction wrapping (`SET LOCAL`) and automated integration tests testing cross-tenant leak scenarios.

### ASM-09: Asynchronous Payer & HIE Dispatch via Distributed Queues (BullMQ / Redis)
* **Assumption Statement:** All external network interactions with government systems (DHA HIE, SHA eClaims, KRA eTIMS, and SMS gateways) must be executed asynchronously via background worker queues (Redis + BullMQ) with idempotent retry policies, exponential backoff, and circuit breakers.
* **Justification:** Architectural Decision ADR-004; external government gateway latency or downtime must never block clinical point-of-care user interfaces or delay urgent patient triage.
* **Failure Condition & Mitigation:** Prolonged external service outages could accumulate large dead-letter queues. The background worker architecture includes persistent dead-letter storage, auto-reconciliation crons, and Prometheus queue depth alerts.

### ASM-10: PII & Health Data Searchability via HMAC-SHA256 Blind Indexing
* **Assumption Statement:** Patient Personally Identifiable Information (PII) including National ID/Alien ID and Phone Numbers will be encrypted at rest using AES-256-GCM. Exact-match patient lookups will be achieved securely using deterministic HMAC-SHA256 blind indexing with a secret pepper.
* **Justification:** Architectural Decision ADR-003 and Section 41 DPA 2019; prevents exposure of raw national identity numbers even in the event of an unauthorized database dump while preserving $O(1)$ indexed lookup performance.
* **Failure Condition & Mitigation:** Compromise of the blind index salt/pepper would allow dictionary lookup attacks. The HMAC pepper is stored strictly in Cloud KMS / HashiCorp Vault isolated from the database credentials.

### ASM-11: Sovereign Kenyan Cloud Baseline with Sovereign Cold Replication
* **Assumption Statement:** The production hosting environment will be deployed within a compliant Kenyan Tier-3 data center (Africa Data Centres Nairobi or Safaricom Cloud), backed by continuous WAL archiving to local S3-compatible sovereign object storage for cold disaster recovery.
* **Justification:** Architectural Decision ADR-005 and Regulation 26(2) Data Protection Regulations, 2021; eliminates legal ambiguity regarding healthcare data sovereignty.
* **Failure Condition & Mitigation:** Should local sovereign infrastructure face transient regional hardware scarcity, an ODPC-notified cross-border encrypted cold backup with local decryption keys will be held in escrow under strict DPA Part VI legal safeguards.

---

## 3. Assumptions Impact & Validation Matrix

| Assumption ID | Domain | Certainty Level | Validation Mechanism | Trigger for Architecture Re-evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **ASM-01** | Multi-Tenancy Gateway | **High** | Verified in official DHA HIE docs | DHA alters header specifications in live sandbox |
| **ASM-02** | Legal Continuity | **High** | Verified Court of Appeal stay orders | Court of Appeal issues substantive judgment |
| **ASM-03** | Data Localization | **High** | Explicit text of DPA Reg 26 | ODPC issues revised cross-border data transfer guidelines |
| **ASM-04** | ICD-11 Exclusivity | **Medium** | Verified DHA TS docs | DHA permits legacy ICD-10 grace period |
| **ASM-05** | Clinician PUID Index | **Medium** | Official HIE docs | Significant proportion of clinicians unindexed in HWR |
| **ASM-06** | eTIMS Mandate | **High** | Section 23A Tax Procedures Act | KRA issues specific exemption for health facilities |
| **ASM-07** | Offline Continuity | **High** | Standard Kenyan infrastructure reality | Facilities operate 100% on redundant satellite/fiber links |
| **ASM-08** | PostgreSQL RLS Isolation | **High** | PostgreSQL 16 standard feature & ADR-002 | Connection pool latency benchmark shows unacceptable RLS overhead |
| **ASM-09** | BullMQ Async Queuing | **High** | Enterprise queue pattern & ADR-004 | Memory consumption of Redis during sustained gateway outages exceeds limits |
| **ASM-10** | Blind Index Searchability | **High** | Cryptographic standard & ADR-003 | Facility requires fuzzy/phonetic search on encrypted National ID (requires trie/trigram indexes) |
| **ASM-11** | Kenyan Tier-3 Hosting | **High** | Colocation SLA & DPA Reg 26 & ADR-005 | Colocation costs or local infrastructure unavailability necessitates foreign host with ODPC waiver |

