# Operational Runbook: SHA Claims Reconciliation & Exception Handling

**Document Reference:** `OPS-SHA-RECON-001`  
**Audience:** Hospital IT Operations, Revenue Cycle Specialists, Lead System Administrators  
**System Module:** `AFYA-POA-RECONCILIATION-ENGINE`

---

## 1. Objectives & Overview

This runbook describes standard operating procedures for detecting, investigating, and resolving ambiguous or timed-out SHA claim transmissions, managing webhook delivery failures, and escalating disputed adjudication decisions under SHIA 2023.

---

## 2. Standard Operating Procedures (SOP)

### SOP-01: Probing Ambiguous / Timed-Out Submissions

#### Trigger:
A claim remains in `SUBMITTED` status for more than 15 minutes without receiving an `ACKNOWLEDGED` or `REJECTED` response from the DHA HIE Gateway.

#### Automated Action:
AFYA POA runs a background cron or manual trigger on `POST /api/v1/claims/reconcile`.

#### Operator Steps:
1. Navigate to **Billing & Claims Ops** -> **Pending Submissions**.
2. Identify claims with status `SUBMITTED` and elapsed time $> 15$ min.
3. Click **Probe SHA Gateway** (`POST /api/v1/claims/reconcile` with payload `{"claimNumber": "CLM-..."}`).
4. Review the reconciliation output:
   - **Case A: Record Exists at SHA:**
     If SHA confirms the submission was received, the local claim status transitions to `ACKNOWLEDGED` or `ACCEPTED`, and `shaTrackingNumber` is stored. No further action needed.
   - **Case B: No Record at SHA (Submission Lost):**
     If the gateway returns `NOT_FOUND` after the 30-minute grace period, the claim status reverts to `QUEUED`. The operator clicks **Retry Dispatch**.
   - **Case C: Gateway Unavailable (HTTP 502/503/504):**
     Wait for the gateway recovery window. Do not manually recreate claims in the database; the idempotency fingerprint prevents duplicate submission once connectivity resumes.

---

### SOP-02: Handling Ingested Webhook Callbacks

#### Trigger:
SHA transmits asynchronous event notifications to `POST /api/v1/claims/callbacks`.

#### Verification:
1. Inspect the `sha_callback_events` log table (`SELECT * FROM sha_callback_events WHERE processed = false`).
2. Verify headers:
   - `X-Tenant-Id`: Verified against tenant database.
   - `X-Trace-Id`: Persisted for cross-organization auditing.
3. If an event fails automated processing:
   - Read `processing_notes` in `sha_callback_events`.
   - Common causes: Claim number mismatch, claim already transitioned to `PAID`, or unknown event type.
   - Replay event using internal admin command after correcting reference data.

---

### SOP-03: Resolving Adjudication Rejections (SOP-03)

#### Process Flow:
```
[SHA Rejection Webhook Received] 
             |
             v
[Inspect Rejection Reason & Codes]
             |
             +---> Code: STATUTORY_DEADLINE_EXCEEDED
             |     Action: File formal Late Submission Appeal to SHA County Committee.
             |
             +---> Code: MISSING_CLINICAL_ATTACHMENT
             |     Action: Clinician attaches operative/histology PDF -> v2 Resubmit.
             |
             +---> Code: TARIFF_MISMATCH
             |     Action: Billing clerk updates item code to match Gazette tariff -> v2 Resubmit.
             |
             +---> Code: PUID_UNVERIFIED
                   Action: Update attending doctor profile with verified KMPDC PUID -> v2 Resubmit.
```

---

### SOP-04: Resolving Dispute & Appeal Escalations

Under Section 36 of the Social Health Insurance Act 2023, healthcare providers have the statutory right to appeal adverse claim determinations within 30 days of notification.

1. Locate the rejected or partially approved claim in AFYA POA.
2. Export the complete **Audit Dossier** (`GET /api/v1/claims/:id`), including:
   - Timestamped outbound payload snapshot (`request_payload_redacted`).
   - SHA-256 payload digest.
   - Attending clinician's digital signature and PUID.
   - Complete clinical notes and lab findings.
3. Lodge the formal electronic appeal referencing the original `claimNumber`, `version`, and `shaTrackingNumber`.
