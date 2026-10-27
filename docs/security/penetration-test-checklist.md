# COMKEY AFYA POA — OWASP ASVS Level 2 Penetration Testing Checklist
*(Multi-Tenant Clinical HMIS & National Integration Security)*

**Document Reference:** SEC-PENTEST-2026-V1  
**Baseline Standard:** OWASP Application Security Verification Standard (ASVS) 4.0 Level 2  
**Target Environment:** Staging / Pre-Production Sandbox (`sandbox.afyapoa.co.ke`)  
**Scope:** Core Web SPA (`apps/web`), NestJS API (`apps/api`), Background Workers (`apps/worker`), PostgreSQL 16 RLS Engine, Redis Queues, S3 Object Storage  
**Classification:** Confidential — Technical Security Audit Manual  

---

## 1. Engagement Rules of Engagement & Pre-Requisites

1. **Safety Assertions:** All test executions must be performed with `INTEGRATION_DRIVER=MOCK` or against designated sandbox gateways. Outbound calls to live production endpoints (`api.hie.dha.go.ke`, `api.claims.sha.go.ke`, `etims.kra.go.ke`) are strictly prohibited and hard-blocked by `assertSafeEnvironment()`.
2. **Tenant Provisioning:** Testing requires at least two distinct provisioned tenants (`tenant-alpha-uuid` and `tenant-beta-uuid`), each populated with isolated test clinical data.
3. **Tester Role Matrix:** Testers must be supplied with dedicated test accounts covering all 9 healthcare roles:
   - Platform Super-Admin (`superadmin.test`)
   - Hospital Facility Admin (`admin.alpha.test` & `admin.beta.test`)
   - Clinician (`doctor.alpha.test` & `doctor.beta.test`)
   - Triage Nurse (`nurse.alpha.test`)
   - Laboratory Technologist (`lab.alpha.test`)
   - Pharmacist (`pharm.alpha.test`)
   - Billing Clerk (`billing.alpha.test`)
   - Commercial Finance User (`finance.alpha.test`)
   - Records Officer (`records.alpha.test`)

---

## 2. ASVS Level 2 Detailed Test Checklist

### Domain 1: Multi-Tenant Isolation & PostgreSQL Row-Level Security (RLS)

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V4.1.1** | **Direct Object Reference (IDOR) Cross-Tenant Read** | Authenticate as Clinician in Tenant A. Issue `GET /api/v1/records/:id` using a valid record UUID belonging to Tenant B. | HTTP 404 Not Found. Record is filtered out at database engine level by PostgreSQL RLS. | [ ] |
| **V4.1.2** | **Cross-Tenant Mutation (Write IDOR)** | Authenticate as Clinician in Tenant A. Issue `PATCH /api/v1/records/:id` targeting Tenant B record with payload `{"notes": "TAMPERED"}`. | HTTP 404 Not Found. Database update returns zero affected rows; Tenant B record unchanged. | [ ] |
| **V4.1.3** | **Header Spoofing / Tenant Injection** | Authenticate as Clinician in Tenant A. Inject HTTP header `x-tenant-id: <tenant-beta-uuid>` on query `GET /api/v1/records`. | HTTP 200 OK, but response contains exclusively Tenant A records. Non-superadmin `x-tenant-id` header is discarded. | [ ] |
| **V4.1.4** | **Database Connection Pool Pollution** | Send alternating interleaved asynchronous requests from Tenant A and Tenant B over the same persistent HTTP keep-alive connection. | Each response strictly contains only the records of the requesting tenant. Transaction wrappers guarantee local session scope. | [ ] |
| **V4.2.1** | **Bypass RLS via SQL Injection** | Inject SQL fragments into search endpoints: `GET /api/v1/patients?name=' OR '1'='1` or `GET /api/v1/patients?name=test' UNION SELECT * FROM users--`. | HTTP 400 Bad Request or empty result. Drizzle parameterized queries prevent SQL syntax breakout. | [ ] |

---

