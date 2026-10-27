# COMKEY AFYA POA — Authentication & Identity Lifecycle (IAM) Specification

**Document Identifier:** `SEC-IAM-2026-V1`  
**Target Platform:** COMKEY AFYA POA (Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities)  
**Author:** Principal Software Architect & Healthcare Technology Compliance Researcher  
**Status:** Implemented & Verified in Engine Tests  
**Date:** October 19, 2026  
**Regulatory Standards:** Data Protection Act, 2019 (Section 41), Computer Misuse and Cybercrimes Act, 2018, NIST SP 800-63B  

---

## 1. Authentication Architecture Overview

`COMKEY AFYA POA` implements a stateless, token-based authentication mechanism backed by stateful database session tracking for non-repudiation and instantaneous revocation.

```
┌──────────┐                 ┌──────────────┐                 ┌───────────────┐
│  Client  │                 │   API Auth   │                 │ PostgreSQL DB │
└────┬─────┘                 └──────┬───────┘                 └───────┬───────┘
     │                              │                                 │
     │ 1. POST /auth/login          │                                 │
     │    (username, password)      │                                 │
     │─────────────────────────────>│ 2. Find user & verify hash      │
     │                              │────────────────────────────────>│
     │                              │    (bcryptjs 12 rounds)         │
     │                              │<────────────────────────────────│
     │                              │                                 │
     │                              │ 3. Check role & MFA enabled?    │
     │                              │    If SUPER_ADMIN / ADMIN:      │
     │<─────────────────────────────│                                 │
     │    200 OK { mfaRequired: true,                                 │
     │             challengeToken } │                                 │
     │                              │                                 │
     │ 4. POST /auth/mfa/verify     │                                 │
     │    (challengeToken, 6-digit) │                                 │
     │─────────────────────────────>│ 5. otplib verify(code, secret)  │
     │                              │ 6. Create active user_session   │
     │                              │────────────────────────────────>│
     │<─────────────────────────────│                                 │
     │    200 OK { accessToken,     │                                 │
     │             refreshToken,    │                                 │
     │             user, tenant }   │                                 │
```

---

## 2. Password Security & Account Protection

### 2.1 Password Hashing Specification
- **Algorithm:** `bcryptjs` with a work factor (cost) of **12**.
- **Entropy Requirement:** Passwords must be at least 10 characters long, containing uppercase letters, lowercase letters, numbers, and special symbols.
- **Salt Generation:** Unique, cryptographically secure 128-bit salt per user password.

### 2.2 Account Lockout Policy
- **Threshold:** 5 consecutive failed login attempts within a 15-minute sliding window.
- **Lockout Duration:** 15 minutes.
- **State Fields:** `failed_login_attempts INT DEFAULT 0`, `locked_until TIMESTAMP WITH TIME ZONE`.
- **Reset:** Successful authentication resets `failed_login_attempts` to 0 and clears `locked_until`.
- **Audit Logging:** Every failed login attempt records an `AUTH_LOGIN_FAILED` audit event. Upon the 5th failure, an `AUTH_ACCOUNT_LOCKED` security event is emitted.

---

## 3. Multi-Factor Authentication (TOTP)

### 3.1 Statutory & Security Requirement
Under the approved security architecture:
1. **Mandatory TOTP MFA:** Enforced for privileged administrative roles (`SUPER_ADMIN`, `FACILITY_ADMIN`).
2. **Voluntary / Policy-Enforced MFA:** Available for clinical and billing roles (`DOCTOR`, `CLINICAL_OFFICER`, `PHARMACIST`, `CASHIER`).

### 3.2 TOTP Implementation
- **Standard:** RFC 6238 (TOTP: Time-Based One-Time Password Algorithm).
- **Engine:** `otplib` with HMAC-SHA1, 30-second time steps, and a clock-drift window tolerance of $\pm 1$ step.
- **Secret Generation:** 20-byte base32-encoded cryptographic secret stored per user (`mfa_secret`).
- **Challenge-Response Flow:**
  - When primary credentials succeed for an MFA-enforced user, the server responds with:
    ```json
    {
      "mfaRequired": true,
      "challengeToken": "<ephemeral-jwt-valid-for-5m>"
    }
    ```
  - The client submits `POST /api/v1/auth/mfa/verify` containing `challengeToken` and the 6-digit TOTP code.
  - Only upon successful TOTP verification are the real `accessToken` (15m) and `refreshToken` (7d) issued.

---

## 4. Session Lifecycle Management & Revocation

