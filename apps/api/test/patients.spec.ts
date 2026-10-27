import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import { withSuperAdminContext, tenants, patients, patientIdentifiers } from '@afyapoa/database';
import {
  PatientGender,
  PatientStatus,
  PatientIdentityStatus,
  PatientIdentifierType,
  ConsentType,
  ConsentChannel,
} from '@afyapoa/domain-core';
import { eq } from 'drizzle-orm';

describe('Patient Registration & Identity Management Integration Tests (Milestone 4)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let clinicianAToken: string;
  let clinicianBToken: string;
  let adminAToken: string;

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

    // Fetch tenant IDs from database seed
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded tenants missing');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;

      // Clean test patients for Tenant A to ensure clean idempotency
      await db.delete(patients).where(eq(patients.tenantId, tenantAId));
    });

    // Login Clinician A (dr.otieno)
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

    // Login Hospital Admin A (admin.nmhg) with MFA to obtain PATIENT_RECONCILE permission
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin.nmhg',
        password: 'Password123!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    const mfaToken = adminLoginData.mfaToken || adminLoginData.data?.mfaToken;

    const mfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mfaToken,
        code: '123456',
      }),
    });
    const mfaData = await mfaRes.json();
    adminAToken = mfaData.accessToken || mfaData.data?.accessToken;

    // Login Clinician B (Kibera Net)
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

  // =========================================================================
  // 1. REGISTRATION & DEMOGRAPHICS
  // =========================================================================

  let registeredPatientId: string;
  let registeredPatientMrn: string;
  const testNationalId = '34567890';
  const testPhone = '+254712345678';

  it('1.1 should register a new patient with valid Kenyan demographics, phone, and statutory consent', async () => {
    const res = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Amina',
        middleName: 'Fatuma',
        lastName: 'Bakari',
        dateOfBirth: '1995-07-24',
        gender: PatientGender.FEMALE,
        bloodGroup: 'B+',
        phone: testPhone,
        email: 'amina.bakari@example.ke',
        physicalAddress: 'Apartment 4B, Nyali Links Road',
        county: 'Mombasa',
        subCounty: 'Nyali',
        ward: 'Kongowea',
        nationality: 'KENYAN',
        maritalStatus: 'MARRIED',
        emergencyContact: {
          name: 'Hassan Bakari',
          relationship: 'SPOUSE',
          phone: '+254722998877',
        },
        identifiers: [
          {
            system: PatientIdentifierType.KENYA_NATIONAL_ID,
            value: testNationalId,
            issuingAuthority: 'NATIONAL_REGISTRATION_BUREAU',
            isPrimary: true,
          },
        ],
        consents: [
          {
            consentType: ConsentType.GENERAL_DATA_PROCESSING,
            policyVersion: 'KE-DPA-2019-V1',
            channel: ConsentChannel.WRITTEN_FORM,
          },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const data = body.data;

    expect(data.id).toBeDefined();
    registeredPatientId = data.id;
    registeredPatientMrn = data.mrn;

    expect(data.firstName).toBe('Amina');
    expect(data.lastName).toBe('Bakari');
    expect(data.gender).toBe(PatientGender.FEMALE);
    expect(data.identityStatus).toBe(PatientIdentityStatus.LOCAL_ONLY);
    expect(data.isExternallyVerified).toBe(false);
    expect(data.mrn).toMatch(/^MRN-\d{6}-\d{4}/);
    expect(data.phoneMasked).toContain('+2547****5678');
  });

  it('1.2 should verify PII field encryption in the database (no plaintext phone or National ID)', async () => {
    await withSuperAdminContext(async (db) => {
      const [pat] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, registeredPatientId));

      expect(pat).toBeDefined();
      expect(pat.phoneEncrypted).toBeDefined();
      expect(pat.phoneEncrypted).not.toBe(testPhone); // Must be AES-256-GCM ciphertext
      expect(pat.phoneBlindIndex).toBeDefined();
      expect(pat.phoneMasked).toBe('+2547****5678');

      const [ident] = await db
        .select()
        .from(patientIdentifiers)
        .where(eq(patientIdentifiers.patientId, registeredPatientId));

      expect(ident).toBeDefined();
      expect(ident.valueEncrypted).toBeDefined();
      expect(ident.valueEncrypted).not.toBe(testNationalId);
      expect(ident.valueBlindIndex).toBeDefined();
      expect(ident.valueMasked).toBe('*****890');
    });
  });

  it('1.3 should reject registration with invalid Kenyan phone number', async () => {
    const res = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: PatientGender.MALE,
        phone: '12345',
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    const errMsg = body.error?.message || body.message;
    expect(errMsg).toContain('Invalid Kenyan phone number');
  });

  // =========================================================================
  // 2. DUPLICATE DETECTION & OVERRIDE
  // =========================================================================

  it('2.1 should reject duplicate registration when identical National ID is supplied', async () => {
    const res = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Amina',
        lastName: 'Bakari',
        dateOfBirth: '1995-07-24',
        gender: PatientGender.FEMALE,
        identifiers: [
          {
            system: PatientIdentifierType.KENYA_NATIONAL_ID,
            value: testNationalId,
          },
        ],
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    const errMsg = body.error?.message || body.message;
    expect(errMsg).toContain('already registered');
  });

  it('2.2 should warn/reject registration on probabilistic duplicate (same name + DOB + gender + phone)', async () => {
    const res = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Amina',
        lastName: 'Bakari',
        dateOfBirth: '1995-07-24',
        gender: PatientGender.FEMALE,
        phone: testPhone,
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    const errMsg = body.error?.message || body.message;
    expect(errMsg).toContain('Potential duplicate patient detected');
  });

  it('2.3 should evaluate duplicate candidates without registering via check-duplicates endpoint', async () => {
    const res = await fetch(`${baseUrl}/patients/check-duplicates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Amina',
        lastName: 'Bakari',
        dateOfBirth: '1995-07-24',
        gender: PatientGender.FEMALE,
        phone: testPhone,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0].confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(body.data[0].patient.id).toBe(registeredPatientId);
  });

  it('2.4 should allow registration with forceDuplicateOverride flag when registrar confirms new individual', async () => {
    const res = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        firstName: 'Amina',
        lastName: 'Bakari',
        dateOfBirth: '1995-07-24',
        gender: PatientGender.FEMALE,
        phone: testPhone,
        forceDuplicateOverride: true,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.id).not.toBe(registeredPatientId);
  });

  // =========================================================================
  // 3. PATIENT SEARCH WITH BLIND-INDEXING & ACCESS CONTROLS
  // =========================================================================

  it('3.1 should search patient exactly by Kenyan National ID blind index', async () => {
    const res = await fetch(`${baseUrl}/patients?nationalId=${testNationalId}`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(registeredPatientId);
    expect(body.data[0].firstName).toBe('Amina');
  });

  it('3.2 should search patient exactly by phone number blind index', async () => {
    const res = await fetch(`${baseUrl}/patients?phone=${encodeURIComponent('0712345678')}`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.some((p: any) => p.id === registeredPatientId)).toBe(true);
  });

  it('3.3 should search patient partially by name and MRN', async () => {
    const res = await fetch(`${baseUrl}/patients?name=Amina`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.some((p: any) => p.mrn === registeredPatientMrn)).toBe(true);
  });

  // =========================================================================
  // 4. EMERGENCY TRAUMA INTAKE
  // =========================================================================

  let emergencyPatientId: string;

  it('4.1 should successfully perform fast emergency intake for unidentified trauma patient', async () => {
    const res = await fetch(`${baseUrl}/patients/emergency-intake`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        gender: PatientGender.MALE,
        estimatedAge: 28,
        triageNotes: 'Unconscious trauma patient admitted from A104 road traffic incident',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    const data = body.data;

    expect(data.id).toBeDefined();
    emergencyPatientId = data.id;
    expect(data.firstName).toBe('EMERGENCY');
    expect(data.lastName).toMatch(/^UNKNOWN-MALE-[A-Z0-9]{5}$/);
    expect(data.gender).toBe(PatientGender.MALE);
    expect(data.isDobEstimated).toBe(true);
    expect(data.identityStatus).toBe(PatientIdentityStatus.LOCAL_ONLY);
    expect(data.status).toBe(PatientStatus.ACTIVE);
  });

  // =========================================================================
  // 5. EXTERNAL IDENTITY RESOLUTION WITH CLIENT REGISTRY (MOCK)
  // =========================================================================

  it('5.1 should verify patient identity with DHA Client Registry and resolve UPI', async () => {
    const res = await fetch(`${baseUrl}/patients/${registeredPatientId}/verify-dha`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data || body;

    expect(data.success).toBe(true);
    expect(data.crId).toBe('CRID-KE-DHA-12345678');
    expect(data.upi).toBe('UPI-KEN-2026-12345678');

    // Confirm patient state is now VERIFIED_EXTERNAL
    const patRes = await fetch(`${baseUrl}/patients/${registeredPatientId}`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });
    const patBody = await patRes.json();
    expect(patBody.data.identityStatus).toBe(PatientIdentityStatus.VERIFIED_EXTERNAL);
    expect(patBody.data.isExternallyVerified).toBe(true);
    expect(patBody.data.dhaCrid).toBe('CRID-KE-DHA-12345678');
    expect(patBody.data.upi).toBe('UPI-KEN-2026-12345678');
  });

  // =========================================================================
  // 6. SAFE, NON-DESTRUCTIVE RECONCILIATION & MERGE
  // =========================================================================

  it('6.1 should block unauthorized clinicians without PATIENT_RECONCILE from merging records (403)', async () => {
    const res = await fetch(`${baseUrl}/patients/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`, // Clinician lacks PATIENT_RECONCILE
      },
      body: JSON.stringify({
        targetPatientId: registeredPatientId,
        sourcePatientId: emergencyPatientId,
        reason: 'Attempted merge without records administrator authority',
      }),
    });

    expect(res.status).toBe(403);
  });

  it('6.2 should safely merge emergency record into verified record with Hospital Admin authority (200)', async () => {
    const res = await fetch(`${baseUrl}/patients/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAToken}`, // Hospital Admin has PATIENT_RECONCILE
      },
      body: JSON.stringify({
        targetPatientId: registeredPatientId,
        sourcePatientId: emergencyPatientId,
        reason: 'Patient regained consciousness and relatives confirmed identity with National ID',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data || body;
    expect(data.success).toBe(true);
    expect(data.targetPatient.id).toBe(registeredPatientId);

    // Verify source record is MERGED and not deleted
    await withSuperAdminContext(async (db) => {
      const [src] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, emergencyPatientId));

      expect(src).toBeDefined();
      expect(src.status).toBe(PatientStatus.MERGED);
      expect(src.reconciledIntoPatientId).toBe(registeredPatientId);
    });
  });

  // =========================================================================
  // 7. CONSENT & AUDIT TRAIL WORKFLOWS
  // =========================================================================

  let consentRecordId: string;

  it('7.1 should record statutory patient consent under Kenya DPA 2019', async () => {
    const res = await fetch(`${baseUrl}/patients/${registeredPatientId}/consents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        consentType: ConsentType.HIE_SHR_SHARING,
        policyVersion: 'KE-DPA-2019-V1',
        channel: ConsentChannel.WRITTEN_FORM,
        witnessName: 'Nurse Kiprono',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBeDefined();
    consentRecordId = body.data.id;
    expect(body.data.consentType).toBe(ConsentType.HIE_SHR_SHARING);
    expect(body.data.status).toBe('GRANTED');
  });

  it('7.2 should revoke consent when patient exercises right to object', async () => {
    const res = await fetch(
      `${baseUrl}/patients/${registeredPatientId}/consents/${consentRecordId}/revoke`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient requested restriction of electronic health record sharing',
        }),
      },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('REVOKED');
    expect(body.data.revokedAt).toBeDefined();
  });

  it('7.3 should return comprehensive audit trail and record access logs', async () => {
    // Access patient record to generate an explicit access log
    await fetch(`${baseUrl}/patients/${registeredPatientId}`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    const res = await fetch(`${baseUrl}/patients/${registeredPatientId}/history`, {
      headers: {
        Authorization: `Bearer ${clinicianAToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;

    expect(Array.isArray(data.accessLogs)).toBe(true);
    expect(data.accessLogs.length).toBeGreaterThan(0);
    expect(Array.isArray(data.stateTransitions)).toBe(true);
    expect(Array.isArray(data.reconciliations)).toBe(true);
    expect(data.reconciliations.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // 8. TENANT ISOLATION & UNAUTHORIZED ACCESS
  // =========================================================================

  it('8.1 should block unauthorized requests without token (401)', async () => {
    const res = await fetch(`${baseUrl}/patients/${registeredPatientId}`);
    expect(res.status).toBe(401);
  });

  it('8.2 should enforce strict Row-Level Security: Clinician B cannot access Clinician A patient (404)', async () => {
    const res = await fetch(`${baseUrl}/patients/${registeredPatientId}`, {
      headers: {
        Authorization: `Bearer ${clinicianBToken}`,
      },
    });

    expect(res.status).toBe(404);
  });
});