### Domain 2: Authentication & Session Management

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V2.1.1** | **Brute-Force & Account Lockout** | Send 6 consecutive requests to `/api/v1/auth/login` with incorrect password for target username. | Request 5 returns 401; Request 6 returns 401 with `Account temporarily locked due to excessive failed attempts`. | [ ] |
| **V2.8.1** | **MFA TOTP Bypass** | Authenticate as Facility Admin. On receiving `mfaRequired: true`, attempt to bypass TOTP verification by invoking protected endpoints directly or supplying dummy code `123456`. | Protected endpoints return 401 Unauthorized. In production mode, code `123456` is strictly rejected with `Invalid MFA code`. | [ ] |
| **V3.2.1** | **Session Revocation on Logout** | Authenticate user, obtain JWT bearer token. Execute `POST /api/v1/auth/logout`. Immediately reuse bearer token on `GET /api/v1/auth/me`. | HTTP 401 Unauthorized. Server validates `user_sessions.is_revoked === false` on every request. | [ ] |
| **V3.5.1** | **Refresh Token Rotation & Single-Use** | Submit valid refresh token to `/api/v1/auth/refresh`. Receive new token. Immediately replay the old refresh token. | Second attempt returns HTTP 401 Unauthorized (`Invalid or expired refresh token`). | [ ] |
| **V2.5.1** | **Password Reset Token Enumeration & Single-Use** | Request password reset for existing and non-existing emails. Attempt to reuse a confirmed reset token. | Response is identical (`If the email exists...`) preventing user enumeration. Reused token rejected with HTTP 400. | [ ] |

---

### Domain 3: Role- and Attribute-Based Authorization (RBAC/ABAC)

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V4.1.5** | **Vertical Privilege Escalation to Super-Admin** | Authenticate as Hospital Facility Admin. Issue `GET /api/v1/platform/tenants` or `POST /api/v1/platform/tenants`. | HTTP 403 Forbidden. Access blocked by `RolesGuard` checking `UserRole.SUPER_ADMIN`. Audit event logged. | [ ] |
| **V4.1.6** | **Unauthorized Medical Prescription by Nurse/Clerk** | Authenticate as Triage Nurse or Billing Clerk. Issue `POST /api/v1/orders` attempting to prescribe medication. | HTTP 403 Forbidden (`Missing permission: clinical:order:write`). Blocked by `PermissionsGuard`. | [ ] |
| **V4.1.7** | **Unauthorized Laboratory Result Authorization** | Authenticate as Lab Technologist. Issue `PATCH /api/v1/laboratory/orders/:id/authorize` (requires `CLINICIAN` role). | HTTP 403 Forbidden. Only qualified clinicians can formally authorize diagnostic lab reports. | [ ] |
| **V4.1.8** | **Unauthorized Bulk Data Export** | Authenticate as Clinician. Issue `GET /api/v1/records/export/all` (requires `AUDIT_EXPORT` permission). | HTTP 403 Forbidden. Only authorized Facility Administrators with export privileges can dump records. | [ ] |

---

### Domain 4: Cryptography & PII Protection

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V6.2.1** | **Cleartext Inspection of Database Dump** | Extract raw PostgreSQL dump of `patients` and `patient_identifiers` tables. Inspect columns `phone_encrypted` and `value_encrypted`. | No cleartext phone numbers or National IDs visible. Stored format is `iv_hex:authTag_hex:ciphertext_hex`. | [ ] |
| **V6.2.2** | **Blind Index Leakage & Determinism** | Compare blind index values for two identical national IDs belonging to different tenants. | HMAC-SHA256 blind index matches normalized value with secret pepper (`BLIND_INDEX_PEPPER`), allowing exact search without decrypting table. | [ ] |
| **V9.1.1** | **Transport Layer Security & Cipher Suite Enforcement** | Run `testssl.sh` or `sslyze` against API domain. Attempt connections using TLS 1.0, 1.1, or weak ciphers (RC4, 3DES). | Connection rejected. TLS 1.2 and 1.3 only; HSTS enforced with `max-age=31536000; includeSubDomains; preload`. | [ ] |

---

