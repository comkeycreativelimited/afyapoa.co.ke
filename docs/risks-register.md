# COMKEY AFYYA POA — Master Project Risk Register

**Document Identifier:** `RSK-REG-2026-V1`  
**Target Platform:** COMKEY AFYYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Baseline Draft (Discovery & Research Phase)  
**Date of Research / Last Verified:** October 19, 2026

---

## 1. Risk Evaluation Methodology

Risks are evaluated using a standard 5x5 qualitative risk matrix:
* **Probability (P):** 1 (Rare), 2 (Unlikely), 3 (Possible), 4 (Likely), 5 (Almost Certain)
* **Impact (I):** 1 (Insignificant), 2 (Minor), 3 (Moderate), 4 (Major), 5 (Catastrophic)
* **Severity Score (S):** $P \times I$  
  * **Low (1–4):** Manage via routine procedures.  
  * **Medium (5–9):** Active monitoring and planned mitigation.  
  * **High (10–14):** Formal risk owner, proactive controls.  
  * **Critical (15–25):** Executive escalation, mandatory architectural safeguards.

---

## 2. Risk Matrix & Catalog

```
+---------------------------------------------------------------------------------------------------------------------------------------------------+
| ID       | Category       | Risk Description                  | P | I | S  | Trigger Condition                  | Mitigation Strategy         |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-L-01 | Legal          | Judicial nullification of DHA/SHIA | 3 | 5 | 15 | Court of Appeal upholds High Court | Decoupled adapter layers;   |
|          |                | Acts on constitutional challenge   |   |   |    | declaration of unconstitutionality | maintain backward-compat    |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-S-01 | Privacy/Legal  | Violation of DPA Reg 26 data       | 2 | 5 | 10 | Hosting pure cloud instances       | Host in Kenya data centre   |
|          |                | localization (offshore storage)    |   |   |    | outside Kenya without local replica| or local synchronized copy  |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-T-01 | Technical      | DHA HIE API contract drift /       | 4 | 4 | 16 | DHA modifies API specs between     | Strict automated contract   |
|          |                | breaking changes in beta specs     |   |   |    | developer preview and production   | testing & CI/CD validators  |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-C-01 | Certification  | Failure to achieve DHA 4-phase     | 2 | 5 | 10 | Failed UAT demo or non-compliance | Rigorous pre-UAT audit      |
|          |                | certification for HMIS deployment  |   |   |    | with security/interop standards    | against official checklist  |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-S-02 | Security       | Multi-tenant cross-tenant data     | 1 | 5 | 5  | Flaw in SQL queries or tenant      | Row-Level Security (RLS)    |
|          |                | contamination or record bleeding   |   |   |    | discriminator context filtering    | & tenant schema isolation   |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-O-01 | Operational    | Internet outage at health facility | 4 | 4 | 16 | Fiber cuts, ISP downtime in rural  | Edge caching, offline queue |
|          |                | halts SHA check & visit creation   |   |   |    | or peri-urban healthcare clinics   | for emergency intake        |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-F-01 | Financial/Ops  | Forfeiture of ECCIF emergency      | 4 | 4 | 16 | Emergency claim submitted >24 hours| Automated dispatch queue    |
|          |                | claims due to 24h deadline breach  |   |   |    | after admission due to paperwork   | with SLA breach alarms      |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-T-02 | Technical      | Clinician resistance / errors in   | 4 | 3 | 12 | Doctors unable to find ICD-11 codes| Smart auto-suggest mapper;  |
|          |                | adopting mandatory WHO ICD-11      |   |   |    | during live consultation           | synonym search dictionary   |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-F-02 | Fiscal/Tax     | KRA eTIMS invoice signing failure  | 3 | 4 | 12 | KRA eTIMS gateway outage or invalid| Asynchronous retry buffer   |
|          |                | exposes facility to tax penalties  |   |   |    | item tax classification            | with signed fiscal receipt  |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-T-03 | Technical      | BullMQ queue backlog/saturation    | 3 | 4 | 12 | Sustained external DHA/SHA gateway | Dead-letter storage, auto-  |
|          |                | during extended upstream outages   |   |   |    | downtime causing memory pressure   | backoff, queue depth alerts |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
| RSK-S-03 | Security/Ops   | KMS master key unavailability halts| 1 | 5 | 5  | Cloud KMS outage prevents AES-256  | Local ephemeral envelope    |
|          |                | patient record decryption/intake   |   |   |    | field decryption for triage        | key caching with 15m TTL    |
+----------+----------------+------------------------------------+---+---+----+------------------------------------+-----------------------------+
```

