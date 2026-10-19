# COMKEY AFYA POA — Security Threat Model, Privacy & Observability Architecture

**Document Identifier:** `ARCH-SEC-2026-V1`  
**System:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Architecture Proposal (Awaiting Approval)  
**Date:** October 19, 2026  
**Methodologies:** STRIDE Threat Modeling, Privacy by Design, OpenTelemetry Standards  

---

## 1. Security Threat Model (STRIDE Analysis)

To secure sensitive healthcare data and comply with the **Computer Misuse and Cybercrimes Act, 2018** and the **Data Protection Act, 2019**, the architecture is evaluated against the STRIDE threat model:

| Threat Category | Specific Threat in HMIS SaaS | Likelihood | Impact | Architectural Mitigation in COMKEY AFYA POA |
| :--- | :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates health facility KMFL code (`FID`) to forge DHA claims | Low | Critical | Mutual TLS (mTLS) with client certificates; OAuth 2.0 client credentials bound to static IP egress; JWT cryptographic signature verification |
| **Spoofing** | Unauthorized staff member charts notes under a physician's name | Medium | High | Mandatory biometric or TOTP 2FA for clinical actions; practitioner PUID validation against DHA HWR registry |
| **Tampering** | Malicious insider alters clinical chart notes post-incident | Low | Critical | Append-only clinical event ledger; clinical notes signed with cryptographic hash (SHA-256) upon finalization; immutability enforced by DB triggers |
| **Tampering** | Claims cashier modifies billing amounts after preauthorization approval | Medium | High | Cryptographic checksums on preauth authorization tokens; automatic validation against approved SHA tariff schedule |
| **Repudiation** | Clinician denies viewing sensitive HIV/psychiatric records of a VIP patient | Medium | High | WORM (Write Once, Read Many) audit logging tracking every `RECORD_READ` event with user ID, PUID, timestamp, client IP, and consent token reference |
| **Information Disclosure** | Cross-tenant data bleed: User from Hospital A accesses patients of Hospital B | Low | Catastrophic | PostgreSQL Row-Level Security (RLS) enforced at the database engine level via session variable binding; tenant context verified at API gateway |
| **Information Disclosure** | Plaintext exposure of patient National IDs in database backups | Medium | Critical | AES-256-GCM application-layer field encryption; HMAC-SHA256 blind indexing for search; encrypted database volume snapshots |
| **Denial of Service** | Volumetric API flood exhausts server resources, preventing emergency intake | Medium | High | Redis-based Token Bucket rate limiting per tenant IP; Cloudflare / AWS Shield DDoS mitigation; edge caching for static assets |
| **Elevation of Privilege** | Cashier manipulates JWT claims to acquire `DOCTOR` or `ADMIN` roles | Low | Critical | Asymmetric JWT signing (RS256); secret keys managed via HSM/KMS; stateless JWT claims validated against active Redis session whitelist |

---

## 2. Privacy by Design & Data Protection Act 2019 Architecture

### 2.1 Sensitive Personal Data Governance (Sections 44–46 DPA 2019)
1. **Consent-Gated Processing:** Personal health data cannot be indexed or retrieved without an active, verified consent token (`X-Consent-Token`) linked to an open visit, except under codified statutory emergency exemptions (`emergency = 1`).
2. **Specialized Sensitivity Labels:** In alignment with DHA Shared Health Record standards, clinical observations for stigmatized conditions are segregated:
   * `HIV`: Human Immunodeficiency Virus tests and antiretroviral prescriptions.
   * `PSY`: Psychiatric and mental health notes.
   * `SUD`: Substance use disorder records.
   * `RH`: Reproductive health consultations.
   * *Control:* Accessing sensitive-labeled records requires explicit role authorization (`SENSITIVE_RECORDS_VIEW`) and triggers high-severity audit logging.

