# COMKEY AFYA POA — Synthetic Local Mock Gateway Server

**Service Identifier:** `@afyapoa/mock-server`  
**Purpose:** High-fidelity local HTTP simulation of Kenya's Digital Health Agency (DHA) HIE, Social Health Authority (SHA) eClaims, KRA eTIMS, and M-Pesa gateways.  
**Conformance:** Verified against `DHA-REQ-2026-V1` and `SHA-INT-2026-V1`.

---

## 1. Quick Start

### Run in Development (Watch Mode):
```bash
pnpm --filter @afyapoa/mock-server dev
```

### Build & Run Production Build:
```bash
pnpm --filter @afyapoa/mock-server build
pnpm --filter @afyapoa/mock-server start
```

### Execute Test Suite:
```bash
pnpm --filter @afyapoa/mock-server test
```

Default local address: `http://localhost:4000` (Configured via `MOCK_SERVER_PORT`).

---

## 2. Documented API Routes Reference

### Health & Diagnostics
* `GET /health` -> Server status and timestamp.

### Authentication & Multi-Tenancy Gateway
* `POST /api/v1/tenants/token` -> OAuth 2.0 client credentials grant. Returns Bearer access token.

### DHA Master Registries
* `GET /api/v1/patients?identification_number={ID}&identification_type={TYPE}` -> Client Registry lookup.
* `GET /api/v1/patients/search?name={name}` -> Beneficiary search.
* `GET /api/v1/facilities/:kmflCode` -> Master Facility List accreditation verification.
* `GET /api/v1/practitioners/:puid` -> Health Worker Registry license status.
* `GET /api/v1/practitioners/:puid/license?board={board}` -> Council verification.

### DHA Patient Consent Framework
* `GET /shr/open-visits?patient_id={crId}&facility_id={frCode}` -> Open visit check.
* `GET /api/v1/patients/contacts?patient_id={crId}` -> Registered patient contacts for OTP.
* `POST /shr/consents` & `POST /api/v1/claims/otp` -> Trigger OTP dispatch.
* `POST /shr/consents/:id/verify` -> Verify OTP. Standard simulated OTP is `123456`.
* `POST /api/v1/claims/authorize` -> Biometric fingerprint match session.
* `POST /shr/consents/emergency` -> Emergency doctor OTP consent.
* `POST /shr/visits/:id/close` -> Close visit and terminate consent session upon discharge.

### DHA Shared Health Record (SHR)
* `POST /shr/bundles` -> Clinical FHIR bundle ingestion (Requires `X-Consent-Token` and `X-PUID`).
* `GET /shr/patient-records?cr_id={crId}&practitioner_id={puid}` -> Retrieve longitudinal patient records.

### DHA Terminology Service
* `POST /api/v1/terminology/validate` -> Validate WHO ICD-11, LOINC, or WHO ICHI concept.
* `GET /api/v1/terminology/search?query={q}` -> Search clinical concepts.

### SHA eClaims & Insurance Engine
* `GET /api/v1/patients/eligibility?identification_number={ID}` -> Check PHC, SHIF, and ECCIF coverage.
* `GET /api/v1/patients/sub-benefits?patient_id={crId}` -> Authorized sub-benefits.
* `GET /api/v1/patients/benefits/interventions?patient_id={crId}&sub_benefit_code={code}` -> Interventions and tariffs.
* `POST /api/v1/claims/preauth` -> Submit preauthorization.
* `GET /api/v1/claims/preauth/:id` -> Query preauthorization status.
* `POST /api/v1/claims/preauth/cancel` -> Cancel preauthorization.
* `POST /api/v1/claims/visit` -> Start active claims visit.
* `POST /api/v1/claims/submit` -> Submit outpatient / capitation claim.
* `POST /api/v1/claims/discharge_inpatient` -> Submit inpatient discharge claim.
* `GET /api/v1/claims/:claimId/status` -> Asynchronous adjudication status query.

### KRA eTIMS Fiscal Service
* `POST /api/v1/etims/sign` -> Fiscal invoice signing. Emits control code and QR verification URL.
* `POST /api/v1/etims/credit-note` -> Credit note signing.

### M-Pesa Gateway (Provisional Simulation)
* `POST /api/v1/mpesa/stkpush` -> Initiate STK push prompt.
* `GET /api/v1/mpesa/query/:checkoutRequestId` -> Query payment allocation.

---

## 3. Deterministic Scenario Simulation

The mock server can deterministically simulate failures and edge cases across any route by passing the `X-Mock-Scenario` header:

| Header Value | HTTP Status | Simulated Error / Behavior |
| :--- | :--- | :--- |
| `X-Mock-Scenario: timeout` | `504 Gateway Timeout` | Simulates slow or uncooperative upstream DHA/SHA gateway. |
| `X-Mock-Scenario: rate_limit` | `429 Too Many Requests` | Returns `Retry-After: 1` header simulating quota exhaustion. |
| `X-Mock-Scenario: unavailable` | `503 Service Unavailable` | Simulates scheduled maintenance window. |
| `X-Mock-Scenario: auth_fail` | `401 Unauthorized` | Simulates expired or rejected OAuth 2.0 bearer token. |
| `X-Mock-Scenario: forbidden` | `403 Forbidden` | Simulates unauthorized PUID or unaccredited facility. |
| `X-Mock-Scenario: validation_error`| `400 Bad Request` | Simulates semantic FHIR schema rejection. |
| `X-Mock-Scenario: duplicate` | `409 Conflict` | Simulates duplicate claim or resource submission. |

---

## 4. Synthetic Behavior & Mock Assumptions

1. **Clear Labeling:** All responses include `isSynthetic: true` and the stamp `mockAssumption: "SYNTHETIC IN-MEMORY SIMULATION: Verified against DHA-REQ-2026-V1 and SHA-INT-2026-V1. Not connected to external DHA/SHA production network."`.
2. **Standard Test Tokens:**
   * National ID `12345678`: Verified female citizen (Jane Mwangi, UPI `UPI-KEN-2026-12345678`, SHIF `SHIF-9988776655`).
   * National ID `23456789`: Verified male citizen (David Kipkorir, UPI `UPI-KEN-2026-23456789`).
   * Member Number `SHA-EXHAUSTED-001`: Active member with `EXHAUSTED` annual entitlement balance.
   * OTP `123456`: Always valid for synthetic OTP consent verification. Any other code returns 400 Bad Request.
   * Phone `+254700000000`: Triggers simulated user cancellation (DS-1032) for M-Pesa testing.
