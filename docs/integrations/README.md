# COMKEY AFYA POA — External Healthcare Integration Framework

**Document Identifier:** `INT-FW-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Systems Engineer  
**Status:** Approved & Implemented  
**Date:** October 20, 2026  
**Primary Authorities:** Digital Health Agency (DHA), Social Health Authority (SHA), Kenya Revenue Authority (KRA)

---

## 1. Executive Architecture Overview

The COMKEY AFYA POA **External Healthcare Integration Framework** connects tenant healthcare facilities to national digital health infrastructure:
* **Digital Health Agency (DHA) Kenya Health Information Exchange (HIE):** Master patient index, enterprise facility registry, health worker registry, visit-bound consent engine, HL7 FHIR R4 Shared Health Record (SHR), and clinical terminology service (WHO ICD-11, LOINC, WHO ICHI, KEML).
* **Social Health Authority (SHA) eClaims Engine:** Beneficiary eligibility verification across three statutory funds (PHC, SHIF, ECCIF), preauthorizations (normal, elective, surgical, oncology, renal, imaging), real-time claims adjudication, inpatient discharge claims, and asynchronous callbacks.
* **Kenya Revenue Authority (KRA) eTIMS:** Virtual Sales Control Unit (VSCU) fiscal invoice signing and credit note generation.
* **M-Pesa Payment Gateway:** Cashless patient billing collections and automated STK push payment allocations (isolated behind a provisional port).

The framework is architected using **Hexagonal Ports & Adapters**, ensuring high cohesion, absolute environment isolation, deterministic automated testing, and zero dependency on live national production networks during development.

---

## 2. Directory Structure & Workspace Packages

```
afya-poa/
├── packages/
│   ├── integration-adapters/            # Core integration library
│   │   ├── src/
│   │   │   ├── types.ts                # Typed contracts, error codes, Result interfaces
│   │   │   ├── security.ts             # Production safety guards, correlation, PHI redaction
│   │   │   ├── http-client.ts          # Resilient HTTP client (circuit breaker, retries, jitter)
│   │   │   ├── mock-clients.ts         # In-memory synthetic simulations (MOCK mode)
│   │   │   ├── remote-clients.ts       # HTTP clients connecting to DHA/SHA gateways (UAT/PROD)
│   │   │   ├── factory.ts              # Client instantiation based on operational mode
│   │   │   ├── index.ts                # Public exports
│   │   │   └── index.spec.ts           # 26 deterministic tests across all 12 scenarios
│   │   └── package.json
│   └── fhir-models/                     # Kenya Core HL7 FHIR R4 profiles & serializers
├── apps/
│   └── mock-server/                     # Standalone synthetic simulation gateway
│       ├── src/
│       │   ├── app.ts                  # Express application with all DHA & SHA routes
│       │   ├── index.ts                # Server entrypoint and lifecycle listener
│       │   └── index.spec.ts           # 25 HTTP unit/contract tests
│       ├── README.md                   # Mock server usage and scenario headers guide
│       └── package.json
└── docs/
    └── integrations/
        ├── README.md                   # This document
        ├── architecture-and-modes.md   # Operational modes, security guards & logging
        └── dha-sha-contract-matrix.md  # Verified vs provisional contracts matrix
```

---

## 3. The Three Controlled Operational Modes

The integration framework enforces three strict modes configured at the deployment level:

| Mode | Purpose | Target Gateway | Network Activity | Safety Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| **`MOCK`** | Local development, CI/CD, fast developer feedback | 100% In-Memory Synthetic (`MockDhaHieClient`, `MockShaClaimsClient`, etc.) | **Zero** external network traffic | Default fallback for local testing |
| **`UAT`** | End-to-end integration testing, QA verification | Authorized DHA/SHA Sandbox (`sandbox.hie.dha.go.ke`) or Local Mock Server (`localhost:4000`) | Network calls permitted to sandbox endpoints | Hard-blocked from calling verified production hostnames |
| **`PROD`** | Live clinical and claims operations in accredited facilities | Production National HIE (`api.hie.dha.go.ke`, `api.claims.sha.go.ke`) | Encrypted TLS 1.3 / mTLS traffic | Hard-blocked when `NODE_ENV === 'test'` or `VITEST === 'true'` |

### Configuration Rules:
1. **Deployment-Level Precedence:** The operational mode is set via environment configuration (`INTEGRATION_MODE=MOCK|UAT|PROD`).
2. **Tenant User Isolation:** Ordinary clinic staff, cashiers, and facility administrators **cannot** override the integration mode or target arbitrary production URLs.
3. **Automated Test Guard:** The security guard (`assertSafeEnvironment`) immediately aborts any automated test execution attempting to connect to `PROD` or verified production hostnames.

---

## 4. Key Architectural Patterns

1. **Deterministic Error Handling (`IntegrationError`):** Standard error classification covering `AUTH_FAILED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `RATE_LIMITED`, `TIMEOUT`, `SERVICE_UNAVAILABLE`, `DUPLICATE_SUBMISSION`, `PARTIAL_FAILURE`, `CONSENT_REQUIRED`, and `CIRCUIT_OPEN`.
2. **Resilience & Circuit Breaking:** `ResilientHttpClient` implements configurable timeouts via `AbortController`, bounded exponential backoff with random jitter, and a circuit breaker that trips after 5 consecutive upstream failures.
3. **Mandatory Request Correlation:** All outbound integration calls automatically inject standard multi-tenant headers:
   * `X-Facility-Id`: KMFL code (e.g., `FID-01-000101-1`)
   * `X-Facility-Id-Type`: Taxonomy identifier (strictly `fr-code`)
   * `X-Correlation-Id`: End-to-end tracing identifier
   * `X-Request-Id`: Unique request execution identifier
4. **PHI & Secret Sanitization:** Strict log filter (`sanitizeForLogging`) redacts OAuth secrets, OTP codes, and unrestricted clinical summaries/diagnoses from ordinary application logs.
