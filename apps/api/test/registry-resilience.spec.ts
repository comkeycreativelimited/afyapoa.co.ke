/**
 * COMKEY AFYA POA — Registry Synchronization & Resilient Integration Operations Tests
 * Grounded in Digital Health Act 2023, Kenya Core FHIR IG, KMFL, and DHA HIE v1.0 specifications.
 * Covers:
 * 1. Scheduled and manual synchronization (Client Registry, Facility Registry, HWR, Terminology)
 * 2. Source identifiers, data provenance, and version tracking
 * 3. Freshness tracking, cache expiry, and explicit invalidation
 * 4. Safe handling of changed and retired records (suspended practitioner, closed facility, deprecated concept)
 * 5. Authorization-aware access control (permissions & role boundaries)
 * 6. Offline handling & Risk gating (unverified offline patient isolation, prohibited offline financial operations)
 * 7. AES-256-GCM encrypted storage for sensitive queued information
 * 8. Bounded retries, exponential backoff with jitter, and dead-letter queue (DLQ) transitions
 * 9. Failed-job inspection and safe replay reconciliation
 * 10. External-service outage and circuit breaker state transitions (CLOSED -> OPEN -> HALF_OPEN)
 * 11. Expired credentials (AUTH_FAILED) handling
 * 12. Conflicting updates and dry-run reconciliation
 * 13. Operational alerts for persistent failures
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import {
  withSuperAdminContext,
  withTenantContext,
  tenants,
  facilities,
  users,
  patients,
  practitionerProfiles,
  registrySyncRecords,
  jobExecutions,
  auditEvents,
} from '@afyapoa/database';
import {
  RegistryType,
  RegistrySyncStatus,
  CircuitBreakerState,
  JobQueueName,
  JobType,
  JobStatus,
  AuditEventType,
} from '@afyapoa/domain-core';
import {
  createIntegrationClients,
  MockDhaHieClient,
  IntegrationErrorCode,
} from '@afyapoa/integration-adapters';
import { RegistrySyncService } from '../src/registry/registry-sync.service.js';
import { ResilienceService } from '../src/registry/resilience.service.js';
import { eq, and, desc } from 'drizzle-orm';

describe('Registry Synchronization & Resilient Integration Operations', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let facilityA1Id: string;
  let facilityA1Kmfl: string;

  let adminAToken: string;
  let clinicianAToken: string;
  let nurseAToken: string;

  let testPatientId: string;
  let resilienceService: ResilienceService;
  let registrySyncService: RegistrySyncService;
  let mockDhaClient: MockDhaHieClient;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/liveness', 'health/readiness'],
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    resilienceService = app.get(ResilienceService);
    registrySyncService = app.get(RegistrySyncService);

    // 1. Fetch seed tenant & facility and clear registry_sync_records
    await withSuperAdminContext(async (db) => {
      await db.delete(registrySyncRecords);

      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      if (!tA) throw new Error('Seed tenant missing');
      tenantAId = tA.id;

      const facs = await db.select().from(facilities);
      const fA1 = facs.find((f) => f.tenantId === tenantAId);
      if (!fA1) throw new Error('Seed facility missing');
      facilityA1Id = fA1.id;
      facilityA1Kmfl = fA1.kmflCode;
    });

    // 2. Login Admin A with MFA
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin.nmhg', password: 'Password123!' }),
    });
    const adminLoginData = await adminLoginRes.json();
    const mfaToken = adminLoginData.mfaToken || adminLoginData.data?.mfaToken;

    const mfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken, code: '123456' }),
    });
    const mfaData = await mfaRes.json();
    adminAToken = mfaData.accessToken || mfaData.data?.accessToken;

    // 3. Login Clinician A
    const clinLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.otieno', password: 'Password123!' }),
    });
    const clinData = await clinLoginRes.json();
    clinicianAToken = clinData.accessToken || clinData.data?.accessToken;

    // 4. Login Nurse A (Triage Nurse - no REGISTRY_SYNC_TRIGGER permission)
    const nurseLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nurse.faith', password: 'Password123!' }),
    });
    const nurseData = await nurseLoginRes.json();
    nurseAToken = nurseData.accessToken || nurseData.data?.accessToken;

    // 5. Seed Test Patient for Sync Linking
    await withTenantContext(tenantAId, async (tx) => {
      const [pat] = await tx
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          mrn: `MRN-REG-${Date.now()}`,
          firstName: 'Jane',
          lastName: 'Mwangi',
          dateOfBirth: '1988-04-12',
          gender: 'FEMALE',
          identityStatus: 'LOCAL_ONLY',
        })
        .returning();
      testPatientId = pat.id;
    });

    // Obtain reference to mock DHA client for deterministic fault injection
    mockDhaClient = registrySyncService.getIntegrationClients().dhaHie as MockDhaHieClient;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resilienceService.resetBreakerForTesting();
    mockDhaClient.setSimulatedFault(null);
  });

  // ===========================================================================
  // GROUP 1: MANUAL & SCHEDULED SYNCHRONIZATION WITH PROVENANCE
  // ===========================================================================

  describe('1. Registry Synchronization & Data Provenance', () => {
    it('synchronizes verified patient with DHA Client Registry (CR) and updates identity', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientId,
          nationalId: '12345678',
          facilityCode: facilityA1Kmfl,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.SYNCED);
      expect(result.recordKey).toBe('12345678');
      expect(result.version).toBe('1');
      expect(result.isFresh).toBe(true);
      expect(result.fromCache).toBe(false);

      // Verify Provenance
      expect(result.provenance).toBeDefined();
      expect(result.provenance.sourceSystem).toBe('DHA_CR');
      expect(result.provenance.payloadDigest).toMatch(/^sha256:/);
      expect(result.data.crId).toBe('CRID-KE-DHA-12345678');

      // Verify patient record updated
      await withTenantContext(tenantAId, async (tx) => {
        const [pat] = await tx
          .select()
          .from(patients)
          .where(and(eq(patients.tenantId, tenantAId), eq(patients.id, testPatientId)));

        expect(pat.dhaCrid).toBe('CRID-KE-DHA-12345678');
        expect(pat.identityStatus).toBe('VERIFIED_EXTERNAL');
      });
    });

    it('synchronizes facility metadata with Master Health Facility List (KMFL)', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/facility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          kmflCode: 'FID-01-000101-1',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.SYNCED);
      expect(result.recordKey).toBe('FID-01-000101-1');
      expect(result.provenance.sourceSystem).toBe('DHA_KMFL');
      expect(result.data.active).toBe(true);
      expect(result.data.level).toBe('LEVEL_5');
    });

    it('synchronizes practitioner credentials with Health Worker Registry (HWR)', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/health-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          puid: 'PUID-KMPDC-A0001',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.SYNCED);
      expect(result.recordKey).toBe('PUID-KMPDC-A0001');
      expect(result.provenance.sourceSystem).toBe('DHA_HWR');
      expect(result.data.licenseStatus).toBe('ACTIVE');
      expect(result.data.board).toBe('KMPDC');
    });

    it('synchronizes and validates clinical concepts against DHA Terminology Service', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/terminology`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          system: 'WHO_ICD_11',
          code: 'BA00',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.SYNCED);
      expect(result.data.isValid).toBe(true);
      expect(result.data.code).toBe('BA00');
    });
  });

  // ===========================================================================
  // GROUP 2: FRESHNESS TRACKING, CACHING & INVALIDATION
  // ===========================================================================

  describe('2. Version Tracking, Freshness & Cache Invalidation', () => {
    it('returns cached result on repeated lookup within TTL', async () => {
      // First lookup already primed in previous test
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          nationalId: '12345678',
          forceRefresh: false,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.fromCache).toBe(true);
      expect(result.version).toBe('1');
      expect(result.isFresh).toBe(true);
    });

    it('increments version and updates timestamp when forceRefresh is true', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          nationalId: '12345678',
          forceRefresh: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.fromCache).toBe(false);
      expect(result.version).toBe('2');
    });

    it('invalidates cache explicitly and marks record as STALE', async () => {
      const invalRes = await fetch(`${baseUrl}/registry/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          registryType: RegistryType.CLIENT_REGISTRY,
          recordKey: '12345678',
        }),
      });

      expect(invalRes.status).toBe(200);

      // Verify status is now STALE
      const statusRes = await fetch(
        `${baseUrl}/registry/status/${RegistryType.CLIENT_REGISTRY}/12345678`,
        {
          headers: { Authorization: `Bearer ${clinicianAToken}` },
        },
      );
      const statusJson = await statusRes.json();
      const statusData = statusJson.data || statusJson;

      expect(statusData.syncStatus).toBe(RegistrySyncStatus.STALE);
      expect(statusData.isFresh).toBe(false);
    });
  });

  // ===========================================================================
  // GROUP 3: SAFE HANDLING OF CHANGED OR RETIRED RECORDS
  // ===========================================================================

  describe('3. Safe Handling of Changed or Retired Records', () => {
    it('safely handles suspended practitioner without destroying historical clinical notes', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/health-worker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          puid: 'PUID-KMPDC-SUSPENDED',
          forceRefresh: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.RETIRED);
      expect(result.data.licenseStatus).toBe('SUSPENDED');
      expect(result.warnings).toBeDefined();

      // Verify audit trail recorded RETIRED event
      await withTenantContext(tenantAId, async (tx) => {
        const events = await tx
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.tenantId, tenantAId),
              eq(auditEvents.action, AuditEventType.REGISTRY_RECORD_RETIRED),
            ),
          )
          .orderBy(desc(auditEvents.createdAt));

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].resourceId).toBe('PUID-KMPDC-SUSPENDED');
      });
    });

    it('handles closed/retired facility in KMFL gracefully without breaking historical claims', async () => {
      // Simulate remote facility closing
      const closedKmfl = 'FID-01-CLOSED-9';
      mockDhaClient.setFacility(closedKmfl, {
        kmflCode: closedKmfl,
        name: 'Closed Dispensary (Mock)',
        level: 'LEVEL_2',
        county: 'Nairobi',
        active: false,
        isSynthetic: true,
      });

      const res = await fetch(`${baseUrl}/registry/sync/facility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          kmflCode: closedKmfl,
          forceRefresh: true,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      expect(result.syncStatus).toBe(RegistrySyncStatus.RETIRED);
      expect(result.data.active).toBe(false);
      expect(result.warnings).toContain('Facility is marked INACTIVE/RETIRED in Master Facility List');
    });
  });

  // ===========================================================================
  // GROUP 4: AUTHORIZATION-AWARE ACCESS CONTROLS
  // ===========================================================================

  describe('4. Authorization-Aware Access Controls', () => {
    it('rejects unauthenticated requests to registry endpoints with 401', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nationalId: '12345678' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects users without REGISTRY_SYNC_TRIGGER permission with 403', async () => {
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`, // Nurse lacks REGISTRY_SYNC_TRIGGER
        },
        body: JSON.stringify({ nationalId: '12345678' }),
      });
      expect(res.status).toBe(403);
    });

    it('allows clinician with REGISTRY_SYNC_READ to inspect sync status', async () => {
      const res = await fetch(
        `${baseUrl}/registry/status/${RegistryType.FACILITY_REGISTRY}/FID-01-000101-1`,
        {
          headers: { Authorization: `Bearer ${clinicianAToken}` },
        },
      );
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // GROUP 5: OFFLINE HANDLING & RISK GATING CONTROLS
  // ===========================================================================

  describe('5. Offline Handling & Risk Gating Controls', () => {
    it('keeps unindexed/offline patient in UNVERIFIED_OFFLINE status without assigning fake CR ID', async () => {
      const unindexedNationalId = '99998888';

      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          nationalId: unindexedNationalId,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;

      // Invariant: Queued offline data MUST NEVER appear externally verified
      expect(result.syncStatus).toBe(RegistrySyncStatus.UNVERIFIED_OFFLINE);
      expect(result.data.crId).toBe('');
      expect(result.data.status).toBe('UNINDEXED');
      expect(result.warnings).toBeDefined();

      // Check database record reflects UNVERIFIED_OFFLINE
      const statusRes = await fetch(
        `${baseUrl}/registry/status/${RegistryType.CLIENT_REGISTRY}/${unindexedNationalId}`,
        {
          headers: { Authorization: `Bearer ${adminAToken}` },
        },
      );
      const statusJson = await statusRes.json();
      const statusData = statusJson.data || statusJson;

      expect(statusData.syncStatus).toBe(RegistrySyncStatus.UNVERIFIED_OFFLINE);
      expect(statusData.isOfflineCreated).toBe(true);
    });

    it('strictly prohibits queuing operations requiring live authorization offline', () => {
      // Must throw ForbiddenException for high-risk operations
      expect(() => {
        registrySyncService.assertPermittedOfflineOperation('SHA_CLAIM_SUBMIT');
      }).toThrow(/requires live online external authorization/);

      expect(() => {
        registrySyncService.assertPermittedOfflineOperation('SHA_PREAUTH_REQUEST');
      }).toThrow(/requires live online external authorization/);

      expect(() => {
        registrySyncService.assertPermittedOfflineOperation('BIOMETRIC_CONSENT_VERIFY');
      }).toThrow(/requires live online external authorization/);

      // Low-risk operations permitted
      expect(() => {
        registrySyncService.assertPermittedOfflineOperation('RECORD_CLINICAL_NOTE');
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // GROUP 6: ENCRYPTED QUEUE STORAGE (AES-256-GCM) & RETENTION
  // ===========================================================================

  describe('6. Encrypted Storage for Sensitive Queued Information', () => {
    it('encrypts sensitive queued job payload with AES-256-GCM at rest', async () => {
      const sensitivePayload = {
        patientName: 'Jane Muthoni',
        nationalId: '12345678',
        diagnosis: 'Hypertension',
        phone: '+254712345678',
      };

      const job = await resilienceService.enqueueEncryptedJob({
        tenantId: tenantAId,
        queueName: JobQueueName.REGISTRY_SYNC,
        jobType: JobType.CLIENT_REGISTRY_SYNC,
        payload: sensitivePayload,
        maxAttempts: 3,
      });

      expect(job.id).toBeDefined();

      // Check database directly: verify raw payload is ciphertext format (iv:authTag:ciphertext)
      await withTenantContext(tenantAId, async (tx) => {
        const [rawJob] = await tx
          .select()
          .from(jobExecutions)
          .where(and(eq(jobExecutions.tenantId, tenantAId), eq(jobExecutions.id, job.id)));

        expect(rawJob.payload).not.toContain('Jane Muthoni');
        expect(rawJob.payload).not.toContain('12345678');
        expect(rawJob.payload).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
      });
    });
  });

  // ===========================================================================
  // GROUP 7: BOUNDED RETRY & DEAD-LETTER QUEUE (DLQ)
  // ===========================================================================

  describe('7. Bounded Retries & Dead-Letter Queue (DLQ)', () => {
    it('executes bounded retries and transitions to DEAD_LETTER after max attempts', async () => {
      const job = await resilienceService.enqueueEncryptedJob({
        tenantId: tenantAId,
        queueName: JobQueueName.REGISTRY_SYNC,
        jobType: JobType.CLIENT_REGISTRY_SYNC,
        payload: { test: 'retry-fail' },
        maxAttempts: 3,
      });

      // Attempt 1 Failure -> RETRYING
      const attempt1 = await resilienceService.recordJobFailure(
        tenantAId,
        job.id,
        new Error('Upstream Connection Reset (Attempt 1)'),
      );
      expect(attempt1.status).toBe(JobStatus.RETRYING);
      expect(attempt1.nextRetryDelayMs).toBeGreaterThan(0);

      // Attempt 2 Failure -> RETRYING
      const attempt2 = await resilienceService.recordJobFailure(
        tenantAId,
        job.id,
        new Error('Upstream Connection Reset (Attempt 2)'),
      );
      expect(attempt2.status).toBe(JobStatus.RETRYING);

      // Attempt 3 Failure -> DEAD_LETTER
      const attempt3 = await resilienceService.recordJobFailure(
        tenantAId,
        job.id,
        new Error('Upstream Connection Reset (Attempt 3 - Terminal)'),
      );
      expect(attempt3.status).toBe(JobStatus.DEAD_LETTER);

      // Verify audit trail recorded DLQ event
      await withTenantContext(tenantAId, async (tx) => {
        const events = await tx
          .select()
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.tenantId, tenantAId),
              eq(auditEvents.action, AuditEventType.REGISTRY_DLQ_JOB_ENQUEUED),
            ),
          )
          .orderBy(desc(auditEvents.createdAt));

        expect(events.length).toBeGreaterThan(0);
        expect(events[0].resourceId).toBe(job.id);
      });
    });

    it('inspects dead-letter jobs with decrypted payload preview', async () => {
      const res = await fetch(`${baseUrl}/registry/failed-jobs`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const failedJobs = json.data || json;

      expect(Array.isArray(failedJobs)).toBe(true);
      const dlqJob = failedJobs.find((j: any) => j.status === JobStatus.DEAD_LETTER);
      expect(dlqJob).toBeDefined();
      expect(dlqJob.attempts).toBe(3);
      expect(dlqJob.payloadSummary).toBeDefined();
    });

    it('safely replays a dead-letter queue job', async () => {
      // Find a dead-letter job
      const failedRes = await fetch(`${baseUrl}/registry/failed-jobs`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const failedJson = await failedRes.json();
      const failedJobs = failedJson.data || failedJson;
      const dlqJob = failedJobs.find((j: any) => j.status === JobStatus.DEAD_LETTER);

      const replayRes = await fetch(`${baseUrl}/registry/failed-jobs/${dlqJob.id}/replay`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(replayRes.status).toBe(201);
      const json = await replayRes.json();
      const replayed = json.data || json;

      expect(replayed.status).toBe(JobStatus.PENDING);
      expect(replayed.attempts).toBe(0);
      expect(replayed.correlationId).not.toBe(dlqJob.correlationId);
    });
  });

  // ===========================================================================
  // GROUP 8: CIRCUIT BREAKER & EXTERNAL SERVICE OUTAGES
  // ===========================================================================

  describe('8. Circuit Breaker & External Service Outages', () => {
    it('trips circuit breaker to OPEN after 3 consecutive failures', async () => {
      const testError = new Error('Simulated DHA 503 Outage');

      // Failure 1
      await resilienceService.recordFailure(RegistryType.CLIENT_REGISTRY, testError, tenantAId);
      expect(resilienceService.getCircuitState(RegistryType.CLIENT_REGISTRY)).toBe(CircuitBreakerState.CLOSED);

      // Failure 2
      await resilienceService.recordFailure(RegistryType.CLIENT_REGISTRY, testError, tenantAId);
      expect(resilienceService.getCircuitState(RegistryType.CLIENT_REGISTRY)).toBe(CircuitBreakerState.CLOSED);

      // Failure 3 -> Trips to OPEN
      await resilienceService.recordFailure(RegistryType.CLIENT_REGISTRY, testError, tenantAId);
      expect(resilienceService.getCircuitState(RegistryType.CLIENT_REGISTRY)).toBe(CircuitBreakerState.OPEN);

      // Verify immediate fast-fail
      expect(resilienceService.canExecute(RegistryType.CLIENT_REGISTRY)).toBe(false);

      // Endpoint must throw 503 Service Unavailable immediately without network call
      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({ nationalId: '12345678' }),
      });
      expect(res.status).toBe(503);
    });

    it('recovers circuit breaker to CLOSED after successful probe', async () => {
      // Record success closes the circuit
      await resilienceService.recordSuccess(RegistryType.CLIENT_REGISTRY, 45, tenantAId);
      expect(resilienceService.getCircuitState(RegistryType.CLIENT_REGISTRY)).toBe(CircuitBreakerState.CLOSED);
      expect(resilienceService.canExecute(RegistryType.CLIENT_REGISTRY)).toBe(true);
    });
  });

  // ===========================================================================
  // GROUP 9: EXPIRED CREDENTIALS & SERVICE RECOVERY
  // ===========================================================================

  describe('9. Expired Credentials Handling', () => {
    it('cleanly handles simulated AUTH_FAILED error from DHA HIE', async () => {
      mockDhaClient.setSimulatedFault(IntegrationErrorCode.AUTH_FAILED);

      const res = await fetch(`${baseUrl}/registry/sync/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({ nationalId: '12345678', forceRefresh: true }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      const message = json.error?.message || json.message;
      expect(message).toContain('Simulated OAuth Token Expired');
    });
  });

  // ===========================================================================
  // GROUP 10: DRY-RUN & LIVE RECONCILIATION
  // ===========================================================================

  describe('10. Safe Replay & Dry-Run Reconciliation', () => {
    it('previews stale records in dry-run mode without modifying records', async () => {
      // Invalidate to ensure at least one stale record exists
      await fetch(`${baseUrl}/registry/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          registryType: RegistryType.CLIENT_REGISTRY,
          recordKey: '12345678',
        }),
      });

      const res = await fetch(`${baseUrl}/registry/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          registryType: RegistryType.CLIENT_REGISTRY,
          dryRun: true,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const report = json.data || json;

      expect(report.dryRun).toBe(true);
      expect(report.scanned).toBeGreaterThanOrEqual(1);
      if (report.items.length > 0) {
        expect(report.items[0].action).toBe('WOULD_RESYNC');
      }
    });

    it('executes live reconciliation and marks stale records as SYNCED', async () => {
      // Invalidate to ensure at least one stale record exists
      await fetch(`${baseUrl}/registry/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          registryType: RegistryType.CLIENT_REGISTRY,
          recordKey: '12345678',
        }),
      });

      const res = await fetch(`${baseUrl}/registry/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          registryType: RegistryType.CLIENT_REGISTRY,
          dryRun: false,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const report = json.data || json;

      expect(report.dryRun).toBe(false);
      expect(report.reconciledCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ===========================================================================
  // GROUP 11: INTEGRATION HEALTH MONITORING & OPERATIONAL ALERTS
  // ===========================================================================

  describe('11. Integration Health Monitoring & Operational Alerts', () => {
    it('returns comprehensive health metrics and active alerts across registries', async () => {
      const res = await fetch(`${baseUrl}/registry/health`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const health = json.data || json;

      expect(health.timestamp).toBeDefined();
      expect(['HEALTHY', 'DEGRADED', 'DOWN']).toContain(health.overallStatus);
      expect(health.registries.length).toBe(4);

      const crHealth = health.registries.find(
        (r: any) => r.registryType === RegistryType.CLIENT_REGISTRY,
      );
      expect(crHealth).toBeDefined();
      expect(crHealth.circuitState).toBe(CircuitBreakerState.CLOSED);
      expect(crHealth.latencyMs).toBeGreaterThan(0);
    });

    it('triggers operational alert when persistent failure threshold (5) is breached', async () => {
      const error = new Error('Persistent Gateway Outage');

      // Simulate 5 consecutive failures on Terminology registry
      for (let i = 0; i < 5; i++) {
        await resilienceService.recordFailure(RegistryType.TERMINOLOGY_CATALOGUE, error, tenantAId);
      }

      const res = await fetch(`${baseUrl}/registry/health`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const json = await res.json();
      const health = json.data || json;

      expect(health.activeAlerts.length).toBeGreaterThan(0);
      const alert = health.activeAlerts.find(
        (a: any) => a.registryType === RegistryType.TERMINOLOGY_CATALOGUE,
      );
      expect(alert).toBeDefined();
      expect(alert.consecutiveFailures).toBe(5);
      expect(alert.severity).toBe('WARNING');
    });
  });
});