### 4.1 Token Dualism
1. **Access Token:**
   - Stateless JWT signed with `JWT_SECRET` (RS256 / HS256).
   - Lifetime: 15 minutes.
   - Contains immutable claims: `sub` (userId), `tenantId`, `facilityId`, `facilityCode`, `role`, `sessionId`.
2. **Refresh Token:**
   - Cryptographically random 64-character hex string.
   - Lifetime: 7 days.
   - Stored in `user_sessions.refresh_token_hash` as a SHA-256 digest.

### 4.2 Database-Tracked Session Revocation
Every authenticated request is verified against the `user_sessions` table in PostgreSQL:
```sql
SELECT id, is_revoked, expires_at
FROM user_sessions
WHERE id = $sessionId AND is_revoked = false AND expires_at > NOW();
```
- If `is_revoked` is `true` or the session row does not exist, the API immediately rejects the request with `401 Unauthorized` (`SESSION_REVOKED`).
- **Logout:** Calling `POST /api/v1/auth/logout` sets `is_revoked = true` on the database session, neutralizing the token before its 15-minute expiration.
- **Password Reset:** Changing a user's password immediately revokes **all** active sessions belonging to that user.

---

## 5. Account Recovery (Self-Service Password Reset)

1. **Request:** `POST /api/v1/auth/password-reset/request`
   - Accepts username or registered email.
   - Generates a cryptographically random, URL-safe 64-character token.
   - Stores SHA-256 hash in `password_resets` table with `expires_at = NOW() + INTERVAL '1 hour'`.
   - Records an `AUTH_PASSWORD_RESET_REQUESTED` audit event.
   - In production, sends a secure reset link via SMS/Email. In test environments, returns `resetToken` for automated test orchestration.

2. **Confirmation:** `POST /api/v1/auth/password-reset/confirm`
   - Accepts `token` and `newPassword`.
   - Validates token expiration and single-use status (`is_used = false`).
   - Updates `users.password_hash` with a newly salted bcrypt hash.
   - Marks reset token as `is_used = true`.
   - Revokes all existing user sessions (`UPDATE user_sessions SET is_revoked = true WHERE user_id = $1`).
   - Records an `AUTH_PASSWORD_RESET_COMPLETED` audit event.

---

## 6. Separation of Platform Super-Administration

`COMKEY AFYA POA` strictly isolates multi-tenant SaaS platform administration from individual hospital administration:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PLATFORM SUPER-ADMINISTRATOR                      │
│ - Global SaaS operator (Comkey Creative Limited / MoH Systems Team)     │
│ - Endpoints: /api/v1/platform/*                                        │
│ - Operations: Onboard new hospital organizations, inspect platform      │
│   telemetry, verify cross-tenant cryptographic audit logs.             │
│ - Cannot chart clinical notes or view patient clinical details.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         STRICT RBAC SEPARATION
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    HOSPITAL FACILITY ADMINISTRATOR                     │
│ - Hospital IT Director / Medical Superintendent                        │
│ - Endpoints: /api/v1/* (tenant-scoped)                                 │
│ - Operations: Manage hospital staff accounts, assign departmental      │
│   roles, configure facility wards and clinics.                         │
│ - Bound strictly to own tenant by PostgreSQL RLS. Cannot access other  │
│   tenants or access /api/v1/platform/* routes.                         │
└────────────────────────────────────────────────────────────────────────┘
```

The separation is enforced by:
1. `@Roles(UserRole.SUPER_ADMIN)` on all platform controller endpoints.
2. `RolesGuard` validating JWT claim `user.role === UserRole.SUPER_ADMIN`.
3. `isSuperAdmin` boolean flag in `TenantContext`, enabling super-admin database operations via `withSuperAdminContext`.
4. Hospital administrators attempting to call `/api/v1/platform/*` receive an immediate `403 Forbidden` and trigger an `AUTHZ_FORBIDDEN_ACCESS` audit event.

---

## 7. Network & Transport Security Controls

| Security Control | Implementation | Purpose |
| :--- | :--- | :--- |
| **HTTP Security Headers** | `helmet` middleware | Injects HSTS (`max-age=31536000`), CSP, X-Frame-Options (`DENY`), and X-Content-Type-Options (`nosniff`). |
| **Strict CORS** | NestJS CORS Configuration | Whitelists only approved healthcare portal domains (`CORS_ORIGIN`). Rejects wildcard origins. |
| **Rate Limiting** | `@nestjs/throttler` | 5 requests/minute on sensitive auth endpoints (`/auth/login`, `/auth/password-reset/*`), 100 requests/minute global. |
| **Cookie Security** | `HttpOnly`, `SameSite=Strict`, `Secure` | Protects session and refresh tokens against Cross-Site Scripting (XSS) and CSRF. |