### 2.2 Data Subject Rights Implementation
The system provides built-in automated workflows enabling tenant hospitals to fulfill data subject requests under the Data Protection Act:
* **Right of Access & Portability (Section 34 & 38):** Automated export of patient clinical history as a standardized HL7® FHIR® R4 Patient Summary Bundle (`fhir.kenyaPSIG`).
* **Right to Rectification (Section 40):** Clerical error amendments create versioned append-only clinical revisions; prior versions remain archived for non-repudiation.
* **Right to Erasure (Section 40):** Erasure of medical records is legally constrained by the **Health Act, 2017** medical record retention mandates (minimum retention period: 7 years for adults, age 25 for minors). The system implements statutory retention holds preventing premature deletion while supporting anonymization for research cohorts.

---

## 3. Immutable Audit Logging Architecture (WORM Design)

Every security-sensitive, clinical, and financial event generates a non-repudiable audit event stored in an append-only audit table with database-level update/delete prevention:

```sql
-- Create append-only audit log table
CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    practitioner_puid VARCHAR(64),
    event_type VARCHAR(64) NOT NULL, -- RECORD_READ, RECORD_WRITE, CLAIM_DISPATCH, CONSENT_OVERRIDE
    entity_name VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    patient_id UUID,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    consent_token_ref TEXT,
    event_payload JSONB NOT NULL,
    record_hash CHAR(64) NOT NULL, -- SHA-256(prev_hash + current_event)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Database trigger preventing modification or deletion of audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutability_trigger
BEFORE UPDATE OR DELETE ON system_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();
```

* **Cryptographic Tamper-Evident Hashing:** Each audit record embeds a cryptographic hash chaining to the preceding entry, forming a verifiable audit blockchain for forensic audits.

---

## 4. Observability & Telemetry Architecture (OpenTelemetry)

The platform implements unified three-pillar observability (Logs, Metrics, Traces) utilizing the **OpenTelemetry (OTel)** standard:

```
+-----------------------------------------------------------------------------------+
|                        OPENTELEMETRY OBSERVABILITY PIPELINE                       |
|                                                                                   |
|  [NestJS API / Worker Services]                                                   |
|    - OpenTelemetry Node.js SDK auto-instrumentation (Fastify, PostgreSQL, Redis)  |
|    - W3C TraceContext propagation across HTTP headers (traceparent)               |
|    - Pino structured JSON logging with injected trace_id & span_id                |
|                                     |                                             |
|                                     v OTLP (gRPC / Port 4317)                     |
|  [OpenTelemetry Collector (Edge Daemon)]                                          |
|    - Batches, filters, and scrubs PHI (masks national IDs and patient names)      |
|    - Exports metrics to Prometheus / Grafana                                      |
|    - Exports traces to Jaeger / Tempo                                             |
|    - Exports logs to Loki / Elasticsearch                                         |
+-----------------------------------------------------------------------------------+
```

### 4.1 Key Health & Compliance Metrics
* `hie_request_duration_seconds`: Latency distribution of external DHA HIE calls.
* `sha_claim_submission_total`: Counter partitioned by status (`SUCCESS`, `REJECTED`, `RETRY`).
* `eccif_emergency_sla_remaining_hours`: Gauge tracking impending 24-hour emergency SLA breaches.
* `etims_signing_failures_total`: Counter tracking fiscal invoice transmission errors.
* `rls_tenant_context_missing_total`: Security alarm counter triggered if any query runs without a tenant context.

---

## 5. Security Incident Response & 72-Hour Breach Notification Workflow

In accordance with **Section 43 of the Data Protection Act, 2019**, any breach resulting in unauthorized access, disclosure, or corruption of personal health data triggers an automated compliance workflow:

```
[Security Anomaly Detected] (SIEM Alert / RLS Boundary Breach / Mass Data Exfiltration)
                     |
                     v
[Incident Containment & System Isolation]
  - Affected tenant sessions immediately invalidated in Redis
  - Automated kill-switch suspends external outbound sync
                     |
                     v
[Automated Forensic Snapshot]
  - PostgreSQL transaction logs and system audit logs frozen
  - Scope of compromised patient CR IDs computed
                     |
                     v
[Mandatory 72-Hour Statutory Compliance Trigger]
  - Automated incident packet generated for the Data Protection Officer (DPO)
  - Formal notification payload prepared for submission to the Office of the
    Data Protection Commissioner (ODPC) via portal: https://www.odpc.go.ke
  - Patient notification templates prepared for delivery via verified SMS/Email
```
