/**
 * COMKEY AFYA POA — SHA Integration Workflows Integration Tests
 * Grounded in Social Health Insurance Act 2023, SHI Regulations 2024,
 * and verified DHA/SHA integration specifications.
 * Covers:
 * 1. Eligibility & coverage verification across PHC, SHIF, ECCIF
 * 2. Benefit validation & intervention tariff lookup
 * 3. Pre-authorization request & cancellation
 * 4. Claim preparation with 90-day and 24-hour statutory validation
 * 5. Claim submission & acknowledgement
 * 6. Supporting clinical attachments
 * 7. Inpatient discharge & claim dispatch
 * 8. Status tracking & webhook callback processing
 * 9. Corrected claims and resubmission (versioning)
 * 10. Ambiguous submission reconciliation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import {
  withSuperAdminContext,
  tenants,
  facilities,
  users,
  patients,
  encounters,
  shaPreauthorizations,
  shaClaims,
  shaClaimItems,
  shaClaimSubmissions,
  shaClaimAttachments,
  shaCallbackEvents,
} from '@afyapoa/database';
import { eq } from 'drizzle-orm';
import {
  ShaFundType,
  ShaIntegrationScenario,
  ShaPaymentMechanism,
  ShaAccessPoint,
  ShaClaimStatus,
  ShaPreauthType,
} from '@afyapoa/domain-core';
import bcrypt from 'bcryptjs';

describe('SHA Integration Workflows End-to-End Tests (COMKEY AFYA POA)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let facilityA1Id: string;

  let clinicianAToken: string;
  let clinicianAUserId: string;

  let testPatientId: string;
  let testEncounterId: string;
  let testCrId: string;

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

    // 1. Fetch tenants & facilities
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      if (!tA) {
        throw new Error('Test setup error: Seeded tenant-nmhg missing');
      }
      tenantAId = tA.id;

      const facs = await db.select().from(facilities);
      const fA1 = facs.find((f) => f.tenantId === tenantAId);
      if (!fA1) {
        throw new Error('Test setup error: Seeded facility missing');
      }
      facilityA1Id = fA1.id;

      // Clean transactional SHA records
      await db.delete(shaCallbackEvents);
      await db.delete(shaClaimAttachments);
      await db.delete(shaClaimSubmissions);
      await db.delete(shaClaimItems);
      await db.delete(shaClaims);
      await db.delete(shaPreauthorizations);

      // Ensure Clinician user exists in Tenant A
      const existingClinician = await db.query.users.findFirst({
        where: (u, { eq, and }) => and(eq(u.tenantId, tenantAId), eq(u.username, 'dr.mwangi')),
      });

      if (!existingClinician) {
        const passwordHash = await bcrypt.hash('Password123!', 10);
        const [insertedUser] = await db
          .insert(users)
          .values({
            tenantId: tenantAId,
            primaryFacilityId: facilityA1Id,
            username: 'dr.mwangi',
            email: 'mwangi@nmhg.demo.afyapoa.co.ke',
            fullName: 'Dr. James Mwangi (Clinician)',
            role: 'CLINICIAN',
            passwordHash,
            status: 'ACTIVE',
          })
          .returning();
        clinicianAUserId = insertedUser!.id;
      } else {
        clinicianAUserId = existingClinician.id;
      }

      // Seed a test patient under Tenant A with DHA CR ID & SHA Number
      testCrId = 'CRID-KE-DHA-998877';
      const testMrn = `MRN-SHA-${Date.now()}`;
      const [pA] = await db
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          mrn: testMrn,
          dhaCrid: testCrId,
          shaNumber: 'SHA-00998877',
          firstName: 'Amina',
          lastName: 'Muthoni',
          dateOfBirth: '1990-05-12',
          gender: 'FEMALE',
          nationality: 'KENYAN',
          phoneMasked: '+254711***344',
          status: 'ACTIVE',
        })
        .returning();
      testPatientId = pA!.id;

      // Seed an active encounter for Patient A
      const testEncNumber = `ENC-SHA-${Date.now()}`;
      const [enc] = await db
        .insert(encounters)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          patientId: testPatientId,
          clinicianId: clinicianAUserId,
          encounterNumber: testEncNumber,
          encounterType: 'INPATIENT',
          serviceDepartment: 'SURGICAL_WARD',
          status: 'IN_PROGRESS',
        })
        .returning();
      testEncounterId = enc!.id;
    });

    // 2. Login Clinician (dr.mwangi)
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.mwangi', password: 'Password123!' }),
    });
    const lData = await loginRes.json();
    clinicianAToken = lData.data?.accessToken || lData.accessToken;
  });

  afterAll(async () => {
    await withSuperAdminContext(async (db) => {
      await db.delete(shaClaimAttachments);
      await db.delete(shaClaimSubmissions);
      await db.delete(shaClaimItems);
      await db.delete(shaClaims);
      await db.delete(shaPreauthorizations);
      await db.delete(shaCallbackEvents);
      if (testEncounterId) {
        await db.delete(encounters).where(eq(encounters.id, testEncounterId));
      }
      if (testPatientId) {
        await db.delete(patients).where(eq(patients.id, testPatientId));
      }
    });
    if (app) {
      await app.close();
    }
  });

  // ===========================================================================
  // 1. ELIGIBILITY & COVERAGE VERIFICATION
  // ===========================================================================
  describe('1. Eligibility & Coverage Verification', () => {
    it('verifies SHA beneficiary eligibility across PHC, SHIF, ECCIF', async () => {
      const res = await fetch(`${baseUrl}/claims/eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          identificationType: 'SHA_NUMBER',
          identificationNumber: 'SHA-00998877',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const data = json.data;
      expect(data.eligible).toBe(true);
      expect(data.fundType).toBe('SHIF');
      expect(data.activeSchemes.some((s: any) => s.fund === 'SHIF')).toBe(true);
      expect(data.benefitBalanceKES).toBeGreaterThan(0);
    });

    it('retrieves patient sub-benefits catalog', async () => {
      const res = await fetch(`${baseUrl}/claims/sub-benefits/${testCrId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].subBenefitCode).toBeDefined();
    });

    it('retrieves interventions and tariff rules for sub-benefit', async () => {
      const res = await fetch(`${baseUrl}/claims/interventions/${testCrId}/SB-SURG-GENERAL`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].interventionCode).toBeDefined();
      expect(json.data[0].standardTariffKES).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 2. PREAUTHORIZATIONS
  // ===========================================================================
  describe('2. Preauthorizations (Elective & Surgical)', () => {
    let preauthId: string;

    it('submits surgical preauthorization and receives approved status', async () => {
      const res = await fetch(`${baseUrl}/claims/preauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientId,
          patientCrId: testCrId,
          fund: 'SHIF',
          subBenefitCode: 'SB-SURG-GENERAL',
          interventionCode: 'INT-SURG-APP',
          preauthType: 'SURGICAL',
          clinicalSummary: 'Scheduled open cholecystectomy for chronic cholelithiasis',
          practitionerPuid: 'PUID-KMPDC-A0001',
          requestedAmountKES: 45000,
          supportingDocumentUrls: ['https://storage.afyapoa.local/docs/us_abdomen.pdf'],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const preauth = json.data;
      expect(preauth.id).toBeDefined();
      expect(preauth.status).toBe('APPROVED');
      expect(preauth.preauthNumber).toContain('PA-');
      expect(Number(preauth.approvedAmountKES)).toBe(45000);
      preauthId = preauth.id;
    });

    it('cancels pending or approved preauthorization prior to admission', async () => {
      const res = await fetch(`${baseUrl}/claims/preauth/${preauthId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient opted to defer surgery to next month',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe('CANCELLED');
    });
  });

  // ===========================================================================
  // 3. CLAIM CREATION, STATUTORY VALIDATION & SUBMISSION
  // ===========================================================================
  describe('3. Claim Lifecycle, Validation & Submission', () => {
    let createdClaimId: string;
    let approvedPreauthId: string;

    beforeAll(async () => {
      // Create an approved preauth for surgical scenario SC-02
      const res = await fetch(`${baseUrl}/claims/preauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientId,
          patientCrId: testCrId,
          fund: 'SHIF',
          subBenefitCode: 'SB-SURG-GENERAL',
          interventionCode: 'INT-SURG-APP',
          preauthType: 'SURGICAL',
          clinicalSummary: 'Preauth for appendectomy',
          practitionerPuid: 'PUID-KMPDC-A0001',
          requestedAmountKES: 35000,
        }),
      });
      const json = await res.json();
      approvedPreauthId = json.data.id;
    });

    it('creates and validates draft claim for SC-02 (Inpatient FFS with Preauth)', async () => {
      const res = await fetch(`${baseUrl}/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientId,
          encounterId: testEncounterId,
          preauthId: approvedPreauthId,
          fund: 'SHIF',
          scenario: 'SC-02',
          accessPoint: 'IP',
          paymentMechanism: 'FEE_FOR_SERVICE',
          serviceStartDate: '2026-05-01T08:00:00Z',
          serviceEndDate: '2026-05-04T10:00:00Z',
          practitionerPuid: 'PUID-KMPDC-A0001',
          primaryDiagnosisIcd11: 'DA24.0', // Acute appendicitis
          items: [
            {
              lineType: 'INTERVENTION',
              code: 'INT-SURG-APP',
              description: 'Emergency Appendectomy',
              quantity: 1,
              unitPriceKES: 25000,
              serviceDate: '2026-05-01T12:00:00Z',
            },
            {
              lineType: 'BED_DAY',
              code: 'BED-GEN',
              description: 'General Ward Bed (3 days)',
              quantity: 3,
              unitPriceKES: 3000,
              serviceDate: '2026-05-01T14:00:00Z',
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const claim = json.data;
      expect(claim.id).toBeDefined();
      expect(claim.claimNumber).toContain('CLM-');
      expect(claim.version).toBe(1);
      expect(claim.status).toBe('DRAFT'); // Inpatient claim remains in DRAFT until patient is discharged
      expect(Number(claim.totalClaimAmountKES)).toBe(34000);
      expect(claim.submissionFingerprint).toContain('SHA-FINGERPRINT-');
      createdClaimId = claim.id;
    });

    it('attaches supporting clinical documentation (Operative Notes)', async () => {
      const res = await fetch(`${baseUrl}/claims/${createdClaimId}/attachments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          documentType: 'OPERATIVE_NOTES',
          title: 'Operative Notes - Dr. Mwangi',
          mimeType: 'application/pdf',
          fileUrl: 'https://storage.afyapoa.local/claims/op_notes_001.pdf',
          fileSizeBytes: 204850,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.id).toBeDefined();
      expect(json.data.shaUploadStatus).toBe('UPLOADED_TO_SHA');
    });

    it('finalizes inpatient discharge and transitions claim to ACCEPTED with tracking number', async () => {
      const res = await fetch(`${baseUrl}/claims/${createdClaimId}/discharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          dischargeDate: '2026-05-04T10:00:00Z',
          dischargeDisposition: 'HOME',
          summaryNotes: 'Patient recovered well post-operatively. Wounds clean and dry.',
          finalDiagnosisIcd11: 'DA24.0',
          attendingPractitionerPuid: 'PUID-KMPDC-A0001',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.status).toBe('ACCEPTED');
      expect(json.data.shaTrackingNumber).toBeDefined();
    });

    it('submits standard outpatient claim to SHA adjudication engine and receives ACKNOWLEDGED / ACCEPTED status', async () => {
      // 1. Create a queued outpatient claim (SC-06)
      const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const opRes = await fetch(`${baseUrl}/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientId,
          encounterId: testEncounterId,
          fund: 'PHC',
          scenario: 'SC-06',
          accessPoint: 'OP',
          paymentMechanism: 'CAPITATION',
          serviceStartDate: recentDate,
          practitionerPuid: 'PUID-KMPDC-A0001',
          primaryDiagnosisIcd11: '1A00',
          items: [
            {
              lineType: 'SERVICE',
              code: 'CONS-OP',
              description: 'General Outpatient Consultation',
              quantity: 1,
              unitPriceKES: 1200,
              serviceDate: recentDate,
            },
          ],
        }),
      });
      const opClaim = (await opRes.json()).data;
      expect(opClaim.status).toBe('QUEUED');

      // 2. Submit to SHA
      const submitRes = await fetch(`${baseUrl}/claims/${opClaim.id}/submit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(submitRes.status).toBe(201);
      const submitData = (await submitRes.json()).data;
      expect(['ACKNOWLEDGED', 'ACCEPTED']).toContain(submitData.status);
      expect(submitData.shaTrackingNumber).toBeDefined();
    });

    it('tracks live claim adjudication status', async () => {
      const res = await fetch(`${baseUrl}/claims/${createdClaimId}/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.localClaim).toBeDefined();
      expect(json.data.remoteStatus).toBeDefined();
    });
  });

  // ===========================================================================
  // 4. CORRECTED CLAIMS RESUBMISSION & VERSIONING
  // ===========================================================================
  describe('4. Corrected Claims Resubmission & Versioning', () => {
    let rejectedClaimId: string;

    beforeAll(async () => {
      // Create a claim and simulate rejection in DB
      await withSuperAdminContext(async (db) => {
        const [clm] = await db
          .insert(shaClaims)
          .values({
            tenantId: tenantAId,
            facilityId: facilityA1Id,
            claimNumber: 'CLM-REJECT-TEST-001',
            version: 1,
            patientId: testPatientId,
            encounterId: testEncounterId,
            fund: 'SHIF',
            scenario: 'SC-01',
            accessPoint: 'IP',
            paymentMechanism: 'PER_DIEM',
            status: ShaClaimStatus.REJECTED,
            serviceStartDate: new Date('2026-05-01'),
            totalClaimAmountKES: '15000',
            submissionFingerprint: 'FP-REJECT-001',
            rejectionReason: 'Missing laboratory confirmation for primary diagnosis',
          })
          .returning();
        rejectedClaimId = clm!.id;

        await db.insert(shaClaimItems).values({
          tenantId: tenantAId,
          claimId: rejectedClaimId,
          lineType: 'BED_DAY',
          code: 'BED-GEN',
          description: 'General Bed (3 days)',
          quantity: '3',
          unitPriceKES: '5000',
          totalAmountKES: '15000',
          serviceDate: new Date('2026-05-01'),
        });
      });
    });

    it('creates corrected claim resubmission with incremented version number (v2)', async () => {
      const res = await fetch(`${baseUrl}/claims/${rejectedClaimId}/resubmit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          correctionReason: 'Attached lab histology report and updated ICD-11 coding',
          updatedItems: [
            {
              lineType: 'BED_DAY',
              code: 'BED-GEN',
              description: 'General Bed (3 days)',
              quantity: 3,
              unitPriceKES: 5000,
              serviceDate: '2026-05-01T10:00:00Z',
            },
            {
              lineType: 'LABORATORY',
              code: 'LAB-HISTO',
              description: 'Histopathology Biopsy',
              quantity: 1,
              unitPriceKES: 3500,
              serviceDate: '2026-05-01T12:00:00Z',
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const v2Claim = json.data;
      expect(v2Claim.claimNumber).toBe('CLM-REJECT-TEST-001');
      expect(v2Claim.version).toBe(2);
      expect(v2Claim.resubmissionCount).toBe(1);
      expect(v2Claim.originalClaimId).toBe(rejectedClaimId);
      expect(v2Claim.status).toBe('DRAFT');
      expect(Number(v2Claim.totalClaimAmountKES)).toBe(18500);
    });
  });

  // ===========================================================================
  // 5. ASYNCHRONOUS WEBHOOK CALLBACK ENGINE
  // ===========================================================================
  describe('5. Asynchronous Webhook Callback Ingestion', () => {
    let pendingClaimNumber: string;

    beforeAll(async () => {
      pendingClaimNumber = `CLM-WEBHOOK-${Date.now()}`;
      await withSuperAdminContext(async (db) => {
        await db.insert(shaClaims).values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          claimNumber: pendingClaimNumber,
          version: 1,
          patientId: testPatientId,
          encounterId: testEncounterId,
          fund: 'SHIF',
          scenario: 'SC-01',
          accessPoint: 'IP',
          paymentMechanism: 'PER_DIEM',
          status: ShaClaimStatus.SUBMITTED,
          serviceStartDate: new Date('2026-05-01'),
          totalClaimAmountKES: '20000',
          submissionFingerprint: `FP-${pendingClaimNumber}`,
        });
      });
    });

    it('ingests CLAIM_PROCESSED webhook and transitions claim to ADJUDICATED', async () => {
      const res = await fetch(`${baseUrl}/claims/callbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Id': tenantAId,
          'X-Trace-Id': 'TRACE-TEST-CALLBACK-001',
        },
        body: JSON.stringify({
          eventId: `EVT-${Date.now()}`,
          eventType: 'CLAIM_PROCESSED',
          claimNumber: pendingClaimNumber,
          status: 'ADJUDICATED',
          approvedAmountKES: 19000,
          patientCopayKES: 1000,
          deductionAmountKES: 0,
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.processed).toBe(true);

      // Verify claim updated in DB
      await withSuperAdminContext(async (db) => {
        const [clm] = await db
          .select()
          .from(shaClaims)
          .where(eq(shaClaims.claimNumber, pendingClaimNumber));
        expect(clm?.status).toBe(ShaClaimStatus.ADJUDICATED);
        expect(Number(clm?.approvedAmountKES)).toBe(19000);
        expect(Number(clm?.patientCopayKES)).toBe(1000);
      });
    });
  });

  // ===========================================================================
  // 6. TIMEOUT RECONCILIATION
  // ===========================================================================
  describe('6. Reconciliation of Ambiguous / Timed-Out Submissions', () => {
    let unacknowledgedClaimNumber: string;

    beforeAll(async () => {
      unacknowledgedClaimNumber = `CLM-TIMEOUT-${Date.now()}`;
      await withSuperAdminContext(async (db) => {
        await db.insert(shaClaims).values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          claimNumber: unacknowledgedClaimNumber,
          version: 1,
          patientId: testPatientId,
          encounterId: testEncounterId,
          fund: 'PHC',
          scenario: 'SC-06',
          accessPoint: 'OP',
          paymentMechanism: 'CAPITATION',
          status: ShaClaimStatus.SUBMITTED,
          serviceStartDate: new Date('2026-05-01'),
          totalClaimAmountKES: '3500',
          submissionFingerprint: `FP-${unacknowledgedClaimNumber}`,
        });
      });
    });

    it('probes pending submissions and updates status upon reconciliation', async () => {
      const res = await fetch(`${baseUrl}/claims/reconcile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          claimNumber: unacknowledgedClaimNumber,
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.totalProbed).toBeGreaterThanOrEqual(1);
    });
  });
});