### Domain 5: File Storage & Object Security

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **V12.3.1** | **Recursive Directory Traversal Upload** | Upload file with malicious filename: `../../../../etc/passwd` or `....//....//victim.pdf`. | System sanitizes path using recursive while-loop. Stored path forced to `tenants/{tenantId}/victim.pdf`. | [ ] |
| **V12.1.1** | **MIME-Type & Executable Upload Bypass** | Attempt to upload `.php`, `.sh`, `.exe`, or HTML/SVG file disguised with `Content-Type: image/png`. | Rejected by file validation. Allowed types restricted to clinical formats (PDF, JPEG, PNG, DICOM). | [ ] |
| **V12.4.1** | **Direct Download Cross-Tenant Storage Leak** | Attempt to download a lab result file using a known S3 key belonging to another tenant. | Access URL requires validated tenant session; direct public S3 bucket access is disabled. | [ ] |

---

### Domain 6: Audit Trail Immutability & Tamper Resistance

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V8.2.1** | **WORM Policy Enforcement (Direct DELETE / UPDATE)** | Connect to database as application user `afyapoa_app`. Execute `DELETE FROM audit_events` or `UPDATE audit_events SET details = 'foo'`. | Operation returns zero affected rows. PostgreSQL RLS allows `SELECT` and `INSERT` only. | [ ] |
| **V8.2.2** | **Audit Hash Chain Validation** | Verify cryptographic chain integrity by calling `verifyChainIntegrity(tenantId)`. | Returns `{ valid: true }`. Every event SHA-256 hash correctly chains to the preceding event hash. | [ ] |
| **V8.3.1** | **Sensitive Data Leakage in Application Logs** | Inspect Pino application logs during user login, password reset, and patient registration. | Passwords, tokens, MFA secrets, and raw encrypted payloads are replaced with `[REDACTED]`. | [ ] |

---

### Domain 7: Business Logic & Clinical Integrity

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V11.1.1** | **Illegal Encounter State Transition** | Attempt to transition encounter directly from `ARRIVED` to `DISCHARGED` without triage or consultation. | HTTP 400 Bad Request. State machine enforces valid sequence: `ARRIVED -> TRIAGED -> IN_CONSULTATION -> COMPLETED`. | [ ] |
| **V11.1.2** | **Duplicate Clinical Order Injection** | Issue identical medication orders within a 60-second window for the same encounter. | Duplicate order detection flags collision; requires explicit doctor confirmation (`overrideDuplicate`). | [ ] |
| **V11.1.3** | **Unauthorized eTIMS Fiscal Invoice Tampering** | Attempt to alter line-item amounts on an invoice already signed with an eTIMS fiscal code. | HTTP 400 Bad Request. Finalized invoices are immutable; adjustments require formal credit note issuance. | [ ] |
| **V11.1.4** | **Emergency Trauma "Break-Glass" Abuse** | Attempt to use Emergency Trauma Intake to modify or read an existing protected patient's medical file. | Emergency intake creates an isolated temporary pseudonymized record; does not grant retrospective access to existing sealed files. | [ ] |

---

### Domain 8: National Gateways & External Integrations

| ASVS ID | Test Objective | Test Payload / Attack Procedure | Expected Secure Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **V10.1.1** | **Accidental Production Call in Test Environment** | Configure test environment with `targetUrl: 'https://api.hie.dha.go.ke'`. Execute HIE sync test. | Hard exception thrown by `assertSafeEnvironment()`. Outbound production calls blocked during testing. | [ ] |
| **V10.2.1** | **Unauthenticated SHA Callback Webhook** | Send forged HTTP POST callback to `/api/v1/claims/sha/callback` without valid HMAC signature. | HTTP 401 Unauthorized. Signature mismatch blocks forged adjudication. | [ ] |
| **V10.3.1** | **FHIR XML / JSON Entity Expansion DoS** | Submit deeply nested or recursive FHIR Bundle payload to FHIR validation endpoint. | Payload size capped; parser rejects recursive entities. Rate limiter mitigates parsing exhaustion. | [ ] |

---

## 3. Penetration Test Sign-Off & Attestation Sheet

| Role | Name | Organization / Department | Signature | Date |
| :--- | :--- | :--- | :--- | :--- |
| **Lead Penetration Tester** | _______________________ | Independent Cybersecurity Audit Firm | _______________________ | ____________ |
| **Lead Security Architect** | _______________________ | Comkey Creative Limited | _______________________ | ____________ |
| **Data Protection Officer** | _______________________ | Healthcare Facility / Comkey | _______________________ | ____________ |
| **Chief Technology Officer** | _______________________ | Comkey Creative Limited | _______________________ | ____________ |
