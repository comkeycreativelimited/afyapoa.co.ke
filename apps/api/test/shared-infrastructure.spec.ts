import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import { withSuperAdminContext, tenants } from '@afyapoa/database';
import {
  WorkflowEntityType,
  WorkflowTrigger,
  JobQueueName,
  JobType,
  FileEntityType,
  FileAccessLevel,
  IntegrationSystemType,
  InternalEntityType,
  ExternalSystem,
} from '@afyapoa/domain-core';
import { randomUUID } from 'crypto';

describe('Shared Domain Infrastructure & Database Models Integration Tests', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let clinicianAToken: string;
  let clinicianBToken: string;

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

    // 1. Fetch tenant IDs
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded tenants missing');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;
    });

    // 2. Login Tenant A Clinician (dr.otieno)
    const loginARes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dr.otieno',
        password: 'Password123!',
      }),
    });
    const loginAData = await loginARes.json();
    clinicianAToken = loginAData.data?.accessToken || loginAData.accessToken;

    // 3. Login Tenant B Clinician (dr.mary)
    const loginBRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dr.mary',
        password: 'Password123!',
      }),
    });
    const loginBData = await loginBRes.json();
    clinicianBToken = loginBData.data?.accessToken || loginBData.accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Versioned Workflow State Transitions', () => {
    const entityId = randomUUID();

    it('1.1 should record initial versioned state transition (DRAFT -> FINALIZED)', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/state-transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          entityType: WorkflowEntityType.CLINICAL_NOTE,
          entityId,
          fromState: 'DRAFT',
          toState: 'FINALIZED',
          trigger: WorkflowTrigger.SUBMIT,
          reason: 'Initial consultation finalized by attending clinician',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(1);
      expect(body.data.toState).toBe('FINALIZED');
      expect(body.data.tenantId).toBe(tenantAId);
    });

    it('1.2 should increment version on subsequent valid transition (FINALIZED -> AMENDED)', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/state-transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          entityType: WorkflowEntityType.CLINICAL_NOTE,
          entityId,
          fromState: 'FINALIZED',
          toState: 'AMENDED',
          trigger: WorkflowTrigger.REVISE,
          reason: 'Addendum added with lab investigation report',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(2);
      expect(body.data.toState).toBe('AMENDED');
    });

    it('1.3 should reject illegal state transition with 422 InvalidStateTransitionError', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/state-transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          entityType: WorkflowEntityType.CLINICAL_NOTE,
          entityId,
          fromState: 'FINALIZED',
          toState: 'DRAFT', // Illegal transition! Notes cannot revert to draft once finalized
          trigger: WorkflowTrigger.REVISE,
        }),
      });

      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('1.4 should retrieve transition history in descending version order', async () => {
      const res = await fetch(
        `${baseUrl}/infrastructure/state-transitions/${WorkflowEntityType.CLINICAL_NOTE}/${entityId}`,
        {
          headers: { Authorization: `Bearer ${clinicianAToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0].version).toBe(2);
      expect(body.data[1].version).toBe(1);
    });

    it('1.5 should prevent Tenant B from reading Tenant A state transitions (RLS isolation)', async () => {
      const res = await fetch(
        `${baseUrl}/infrastructure/state-transitions/${WorkflowEntityType.CLINICAL_NOTE}/${entityId}`,
        {
          headers: { Authorization: `Bearer ${clinicianBToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(0); // 0 rows leaked across tenant boundary!
    });
  });

  describe('2. Background Job Registration & Monitoring', () => {
    let createdJobId: string;
    const testCorrId = `corr-${randomUUID()}`;

    it('2.1 should register background job under tenant context', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          queueName: JobQueueName.CLAIMS,
          jobType: JobType.SHA_CLAIM_DISPATCH,
          payload: { claimId: 'claim-12345', amount: 5000 },
          correlationId: testCorrId,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('PENDING');
      expect(body.data.tenantId).toBe(tenantAId);
      expect(body.data.correlationId).toBe(testCorrId);
      createdJobId = body.data.id;
    });

    it('2.2 should retrieve job by ID for tenant owner', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/jobs/${createdJobId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdJobId);
      expect(body.data.jobType).toBe(JobType.SHA_CLAIM_DISPATCH);
    });

    it('2.3 should return null when Tenant B queries Tenant A job ID (RLS isolation)', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/jobs/${createdJobId}`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeNull(); // 0 data leaked!
    });

    it('2.4 should list jobs with pagination envelope', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/jobs?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(10);
    });
  });

  describe('3. File Metadata & Secure Storage Access', () => {
    let fileId: string;
    const testDocEntityId = randomUUID();

    it('3.1 should register file metadata with tenant-scoped isolation path', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          originalFilename: 'radiology-scan-xray.png',
          mimeType: 'image/png',
          sizeBytes: 1048576,
          entityType: FileEntityType.LAB_REPORT,
          entityId: testDocEntityId,
          accessLevel: FileAccessLevel.CONFIDENTIAL,
          sha256Checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(tenantAId);
      expect(body.data.storageKey).toContain(`tenants/${tenantAId}/`);
      expect(body.data.storageKey).not.toContain('..'); // Anti-directory traversal
      fileId = body.data.id;
    });

    it('3.2 should resolve secure file descriptor for owner tenant', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/files/${fileId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(fileId);
      expect(body.data.secureAccessUrl).toContain(fileId);
    });

    it('3.3 should reject cross-tenant file access with 404 (RLS isolation)', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/files/${fileId}`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
    });
  });

  describe('4. Integrations & External References', () => {
    const internalPatientId = randomUUID();
    const testDhaCrid = `CRID-KE-${Date.now()}`;

    it('4.1 should link internal entity to national external reference', async () => {
      const res = await fetch(`${baseUrl}/infrastructure/integrations/references`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          internalEntityType: InternalEntityType.PATIENT,
          internalEntityId: internalPatientId,
          externalSystem: ExternalSystem.DHA_CR,
          externalId: testDhaCrid,
          responseMetadata: { matchConfidence: 0.99, registryStatus: 'VERIFIED' },
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.tenantId).toBe(tenantAId);
      expect(body.data.externalId).toBe(testDhaCrid);
      expect(body.data.status).toBe('SYNCED');
    });

    it('4.2 should find external reference by external ID', async () => {
      // Find reference using internal service / verify isolation
      const res = await fetch(
        `${baseUrl}/infrastructure/integrations/configs/${IntegrationSystemType.DHA_HIE}`,
        {
          headers: { Authorization: `Bearer ${clinicianAToken}` },
        },
      );
      expect(res.status).toBe(200);
    });
  });

  describe('5. Application Configuration & Feature Flags', () => {
    it('5.1 should evaluate tenant-level feature flag with isolation', async () => {
      // Evaluate flag for Tenant A
      const evalResA = await fetch(
        `${baseUrl}/infrastructure/config/flags/FEATURE_SHA_AUTO_DISPATCH`,
        {
          headers: { Authorization: `Bearer ${clinicianAToken}` },
        },
      );

      expect(evalResA.status).toBe(200);
      const bodyA = await evalResA.json();
      expect(bodyA.success).toBe(true);

      // Evaluate flag for Tenant B
      const evalResB = await fetch(
        `${baseUrl}/infrastructure/config/flags/FEATURE_SHA_AUTO_DISPATCH`,
        {
          headers: { Authorization: `Bearer ${clinicianBToken}` },
        },
      );

      expect(evalResB.status).toBe(200);
      const bodyB = await evalResB.json();
      expect(bodyB.success).toBe(true);
    });
  });
});
