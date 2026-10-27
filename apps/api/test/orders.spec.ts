import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
  patients,
  encounters,
  diagnoses,
  clinicalOrders,
  medicationRequests,
  serviceRequests,
  auditEvents,
} from '@afyapoa/database';
import {
  CodingSystem,
  ClinicalOrderType,
  ClinicalOrderStatus,
  ClinicalOrderPriority,
  ClinicalOrderIntent,
  MedicationRoute,
  MedicationFrequency,
  MedicationDurationUnit,
  MedicationQuantityUnit,
  DiagnosisType,
  DiagnosisClinicalStatus,
  DiagnosisVerificationStatus,
  AuditEventType,
} from '@afyapoa/domain-core';
import { eq, and } from 'drizzle-orm';

describe('Clinical Terminology, Diagnoses & CPOE Ordering Integration Tests (Milestone 6)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityB1Id: string;

  let clinicianAToken: string;
  let adminAToken: string;
  let clinicianBToken: string;

  let testPatientAId: string;
  let testEncounterAId: string;
  let testPatientBId: string;
  let testEncounterBId: string;

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

    // 1. Fetch tenants & facilities from seed
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

      // Clean existing orders, diagnoses, encounters and patients for clean tests
      await db.delete(serviceRequests);
      await db.delete(medicationRequests);
      await db.delete(clinicalOrders);
      await db.delete(diagnoses);
      await db.delete(encounters);
      await db.delete(patients);
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

    // 4. Login Clinician B (dr.mary - Kibera Net)
    const loginClinicianB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.mary', password: 'Password123!' }),
    });
    const cBData = await loginClinicianB.json();
    clinicianBToken = cBData.data?.accessToken || cBData.accessToken;

    // 5. Create Test Patient & Encounter for Tenant A
    const patientResA = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityA1Id,
        firstName: 'Juma',
        lastName: 'Bakari',
        gender: 'MALE',
        dateOfBirth: '1988-06-12',
        phone: `+25470${Math.floor(1000000 + Math.random() * 9000000)}`,
      }),
    });
    const pDataA = await patientResA.json();
    testPatientAId = pDataA.data?.id || pDataA.id;
    expect(testPatientAId).toBeDefined();

    const encResA = await fetch(`${baseUrl}/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        patientId: testPatientAId,
        facilityId: facilityA1Id,
        encounterType: 'OUTPATIENT',
        serviceDepartment: 'GENERAL_OUTPATIENT',
        reasonForVisit: 'High fever and joint pain',
      }),
    });
    const encDataA = await encResA.json();
    testEncounterAId = encDataA.data?.id || encDataA.id;
    expect(testEncounterAId).toBeDefined();

    // 6. Create Test Patient & Encounter for Tenant B
    const patientResB = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianBToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityB1Id,
        firstName: 'Amina',
        lastName: 'Kariuki',
        gender: 'FEMALE',
        dateOfBirth: '1992-04-10',
        phone: `+25471${Math.floor(1000000 + Math.random() * 9000000)}`,
      }),
    });
    const pDataB = await patientResB.json();
    testPatientBId = pDataB.data?.id || pDataB.id;
    expect(testPatientBId).toBeDefined();

    const encResB = await fetch(`${baseUrl}/encounters`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianBToken}`,
      },
      body: JSON.stringify({
        patientId: testPatientBId,
        facilityId: facilityB1Id,
        encounterType: 'OUTPATIENT',
        serviceDepartment: 'GENERAL_OUTPATIENT',
        reasonForVisit: 'Routine consultation',
      }),
    });
    const encDataB = await encResB.json();
    testEncounterBId = encDataB.data?.id || encDataB.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ========================================================
  // 1. TERMINOLOGY CATALOGUES & VALIDATION
  // ========================================================

  describe('1. Standard Terminology Catalogues & Validation', () => {
    it('should list all auto-seeded Kenyan standard catalogues (ICD-11, ICD-10, LOINC, Kenya EML)', async () => {
      const res = await fetch(`${baseUrl}/terminology/catalogues`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const catalogues = json.data || json;
      expect(Array.isArray(catalogues)).toBe(true);
      expect(catalogues.length).toBeGreaterThanOrEqual(4);

      const systems = catalogues.map((c: any) => c.system);
      expect(systems).toContain('ICD_11_MMS');
      expect(systems).toContain('ICD_10');
      expect(systems).toContain('LOINC');
      expect(systems).toContain('KENYA_EML');
    });

    it('should autocomplete/search terminology concepts across systems', async () => {
      const res = await fetch(`${baseUrl}/terminology/search?query=malaria`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const items = json.data || json;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const foundICD11 = items.some(
        (i: any) => i.system === 'ICD_11_MMS' && i.code === '1F40.0',
      );
      expect(foundICD11).toBe(true);

      const foundLOINC = items.some(
        (i: any) => i.system === 'LOINC' && i.code === '58453-2',
      );
      expect(foundLOINC).toBe(true);
    });

    it('should validate authentic ICD-11 concept code (1F40.0)', async () => {
      const res = await fetch(`${baseUrl}/terminology/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          system: CodingSystem.ICD_11_MMS,
          code: '1F40.0',
        }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const concept = json.data || json;
      expect(concept.code).toBe('1F40.0');
      expect(concept.display).toBe('Plasmodium falciparum malaria');
    });

    it('should strictly reject invented or unauthorized terminology codes with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/terminology/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          system: CodingSystem.ICD_11_MMS,
          code: 'INVENTED-999-XYZ',
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('Invented or unverified codes are strictly prohibited');
    });

    it('should allow authorized administrator to import a new versioned catalogue', async () => {
      const res = await fetch(`${baseUrl}/terminology/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          system: CodingSystem.KENYA_MOH_LAB,
          version: '2026.1',
          name: 'Kenya MOH Fast-Track Point-of-Care Diagnostic Procedures',
          authority: 'National Public Health Laboratories (NPHL) Kenya',
          releaseDate: '2026-01-15',
          concepts: [
            {
              code: 'MOH-POC-RDT-01',
              display: 'Malaria Rapid Diagnostic Test (Pan/Pf RDT)',
              category: 'Rapid Diagnostics',
              effectiveStartDate: '2026-01-15',
            },
            {
              code: 'MOH-POC-GLUC-01',
              display: 'Random Blood Glucose Point-of-Care Strip',
              category: 'Rapid Diagnostics',
              effectiveStartDate: '2026-01-15',
            },
          ],
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      const result = json.data || json;
      expect(result.insertedCount + result.updatedCount).toBe(2);
      expect(result.totalConcepts).toBe(2);
      expect(result.status).toBe('SUCCESS');
    });
  });

  // ========================================================
  // 2. DIAGNOSIS ENTRY & LIFECYCLE MANAGEMENT
  // ========================================================

  describe('2. Encounter Diagnosis Entry & Verification', () => {
    let recordedDiagnosisId: string;

    it('should record an ICD-11 diagnosis for an active patient encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/diagnoses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          code: '1F40.0',
          codingSystem: CodingSystem.ICD_11_MMS,
          display: 'Plasmodium falciparum malaria',
          diagnosisType: DiagnosisType.WORKING,
          clinicalStatus: DiagnosisClinicalStatus.ACTIVE,
          verificationStatus: DiagnosisVerificationStatus.PROVISIONAL,
          isPrimary: true,
          notes: 'High fever, chills, diaphoresis. Suspected acute uncomplicated malaria.',
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const diag = json.data || json;
      expect(diag.id).toBeDefined();
      expect(diag.code).toBe('1F40.0');
      expect(diag.codingSystem).toBe('ICD_11_MMS');
      expect(diag.isPrimary).toBe(true);
      recordedDiagnosisId = diag.id;
    });

    it('should reject invented diagnosis code when creating encounter diagnosis', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/diagnoses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          code: 'FAKE-DIAG-0001',
          codingSystem: CodingSystem.ICD_11_MMS,
          display: 'Fabricated Disease Syndrome',
          diagnosisType: DiagnosisType.WORKING,
          isPrimary: false,
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('Invented or unverified codes are strictly prohibited');
    });

    it('should prevent duplicate active diagnosis of the same code on the encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/diagnoses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          code: '1F40.0',
          codingSystem: CodingSystem.ICD_11_MMS,
          display: 'Plasmodium falciparum malaria',
          diagnosisType: DiagnosisType.WORKING,
          isPrimary: true,
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('is already actively recorded on this encounter');
    });

    it('should list all diagnoses recorded for the encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/diagnoses`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const list = json.data || json;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].code).toBe('1F40.0');
    });

    it('should update clinical and verification status of a diagnosis', async () => {
      const res = await fetch(`${baseUrl}/diagnoses/${recordedDiagnosisId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          clinicalStatus: DiagnosisClinicalStatus.ACTIVE,
          verificationStatus: DiagnosisVerificationStatus.CONFIRMED,
          notes: 'Confirmed by positive blood slide microscopy.',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const updated = json.data || json;
      expect(updated.verificationStatus).toBe('CONFIRMED');
      expect(updated.notes).toContain('Confirmed by positive blood slide');
    });

    it('should export encounter diagnoses in Kenya Core FHIR R4 Condition format', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/diagnoses/fhir`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const conditions = json.data || json;
      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBeGreaterThanOrEqual(1);

      const fhirCond = conditions[0];
      expect(fhirCond.resourceType).toBe('Condition');
      expect(fhirCond.code.coding[0].system).toBe('http://id.who.int/icd/release/11/mms');
      expect(fhirCond.code.coding[0].code).toBe('1F40.0');
      expect(fhirCond.subject.reference).toContain('Patient/');
      expect(fhirCond.encounter.reference).toContain('Encounter/');
    });
  });

  // ========================================================
  // 3. CLINICAL ORDERS: MEDICATION & SERVICE REQUESTS
  // ========================================================

  describe('3. Clinical Order Creation, Tracking & Duplicate Safeguards', () => {
    let createdMedicationOrderId: string;
    let createdServiceOrderId: string;

    it('should create an authorized medication order with authentic Kenya EML code (P01BF01)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.MEDICATION_REQUEST,
          priority: ClinicalOrderPriority.URGENT,
          intent: ClinicalOrderIntent.ORDER,
          clinicalIndication: 'Uncomplicated falciparum malaria treatment',
          medication: {
            medicationCode: 'P01BF01',
            medicationName: 'Artemether + lumefantrine 20mg/120mg tablet',
            codingSystem: CodingSystem.KENYA_EML,
            dosage: '4',
            dosageUnit: 'tablets',
            route: MedicationRoute.ORAL,
            frequency: MedicationFrequency.BID,
            durationValue: 3,
            durationUnit: MedicationDurationUnit.DAYS,
            totalQuantity: 24,
            quantityUnit: MedicationQuantityUnit.TABLETS,
            instructions: 'Take 4 tablets BD with a fatty meal or milk for 3 days.',
            substitutionAllowed: true,
          },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.data || json;
      expect(order.id).toBeDefined();
      expect(order.orderNumber).toMatch(/^ORD-\d{6}-\d{4}$/);
      expect(order.orderType).toBe('MEDICATION_REQUEST');
      expect(order.status).toBe('ACTIVE');
      expect(order.detail).toBeDefined();
      expect(order.detail.medicationCode).toBe('P01BF01');
      createdMedicationOrderId = order.id;
    });

    it('should create a diagnostic laboratory service order with authentic LOINC code (58453-2)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.LAB_SERVICE_REQUEST,
          priority: ClinicalOrderPriority.STAT,
          intent: ClinicalOrderIntent.ORDER,
          clinicalIndication: 'Acute febrile illness; exclude malaria',
          service: {
            serviceCategory: 'LABORATORY',
            serviceCode: '58453-2',
            serviceName: 'Malaria smear in Blood by Light microscopy',
            codingSystem: CodingSystem.LOINC,
            specimenType: 'WHOLE_BLOOD',
            clinicalNotes: 'Thick and thin smears for parasite density estimation',
            urgency: ClinicalOrderPriority.STAT,
          },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.data || json;
      expect(order.id).toBeDefined();
      expect(order.orderType).toBe('LAB_SERVICE_REQUEST');
      expect(order.status).toBe('ACTIVE');
      expect(order.detail).toBeDefined();
      expect(order.detail.serviceCode).toBe('58453-2');
      createdServiceOrderId = order.id;
    });

    it('should reject invented medication code with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.MEDICATION_REQUEST,
          medication: {
            medicationCode: 'FAKE-MED-777',
            medicationName: 'Imaginary Antimalarial Compound',
            dosage: '1',
            dosageUnit: 'tablet',
            totalQuantity: 10,
          },
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('Invented or unverified codes are strictly prohibited');
    });

    it('should detect accidental duplicate order within 24 hours and return 409 Conflict', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.MEDICATION_REQUEST,
          medication: {
            medicationCode: 'P01BF01',
            medicationName: 'Artemether + lumefantrine 20mg/120mg tablet',
            dosage: '4',
            dosageUnit: 'tablets',
            totalQuantity: 24,
          },
        }),
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      const err = json.error || json;
      expect(err.message || err.details?.message).toContain('duplicate');
    });

    it('should permit clinician to override duplicate order warning with explicit clinical justification', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.MEDICATION_REQUEST,
          overrideDuplicateWarning: true,
          duplicateOverrideReason: 'Patient vomited previous oral dose within 15 minutes; repeated dose indicated.',
          medication: {
            medicationCode: 'P01BF01',
            medicationName: 'Artemether + lumefantrine 20mg/120mg tablet',
            dosage: '4',
            dosageUnit: 'tablets',
            totalQuantity: 24,
          },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      const order = json.data || json;
      expect(order.id).toBeDefined();
    });

    it('should reject overriding duplicate warning if justification is missing or under 10 chars', async () => {
      const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: ClinicalOrderType.MEDICATION_REQUEST,
          overrideDuplicateWarning: true,
          duplicateOverrideReason: 'repeat', // Under 10 chars
          medication: {
            medicationCode: 'P01BF01',
            medicationName: 'Artemether + lumefantrine 20mg/120mg tablet',
            dosage: '4',
            dosageUnit: 'tablets',
            totalQuantity: 24,
          },
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('minimum 10 characters');
    });
  });

  // ========================================================
  // 4. ORDER AUTHORIZATION, CANCELLATION & AMENDMENT
  // ========================================================

  describe('4. Order Lifecycle: Review, Authorization, Cancellation & Amendment', () => {
    let orderToAuthorizeId: string;
    let orderToCancelId: string;
    let orderToAmendId: string;

    beforeAll(async () => {
      // Create 3 orders for lifecycle transitions
      const createOrder = async (indication: string) => {
        const res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clinicianAToken}`,
          },
          body: JSON.stringify({
            patientId: testPatientAId,
            orderType: ClinicalOrderType.MEDICATION_REQUEST,
            overrideDuplicateWarning: true,
            duplicateOverrideReason: 'Dedicated test order for lifecycle test suite.',
            clinicalIndication: indication,
            medication: {
              medicationCode: 'N02BE01',
              medicationName: 'Paracetamol 500mg tablet',
              codingSystem: CodingSystem.KENYA_EML,
              dosage: '1000',
              dosageUnit: 'mg',
              route: MedicationRoute.ORAL,
              frequency: MedicationFrequency.TID,
              totalQuantity: 20,
            },
          }),
        });
        const json = await res.json();
        return (json.data || json).id;
      };

      orderToAuthorizeId = await createOrder('Order for authorization');
      orderToCancelId = await createOrder('Order for cancellation');
      orderToAmendId = await createOrder('Order for amendment');
    });

    it('should review and authorize an order by a licensed clinician', async () => {
      const res = await fetch(`${baseUrl}/orders/${orderToAuthorizeId}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          notes: 'Reviewed contraindications and liver function; approved.',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const updated = json.data || json;
      expect(updated.status).toBe('AUTHORIZED');
      expect(updated.authorizedById).toBeDefined();
    });

    it('should reject cancelling an order without adequate clinical justification (< 10 chars)', async () => {
      const res = await fetch(`${baseUrl}/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'error',
        }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error?.message || json.message).toContain('at least 10 characters');
    });

    it('should cancel an active order with a valid clinical reason', async () => {
      const res = await fetch(`${baseUrl}/orders/${orderToCancelId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient reported pre-existing hypersensitivity to paracetamol; stopped immediately.',
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const cancelled = json.data || json;
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancellationReason).toContain('hypersensitivity to paracetamol');
      expect(cancelled.cancelledById).toBeDefined();
    });

    it('should amend an order: marks original as AMENDED and generates superseding order', async () => {
      const res = await fetch(`${baseUrl}/orders/${orderToAmendId}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          amendmentReason: 'Reduce dosage from 1000mg TID to 500mg BID due to mild hepatic transaminase elevation.',
          newOrder: {
            patientId: testPatientAId,
            orderType: ClinicalOrderType.MEDICATION_REQUEST,
            priority: ClinicalOrderPriority.ROUTINE,
            clinicalIndication: 'Analgesia with dose reduction',
            medication: {
              medicationCode: 'N02BE01',
              medicationName: 'Paracetamol 500mg tablet',
              dosage: '500',
              dosageUnit: 'mg',
              route: MedicationRoute.ORAL,
              frequency: MedicationFrequency.BID,
              totalQuantity: 10,
            },
          },
        }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      const result = json.data || json;
      expect(result.originalOrderId).toBe(orderToAmendId);
      expect(result.supersedingOrder).toBeDefined();
      expect(result.supersedingOrder.status).toBe('ACTIVE');

      // Verify original order in DB is now AMENDED
      const originalRes = await fetch(`${baseUrl}/orders/${orderToAmendId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const origData = await originalRes.json();
      expect(origData.data?.status || origData.status).toBe('AMENDED');
    });
  });

  // ========================================================
  // 5. FHIR R4 SERIALIZATION & EXPORT
  // ========================================================

  describe('5. FHIR R4 Serialization & Integration', () => {
    it('should export a medication order as Kenya Core FHIR MedicationRequest', async () => {
      // Find one active medication order
      const listRes = await fetch(`${baseUrl}/orders?patientId=${testPatientAId}&orderType=MEDICATION_REQUEST`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const listData = await listRes.json();
      const orders = Array.isArray(listData.data) ? listData.data : (listData.data?.items || listData.items || []);
      expect(orders.length).toBeGreaterThan(0);
      const medOrderId = orders[0].id;

      const fhirRes = await fetch(`${baseUrl}/orders/${medOrderId}/fhir`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(fhirRes.status).toBe(200);
      const json = await fhirRes.json();
      const fhir = json.data || json;
      expect(fhir.resourceType).toBe('MedicationRequest');
      expect(fhir.id).toBe(medOrderId);
      expect(fhir.medicationCodeableConcept.coding[0].system).toBe('http://keml.health.go.ke');
      expect(fhir.subject.reference).toContain('Patient/');
      expect(fhir.dosageInstruction).toBeDefined();
      expect(fhir.dispenseRequest).toBeDefined();
    });

    it('should export a lab order as Kenya Core FHIR ServiceRequest', async () => {
      const listRes = await fetch(`${baseUrl}/orders?patientId=${testPatientAId}&orderType=LAB_SERVICE_REQUEST`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const listData = await listRes.json();
      const orders = Array.isArray(listData.data) ? listData.data : (listData.data?.items || listData.items || []);
      expect(orders.length).toBeGreaterThan(0);
      const labOrderId = orders[0].id;

      const fhirRes = await fetch(`${baseUrl}/orders/${labOrderId}/fhir`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(fhirRes.status).toBe(200);
      const json = await fhirRes.json();
      const fhir = json.data || json;
      expect(fhir.resourceType).toBe('ServiceRequest');
      expect(fhir.id).toBe(labOrderId);
      expect(fhir.code.coding[0].system).toBe('http://loinc.org');
      expect(fhir.code.coding[0].code).toBe('58453-2');
      expect(fhir.category[0].coding[0].code).toBe('laboratory');
      expect(fhir.subject.reference).toContain('Patient/');
    });
  });

  // ========================================================
  // 6. MULTI-TENANCY RLS & AUDIT TRAIL VERIFICATION
  // ========================================================

  describe('6. Multi-Tenancy RLS & Audit Verification', () => {
    it('should strictly isolate orders between tenants (Tenant B cannot access Tenant A order)', async () => {
      // Find an order from Tenant A
      const listRes = await fetch(`${baseUrl}/orders?patientId=${testPatientAId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const listData = await listRes.json();
      const orders = Array.isArray(listData.data) ? listData.data : (listData.data?.items || listData.items || []);
      expect(orders.length).toBeGreaterThan(0);
      const tenantAOrderId = orders[0].id;

      // Clinician B (Tenant B) attempts to read Tenant A order
      const crossReadRes = await fetch(`${baseUrl}/orders/${tenantAOrderId}`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });
      expect(crossReadRes.status).toBe(404);

      // Clinician B attempts to cancel Tenant A order
      const crossCancelRes = await fetch(`${baseUrl}/orders/${tenantAOrderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianBToken}`,
        },
        body: JSON.stringify({
          reason: 'Unauthorized cross-tenant cancellation attempt.',
        }),
      });
      expect(crossCancelRes.status).toBe(404);
    });

    it('should verify audit events exist for diagnosis recording, order creation, and cancellation', async () => {
      await withTenantContext(tenantAId, async (db) => {
        const events = await db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.tenantId, tenantAId));

        const actions = events.map((e) => e.action);
        expect(actions).toContain(AuditEventType.DIAGNOSIS_RECORDED);
        expect(actions).toContain(AuditEventType.CLINICAL_ORDER_CREATED);
        expect(actions).toContain(AuditEventType.CLINICAL_ORDER_AUTHORIZED);
        expect(actions).toContain(AuditEventType.CLINICAL_ORDER_CANCELLED);
        expect(actions).toContain(AuditEventType.CLINICAL_ORDER_AMENDED);
        expect(actions).toContain(AuditEventType.DUPLICATE_ORDER_OVERRIDDEN);
      });
    });
  });
});
