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
  medicationRequests,
  pharmacyProducts,
  pharmacySuppliers,
  pharmacyBatches,
  pharmacyStockMovements,
  medicationDispenses,
  medicationDispenseItems,
  medicationAdministrations,
} from '@afyapoa/database';
import {
  BatchStatus,
  StockMovementType,
  MedicationDispenseStatus,
  DispenseType,
} from '@afyapoa/domain-core';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

describe('Pharmacy & Medication-Dispensing Module Integration Tests (Milestone 8)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityA2Id: string;
  let facilityB1Id: string;

  let clinicianAToken: string;
  let adminAToken: string;
  let pharmacistAToken: string;
  let nurseAToken: string;
  let clinicianBToken: string;

  let testPatientAId: string;
  let testEncounterAId: string;

  let amoxicillinProductId: string;
  let coartemProductId: string;
  let kemsaSupplierId: string;

  let batchEarlyId: string;
  let batchLateId: string;

  let testOrderId: string;
  let testMedRequestId: string;
  let testDispenseId: string;

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

      let fA2 = facs.find((f) => f.tenantId === tenantAId && f.id !== fA1.id);
      if (!fA2) {
        const [newF] = await db
          .insert(facilities)
          .values({
            tenantId: tenantAId,
            facilityCode: 'FAC-NMHG-SUB',
            name: 'NMHG Sub-Store B',
            facilityType: 'HOSPITAL',
            regulatoryLevel: 'LEVEL_4',
            county: 'Nairobi',
            subCounty: 'Westlands',
            ownershipType: 'PRIVATE',
            isActive: true,
          })
          .returning();
        fA2 = newF;
      }
      facilityA2Id = fA2.id;

      // Ensure all existing users in Tenant A have primaryFacilityId set to facilityA1Id
      await db
        .update(users)
        .set({ primaryFacilityId: facilityA1Id })
        .where(eq(users.tenantId, tenantAId));

      // Clean existing pharmacy and order test tables for a clean test run
      await db.delete(medicationAdministrations);
      await db.delete(medicationDispenseItems);
      await db.delete(medicationDispenses);
      await db.delete(pharmacyStockMovements);
      await db.delete(pharmacyBatches);
      await db.delete(medicationRequests);
      await db.delete(clinicalOrders);
      await db.delete(encounters);
      await db.delete(patients);

      // Ensure Pharmacist user exists in Tenant A
      const existingPharmacist = await db.query.users.findFirst({
        where: (u, { eq, and }) => and(eq(u.tenantId, tenantAId), eq(u.username, 'pharm.njeri')),
      });

      const passwordHash = await bcrypt.hash('Password123!', 10);

      if (!existingPharmacist) {
        await db.insert(users).values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          username: 'pharm.njeri',
          email: 'njeri@nmhg.demo.afyapoa.co.ke',
          fullName: 'Faith Njeri (Lead Pharmacist)',
          role: 'PHARMACIST',
          passwordHash,
          status: 'ACTIVE',
        });
      }

      // Ensure Nurse user exists in Tenant A
      const existingNurse = await db.query.users.findFirst({
        where: (u, { eq, and }) => and(eq(u.tenantId, tenantAId), eq(u.username, 'nurse.chebet')),
      });

      if (!existingNurse) {
        await db.insert(users).values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          username: 'nurse.chebet',
          email: 'chebet@nmhg.demo.afyapoa.co.ke',
          fullName: 'Mercy Chebet (Ward Nurse)',
          role: 'TRIAGE_NURSE',
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

    // 4. Login Pharmacist A (pharm.njeri)
    const loginPharm = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'pharm.njeri', password: 'Password123!' }),
    });
    const pharmData = await loginPharm.json();
    pharmacistAToken = pharmData.data?.accessToken || pharmData.accessToken;

    // 5. Login Nurse A (nurse.chebet)
    const loginNurse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nurse.chebet', password: 'Password123!' }),
    });
    const nurseData = await loginNurse.json();
    nurseAToken = nurseData.data?.accessToken || nurseData.accessToken;

    // 6. Login Clinician B (dr.mary) in Tenant B
    const loginClinicianB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.mary', password: 'Password123!' }),
    });
    const cBData = await loginClinicianB.json();
    clinicianBToken = cBData.data?.accessToken || cBData.accessToken;

    // 7. Create a patient and encounter in Tenant A for prescribing tests
    const patientRes = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityA1Id,
        firstName: 'Juma',
        lastName: 'Bakari',
        dateOfBirth: '1988-06-14',
        gender: 'MALE',
        phone: `+25470${Math.floor(1000000 + Math.random() * 9000000)}`,
      }),
    });
    const pData = await patientRes.json();
    testPatientAId = pData.data?.id || pData.id;

    const encRes = await fetch(`${baseUrl}/encounters`, {
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
        reasonForVisit: 'High fever and respiratory symptoms',
      }),
    });
    const eData = await encRes.json();
    testEncounterAId = eData.data?.id || eData.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==========================================
  // SUITE 1: CATALOGUE MANAGEMENT & SEEDING
  // ==========================================
  describe('1. Medicine & Medical-Product Catalogue Management', () => {
    it('1.1 should seed standard Kenya Essential Medicines List (KEML 2023) and suppliers', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/catalogue/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.seededProducts).toBeGreaterThanOrEqual(10);
      expect(body.data.seededSuppliers).toBeGreaterThanOrEqual(4);
    });

    it('1.2 should retrieve seeded products with search and category filters', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/products?search=Amoxicillin`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);

      const amox = body.data.find((p: any) => p.itemCode === 'MED-AMX-500');
      expect(amox).toBeDefined();
      expect(amox.genericName).toBe('Amoxicillin');
      expect(amox.drugSchedule).toBe('PART_1_POISON');
      expect(amox.category).toBe('ORAL_SOLID');
      expect(amox.form).toBe('Capsule');
      expect(amox.strength).toBe('500');
      expect(amox.strengthUnit).toBe('mg');

      amoxicillinProductId = amox.id;

      // Also grab Coartem
      const coartemRes = await fetch(`${baseUrl}/pharmacy/products?search=Coartem`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const cBody = await coartemRes.json();
      coartemProductId = cBody.data[0].id;
    });

    it('1.3 should list authorized pharmaceutical suppliers', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/suppliers`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);

      const kemsa = body.data.find((s: any) => s.supplierCode === 'SUP-KEMSA');
      expect(kemsa).toBeDefined();
      expect(kemsa.ppbLicenseNumber).toBe('PPB/PREM/PUB-001');
      expect(kemsa.kraPin).toBe('P051123456K');

      kemsaSupplierId = kemsa.id;
    });

    it('1.4 should create and update a custom medical product', async () => {
      const createRes = await fetch(`${baseUrl}/pharmacy/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          itemCode: `MED-IBU-${Date.now()}`,
          genericName: 'Ibuprofen',
          brandName: 'Brufen',
          atcCode: 'M01AE01',
          drugSchedule: 'PART_2_POISON',
          category: 'ORAL_SOLID',
          form: 'Film-coated Tablet',
          strength: '400',
          strengthUnit: 'mg',
          dispensingUnit: 'TABLET',
          packagingUnit: 'BLISTER_PACK',
          packagingSize: 100,
          storageCondition: 'ROOM_TEMPERATURE',
          unitPrice: 6.5,
          reorderLevel: 100,
        }),
      });

      expect(createRes.status).toBe(201);
      const createBody = await createRes.json();
      const customId = createBody.data.id;
      expect(createBody.data.genericName).toBe('Ibuprofen');

      const updateRes = await fetch(`${baseUrl}/pharmacy/products/${customId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          unitPrice: 7.0,
          reorderLevel: 120,
        }),
      });

      expect(updateRes.status).toBe(200);
      const updateBody = await updateRes.json();
      expect(Number(updateBody.data.unitPrice)).toBe(7.0);
      expect(updateBody.data.reorderLevel).toBe(120);
    });
  });

  // ==========================================
  // SUITE 2: STOCK RECEIPTS & BATCH TRACKING
  // ==========================================
  describe('2. Stock Receipts & Batch Expiry Tracking', () => {
    it('2.1 should receive stock from supplier creating an active batch and explicit movement record', async () => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years in future

      const res = await fetch(`${baseUrl}/pharmacy/inventory/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          productId: amoxicillinProductId,
          batchNumber: 'BATCH-AMX-LATE',
          manufacturer: 'Cosmos Pharma Kenya',
          expiryDate: expiryDate.toISOString(),
          quantityReceived: 500,
          unitCost: 8.5,
          sellingPrice: 12.0,
          supplierId: kemsaSupplierId,
          storageBin: 'BIN-A-01',
          notes: 'Standard KEMSA shipment delivery',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.quantityReceived).toBe(500);
      expect(body.data.quantityOnHand).toBe(500);

      batchLateId = body.data.batchId;

      // Verify explicit stock-movement record in ledger
      const movRes = await fetch(`${baseUrl}/pharmacy/movements?productId=${amoxicillinProductId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const movBody = await movRes.json();
      expect(movBody.success).toBe(true);
      expect(movBody.data.length).toBeGreaterThan(0);

      const receiptMovement = movBody.data.find(
        (m: any) => m.movement.movementType === 'RECEIPT' && m.movement.batchId === batchLateId,
      );
      expect(receiptMovement).toBeDefined();
      expect(receiptMovement.movement.quantity).toBe(500);
      expect(receiptMovement.movement.quantityBefore).toBe(0);
      expect(receiptMovement.movement.quantityAfter).toBe(500);
    });

    it('2.2 should receive an earlier expiring batch of the same product to test FEFO ordering', async () => {
      const earlyExpiry = new Date();
      earlyExpiry.setDate(earlyExpiry.getDate() + 45); // Expires in 45 days

      const res = await fetch(`${baseUrl}/pharmacy/inventory/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          productId: amoxicillinProductId,
          batchNumber: 'BATCH-AMX-EARLY',
          manufacturer: 'Universal Corporation Ltd',
          expiryDate: earlyExpiry.toISOString(),
          quantityReceived: 100,
          unitCost: 8.0,
          sellingPrice: 12.0,
          supplierId: kemsaSupplierId,
          storageBin: 'BIN-A-02',
          notes: 'Buffer stock',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      batchEarlyId = body.data.batchId;
      expect(body.data.quantityOnHand).toBe(100);

      // Verify batches are ordered by earliest expiry first
      const batchesRes = await fetch(`${baseUrl}/pharmacy/batches?productId=${amoxicillinProductId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const bBody = await batchesRes.json();
      expect(bBody.data.length).toBe(2);
      expect(bBody.data[0].batch.id).toBe(batchEarlyId); // Earlier batch is first!
      expect(bBody.data[1].batch.id).toBe(batchLateId);
    });
  });

  // ==========================================
  // SUITE 3: PRESCRIPTION WORKLISTS & FEFO DISPENSING
  // ==========================================
  describe('3. Prescription Worklist & FEFO Dispensing Workflows', () => {
    it('3.1 should create clinical medication prescription and appear on pharmacy worklist', async () => {
      // Clinician creates medication order
      const orderRes = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'MEDICATION_REQUEST',
          priority: 'ROUTINE',
          intent: 'ORDER',
          clinicalIndication: 'Acute respiratory bacterial infection',
          medication: {
            medicationCode: 'J01CA04',
            medicationName: 'Amoxicillin 500mg capsule',
            codingSystem: 'KENYA_EML',
            dosage: '500',
            dosageUnit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
            durationValue: 5,
            durationUnit: 'DAYS',
            totalQuantity: 15,
            quantityUnit: 'CAPSULES',
            instructions: 'Take 1 capsule 3 times daily after meals for 5 days',
            substitutionAllowed: true,
          },
        }),
      });

      expect(orderRes.status).toBe(201);
      const oData = await orderRes.json();
      const order = oData.data || oData;
      testOrderId = order.id;
      testMedRequestId = order.detail?.id;

      // Pharmacy queries worklist
      const worklistRes = await fetch(`${baseUrl}/pharmacy/prescriptions/worklist`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      expect(worklistRes.status).toBe(200);
      const wData = await worklistRes.json();

      const item = wData.data.find((w: any) => w.medicationRequestId === testMedRequestId);
      expect(item).toBeDefined();
      expect(item.medicationName).toContain('Amoxicillin');
      expect(item.quantityPrescribed).toBe(15);
      expect(item.quantityDispensed).toBe(0);
      expect(item.quantityRemaining).toBe(15);
      expect(item.fulfillmentStatus).toBe('PENDING');
    });

    it('3.2 should automatically allocate earliest-expiring batch (FEFO) when batchId is omitted', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          orderId: testOrderId,
          medicationRequestId: testMedRequestId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 15, // Dispense full prescribed quantity
          patientCounselingNotes: 'Explained to complete full 5-day course even if symptoms improve',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);

      const dispense = body.data.dispense;
      expect(dispense.dispenseType).toBe('FULL');
      expect(dispense.quantityDispensed).toBe(15);
      expect(dispense.quantityRemaining).toBe(0);
      expect(dispense.status).toBe('COMPLETED');
      testDispenseId = dispense.id;

      // CRITICAL FEFO CHECK: Must have deducted from BATCH-AMX-EARLY (earliest expiry)!
      const items = body.data.items;
      expect(items.length).toBe(1);
      expect(items[0].batchId).toBe(batchEarlyId);
      expect(items[0].quantityDispensed).toBe(15);

      // Verify stock deduction on early batch: 100 - 15 = 85
      const earlyBatchRes = await fetch(`${baseUrl}/pharmacy/batches/${batchEarlyId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const earlyBatchData = await earlyBatchRes.json();
      expect(earlyBatchData.data.quantityOnHand).toBe(85);

      // Verify late batch remains untouched at 500
      const lateBatchRes = await fetch(`${baseUrl}/pharmacy/batches/${batchLateId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const lateBatchData = await lateBatchRes.json();
      expect(lateBatchData.data.quantityOnHand).toBe(500);

      // Verify explicit DISPENSATION movement in audit ledger
      const movRes = await fetch(`${baseUrl}/pharmacy/movements?batchId=${batchEarlyId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const movData = await movRes.json();
      const dispMov = movData.data.find((m: any) => m.movement.referenceId === testDispenseId);
      expect(dispMov).toBeDefined();
      expect(dispMov.movement.quantity).toBe(-15);
      expect(dispMov.movement.quantityBefore).toBe(100);
      expect(dispMov.movement.quantityAfter).toBe(85);
    });

    it('3.3 should reject duplicate dispensing attempt when prescription is already fulfilled', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          orderId: testOrderId,
          medicationRequestId: testMedRequestId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 5,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('already fully dispensed');
    });
  });

  // ==========================================
  // SUITE 4: PARTIAL DISPENSING & BALANCE COMPLETION
  // ==========================================
  describe('4. Partial Dispensing & Balance Completion Workflows', () => {
    let partialOrderId: string;
    let partialMedReqId: string;
    let coartemBatchId: string;

    it('4.1 should support partial dispensing when patient requests or stock is divided', async () => {
      // 1. Receive stock for Coartem
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);

      const recRes = await fetch(`${baseUrl}/pharmacy/inventory/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          productId: coartemProductId,
          batchNumber: 'BATCH-AL-001',
          expiryDate: expiry.toISOString(),
          quantityReceived: 48,
          unitCost: 10.0,
          sellingPrice: 15.0,
        }),
      });
      const recData = await recRes.json();
      coartemBatchId = recData.data.batchId;

      // 2. Clinician prescribes 24 tablets of Coartem
      const orderRes = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'MEDICATION_REQUEST',
          priority: 'ROUTINE',
          intent: 'ORDER',
          clinicalIndication: 'Uncomplicated malaria',
          medication: {
            medicationCode: 'P01BF01',
            medicationName: 'Artemether + Lumefantrine',
            codingSystem: 'KENYA_EML',
            dosage: '20/120',
            dosageUnit: 'mg',
            route: 'ORAL',
            frequency: 'BD',
            durationValue: 3,
            durationUnit: 'DAYS',
            totalQuantity: 24,
            quantityUnit: 'TABLETS',
            instructions: '4 tablets stat, then 4 at 8h, then 4 BD for 2 days',
            substitutionAllowed: false,
          },
        }),
      });
      const oData = await orderRes.json();
      const order = oData.data || oData;
      partialOrderId = order.id;
      partialMedReqId = order.detail?.id;

      // 3. Dispense partial quantity: 12 tablets (half dose for today)
      const partDispRes = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          orderId: partialOrderId,
          medicationRequestId: partialMedReqId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 12,
          notes: 'Patient collected first 12 tablets, balance of 12 tomorrow',
        }),
      });

      expect(partDispRes.status).toBe(201);
      const partBody = await partDispRes.json();
      expect(partBody.data.dispense.dispenseType).toBe('PARTIAL');
      expect(partBody.data.dispense.quantityDispensed).toBe(12);
      expect(partBody.data.dispense.quantityRemaining).toBe(12);

      // Verify worklist shows PARTIALLY_DISPENSED
      const wlRes = await fetch(`${baseUrl}/pharmacy/prescriptions/worklist`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const wlData = await wlRes.json();
      const wlItem = wlData.data.find((w: any) => w.medicationRequestId === partialMedReqId);
      expect(wlItem.fulfillmentStatus).toBe('PARTIALLY_DISPENSED');
      expect(wlItem.quantityRemaining).toBe(12);
    });

    it('4.2 should complete the remaining balance as BALANCE_COMPLETION', async () => {
      const balanceRes = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          orderId: partialOrderId,
          medicationRequestId: partialMedReqId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 12, // Remaining balance
        }),
      });

      expect(balanceRes.status).toBe(201);
      const balBody = await balanceRes.json();
      expect(balBody.data.dispense.dispenseType).toBe('BALANCE_COMPLETION');
      expect(balBody.data.dispense.quantityRemaining).toBe(0);

      // Batch inventory: 48 - 12 - 12 = 24
      const batchRes = await fetch(`${baseUrl}/pharmacy/batches/${coartemBatchId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const bData = await batchRes.json();
      expect(bData.data.quantityOnHand).toBe(24);
    });
  });

  // ==========================================
  // SUITE 5: CONCURRENCY CONTROLS & NEGATIVE STOCK
  // ==========================================
  describe('5. Database Transactions & Concurrency Controls', () => {
    it('5.1 should prevent negative stock and race conditions during simultaneous concurrent requests', async () => {
      // 1. Create a limited batch with only 10 units
      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);

      const recRes = await fetch(`${baseUrl}/pharmacy/inventory/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          productId: amoxicillinProductId,
          batchNumber: 'BATCH-CONCURRENCY-TEST',
          expiryDate: expiry.toISOString(),
          quantityReceived: 10, // Exactly 10 units
          unitCost: 8.0,
          sellingPrice: 12.0,
        }),
      });
      const recData = await recRes.json();
      const concBatchId = recData.data.batchId;

      // 2. Create two distinct prescription orders for 8 units each
      const order1Res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinicianAToken}` },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'MEDICATION_REQUEST',
          priority: 'ROUTINE',
          intent: 'ORDER',
          overrideDuplicateWarning: true,
          duplicateOverrideReason: 'Acute concurrency testing course 1',
          medication: {
            medicationCode: 'J01CA04',
            medicationName: 'Amoxicillin 500mg capsule',
            codingSystem: 'KENYA_EML',
            dosage: '500',
            dosageUnit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
            durationValue: 2,
            durationUnit: 'DAYS',
            totalQuantity: 8,
            quantityUnit: 'CAPSULES',
            instructions: 'Take 1 capsule TID',
          },
        }),
      });
      const o1Data = await order1Res.json();
      const order1 = o1Data.data || o1Data;

      const order2Res = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinicianAToken}` },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'MEDICATION_REQUEST',
          priority: 'ROUTINE',
          intent: 'ORDER',
          overrideDuplicateWarning: true,
          duplicateOverrideReason: 'Acute concurrency testing course 2',
          medication: {
            medicationCode: 'J01CA04',
            medicationName: 'Amoxicillin 500mg capsule',
            codingSystem: 'KENYA_EML',
            dosage: '500',
            dosageUnit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
            durationValue: 2,
            durationUnit: 'DAYS',
            totalQuantity: 8,
            quantityUnit: 'CAPSULES',
            instructions: 'Take 1 capsule TID',
          },
        }),
      });
      const o2Data = await order2Res.json();
      const order2 = o2Data.data || o2Data;

      // 3. Fire TWO concurrent dispensing requests for 8 units from this 10-unit batch simultaneously
      const [res1, res2] = await Promise.all([
        fetch(`${baseUrl}/pharmacy/dispense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmacistAToken}` },
          body: JSON.stringify({
            orderId: order1.id,
            medicationRequestId: order1.detail?.id,
            patientId: testPatientAId,
            encounterId: testEncounterAId,
            quantityToDispense: 8,
            batchId: concBatchId,
          }),
        }),
        fetch(`${baseUrl}/pharmacy/dispense`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmacistAToken}` },
          body: JSON.stringify({
            orderId: order2.id,
            medicationRequestId: order2.detail?.id,
            patientId: testPatientAId,
            encounterId: testEncounterAId,
            quantityToDispense: 8,
            batchId: concBatchId,
          }),
        }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly ONE must succeed (201) and ONE must fail with 400 (insufficient stock)
      expect(statuses).toEqual([201, 400]);

      // Verify batch inventory in database is strictly 10 - 8 = 2 (NEVER negative!)
      const batchCheck = await fetch(`${baseUrl}/pharmacy/batches/${concBatchId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const bData = await batchCheck.json();
      expect(bData.data.quantityOnHand).toBe(2);
    });

    it('5.2 should reject dispensing on a cancelled clinical order', async () => {
      // 1. Create order
      const orderRes = await fetch(`${baseUrl}/encounters/${testEncounterAId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinicianAToken}` },
        body: JSON.stringify({
          patientId: testPatientAId,
          orderType: 'MEDICATION_REQUEST',
          priority: 'ROUTINE',
          intent: 'ORDER',
          overrideDuplicateWarning: true,
          duplicateOverrideReason: 'Cancellation test course',
          medication: {
            medicationCode: 'J01CA04',
            medicationName: 'Amoxicillin 500mg capsule',
            codingSystem: 'KENYA_EML',
            dosage: '500',
            dosageUnit: 'mg',
            route: 'ORAL',
            frequency: 'TID',
            durationValue: 1,
            durationUnit: 'DAYS',
            totalQuantity: 3,
            quantityUnit: 'CAPSULES',
            instructions: 'Take 1 capsule TID',
          },
        }),
      });
      const oData = await orderRes.json();
      const order = oData.data || oData;
      const cancelOrderId = order.id;
      const cancelMedReqId = order.detail?.id;

      // 2. Clinician cancels the order
      await fetch(`${baseUrl}/orders/${cancelOrderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${clinicianAToken}` },
        body: JSON.stringify({ reason: 'Clinical contraindication identified on review' }),
      });

      // 3. Pharmacist attempts to dispense cancelled order
      const dispRes = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmacistAToken}` },
        body: JSON.stringify({
          orderId: cancelOrderId,
          medicationRequestId: cancelMedReqId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 3,
        }),
      });

      expect(dispRes.status).toBe(400);
      const dispBody = await dispRes.json();
      expect(dispBody.error.message).toContain('cancelled clinical order');
    });
  });

  // ==========================================
  // SUITE 6: CONTROLLED RETURNS & REVERSALS
  // ==========================================
  describe('6. Returns, Reversals, and Controlled Corrections', () => {
    it('6.1 should require a justification of at least 10 characters to reverse a dispense', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/dispense/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          dispenseId: testDispenseId,
          reason: 'Wrong', // Too short (<10 chars)
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('at least 10 characters');
    });

    it('6.2 should successfully reverse a dispense, restore batch stock, and record RETURN_TO_STOCK in ledger', async () => {
      // Check stock before reversal on early batch (was 85)
      const beforeRes = await fetch(`${baseUrl}/pharmacy/batches/${batchEarlyId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const beforeData = await beforeRes.json();
      const stockBefore = beforeData.data.quantityOnHand;

      const res = await fetch(`${baseUrl}/pharmacy/dispense/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          dispenseId: testDispenseId,
          reason: 'Patient experienced hypersensitivity prior to leaving dispensary counter; returned intact box',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.dispense.status).toBe('ENTERED_IN_ERROR');

      // Check stock restored on early batch: 85 + 15 = 100
      const afterRes = await fetch(`${baseUrl}/pharmacy/batches/${batchEarlyId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const afterData = await afterRes.json();
      expect(afterData.data.quantityOnHand).toBe(stockBefore + 15);

      // Verify RETURN_TO_STOCK movement in ledger
      const movRes = await fetch(`${baseUrl}/pharmacy/movements?batchId=${batchEarlyId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });
      const movData = await movRes.json();
      const returnMov = movData.data.find(
        (m: any) => m.movement.movementType === 'RETURN_TO_STOCK' && m.movement.referenceId === testDispenseId,
      );
      expect(returnMov).toBeDefined();
      expect(returnMov.movement.quantity).toBe(15); // Positive addition
    });
  });

  // ==========================================
  // SUITE 7: STOCK TRANSFERS & RECONCILIATION
  // ==========================================
  describe('7. Stock Transfers & Controlled Reconciliation Adjustments', () => {
    it('7.1 should transfer stock to another facility and record dual ledger movements', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/inventory/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          batchId: batchLateId, // Has 500 units
          quantity: 50,
          destinationFacilityId: facilityA2Id,
          reason: 'Stock replenishment for Sub-Store B',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.sourceQuantityRemaining).toBe(450);
    });

    it('7.2 should record controlled adjustment for damaged units with audit reason', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          batchId: batchLateId,
          movementType: 'ADJUSTMENT_DAMAGE',
          quantityDelta: -5, // 5 units damaged
          reason: 'Blister pack crushed during routine stock inspection',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.quantityBefore).toBe(450);
      expect(body.data.quantityAfter).toBe(445);
    });

    it('7.3 should reject adjustment that causes negative stock', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/inventory/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          batchId: batchLateId,
          movementType: 'ADJUSTMENT_DAMAGE',
          quantityDelta: -1000, // Exceeds on hand
          reason: 'Massive water leakage in main store damaged entire rack',
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toContain('negative stock');
    });
  });

  // ==========================================
  // SUITE 8: MEDICATION ADMINISTRATION
  // ==========================================
  describe('8. Medication Administration (Bedside / Clinic)', () => {
    let adminRecordId: string;

    it('8.1 should record medication administration event by nurse at bedside', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/administration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          medicationRequestId: testMedRequestId,
          encounterId: testEncounterAId,
          patientId: testPatientAId,
          doseQuantity: 500,
          doseUnit: 'mg',
          route: 'ORAL',
          site: 'Mouth',
          notes: 'Administered with water; patient tolerated well without nausea',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('COMPLETED');
      expect(Number(body.data.doseQuantity)).toBe(500);

      adminRecordId = body.data.id;
    });

    it('8.2 should list administration history for encounter', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/administrations?encounterId=${testEncounterAId}`, {
        headers: { Authorization: `Bearer ${nurseAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0].admin.id).toBe(adminRecordId);
    });
  });

  // ==========================================
  // SUITE 9: INVENTORY VALUATION & ALERTS
  // ==========================================
  describe('9. Alerts & Inventory Valuation Support', () => {
    it('9.1 should compute inventory valuation at acquisition cost and retail', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/valuation`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      const { summary, items } = body.data;
      expect(summary.grandTotalCost).toBeGreaterThan(0);
      expect(summary.grandTotalRetail).toBeGreaterThan(0);
      expect(summary.grandTotalUnits).toBeGreaterThan(0);
      expect(items.length).toBeGreaterThan(0);
    });

    it('9.2 should return expiry alerts for batches near expiration', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/alerts/expiry?daysThreshold=90`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);

      // BATCH-AMX-EARLY expires in 45 days, so it must be flagged!
      const earlyAlert = body.data.find((b: any) => b.batchId === batchEarlyId);
      expect(earlyAlert).toBeDefined();
      expect(earlyAlert.riskLevel).toBe('EXPIRING_WARNING');
    });

    it('9.3 should return low-stock alerts for products at or below reorder level', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/alerts/low-stock`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // ==========================================
  // SUITE 10: FHIR R4 SERIALIZATION
  // ==========================================
  describe('10. HL7 FHIR R4 Resource Mappings', () => {
    it('10.1 should export FHIR R4 Medication resource', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/fhir/medication/${amoxicillinProductId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const fhir = await res.json();
      expect(fhir.data.resourceType).toBe('Medication');
      expect(fhir.data.code.text).toContain('Amoxicillin');
      expect(fhir.data.status).toBe('active');
    });

    it('10.2 should export Kenya Core FHIR R4 MedicationDispense resource', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/fhir/dispense/${testDispenseId}`, {
        headers: { Authorization: `Bearer ${pharmacistAToken}` },
      });

      expect(res.status).toBe(200);
      const fhir = await res.json();
      expect(fhir.data.resourceType).toBe('MedicationDispense');
      expect(fhir.data.status).toBeDefined();
      expect(fhir.data.subject.reference).toBe(`Patient/${testPatientAId}`);
      expect(fhir.data.context.reference).toBe(`Encounter/${testEncounterAId}`);
      expect(fhir.data.authorizingPrescription[0].reference).toBe(`MedicationRequest/${testMedRequestId}`);
    });
  });

  // ==========================================
  // SUITE 11: MULTI-TENANT ISOLATION & RBAC
  // ==========================================
  describe('11. Multi-Tenant Isolation & Role-Based Access Controls', () => {
    it('11.1 should isolate pharmacy inventory across tenants (Tenant B cannot access Tenant A batches)', async () => {
      const res = await fetch(`${baseUrl}/pharmacy/batches`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      // Tenant B should NOT see Tenant A's batches
      const hasTenantABatch = body.data.some((b: any) => b.batch.id === batchLateId);
      expect(hasTenantABatch).toBe(false);
    });

    it('11.2 should block unauthorized roles from dispensing medications', async () => {
      // Clinician lacks PHARMACY_DISPENSE permission
      const res = await fetch(`${baseUrl}/pharmacy/dispense`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          orderId: testOrderId,
          medicationRequestId: testMedRequestId,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          quantityToDispense: 5,
        }),
      });

      expect(res.status).toBe(403);
    });

    it('11.3 should block unauthorized roles from administering medications', async () => {
      // Pharmacist lacks MEDICATION_ADMINISTER permission
      const res = await fetch(`${baseUrl}/pharmacy/administration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pharmacistAToken}`,
        },
        body: JSON.stringify({
          medicationRequestId: testMedRequestId,
          encounterId: testEncounterAId,
          patientId: testPatientAId,
          doseQuantity: 500,
          doseUnit: 'mg',
        }),
      });

      expect(res.status).toBe(403);
    });
  });
});
