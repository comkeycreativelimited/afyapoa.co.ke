# COMKEY AFYA POA — Architecture Decision Records (ADRs)

**Document Identifier:** `ARCH-ADR-2026-V1`  
**System:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Approved for Implementation Planning  
**Date:** October 19, 2026  

---

## Index of Architectural Decision Records

* [ADR-001: Modular Monolith Architecture over Microservices](#adr-001-modular-monolith-architecture-over-microservices)
* [ADR-002: PostgreSQL Row-Level Security (RLS) for Multi-Tenancy](#adr-002-postgresql-row-level-security-rls-for-multi-tenancy)
* [ADR-003: Native HL7® FHIR® R4 Domain Modeling](#adr-003-native-hl7-fhir-r4-domain-modeling)
* [ADR-004: Sovereign Kenyan Data Center Hosting (DPA Reg 26 Compliance)](#adr-004-sovereign-kenyan-data-center-hosting-dpa-reg-26-compliance)
* [ADR-005: Hexagonal Ports-and-Adapters for DHA/SHA Integration](#adr-005-hexagonal-ports-and-adapters-for-dhasha-integration)
* [ADR-006: HMAC-SHA256 Blind Indexing for Encrypted Patient Search](#adr-006-hmac-sha256-blind-indexing-for-encrypted-patient-search)
* [ADR-007: Redis and BullMQ for Asynchronous Jobs & SLA Monitoring](#adr-007-redis-and-bullmq-for-asynchronous-jobs--sla-monitoring)
* [ADR-008: Mandatory Adoption of WHO ICD-11 Over Legacy ICD-10](#adr-008-mandatory-adoption-of-who-icd-11-over-legacy-icd-10)

---

## ADR-001: Modular Monolith Architecture over Microservices

### Status: Accepted
### Context
COMKEY AFYA POA is a greenfield multi-tenant HMIS SaaS. Healthcare applications require strong transactional consistency across clinical charting, stock dispensation, and billing folio generation. Adopting a distributed microservices architecture at inception introduces high operational complexity, distributed transaction failures (SAGA complexity), network latency, and increased cloud hosting costs.
### Decision
We will build COMKEY AFYA POA as a **Modular Monolith using NestJS and TypeScript**, paired with dedicated BullMQ background worker processes. Domain boundaries (Patient, EHR, Lab, Pharmacy, Billing, Claims) are enforced via strict TypeScript module boundaries and ESLint rules.
### Consequences
* **Positive:** Atomic database transactions across billing and encounters; shared memory speed; unified deployment pipeline; simplified local developer setup.
* **Negative:** Requires rigorous engineering discipline to prevent circular module dependencies; single deployable unit requires rolling blue/green deployments to avoid downtime.

---

## ADR-002: PostgreSQL Row-Level Security (RLS) for Multi-Tenancy

### Status: Accepted
### Context
In a multi-tenant healthcare SaaS serving multiple competing hospitals, cross-tenant data contamination is catastrophic and illegal under the Data Protection Act 2019. Relying solely on application-level filtering (`WHERE tenant_id = :id`) is prone to developer oversight or SQL injection leakage. Creating separate physical databases per hospital introduces extreme operational overhead when managing thousands of clinics.
### Decision
We adopt a **shared-database, shared-schema model enforced by native PostgreSQL Row-Level Security (RLS)**. Every query executes within a database transaction where `app.current_tenant_id` is set from the authenticated JWT session.
### Consequences
* **Positive:** Database engine guarantees zero cross-tenant bleeding even if application code omits a where clause; easy centralized migrations; cost-effective database resource utilization.
* **Negative:** All connection pool checkouts must execute a transaction set command; database superusers bypass RLS unless `FORCE ROW LEVEL SECURITY` is applied.

---

## ADR-003: Native HL7® FHIR® R4 Domain Modeling

### Status: Accepted
### Context
The Digital Health Act 2023 mandates that digital health systems exchange clinical records with the national Shared Health Record (SHR) via HL7® FHIR® Release 4 (R4) and the Kenya Core FHIR Implementation Guide (`fhir.dha.go.ke/core`). Traditional HMIS platforms use proprietary relational schemas and rely on runtime mapping layers, resulting in serialization errors, dropped fields, and high mapping latency.
### Decision
We design the internal clinical entity schemas to **directly mirror FHIR R4 resource definitions** (`Patient`, `Encounter`, `Observation`, `Condition`, `MedicationRequest`, `Coverage`, `Claim`).
### Consequences
* **Positive:** Zero-friction serialization when writing to the DHA SHR; guaranteed international interoperability; simplified FHIR bundle construction for UAT demos.
* **Negative:** Relational schemas must handle polymorphic FHIR attributes (e.g., `value[x]` in Observations), resolved using PostgreSQL JSONB columns with typed TypeScript accessors.

---

## ADR-004: Sovereign Kenyan Data Center Hosting (DPA Reg 26 Compliance)

### Status: Accepted
### Context
Regulation 26(2) of the Data Protection (General) Regulations, 2021 categorizes primary and secondary health care as strategic interests of Kenya, mandating that health data be processed through a server located in Kenya or maintain at least one local serving copy. Foreign cloud hosting without local residency risks criminal and civil sanctions from the ODPC.
### Decision
We will deploy the primary production cluster (NestJS, PostgreSQL RLS, Redis, S3 Object Storage) **within a Tier-3 sovereign data center located in Kenya** (e.g., Africa Data Centres ADC Nairobi or iColo MBA1/NBO1).
### Consequences
* **Positive:** 100% compliance with Kenyan data sovereignty laws; ultra-low network latency (<15ms) across Kenyan ISPs and mobile carriers; direct eligibility for government and county hospital tenders.
* **Negative:** Higher compute and bandwidth costs compared to commodity US/EU cloud regions; requires automated Terraform provisioning tailored to local cloud APIs.

---

## ADR-005: Hexagonal Ports-and-Adapters for DHA/SHA Integration

### Status: Accepted
### Context
The DHA Health Information Exchange and SHA eClaims APIs are subject to iterative development, schema updates, and potential statutory revisions. Hardcoding direct HTTP calls inside the clinical or billing modules creates fragile coupling.
### Decision
We implement a **Hexagonal Architecture (Ports and Adapters)** for all external touchpoints (`IDhaHieClient`, `IShaClaimsClient`, `IKraEtimsClient`). The application provides switchable drivers (`Mock`, `Sandbox/UAT`, `Production`).
### Consequences
* **Positive:** Fast, reliable unit tests and CI pipelines using in-memory mock adapters; ability to test all 8 integration scenarios in isolation; seamless switching from sandbox to live production credentials.
* **Negative:** Additional boilerplate code and DTO translation layers between domain models and external wire schemas.

---

## ADR-006: HMAC-SHA256 Blind Indexing for Encrypted Patient Search

### Status: Accepted
### Context
Section 44 of the Data Protection Act 2019 requires sensitive personal data (national ID numbers, passport numbers, phone numbers) to be encrypted at rest. Standard randomized encryption (`AES-256-GCM`) prevents database B-Tree indexing, making exact-match patient lookups impossible without full-table decryption.
### Decision
We adopt **Blind Indexing**: sensitive identifiers are encrypted non-deterministically with AES-256-GCM, while a separate column stores a deterministic cryptographic HMAC-SHA256 hash computed with a secret, rotating pepper.
### Consequences
* **Positive:** High-performance $O(1)$ indexed equality queries; zero plaintext exposure in database files, backups, or query logs; full cryptographic confidentiality.
* **Negative:** Cannot perform partial/substring searches (e.g., `LIKE '%1234%'`) on National ID numbers; requires dual column management (`id_number_encrypted`, `id_number_hash`).

---

## ADR-007: Redis and BullMQ for Asynchronous Jobs & SLA Monitoring

### Status: Accepted
### Context
Several critical HMIS operations cannot run synchronously on user HTTP threads:
1. SHA claims dispatch and adjudication waiting.
2. 24-hour ECCIF emergency claim deadline tracking.
3. KRA eTIMS fiscal invoice signing.
4. Outbound Shared Health Record FHIR bundle ingestion.
### Decision
We deploy **BullMQ backed by a Redis 7 cluster** for distributed task queueing, retry handling with exponential backoff, dead-letter queueing (DLQ), and cron-like SLA monitoring.
### Consequences
* **Positive:** Non-blocking user interactions; resilience against transient network outages; automated escalations before 24-hour emergency SLA breaches.
* **Negative:** Introduces Redis as a critical stateful infrastructure dependency requiring high-availability clustering and memory monitoring.

---

## ADR-008: Mandatory Adoption of WHO ICD-11 Over Legacy ICD-10

### Status: Accepted
### Context
While many legacy Kenyan hospitals still utilize ICD-10, the Digital Health Agency has formally established **WHO ICD-11 MMS** as the national mandatory diagnostic coding standard for the Health Information Exchange. Transmitting ICD-10 codes on new SHA eClaims will lead to automated adjudication rejection.
### Decision
COMKEY AFYA POA will enforce **ICD-11 as the sole primary diagnostic coding system**. The clinical diagnosis search widget will embed a synonym and legacy ICD-10 cross-walk mapper that resolves familiar clinical search terms directly to validated ICD-11 entities.
### Consequences
* **Positive:** Guaranteed compliance with DHA Terminology Service and SHA automated claims adjudicators; future-proof clinical documentation.
* **Negative:** Requires clinician change management and UX auto-suggest optimizations to assist doctors transitioning from legacy terminology.
