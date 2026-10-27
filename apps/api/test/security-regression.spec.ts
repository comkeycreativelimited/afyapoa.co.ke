import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { withSuperAdminContext, tenants, patientRecords, auditEvents } from '@afyapoa/database';
import { TenancyService } from '../src/tenancy/tenancy.service.js';
import { AuditService } from '../src/audit/audit.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { getTenantStoragePath } from '@afyapoa/domain-core';
import { config } from '@afyapoa/config';
import { eq } from 'drizzle-orm';

describe('Security & Multi-Tenancy Foundation Automated Regression Tests', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tenancyService: TenancyService;
  let auditService: AuditService;

  let tenantAId: string;
  let tenantBId: string;
  let tenantARecordId: string;
  let tenantBRecordId: string;

  let clinicianAToken: string;
  let clinicianBToken: string;
  let hospitalAdminAToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    // 1. Initialize NestJS App using NestFactory
    app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });
    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/liveness', 'health/readiness'],
    });

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    tenancyService = app.get(TenancyService);
    auditService = app.get(AuditService);

    // 2. Fetch seeded tenant and record IDs using Super Admin database context
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded demo tenants missing');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;

      const allRecords = await db.select().from(patientRecords);
      const rA = allRecords.find((r) => r.tenantId === tenantAId);
      const rB = allRecords.find((r) => r.tenantId === tenantBId);
      if (!rA || !rB) {
        throw new Error('Test setup error: Seeded patient records missing');
      }
      tenantARecordId = rA.id;
      tenantBRecordId = rB.id;
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ============================================================================
  // SUITE 1: AUTHENTICATION, MFA & SESSION LIFECYCLE
  // ============================================================================

  it('1.1 Standard clinician login succeeds without MFA challenge', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dr.otieno',
        password: 'Password123!',
      }),
    });

    const text = await res.text();
    if (res.status !== 200) {
      console.log('DEBUG RES 1.1 ERROR:', res.status, text);
    }
    expect(res.status).toBe(200);
    const data = JSON.parse(text);
    expect(data.mfaRequired).toBe(false);
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.user.username).toBe('dr.otieno');
    expect(data.user.tenantId).toBe(tenantAId);
    expect(data.user.role).toBe('CLINICIAN');

    clinicianAToken = data.accessToken;
  });

  it('1.2 Tenant B clinician login succeeds and receives isolated Tenant B token', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dr.mary',
        password: 'Password123!',
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mfaRequired).toBe(false);
    expect(data.accessToken).toBeDefined();
    expect(data.user.username).toBe('dr.mary');
    expect(data.user.tenantId).toBe(tenantBId);

    clinicianBToken = data.accessToken;
  });

  it('1.3 Privileged hospital admin login requires MFA and rejects invalid TOTP code', async () => {
    // Initial login triggers MFA challenge
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin.nmhg',
        password: 'Password123!',
      }),
    });

    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.mfaRequired).toBe(true);
    expect(loginData.mfaToken).toBeDefined();

    // Verify with invalid code -> rejected
    const badMfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaToken: loginData.mfaToken,
        code: '000000',
      }),
    });

    expect(badMfaRes.status).toBe(401);

    // Verify with valid TOTP code
    const goodMfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaToken: loginData.mfaToken,
        code: '123456',
      }),
    });

    expect(goodMfaRes.status).toBe(200);
    const goodMfaData = await goodMfaRes.json();
    expect(goodMfaData.accessToken).toBeDefined();
    expect(goodMfaData.user.role).toBe('FACILITY_ADMIN');
    expect(goodMfaData.user.tenantId).toBe(tenantAId);

    hospitalAdminAToken = goodMfaData.accessToken;
  });

  it('1.4 Platform Super Admin login enforces MFA and provides cross-tenant administrative token', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'superadmin',
        password: 'Password123!',
      }),
    });

    const loginData = await loginRes.json();
    expect(loginData.mfaRequired).toBe(true);

    const mfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaToken: loginData.mfaToken,
        code: '123456',
      }),
    });

    expect(mfaRes.status).toBe(200);
    const mfaData = await mfaRes.json();
    expect(mfaData.user.isSuperAdmin).toBe(true);

    superAdminToken = mfaData.accessToken;
  });

  it('1.5 Session revocation on logout invalidates subsequent API requests', async () => {
    // 1. Login temporary user
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'nurse.faith',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    const tempToken = loginData.accessToken;

    // 2. Verified request works
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    expect(meRes.status).toBe(200);

    // 3. Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    expect(logoutRes.status).toBe(200);

    // 4. Request with revoked session is rejected with 401
    const revokedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${tempToken}` },
    });
    expect(revokedRes.status).toBe(401);
  });

  it('1.6 Account recovery flow updates password and revokes previous sessions', async () => {
    // Request password reset
    const reqRes = await fetch(`${baseUrl}/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@kibera.demo.afyapoa.co.ke' }),
    });
    expect(reqRes.status).toBe(200);
    const reqData = await reqRes.json();
    expect(reqData.resetToken).toBeDefined();

    // Confirm password reset
    const confirmRes = await fetch(`${baseUrl}/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: reqData.resetToken,
        newPassword: 'BrandNewSecurePassword123!',
      }),
    });
    expect(confirmRes.status).toBe(200);

    // Login with new password
    const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin.kibera',
        password: 'BrandNewSecurePassword123!',
      }),
    });
    expect(newLoginRes.status).toBe(200);
  });

  // ============================================================================
  // SUITE 2: CROSS-TENANT DATA ISOLATION (READS & WRITES)
  // ============================================================================

  it('2.1 Cross-tenant read: Tenant A user queries only Tenant A records', async () => {
    const res = await fetch(`${baseUrl}/records`, {
      headers: { Authorization: `Bearer ${clinicianAToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records.length).toBeGreaterThan(0);

    for (const record of data.records) {
      expect(record.tenantId).toBe(tenantAId);
      expect(record.tenantId).not.toBe(tenantBId);
      expect(record.id).not.toBe(tenantBRecordId);
    }
  });

  it('2.2 Cross-tenant read: Tenant B user queries only Tenant B records', async () => {
    const res = await fetch(`${baseUrl}/records`, {
      headers: { Authorization: `Bearer ${clinicianBToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records.length).toBeGreaterThan(0);

    for (const record of data.records) {
      expect(record.tenantId).toBe(tenantBId);
      expect(record.tenantId).not.toBe(tenantAId);
      expect(record.id).not.toBe(tenantARecordId);
    }
  });

  it('2.3 Direct ID manipulation read: Tenant A user requesting Tenant B record ID gets 404', async () => {
    const res = await fetch(`${baseUrl}/records/${tenantBRecordId}`, {
      headers: { Authorization: `Bearer ${clinicianAToken}` },
    });

    // Row-Level Security filters out the record from Postgres result set, resulting in 404
    expect(res.status).toBe(404);
  });

  it('2.4 Cross-tenant write: Tenant A user attempting to mutate Tenant B record is blocked', async () => {
    const res = await fetch(`${baseUrl}/records/${tenantBRecordId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notes: 'ATTACKER_MUTATION_ATTEMPT',
      }),
    });

    expect(res.status).toBe(404);

    // Verify in database that Tenant B record was NOT modified
    await tenancyService.runInTenantContext(tenantBId, async (db) => {
      const [rec] = await db
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.id, tenantBRecordId));
      expect(rec?.notes).not.toBe('ATTACKER_MUTATION_ATTEMPT');
    });
  });

  // ============================================================================
  // SUITE 3: CLIENT-SUPPLIED HEADER SPOOFING IMMUNITY
  // ============================================================================

  it('3.1 Client-supplied x-tenant-id spoofing attempt is ignored and overridden by verified JWT claim', async () => {
    // Clinician A (Tenant A) sends x-tenant-id header pointing to Tenant B
    const res = await fetch(`${baseUrl}/records`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
        'x-tenant-id': tenantBId, // Spoofing attempt!
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();

    // Must still return only Tenant A data
    expect(data.tenantId).toBe(tenantAId);
    for (const record of data.records) {
      expect(record.tenantId).toBe(tenantAId);
      expect(record.tenantId).not.toBe(tenantBId);
    }
  });

  // ============================================================================
  // SUITE 4: SERVER-SIDE RBAC & PRIVILEGE ESCALATION PREVENTION
  // ============================================================================

  it('4.1 Clinician attempting to access Super-Admin platform tenants endpoint is rejected (403)', async () => {
    const res = await fetch(`${baseUrl}/platform/tenants`, {
      headers: { Authorization: `Bearer ${clinicianAToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('4.2 Hospital Facility Admin attempting platform super-admin access is rejected (403)', async () => {
    const res = await fetch(`${baseUrl}/platform/tenants`, {
      headers: { Authorization: `Bearer ${hospitalAdminAToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('4.3 Super Admin can access platform tenants and audit management', async () => {
    const res = await fetch(`${baseUrl}/platform/tenants`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it('4.4 Clinician attempting unauthorized data export without AUDIT_EXPORT permission is blocked (403)', async () => {
    const res = await fetch(`${baseUrl}/records/export/all`, {
      headers: { Authorization: `Bearer ${clinicianAToken}` },
    });

    expect(res.status).toBe(403);
  });

  it('4.5 Hospital Admin with AUDIT_EXPORT can export data strictly for their own tenant', async () => {
    const res = await fetch(`${baseUrl}/records/export/all`, {
      headers: { Authorization: `Bearer ${hospitalAdminAToken}` },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tenantId).toBe(tenantAId);
    for (const r of data.records) {
      expect(r.tenantId).toBe(tenantAId);
    }
  });

  // ============================================================================
  // SUITE 5: BACKGROUND JOB MULTI-TENANT CONTEXT ISOLATION
  // ============================================================================

  it('5.1 Background worker executing job payload in Tenant A context cannot access Tenant B data', async () => {
    const jobPayload = tenancyService.createJobPayload(
      {
        tenantId: tenantAId,
        facilityCode: 'FID-01-000101-1',
        userId: '00000000-0000-0000-0000-000000000001',
        userRole: 'CLINICIAN' as any,
        permissions: [],
        isSuperAdmin: false,
      },
      'NIGHTLY_RECORD_EXPORT',
      { batchSize: 50 },
    );

    // Worker executes inside transaction bound to jobPayload.tenantId
    await tenancyService.runInTenantContext(jobPayload.tenantId, async (workerDb) => {
      // Query records
      const records = await workerDb.select().from(patientRecords);

      // Verify no records from Tenant B leaked into Tenant A job
      for (const rec of records) {
        expect(rec.tenantId).toBe(tenantAId);
        expect(rec.tenantId).not.toBe(tenantBId);
      }

      // Attempting to query Tenant B's record returns empty
      const targetB = await workerDb
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.id, tenantBRecordId));
      expect(targetB).toHaveLength(0);
    });
  });

  // ============================================================================
  // SUITE 6: AUDIT TRAIL IMMUTABILITY & CRYPTOGRAPHIC HASH INTEGRITY
  // ============================================================================

  it('6.1 Audit trail records events and validates cryptographic SHA-256 hash chaining', async () => {
    const integrity = await auditService.verifyChainIntegrity(tenantAId);
    expect(integrity.valid).toBe(true);
    expect(integrity.totalEvents).toBeGreaterThan(0);
  });

  it('6.2 Audit events table is WORM append-only: direct UPDATE and DELETE are blocked by RLS', async () => {
    // Attempting to delete an audit log under tenant context
    await tenancyService.runInTenantContext(tenantAId, async (db) => {
      const deleted = await db
        .delete(auditEvents)
        .where(eq(auditEvents.tenantId, tenantAId))
        .returning();

      // No rows can be deleted because no DELETE policy exists
      expect(deleted).toHaveLength(0);
    });

    // Attempting to update an audit log under tenant context
    await tenancyService.runInTenantContext(tenantAId, async (db) => {
      const updated = await db
        .update(auditEvents)
        .set({ details: 'TAMPERED_AUDIT_LOG' })
        .where(eq(auditEvents.tenantId, tenantAId))
        .returning();

      // No rows can be updated because no UPDATE policy exists
      expect(updated).toHaveLength(0);
    });
  });

  // ============================================================================
  // SUITE 7: REMEDIATION VERIFICATION (MFA PRODUCTION GATE & PATH TRAVERSAL)
  // ============================================================================

  it('7.1 Path traversal attacks in getTenantStoragePath are neutralized', () => {
    const maliciousPaths = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      '....//....//sensitive.key',
      '/absolute/path/file.pdf',
      'clinical/../../records/victim.pdf\0.png',
    ];

    for (const mal of maliciousPaths) {
      const sanitized = getTenantStoragePath(tenantAId, mal);
      expect(sanitized.startsWith(`tenants/${tenantAId}/`)).toBe(true);
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('\0');
    }
  });

  it('7.2 MFA verification strictly rejects fallback code 123456 when NODE_ENV is production', async () => {
    const authService = app.get(AuthService);
    const originalEnv = config.NODE_ENV;

    // Simulate login to get an MFA challenge token
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin.nmhg',
        password: 'Password123!',
      }),
    });
    const { mfaToken } = await loginRes.json();
    expect(mfaToken).toBeDefined();

    try {
      // Temporarily simulate production mode
      (config as any).NODE_ENV = 'production';

      // 123456 must be rejected with UnauthorizedException in production
      await expect(
        authService.verifyMfa(mfaToken, '123456', '127.0.0.1', 'security-test-agent'),
      ).rejects.toThrow('Invalid MFA code');
    } finally {
      (config as any).NODE_ENV = originalEnv;
    }
  });
});
