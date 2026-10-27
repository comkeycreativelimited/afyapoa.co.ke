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
  clinicalOrders,
  serviceRequests,
  labTestCatalog,
  labReferenceRanges,
  labSpecimens,
  labResults,
  diagnosticReports,
  labConsumables,
  labConsumableDeductions,
} from '@afyapoa/database';
import {
  SpecimenStatus,
  SpecimenRejectionReason,
  ContainerType,
  SpecimenType,
  LabDepartment,
  LabAbnormalFlag,
  LabResultStatus,
  DiagnosticReportStatus,
} from '@afyapoa/domain-core';
import bcrypt from 'bcryptjs';

describe('Laboratory Information Module Integration Tests (Milestone 7)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityB1Id: string;

  let clinicianAToken: string;
  let adminAToken: string;
  let labTechAToken: string;
  let nurseAToken: string;
  let clinicianBToken: string;

  let testPatientAId: string;
  let testEncounterAId: string;

  let labOrderId: string;
  let collectedSpecimenId: string;
  let labResultId: string;
  let diagnosticReportId: string;

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
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) {
        throw new Error('Test setup error: Seeded tenants missing');
      }
      tenantAId = tA.id;
      tenantBId = tB.id;

      const facs = await db.select().from(facilities);
      const fA1 = facs.find((f) => f.tenantId === tenantAId);
      const fB1 = facs.find((f) => f.tenantId === tenantBId);
      if (!fA1 || !fB1) {
        throw new Error('Test setup error: Seeded facilities missing');
      }
      facilityA1Id = fA1.id;
      facilityB1Id = fB1.id;

      // Clean existing lab & order records for a pristine test run
      await db.delete(labConsumableDeductions);
      await db.delete(diagnosticReports);
      await db.delete(labResults);
      await db.delete(labSpecimens);
      await db.delete(serviceRequests);
      await db.delete(clinicalOrders);
      await db.delete(encounters);
      await db.delete(patients);

      // Ensure Lab Tech user exists in Tenant A
      const existingLabTech = await db.query.users.findFirst({
        where: (u, { eq, and }) => and(eq(u.tenantId, tenantAId), eq(u.username, 'tech.kiprop')),
      });

      if (!existingLabTech) {
        const passwordHash = await bcrypt.hash('Password123!', 10);
        await db.insert(users).values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          username: 'tech.kiprop',
          email: 'kiprop@nmhg.demo.afyapoa.co.ke',
          fullName: 'Kiprop Kiprono (Lab Technologist)',
          role: 'LAB_TECH',
          passwordHash,
          status: 'ACTIVE',
        });
      }
    });

    // 2. Login Clinician A (dr.otieno)
    const loginClinicianA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.otieno', password: 'Password123!' }),
    });
    const cAData = await loginClinicianA.json();
    clinicianAToken = cAData.data?.accessToken || cAData.accessToken;

    // 3. Login Hospital Admin A (admin.nmhg) with MFA
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

    // 4. Login Lab Tech A (tech.kiprop)
    const loginLabTech = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'tech.kiprop', password: 'Password123!' }),
    });
    const ltData = await loginLabTech.json();
    labTechAToken = ltData.data?.accessToken || ltData.accessToken;

    // 5. Login Triage Nurse A (nurse.faith)
    const loginNurse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nurse.faith', password: 'Password123!' }),
    });
    const nData = await loginNurse.json();
    nurseAToken = nData.data?.accessToken || nData.accessToken;

    // 6. Login Clinician B (dr.mary - Kibera Net)
    const loginClinicianB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.mary', password: 'Password123!' }),
    });
    const cBData = await loginClinicianB.json();
    clinicianBToken = cBData.data?.accessToken || cBData.accessToken;

    // 7. Create Test Patient & Encounter for Tenant A
    const patientResA = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityA1Id,
        firstName: 'Samwel',
        lastName: 'Kariuki',
        gender: 'MALE',
        dateOfBirth: '1992-04-15',
        phone: '+254712345678',
      }),
    });
    const pDataA = await patientResA.json();
    testPatientAId = pDataA.data?.id || pDataA.id;

    const encResA = await fetch(`${baseUrl}/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        facilityId: facilityA1Id,
        patientId: testPatientAId,
        encounterType: 'WALK_IN',
        serviceDepartment: 'OUTPATIENT',
        priority: 'URGENT',
      }),
    });
    const encDataA = await encResA.json();
    testEncounterAId = encDataA.data?.id || encDataA.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==========================================
  // 1. CATALOGUE MANAGEMENT & CONSUMABLES SEEDING
  // ==========================================

  describe('1. Laboratory Catalogue Management & Consumables Seeding', () => {
    it('should seed standard Kenya MOH lab test catalog and consumables idempotently', async () => {
      const res = await fetch(`${baseUrl}/laboratory/seed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const body = data.data || data;
      expect(body.success).toBe(true);
      expect(body.testsInserted).toBeGreaterThanOrEqual(0);
      expect(body.consumablesInserted).toBeGreaterThanOrEqual(0);
    });

    it('should retrieve catalog items with configured reference ranges containing source and version', async () => {
      const res = await fetch(`${baseUrl}/laboratory/catalog?department=HEMATOLOGY`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const items = data.data || data;
      expect(Array.isArray(items)).toBe(true);

      const hgb = items.find((t: any) => t.testCode === '718-7');
      expect(hgb).toBeDefined();
      expect(hgb.testName).toContain('Hemoglobin');
      expect(hgb.department).toBe(LabDepartment.HEMATOLOGY);
      expect(hgb.specimenType).toBe(SpecimenType.WHOLE_BLOOD);
      expect(hgb.referenceRanges.length).toBeGreaterThan(0);

      const range = hgb.referenceRanges[0];
      expect(range.source).toContain('WHO');
      expect(range.sourceVersion).toBeDefined();
      expect(Number(range.lowNumeric)).toBe(13);
      expect(Number(range.highNumeric)).toBe(18);
      expect(Number(range.criticalLowNumeric)).toBe(7);
    });

    it('should reject unauthenticated or unauthorized users from seeding catalog', async () => {
      const res = await fetch(`${baseUrl}/laboratory/seed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${nurseAToken}`, // Nurse lacks LAB_ADMIN
        },
      });

      expect(res.status).toBe(403);
    });
  });

  // ==========================================
  // 2. INCOMING ORDERS QUEUE
  // ==========================================

  describe('2. Incoming Laboratory Orders', () => {
    it('should receive clinical laboratory service request orders', async () => {
      // Create a lab service order via CPOE
      const orderRes = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'LAB_SERVICE_REQUEST',
          priority: 'URGENT',
          intent: 'ORDER',
          clinicalIndication: 'Patient presenting with high fever, pallor, and chills',
          service: {
            serviceCategory: 'LABORATORY',
            serviceCode: '718-7',
            serviceName: 'Hemoglobin [Mass/volume] in Blood',
            codingSystem: 'LOINC',
            specimenType: 'WHOLE_BLOOD',
            urgency: 'URGENT',
          },
        }),
      });

      expect(orderRes.status).toBe(201);
      const orderData = await orderRes.json();
      labOrderId = orderData.data?.id || orderData.id;
      expect(labOrderId).toBeDefined();

      // Check incoming lab queue
      const queueRes = await fetch(`${baseUrl}/laboratory/orders/incoming`, {
        headers: {
          Authorization: `Bearer ${labTechAToken}`,
        },
      });

      expect(queueRes.status).toBe(200);
      const queueData = await queueRes.json();
      const incoming = queueData.data || queueData;
      expect(Array.isArray(incoming)).toBe(true);

      const found = incoming.find((o: any) => o.id === labOrderId);
      expect(found).toBeDefined();
      expect(found.serviceRequests.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 3. SPECIMEN COLLECTION & INVENTORY INTEGRATION
  // ==========================================

  describe('3. Specimen Collection & Consumable Inventory Integration', () => {
    it('should collect specimen, generate accession number/barcode, and deduct consumable', async () => {
      // Check consumable stock before deduction
      const stockBeforeRes = await fetch(`${baseUrl}/laboratory/consumables`, {
        headers: { Authorization: `Bearer ${labTechAToken}` },
      });
      const stockBeforeData = await stockBeforeRes.json();
      const edtaBefore = (stockBeforeData.data || stockBeforeData).find(
        (c: any) => c.itemCode === 'VAC-EDTA-LAV',
      );
      const qtyBefore = edtaBefore.quantityOnHand;

      // Collect specimen
      const collectRes = await fetch(`${baseUrl}/laboratory/specimens/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          orderId: labOrderId,
          patientId: testPatientAId,
          specimenType: SpecimenType.WHOLE_BLOOD,
          containerType: ContainerType.EDTA_TUBE_LAVENDER,
          volumeMl: 4.0,
          collectionSite: 'Left median cubital vein',
          notes: 'Smooth venipuncture, no hematoma',
          deductConsumableItemCode: 'VAC-EDTA-LAV',
          deductQuantity: 1,
        }),
      });

      expect(collectRes.status).toBe(201);
      const collectData = await collectRes.json();
      const specimen = collectData.data || collectData;
      collectedSpecimenId = specimen.id;

      expect(specimen.accessionNumber).toMatch(/^ACC-\d{6}-\d{5}$/);
      expect(specimen.barcode).toMatch(/^BC-\d{6}-\d{5}$/);
      expect(specimen.status).toBe(SpecimenStatus.COLLECTED);

      // Verify consumable inventory was deducted
      const stockAfterRes = await fetch(`${baseUrl}/laboratory/consumables`, {
        headers: { Authorization: `Bearer ${labTechAToken}` },
      });
      const stockAfterData = await stockAfterRes.json();
      const edtaAfter = (stockAfterData.data || stockAfterData).find(
        (c: any) => c.itemCode === 'VAC-EDTA-LAV',
      );
      expect(edtaAfter.quantityOnHand).toBe(qtyBefore - 1);
    });

    it('should prevent specimen collection for a cancelled order (Failure Scenario)', async () => {
      // Create and cancel an order
      const cancelOrderRes = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'LAB_SERVICE_REQUEST',
          service: {
            serviceCategory: 'LABORATORY',
            serviceCode: '2160-0',
            serviceName: 'Serum Creatinine',
            codingSystem: 'LOINC',
          },
        }),
      });
      const cancelOrderData = await cancelOrderRes.json();
      const cancelOrderId = cancelOrderData.data?.id || cancelOrderData.id;

      const cancelRes = await fetch(`${baseUrl}/orders/${cancelOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient discharged before specimen draw',
        }),
      });
      expect(cancelRes.status).toBe(200);

      // Attempt collection on cancelled order
      const failCollectRes = await fetch(`${baseUrl}/laboratory/specimens/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          orderId: cancelOrderId,
          patientId: testPatientAId,
          specimenType: SpecimenType.SERUM,
          containerType: ContainerType.SST_TUBE_GOLD,
        }),
      });

      expect(failCollectRes.status).toBe(400);
      const failData = await failCollectRes.json();
      expect(JSON.stringify(failData).toLowerCase()).toContain('cancelled');
    });
  });

  // ==========================================
  // 4. SPECIMEN RECEIPT & REJECTION WORKFLOWS
  // ==========================================

  describe('4. Specimen Receipt & Rejection Workflows', () => {
    it('should acknowledge specimen physical receipt in the laboratory', async () => {
      const res = await fetch(`${baseUrl}/laboratory/specimens/${collectedSpecimenId}/receive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          notes: 'Received in Hematology bench at 22°C',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const updated = data.data || data;
      expect(updated.status).toBe(SpecimenStatus.RECEIVED_IN_LAB);
      expect(updated.receivedAt).toBeDefined();
    });

    it('should reject invalid specimen transition', async () => {
      // Attempt to receive an already received specimen
      const res = await fetch(`${baseUrl}/laboratory/specimens/${collectedSpecimenId}/receive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
      });

      // Transition from RECEIVED_IN_LAB to RECEIVED_IN_LAB is not valid
      expect(res.status).toBe(400);
    });

    it('should reject specimen with pre-analytical error and spawn recollection', async () => {
      // Collect another specimen specifically for rejection testing
      const colRes = await fetch(`${baseUrl}/laboratory/specimens/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          orderId: labOrderId,
          patientId: testPatientAId,
          specimenType: SpecimenType.WHOLE_BLOOD,
          containerType: ContainerType.EDTA_TUBE_LAVENDER,
          volumeMl: 1.0,
        }),
      });
      const colData = await colRes.json();
      const rejectSpecId = (colData.data || colData).id;

      // Reject the specimen
      const rejectRes = await fetch(`${baseUrl}/laboratory/specimens/${rejectSpecId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          rejectionReason: SpecimenRejectionReason.HEMOLYZED,
          rejectionNotes: 'Gross 4+ hemolysis visible on plasma separation',
          recollectionRequired: true,
        }),
      });

      expect(rejectRes.status).toBe(200);
      const rejectData = await rejectRes.json();
      const body = rejectData.data || rejectData;

      expect(body.rejectedSpecimen.status).toBe(SpecimenStatus.REJECTED);
      expect(body.rejectedSpecimen.rejectionReason).toBe(SpecimenRejectionReason.HEMOLYZED);
      expect(body.recollectionSpecimen).toBeDefined();
      expect(body.recollectionSpecimen.status).toBe(SpecimenStatus.PENDING_COLLECTION);
      expect(body.recollectionSpecimen.accessionNumber).toContain('-R');
    });
  });

  // ==========================================
  // 5. WORKLISTS & RESULT ENTRY WITH AUTO-FLAGGING
  // ==========================================

  describe('5. Bench Worklists, Result Entry & Automated Flagging', () => {
    let hemoglobinCatalogId: string;
    let malariaCatalogId: string;

    beforeAll(async () => {
      const catalogRes = await fetch(`${baseUrl}/laboratory/catalog`, {
        headers: { Authorization: `Bearer ${labTechAToken}` },
      });
      const catalogData = await catalogRes.json();
      const items = catalogData.data || catalogData;

      const hgb = items.find((i: any) => i.testCode === '718-7');
      const mal = items.find((i: any) => i.testCode === '57021-8');
      hemoglobinCatalogId = hgb.id;
      malariaCatalogId = mal.id;
    });

    it('should query bench worklists filtered by processing statuses', async () => {
      const worklistRes = await fetch(`${baseUrl}/laboratory/worklist`, {
        headers: { Authorization: `Bearer ${labTechAToken}` },
      });

      expect(worklistRes.status).toBe(200);
      const worklistData = await worklistRes.json();
      const list = worklistData.data || worklistData;
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((s: any) => s.id === collectedSpecimenId)).toBe(true);
    });

    it('should automatically flag critically low hemoglobin (CRITICAL_LOW)', async () => {
      // Reference range for male adult: 13.0 - 18.0 g/dL. Critical low: <= 7.0 g/dL
      const resultRes = await fetch(`${baseUrl}/laboratory/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          specimenId: collectedSpecimenId,
          orderId: labOrderId,
          testCatalogId: hemoglobinCatalogId,
          numericValue: 6.2, // Critically low
          unit: 'g/dL',
          notes: 'Repeat run performed on Sysmex analyzer to confirm severe anemia',
        }),
      });

      expect(resultRes.status).toBe(201);
      const resultData = await resultRes.json();
      const result = resultData.data || resultData;
      labResultId = result.id;

      expect(result.abnormalFlag).toBe(LabAbnormalFlag.CRITICAL_LOW);
      expect(result.status).toBe(LabResultStatus.PRELIMINARY);
      expect(result.referenceSource).toContain('WHO');
      expect(result.referenceSourceVersion).toBeDefined();
    });

    it('should automatically flag qualitative reactive results (CRITICAL_HIGH)', async () => {
      const malariaResultRes = await fetch(`${baseUrl}/laboratory/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          specimenId: collectedSpecimenId,
          orderId: labOrderId,
          testCatalogId: malariaCatalogId,
          textValue: 'Positive (Pan/Pf)',
          notes: 'Strong positive band observed at 15 minutes',
        }),
      });

      expect(malariaResultRes.status).toBe(201);
      const malData = await malariaResultRes.json();
      const malResult = malData.data || malData;

      expect(malResult.abnormalFlag).toBe(LabAbnormalFlag.CRITICAL_HIGH);
    });
  });

  // ==========================================
  // 6. TWO-TIER REVIEW, CORRECTION & AUTHORIZATION
  // ==========================================

  describe('6. Result Review, Authorization & Amendment Audit History', () => {
    it('should prevent unauthorized users (nurse / junior tech) from authorizing results', async () => {
      const res = await fetch(`${baseUrl}/laboratory/results/${labResultId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`, // Lacks LAB_RESULT_AUTHORIZE
        },
        body: JSON.stringify({
          status: LabResultStatus.VERIFIED,
          verificationSignature: 'SIG-INVALID-UNAUTHORIZED',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should allow clinician/pathologist to verify result with digital signature', async () => {
      const res = await fetch(`${baseUrl}/laboratory/results/${labResultId}/verify`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`, // Has LAB_RESULT_AUTHORIZE
        },
        body: JSON.stringify({
          status: LabResultStatus.VERIFIED,
          verifierRole: 'SENIOR_CLINICIAN_PATHOLOGIST',
          verificationSignature: 'SIG-ECDSA-VERIFY-DR-OTIENO-2026',
          notes: 'Clinically correlated with severe pallor and microcytosis',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const updated = data.data || data;
      expect(updated.status).toBe(LabResultStatus.VERIFIED);
      expect(updated.verifierRole).toBe('SENIOR_CLINICIAN_PATHOLOGIST');
    });

    it('should require minimum 10-character clinical reason for result correction', async () => {
      const res = await fetch(`${baseUrl}/laboratory/results/${labResultId}/correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          numericValue: 6.4,
          correctionReason: 'Typo', // Too short (< 10 chars)
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should preserve immutable audit history of corrected results', async () => {
      const res = await fetch(`${baseUrl}/laboratory/results/${labResultId}/correct`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          numericValue: 6.6,
          correctionReason: 'Analyzer micro-cuvette recalibration adjustment confirmed on rerun',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const correctedResult = data.data || data;

      expect(correctedResult.correctedFromId).toBe(labResultId);
      expect(correctedResult.numericValue).toBe('6.6000');
      expect(correctedResult.status).toBe(LabResultStatus.PRELIMINARY);

      // Verify the original result is preserved as CORRECTED in database
      await withSuperAdminContext(async (db) => {
        const original = await db.query.labResults.findFirst({
          where: (r, { eq }) => eq(r.id, labResultId),
        });
        expect(original?.status).toBe(LabResultStatus.CORRECTED);
        expect(original?.correctionReason).toBeDefined();
      });
    });
  });

  // ==========================================
  // 7. DIAGNOSTIC REPORTS & CLINICIAN DELIVERY
  // ==========================================

  describe('7. Diagnostic Reports Compilation & Delivery', () => {
    it('should compile a diagnostic report linked to clinical encounter and results', async () => {
      const res = await fetch(`${baseUrl}/laboratory/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${labTechAToken}`,
        },
        body: JSON.stringify({
          orderId: labOrderId,
          encounterId: testEncounterAId,
          patientId: testPatientAId,
          title: 'Complete Hematology & Malaria Rapid Diagnostic Panel',
          conclusion: 'Severe microcytic anemia with active Plasmodium falciparum malaria infection',
          resultIds: [labResultId],
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const report = data.data || data;
      diagnosticReportId = report.id;

      expect(report.reportNumber).toMatch(/^REP-\d{6}-\d{5}$/);
      expect(report.status).toBe(DiagnosticReportStatus.PRELIMINARY);
    });

    it('should authorize diagnostic report and mark clinical order as completed', async () => {
      const res = await fetch(`${baseUrl}/laboratory/reports/${diagnosticReportId}/authorize`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          authorizationSignature: 'SIG-PATHOLOGIST-FINAL-SIGN-OFF-2026',
          conclusion: 'Severe anemia secondary to falciparum malaria. Immediate IV artesunate and blood transfusion recommended.',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const report = data.data || data;
      expect(report.status).toBe(DiagnosticReportStatus.FINAL);
      expect(report.authorizedAt).toBeDefined();

      // Verify clinical order status transitioned to COMPLETED
      await withSuperAdminContext(async (db) => {
        const order = await db.query.clinicalOrders.findFirst({
          where: (o, { eq }) => eq(o.id, labOrderId),
        });
        expect(order?.status).toBe('COMPLETED');
      });
    });

    it('should amend diagnostic report with clinical justification', async () => {
      const res = await fetch(`${baseUrl}/laboratory/reports/${diagnosticReportId}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          amendmentReason: 'Added peripheral blood film review showing prominent ring form trophozoites',
          conclusion: 'Severe falciparum malaria with high parasitemia (>5%) and severe anemia.',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const amended = data.data || data;
      expect(amended.status).toBe(DiagnosticReportStatus.AMENDED);
      expect(amended.amendmentReason).toContain('trophozoites');
    });
  });

  // ==========================================
  // 8. TURNAROUND-TIME & OPERATIONAL METRICS
  // ==========================================

  describe('8. Turnaround-Time & Operational Metrics', () => {
    it('should calculate turnaround times across milestones and return inventory alerts', async () => {
      const res = await fetch(`${baseUrl}/laboratory/metrics/operational`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const metrics = data.data || data;

      expect(metrics.specimensTotal).toBeGreaterThan(0);
      expect(metrics.reportsFinalized).toBeGreaterThanOrEqual(1);
      expect(metrics.tatAverages).toBeDefined();
      expect(metrics.abnormalDistribution).toBeDefined();
      expect(metrics.inventory).toBeDefined();
      expect(Array.isArray(metrics.inventory.lowStockAlerts)).toBe(true);
    });
  });

  // ==========================================
  // 9. FHIR R4 EXPORT VERIFICATION
  // ==========================================

  describe('9. FHIR R4 Mappings (Specimen, Observation, DiagnosticReport)', () => {
    it('should export Specimen conforming to KenyaCoreSpecimen profile', async () => {
      const res = await fetch(`${baseUrl}/laboratory/fhir/specimens/${collectedSpecimenId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const fhir = await res.json();
      const body = fhir.data || fhir;

      expect(body.resourceType).toBe('Specimen');
      expect(body.id).toBe(collectedSpecimenId);
      expect(body.identifier.length).toBeGreaterThanOrEqual(2);
      expect(body.subject.reference).toContain('Patient/');
      expect(body.collection.container[0].description).toBeDefined();
    });

    it('should export Observation conforming to KenyaCoreObservation profile', async () => {
      const res = await fetch(`${baseUrl}/laboratory/fhir/observations/${labResultId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const fhir = await res.json();
      const body = fhir.data || fhir;

      expect(body.resourceType).toBe('Observation');
      expect(body.code.coding[0].system).toBe('http://loinc.org');
      expect(body.valueQuantity).toBeDefined();
      expect(body.interpretation[0].coding[0].code).toBeDefined();
      expect(body.referenceRange[0].text).toContain('WHO');
    });

    it('should export DiagnosticReport conforming to KenyaCoreDiagnosticReport profile', async () => {
      const res = await fetch(`${baseUrl}/laboratory/fhir/diagnostic-reports/${diagnosticReportId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const fhir = await res.json();
      const body = fhir.data || fhir;

      expect(body.resourceType).toBe('DiagnosticReport');
      expect(body.category[0].coding[0].code).toBe('LAB');
      expect(body.status).toBeDefined();
      expect(body.subject.reference).toContain('Patient/');
      expect(body.encounter.reference).toContain('Encounter/');
    });
  });

  // ==========================================
  // 10. ROW-LEVEL SECURITY & CROSS-TENANT ISOLATION
  // ==========================================

  describe('10. Row-Level Security & Cross-Tenant Isolation', () => {
    it('should prevent Tenant B clinician from viewing Tenant A specimens or results', async () => {
      const res = await fetch(`${baseUrl}/laboratory/fhir/specimens/${collectedSpecimenId}`, {
        headers: {
          Authorization: `Bearer ${clinicianBToken}`, // Tenant B user
        },
      });

      // Tenant B cannot access Tenant A's specimen under engine RLS
      expect(res.status).toBe(404);
    });

    it('should prevent Tenant B clinician from authorizing Tenant A reports', async () => {
      const res = await fetch(`${baseUrl}/laboratory/reports/${diagnosticReportId}/authorize`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianBToken}`,
        },
        body: JSON.stringify({
          authorizationSignature: 'SIG-ILLEGAL-CROSS-TENANT',
        }),
      });

      expect(res.status).toBe(404);
    });
  });
});
