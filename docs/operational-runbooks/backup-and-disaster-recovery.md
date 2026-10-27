# COMKEY AFYA POA — Operational Runbook: Backup, Restoration & Disaster Recovery

**Document Identifier:** `RUNBOOK-BCP-DR-2026-V1`  
**System:** COMKEY AFYA POA (Multi-Tenant SaaS HMIS)  
**Classification:** Confidential — Internal Operations & Compliance Evidence  
**Author:** Principal Platform Engineer & Security Officer  
**Last Verified:** October 27, 2026  
**Test Evidence:** [`apps/api/test/backup-restoration.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/backup-restoration.spec.ts)  

---

## 1. Overview & Recovery Objectives

This runbook outlines the operational procedures for executing automated and manual backups, verifying backup cryptographic integrity, and performing point-in-time and catastrophic disaster recovery across tenant databases.

### Recovery Objectives
- **Recovery Point Objective (RPO):** $\le 15 \text{ minutes}$ (continuous WAL archiving; 0 data loss for finalized billing/claims transactions).
- **Recovery Time Objective (RTO):** $\le 30 \text{ minutes}$ for tenant logical restore; $\le 2 \text{ hours}$ for full cluster cold restart.
- **Cryptographic Standard:** AES-256-GCM envelope encryption with 12-byte initialization vector and 16-byte authentication tag. SHA-256 manifest hash calculation for tamper detection.

---

## 2. Backup Architecture & Storage Tiers

```
+-------------------------------------------------------------------------------+
|                       PostgreSQL 16 Multi-Tenant Cluster                      |
|   (Public Schema, Row-Level Security, Encrypted Columns, WORM Audit Logs)    |
+---------------------------------------+---------------------------------------+
                                        |
                 +----------------------+----------------------+
                 | (Continuous WAL Archiving)                  | (Daily Scheduled Logical Dump)
                 v                                             v
+--------------------------------+            +--------------------------------+
|      WAL Archive Storage       |            |   Tenant Logical Snapshot      |
|  - Continuous write log stream |            |  - Patients, Encounters, CPOE  |
|  - Retention: 30 days          |            |  - Billing, Claims, Audits     |
+--------------------------------+            +--------------------------------+
                 |                                             |
                 +----------------------+----------------------+
                                        | (AES-256-GCM Envelope Encryption)
                                        v
+-------------------------------------------------------------------------------+
|                    Air-Gapped Sovereign Backup Storage                        |
|  - Kenya-jurisdiction primary S3-compatible vault                             |
|  - Secondary geographically separated replication (Nairobi + Mombasa)         |
|  - WORM compliance lock (Object Lock) to prevent ransomware / tampering       |
+-------------------------------------------------------------------------------+
```

---

## 3. Standard Operating Procedures

### 3.1 Generating a Tenant Logical Backup Snapshot
Automated via SaaS administration subsystem or manual CLI execution:

```bash
# 1. Trigger logical export through API endpoint (requires SUPER_ADMIN role & MFA)
curl -X POST "https://api.afyapoa.co.ke/api/v1/saas/tenants/{tenantId}/backup" \
  -H "Authorization: Bearer ${SUPER_ADMIN_JWT}" \
  -H "X-MFA-Token: ${VERIFIED_TOTP}" \
  -o backup-{tenantId}-$(date +%Y%m%d).enc

# 2. Manual CLI backup generation using pg_dump with tenant scoping
pg_dump -h localhost -U afyapoa_admin -d afyapoa_prod \
  --schema=public \
  --table=patients --table=encounters --table=clinical_orders \
  --table=invoices --table=sha_claims --table=audit_events \
  --data-only \
  -f /var/backups/afyapoa/raw_tenant_export.sql

# 3. Encrypt payload with AES-256-GCM using tenant backup key
node -e "
const crypto = require('crypto');
const fs = require('fs');
const data = fs.readFileSync('/var/backups/afyapoa/raw_tenant_export.sql');
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.BACKUP_KEY, 'hex'), iv);
const enc = Buffer.concat([cipher.update(data), cipher.final()]);
const tag = cipher.getAuthTag();
const hash = crypto.createHash('sha256').update(enc).digest('hex');
fs.writeFileSync('/var/backups/afyapoa/archive.enc', enc);
fs.writeFileSync('/var/backups/afyapoa/archive.meta.json', JSON.stringify({ iv: iv.toString('hex'), tag: tag.toString('hex'), sha256: hash, date: new Date().toISOString() }));
"
```

### 3.2 Backup Integrity Verification (Pre-Restore Gate)
Before applying any backup archive:
1. **Manifest Hash Check:** Calculate `sha256(archive.enc)` and compare against `archive.meta.json`. If mismatched, abort immediately (tamper alert).
2. **Authentication Tag Verification:** AES-256-GCM decipher must verify authentication tag. Any flipped bit in payload triggers decipher rejection.

```bash
# Verify integrity via automated test suite or CLI
pnpm --filter @afyapoa/api test test/backup-restoration.spec.ts
```

### 3.3 Catastrophic Disaster Restoration Procedure
When data loss or host failure occurs:
1. **Provision Target Host:** Initialize clean PostgreSQL 16 instance.
2. **Execute Database Migrations:** Run `pnpm --filter @afyapoa/database migrate` to establish public tables and Row-Level Security policies.
3. **Verify Table RLS Security:** Run SQL query checking `pg_class.relrowsecurity = true` on all tables.
4. **Decrypt & Ingest Backup Data:** Stream decrypted JSON rows into tenant partition using `withTenantContext`.
5. **Verify Row Count Parity:** Compare restored row counts against snapshot manifest.
6. **Verify WORM Audit Hash Chain:** Recompute SHA-256 audit block hashes to confirm unbroken continuity.

---

## 4. Test Evidence & Automated Verification

Automated disaster recovery restoration is tested in [`apps/api/test/backup-restoration.spec.ts`](file:///c:/wamp64/www/afya-poa/apps/api/test/backup-restoration.spec.ts):
- **Step 1:** Logical export across 6 core datasets (patients, encounters, orders, invoices, claims, audits).
- **Step 2:** Tamper detection: 1-bit corrupted archive rejected by AES-GCM auth tag check.
- **Step 3:** Record purge simulation: verified recovery from selective eviction.
- **Step 4:** 100% record parity restored.
- **Step 5:** PostgreSQL RLS verified active (`relrowsecurity = true`) on all 6 restored tables.
- **Step 6:** Unbroken SHA-256 WORM audit trail confirmed post-restoration.
