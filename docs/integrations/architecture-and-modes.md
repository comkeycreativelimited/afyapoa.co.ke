# External Integrations Architecture & Operational Modes

**Document Identifier:** `INT-ARCH-2026-V1`  
**Target Platform:** COMKEY AFYA POA  
**Author:** Principal Software Architect  
**Status:** Approved & Implemented  
**Date:** October 20, 2026  

---

## 1. Controlled Operational Modes

To ensure strict compliance with Kenya's Digital Health Act (2023) and Data Protection Act (2019), COMKEY AFYA POA provides three distinct and securely isolated operational modes:

```
+---------------------------------------------------------------------------------------+
|                       INTEGRATION OPERATIONAL MODES ARCHITECTURE                     |
+--------------------------+-------------------------------+----------------------------+
| 1. MOCK (Default)        | 2. UAT (Sandbox)              | 3. PROD (Production)       |
+--------------------------+-------------------------------+----------------------------+
| - 100% In-Memory         | - Authorized Sandbox Gateway  | - Accredited National HIE  |
| - Zero network traffic   | - Connects to sandbox URLs    | - Production Certificates  |
| - Deterministic faults   | - Validates end-to-end flows  | - Strict mTLS / OAuth 2.0  |
| - Synthetic data stamps  | - Rejects production hosts    | - Multi-Tenant Headers     |
| - Instant test execution | - Reconciles callback events  | - Production Safety Guard  |
+--------------------------+-------------------------------+----------------------------+
```

### 1.1 MOCK Mode
* **Implementation:** `MockDhaHieClient`, `MockShaClaimsClient`, `MockKraEtimsClient`, `MockMpesaPaymentClient`.
* **Execution:** Fully in-memory, synchronous or simulated asynchronous operations. No sockets or network ports are opened.
* **Deterministic Fault Injection:** Adapters support `setSimulatedFault(IntegrationErrorCode)` allowing unit and integration test suites to simulate gateway timeouts, rate limits, 503 maintenance windows, authentication expiries, and 409 duplicate claim conflicts.
* **Synthetic Labeling:** All responses carry `isSynthetic: true` and the `MOCK_ASSUMPTION_NOTE` identifying that the transaction is synthetic.

### 1.2 UAT Mode
* **Implementation:** `RemoteDhaHieClient`, `RemoteShaClaimsClient`, `RemoteKraEtimsClient`, `RemoteMpesaClient`.
* **Target:** DHA AfyaConnect Developer Sandbox (`https://sandbox.hie.dha.go.ke`), SHA Sandbox (`https://sandbox.claims.sha.go.ke`), or local mock server (`http://localhost:4000`).
* **Credentials:** Issued via formal DHA/SHA sandbox developer registration.
* **Purpose:** Verification of the official DHA 4-Phase Qualification Checklist and SHA claims adjudication scenarios.

### 1.3 PROD Mode
* **Target:** Live National Health Information Exchange (`https://api.hie.dha.go.ke`) and SHA eClaims production (`https://api.claims.sha.go.ke`).
* **Security Controls:** Requires production developer credentials, facility-specific accreditation tokens, and facility KMFL verification.
* **Safety Isolation:** Cannot be selected by regular tenant users; locked to deployment-level environment settings.

---

## 2. Production Safety Guard (`assertSafeEnvironment`)

Automated test suites or non-production deployments must **never** inadvertently transmit synthetic or test clinical payloads to live Kenyan national registries.

The `assertSafeEnvironment(mode, targetUrl)` guard enforces the following invariants:

1. **Test Environment Hard-Block:** If `NODE_ENV === 'test'`, `VITEST === 'true'`, or `TEST=1`, any attempt to configure `mode = 'PROD'` throws an immediate `IntegrationError` with code `PRODUCTION_GUARD_TRIGGERED`.
2. **Production Host Blacklist:** The guard inspects all target URLs against authoritative production hosts:
   * `api.hie.dha.go.ke`
   * `api.claims.sha.go.ke`
   * `etims.kra.go.ke`
   * `api.safaricom.co.ke`
3. **Execution Termination:** If a test execution attempts an outbound HTTP request to any listed production hostname, the request is intercepted and terminated before touching the network stack.

---

## 3. Multi-Tenant Request Correlation & Headers

Per DHA technical specification `https://hie-docs.dha.go.ke/docs/authentication/process/facility-identification`, multi-tenant SaaS systems must dynamically inject facility scoping headers on every request:

```http
POST /shr/bundles HTTP/1.1
Host: sandbox.hie.dha.go.ke
Authorization: Bearer <service_account_jwt>
X-Facility-Id: FID-01-000101-1
X-Facility-Id-Type: fr-code
X-PUID: PUID-KMPDC-A0001
X-Consent-Token: JWT-CONSENT-2026-XXXXX
X-Correlation-Id: CORR-1729450000-abc1234
X-Request-Id: REQ-1729450000-xyz789
User-Agent: COMKEY-AFYAPOA-HMIS/1.0 (DHA-CIHIS-Client)
Content-Type: application/json
```