---

## 3. Deep-Dive Risk Analysis & Action Plans

### RSK-L-01: Judicial Nullification of DHA/SHIA Legislation
* **Category:** Legal & Regulatory | **Severity:** 15 (Critical)
* **Risk Context:** The High Court declared the Digital Health Act 2023 and the Social Health Insurance Act 2023 unconstitutional in July 2024 for insufficient public participation. While suspended and stayed by the Court of Appeal, a final adverse decree could force Parliament to amend the Acts or revert operational mechanisms.
* **Trigger:** Court of Appeal delivers final judgment upholding invalidity without granting further legislative cure periods.
* **Mitigation Strategy:**
  1. Build an **Insurance Adapter Layer (Port/Adapter Pattern)** that abstracts the underlying payer API. If SHA workflows are temporarily suspended, the system can route claims through legacy NHIF portals or direct private insurer EDI channels without altering the core HMIS data model.
  2. Legal counsel actively tracks appellate causelists and Ministry of Health consultative sessions.
* **Risk Owner:** Corporate Legal Counsel & Principal Architect.

### RSK-S-01: Data Localization Non-Compliance (DPA 2019 Regulation 26)
* **Category:** Privacy & Data Protection | **Severity:** 10 (High)
* **Risk Context:** Processing healthcare data through overseas servers without maintaining at least one local serving copy in Kenya is a direct violation of Regulation 26(2) of the Data Protection (General) Regulations, 2021.
* **Trigger:** Deploying production databases solely to offshore regions (e.g., AWS eu-west-1 or Azure westeurope) without a Kenyan data replica.
* **Mitigation Strategy:**
  1. Architect primary deployment directly within Kenyan enterprise data centers (e.g., Africa Data Centres Nairobi, iColo, Safaricom Cloud), or establish an active, encrypted real-time read/write replica within Kenya.
  2. Perform a formal Data Protection Impact Assessment (DPIA) and register COMKEY as a Data Processor with the ODPC.
* **Risk Owner:** Cloud Infrastructure Lead & Data Protection Officer (DPO).

### RSK-T-01: DHA HIE API Contract Volatility & Breaking Changes
* **Category:** Technical / Interoperability | **Severity:** 16 (Critical)
* **Risk Context:** The DHA HIE API is evolving rapidly across developer sandbox iterations. Schema updates, new mandatory headers, or modified FHIR profiles can break production claims and consent flows.
* **Trigger:** DHA releases breaking schema revisions without backward compatibility or extended deprecation windows.
* **Mitigation Strategy:**
  1. Implement automated Consumer-Driven Contract Testing (e.g., Pact) in the CI/CD pipeline against DHA mock servers.
  2. Strict isolation of HIE client adapters; changes in DHA endpoints affect only the adapter, never core domain services.
  3. Continuous monitoring of the official DHA documentation changelog (`https://hie-docs.dha.go.ke/changelog`).
* **Risk Owner:** Backend Integration Lead.

### RSK-O-01: Health Facility Internet Outages Interrupting Patient Care
* **Category:** Operational & Clinical | **Severity:** 16 (Critical)
* **Risk Context:** Kenyan healthcare facilities frequently experience internet disruptions. Since DHA eligibility checks and visit authorizations are network calls, downtime can halt clinic operations.
* **Trigger:** Local fiber cuts or mobile network failure during active patient triage.
* **Mitigation Strategy:**
  1. Implement **Local Edge Resilience:** Client web applications cache essential master data (e.g., patient demographics, price lists).
  2. **Emergency Store-and-Forward:** In emergency scenarios (ECCIF), allow immediate admission and local clinical notes capture, queueing the authorization and claim submission for automated dispatch as soon as connectivity resumes.
  3. Recommend dual-WAN cellular backup (Safaricom/Airtel 4G/5G) for tenant facility deployments.