* `X-Facility-Id`: The Kenya Master Facility List (KMFL / FR) identifier.
* `X-Facility-Id-Type`: Must be `fr-code`.
* `X-PUID`: Practitioner Unique Identifier from the Health Worker Registry.
* `X-Consent-Token`: Time-bound visit consent token received from patient OTP or biometric verification.
* `X-Correlation-Id`: End-to-end trace ID logged across all microservices and database audit trails.

---

## 4. Protected Health Information (PHI) & Secret Log Sanitization

Under Section 30 of the Data Protection Act (2019) and DHA Clinical Record Confidentiality Guidelines, unrestricted patient clinical payloads, diagnoses, and authentication credentials **must never appear in plain text in system log files**.

The `sanitizeForLogging` pipeline enforces:

| Field Name Pattern | Sanitization Action | Log Output Example |
| :--- | :--- | :--- |
| `client_secret`, `apiKey`, `password`, `secret` | Total Redaction | `"[REDACTED_SECRET]"` |
| `otp`, `otpCode`, `otpRecord` | Total Redaction | `"[REDACTED_SECRET]"` |
| `clinicalSummary`, `notes`, `summaryNotes`, `observations`, `histology` | Payload Size Redaction | `"[PROTECTED_CLINICAL_PAYLOAD length=142]"` |
| `diagnoses`, `diagnosis` (Array) | Array Count Redaction | `"[PROTECTED_CLINICAL_ARRAY count=3]"` |
| `identificationNumber`, `nationalId` | Masking (Last 4 Digits) | `"****5678"` |
| Non-PHI Metadata (`facilityCode`, `correlationId`, `status`) | Preserved Intact | `"FID-01-000101-1"` |

---

## 5. Resilient HTTP Integration Client

All remote communications utilize `ResilientHttpClient`, incorporating enterprise resilience patterns:

```
Request Dispatch
       |
       v
[Circuit Breaker Check] ----(If Failure Count >= 5)----> Fast Fail (CIRCUIT_OPEN)
       |
       v
[Safe Environment Guard] ---(If Prod in Test)----------> Hard Abort (GUARD_TRIGGERED)
       |
       v
[Inject Multi-Tenant Headers & X-Correlation-Id]
       |
       v
[HTTP Request with AbortController Timeout]
       |
       +---> [Success 2xx] ---> Reset Failure Count ---> Return Parsed Data
       |
       +---> [Transient 429/503/Timeout] ---> Exponential Backoff + Jitter ---> Retry (up to 2 times)
       |
       +---> [Non-Retryable 400/401/403/404/409] ---> Throw Mapped IntegrationError
```

* **Configurable Timeouts:** Default 5000ms, adjustable per endpoint via `AbortController`.
* **Bounded Retries with Jitter:** Maximum 2 retries for transient errors (429, 503, ETIMEDOUT). Jitter formula: `min(2000ms, baseDelay * 2^(attempt-1) + random(0..50ms))`.
* **Circuit Breaker:** Opens for 15 seconds after 5 consecutive upstream failures, preventing cascade exhaustion.

---

## 6. The 12 Deterministic Test Scenarios

The test suite in `packages/integration-adapters/src/index.spec.ts` deterministically proves all 12 operational scenarios:

1. **Successful Requests:** Positive lookup across Client Registry, Facility Registry, Health Worker Registry, SHA Eligibility, Preauthorization, Claims Submission, eTIMS Invoice Signing, and M-Pesa STK Push.
2. **Invalid Requests:** Formatting rejection for malformed phone numbers or non-positive payment amounts.
3. **Authentication Failures:** Expired or revoked OAuth 2.0 token handling returning structured `AUTH_FAILED` (401).
4. **Authorization Failures:** Practitioner lacking credentialed permissions returning `FORBIDDEN` (403).
5. **Timeouts:** Upstream gateway slow responses triggering 504 `TIMEOUT` with retry eligibility.
6. **Rate Limiting:** HTTP 429 `RATE_LIMITED` with dynamic `Retry-After` header parsing.
7. **Service Unavailability:** HTTP 503 `SERVICE_UNAVAILABLE` triggering bounded exponential backoff.
8. **Validation Errors:** FHIR semantic or data integrity failures returning HTTP 400 `VALIDATION_FAILED`.
9. **Duplicate Submissions:** Idempotency enforcement returning HTTP 409 `DUPLICATE_SUBMISSION` when the same claim ID is submitted twice.
10. **Partial Failures:** Graceful degradation when a patient is UNINDEXED or annual benefit entitlement is EXHAUSTED without crashing the workflow.
11. **External Status Changes:** Tracking asynchronous state machines (e.g., preauth submission -> query -> cancellation; claim submission -> status query).
12. **Retry & Reconciliation:** Verifying transient retry recovery, jitter application, and circuit breaker trip/reset cycles.