* **Risk Owner:** Principal Architect & Front-End Lead.

### RSK-F-01: Forfeiture of Emergency Claims Due to 24-Hour SLA Breach
* **Category:** Financial & Operational | **Severity:** 16 (Critical)
* **Risk Context:** The Emergency, Chronic & Critical Illness Fund (ECCIF) rules mandate that emergency claims must be fully submitted within 24 hours of patient presentation. Delays in doctor documentation lead to permanent claim rejections by SHA.
* **Trigger:** Attending physician fails to complete notes/OTP within 24 hours of emergency admission.
* **Mitigation Strategy:**
  1. Implement automated emergency encounter countdown timers visible on clinical and administration dashboards.
  2. Automated SMS and push notifications to attending physicians at 6, 12, and 18 hours.
  3. Escalate impending SLA breaches directly to the hospital medical director / claims administrator.
* **Risk Owner:** Product Manager & Clinical Workflow Specialist.

### RSK-F-02: KRA eTIMS System-to-System Signing Failures
* **Category:** Fiscal & Statutory | **Severity:** 12 (High)
* **Risk Context:** System failures in generating eTIMS electronic tax invoices with KRA Control Codes expose healthcare facilities to tax compliance audits and disallowance of patient expense claims.
* **Trigger:** Inability to communicate with KRA eTIMS API during point-of-sale invoice generation.
* **Mitigation Strategy:**
  1. Deploy an asynchronous fiscal signing buffer: generate provisional invoice for patient with local cryptographically signed offline hash, then reconcile with KRA eTIMS via scheduled background workers.
  2. Implement comprehensive tax code mapping separating zero-rated, VAT-exempt medical consults, and standard rated items.
### RSK-T-03: BullMQ Queue Backlog & Memory Saturation During Upstream Outages
* **Category:** Technical & Operational | **Severity:** 12 (High)
* **Risk Context:** Extended outages of upstream DHA HIE or SHA eClaims endpoints could cause tens of thousands of delayed jobs to accumulate in Redis memory across all active tenants.
* **Trigger:** Upstream government APIs down for >12 hours while health clinics continue local operations.
* **Mitigation Strategy:**
  1. Configure Redis memory caps with `noeviction` for BullMQ queues and enable Redis append-only file (AOF) persistence.
  2. Implement exponential backoff with jitter and a maximum retry threshold before dumping expired jobs into a durable PostgreSQL Dead-Letter Queue (DLQ) table to relieve Redis RAM pressure.
  3. Real-time Prometheus alerting on queue depths exceeding 1,000 pending items.
* **Risk Owner:** Backend Platform & SRE Lead.

### RSK-S-03: Cloud KMS Unavailability Halting Local Clinical Ingestion
* **Category:** Security & Reliability | **Severity:** 5 (Medium)
* **Risk Context:** If field-level encryption (AES-256-GCM) requires a synchronous round-trip to Cloud KMS for every patient demographic decryption, network instability could paralyze clinic check-in.
* **Trigger:** Cloud KMS latency spikes or transient WAN disconnectivity at the data center level.
* **Mitigation Strategy:**
  1. Implement envelope encryption: KMS generates and wraps a Data Encryption Key (DEK); the decrypted DEK is securely cached in memory in the NestJS application process with a strict 15-minute TTL.
  2. DEK rotation handled asynchronously without disrupting active patient lookup workflows.
* **Risk Owner:** Chief Security Officer & Cloud Architect.

---

## 4. Governance & Continuous Monitoring

* **Quarterly Risk Review:** The Principal Architect, Legal Counsel, and Security Lead shall review and update this register quarterly or upon any significant judicial decree or DHA regulatory announcement.
* **Pre-Deployment Gate:** No release of COMKEY AFYYA POA shall proceed to production without resolving all "Critical" risk triggers and securing formal sign-off on open mitigations.
