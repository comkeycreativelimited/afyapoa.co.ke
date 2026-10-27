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
  serviceRequests,
  medicationDispenses,
  medicationDispenseItems,
  pharmacyProducts,
  invoices,
  invoiceLineItems,
  invoiceAdjustments,
  payments,
  paymentAllocations,
  paymentReversals,
  dailyReconciliations,
  billingServiceCatalogue,
} from '@afyapoa/database';
import {
  InvoiceStatus,
  PayerType,
  PaymentMethod,
  PaymentStatus,
  AdjustmentStatus,
  TaxCode,
  EtimsStatus,
  BillingCategory,
} from '@afyapoa/domain-core';
import bcrypt from 'bcryptjs';

describe('Patient Billing & Payments Module Integration Tests (COMKEY AFYA POA)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityB1Id: string;

  let adminAToken: string;
  let cashierAToken: string;
  let clinicianBToken: string;
  let cashierAUserId: string;

  let testPatientAId: string;
  let testEncounterAId: string;
  let testLabOrderId: string;
  let testDispenseId: string;

  let testInvoiceId: string;
  let testPaymentId: string;
  let testShiftId: string;

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

      // Clean existing billing records for a clean run
      await db.delete(paymentAllocations);
      await db.delete(paymentReversals);
      await db.delete(payments);
      await db.delete(dailyReconciliations);
      await db.delete(invoiceAdjustments);
      await db.delete(invoiceLineItems);
      await db.delete(invoices);
      await db.delete(billingServiceCatalogue);

      // Clean transactional clinical records
      await db.delete(medicationDispenseItems);
      await db.delete(medicationDispenses);
      await db.delete(medicationRequests);
      await db.delete(serviceRequests);
      await db.delete(clinicalOrders);
      await db.delete(encounters);
      await db.delete(patients);

      // Ensure Cashier user exists in Tenant A
      const existingCashier = await db.query.users.findFirst({
        where: (u, { eq, and }) => and(eq(u.tenantId, tenantAId), eq(u.username, 'cashier.wangari')),
      });

      if (!existingCashier) {
        const passwordHash = await bcrypt.hash('Password123!', 10);
        const [insertedUser] = await db
          .insert(users)
          .values({
            tenantId: tenantAId,
            primaryFacilityId: facilityA1Id,
            username: 'cashier.wangari',
            email: 'wangari@nmhg.demo.afyapoa.co.ke',
            fullName: 'Wangari Kamau (Billing Cashier)',
            role: 'BILLING_CLERK',
            passwordHash,
            status: 'ACTIVE',
          })
          .returning();
        cashierAUserId = insertedUser!.id;
      } else {
        cashierAUserId = existingCashier.id;
      }

      // Seed a test patient under Tenant A
      const [pA] = await db
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          mrn: 'MRN-BILL-001',
          nationalId: '33445566',
          firstName: 'Amina',
          lastName: 'Muthoni',
          dateOfBirth: '1990-05-12',
          gender: 'FEMALE',
          phone: '+254711223344',
          shaNumber: 'SHA-88776655',
        })
        .returning();
      testPatientAId = pA!.id;

      // Seed an active encounter for Patient A
      const [enc] = await db
        .insert(encounters)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          patientId: testPatientAId,
          clinicianId: cashierAUserId,
          encounterNumber: 'ENC-BILL-001',
          encounterType: 'OUTPATIENT',
          serviceDepartment: 'GENERAL_OPD',
          status: 'IN_PROGRESS',
        })
        .returning();
      testEncounterAId = enc!.id;

      // Seed a lab order for this encounter
      const [order] = await db
        .insert(clinicalOrders)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          orderingPractitionerId: cashierAUserId,
          orderNumber: 'ORD-BILL-001',
          orderType: 'LAB_SERVICE_REQUEST',
          status: 'COMPLETED',
        })
        .returning();
      testLabOrderId = order!.id;

      // Seed a lab service request
      await db.insert(serviceRequests).values({
        tenantId: tenantAId,
        orderId: testLabOrderId,
        patientId: testPatientAId,
        serviceCode: 'LAB-BS-001',
        serviceName: 'Blood Slide for Malaria Parasites (BS for MPs)',
        serviceCategory: 'LABORATORY',
      });

      // Seed medication order, medication request and dispense
      const [medOrder] = await db
        .insert(clinicalOrders)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          orderingPractitionerId: cashierAUserId,
          orderNumber: 'ORD-MED-001',
          orderType: 'MEDICATION_REQUEST',
          status: 'COMPLETED',
        })
        .returning();

      const [medReq] = await db
        .insert(medicationRequests)
        .values({
          tenantId: tenantAId,
          orderId: medOrder!.id,
          patientId: testPatientAId,
          medicationCode: 'J01CA04',
          medicationName: 'Artemether-Lumefantrine 20/120mg',
          dosage: '20/120',
          dosageUnit: 'mg',
          totalQuantity: 24,
        })
        .returning();

      const [disp] = await db
        .insert(medicationDispenses)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          orderId: medOrder!.id,
          medicationRequestId: medReq!.id,
          patientId: testPatientAId,
          encounterId: testEncounterAId,
          dispenserId: cashierAUserId,
          dispenseNumber: 'DSP-BILL-001',
          quantityPrescribed: 24,
          quantityDispensed: 24,
          status: 'COMPLETED',
        })
        .returning();
      testDispenseId = disp!.id;
    });

    // 2. Login Cashier A (cashier.wangari)
    const cashierLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'cashier.wangari', password: 'Password123!' }),
    });
    const cData = await cashierLoginRes.json();
    cashierAToken = cData.data?.accessToken || cData.accessToken;

    // 3. Login Admin A (admin.nmhg) with MFA
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin.nmhg', password: 'Password123!' }),
    });
    const adminData = await adminLoginRes.json();
    const mfaToken = adminData.mfaToken || adminData.data?.mfaToken;

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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. BILLING CATALOGUE & TARIFF CONFIGURATION
  // =========================================================================
  describe('1. Service & Billing Catalogues', () => {
    it('should reject unauthorized cashier attempting to seed default tariffs (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/billing/catalogue/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
      });
      expect(res.status).toBe(403);
    });

    it('should allow facility admin to seed standard Kenyan tariffs', async () => {
      const res = await fetch(`${baseUrl}/billing/catalogue/seed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.seededCount).toBeGreaterThan(5);
    });

    it('should allow cashier to view active tariffs', async () => {
      const res = await fetch(`${baseUrl}/billing/catalogue`, {
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(5);

      const consultation = body.data.find((s: any) => s.category === BillingCategory.CONSULTATION);
      expect(consultation).toBeDefined();
      expect(consultation.taxCode).toBe(TaxCode.E); // VAT exempt under Kenyan VAT Act 1st Schedule
    });

    it('should allow admin to create a custom service tariff with 16% VAT for administrative documents', async () => {
      const res = await fetch(`${baseUrl}/billing/catalogue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          serviceCode: 'ADM-MED-REP',
          serviceName: 'Comprehensive Medical Legal Report',
          category: BillingCategory.ADMINISTRATIVE,
          department: 'RECORDS',
          basePrice: 5000,
          taxRate: 16,
          taxCode: TaxCode.A, // 16% standard rated
          shaCovered: false,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.serviceCode).toBe('ADM-MED-REP');
      expect(Number(body.data.taxRate)).toBe(16);
      expect(body.data.taxCode).toBe(TaxCode.A);
    });
  });

  // =========================================================================
  // 2. INVOICE CREATION & AUTO-AGGREGATION
  // =========================================================================
  describe('2. Invoice Creation, Itemization & Encounters Linkage', () => {
    it('should auto-create an itemized invoice linked to an active encounter, lab order and pharmacy dispense', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/encounter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          encounterId: testEncounterAId,
          payerType: PayerType.OUT_OF_POCKET,
          notes: 'Standard OPD encounter bill',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.encounterId).toBe(testEncounterAId);
      expect(body.data.patientId).toBe(testPatientAId);
      expect(body.data.status).toBe(InvoiceStatus.DRAFT);
      expect(body.data.lineItems.length).toBeGreaterThanOrEqual(3);

      testInvoiceId = body.data.id;

      // Verify line items
      const consLine = body.data.lineItems.find((l: any) => l.category === BillingCategory.CONSULTATION);
      const labLine = body.data.lineItems.find((l: any) => l.category === BillingCategory.LABORATORY);
      const pharmLine = body.data.lineItems.find((l: any) => l.category === BillingCategory.PHARMACY);

      expect(consLine).toBeDefined();
      expect(consLine.sourceType).toBe('ENCOUNTER_CONSULTATION');
      expect(labLine).toBeDefined();
      expect(labLine.sourceType).toBe('LABORATORY_ORDER');
      expect(pharmLine).toBeDefined();
      expect(pharmLine.sourceType).toBe('PHARMACY_DISPENSE');

      // Verify totals
      expect(Number(body.data.totalAmount)).toBeGreaterThan(0);
      expect(Number(body.data.balanceDue)).toBe(Number(body.data.totalAmount));
    });

    it('should add a taxable administrative line item to the draft invoice', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}/lines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          itemCode: 'ADM-CERT-01',
          itemDescription: 'Medical Fitness Certificate for Employment',
          category: BillingCategory.ADMINISTRATIVE,
          quantity: 1,
          unitPrice: 1000,
          discountAmount: 0,
          taxRate: 16,
          taxCode: TaxCode.A,
          shaCoverageAmount: 0,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.itemCode).toBe('ADM-CERT-01');
      expect(Number(body.data.taxAmount)).toBe(160); // 16% of 1000
      expect(Number(body.data.netAmount)).toBe(1160);
    });
  });

  // =========================================================================
  // 3. DISCOUNTS, ADJUSTMENTS & SEGREGATION OF DUTIES
  // =========================================================================
  describe('3. Discounts & Adjustments (Segregation of Duties)', () => {
    it('should auto-approve a minor discount within cashier discretion (<= KES 1,000)', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          adjustmentType: 'DISCOUNT',
          amount: 200,
          reason: 'Senior citizen outpatient courtesy rebate',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.status).toBe(AdjustmentStatus.APPROVED);
      expect(Number(body.data.approvedAmount)).toBe(200);
    });

    it('should flag a large discount (> KES 1,000) as PENDING_APPROVAL requiring supervisor sign-off', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          adjustmentType: 'WAIVER',
          amount: 1500,
          reason: 'Compassionate waiver for indigent emergency patient',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.status).toBe(AdjustmentStatus.PENDING_APPROVAL);

      const adjustmentId = body.data.id;

      // Cashier should be forbidden from approving the waiver
      const cashierApproveRes = await fetch(`${baseUrl}/billing/adjustments/${adjustmentId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          status: AdjustmentStatus.APPROVED,
          reviewNotes: 'Cashier trying to self-approve',
        }),
      });
      expect(cashierApproveRes.status).toBe(403);

      // Facility Admin approves the waiver
      const adminApproveRes = await fetch(`${baseUrl}/billing/adjustments/${adjustmentId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          status: AdjustmentStatus.APPROVED,
          reviewNotes: 'Authorized by Hospital Director per indigent care policy',
        }),
      });
      expect(adminApproveRes.status).toBe(200);
      const approvedBody = await adminApproveRes.json();
      expect(approvedBody.data.status).toBe(AdjustmentStatus.APPROVED);
    });
  });

  // =========================================================================
  // 4. INVOICE FINALIZATION & KRA eTIMS FISCALIZATION
  // =========================================================================
  describe('4. Invoice Finalization, eTIMS Integration & Financial Immutability', () => {
    it('should finalize invoice and issue KRA eTIMS fiscal signature and QR link', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
      });

      expect([200, 201]).toContain(res.status);
      const body = await res.json();
      expect(body.data.status).toBe(InvoiceStatus.FINALIZED);
      expect(body.data.etimsStatus).toBe(EtimsStatus.SIGNED);
      expect(body.data.etimsControlCode).toMatch(/^KRA-/);
      expect(body.data.etimsQrCode).toContain('https://etims.kra.go.ke/verify');
      expect(body.data.finalizedAt).toBeDefined();
    });

    it('should prevent mutating a finalized invoice (immutable financial history)', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}/lines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          itemCode: 'ILLEGAL-MOD-01',
          itemDescription: 'Attempted Silent Modification of Finalized Invoice',
          category: BillingCategory.OTHER,
          quantity: 1,
          unitPrice: 500,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      const errMsg = body.message || body.error?.message;
      expect(errMsg).toContain('Financial records are immutable');
    });
  });

  // =========================================================================
  // 5. DAILY RECONCILIATION & SHIFT OPENING
  // =========================================================================
  describe('5. Daily Shift Reconciliation (Opening Shift)', () => {
    it('should allow cashier to open a daily shift with an opening float', async () => {
      const res = await fetch(`${baseUrl}/billing/reconciliations/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          openingFloat: 5000,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.shiftNumber).toMatch(/^REC-/);
      expect(Number(body.data.openingFloat)).toBe(5000);
      expect(body.data.status).toBe('OPEN');
      testShiftId = body.data.id;
    });

    it('should return existing open shift if cashier already has an open shift', async () => {
      const res = await fetch(`${baseUrl}/billing/reconciliations/shifts/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          openingFloat: 10000,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.id).toBe(testShiftId);
      expect(Number(body.data.openingFloat)).toBe(5000);
    });
  });

  // =========================================================================
  // 6. PAYMENTS, IDEMPOTENCY & ISOLATED M-PESA ADAPTER
  // =========================================================================
  describe('6. Receipts, Payment Processing, Idempotency & M-Pesa Adapter', () => {
    it('should test M-Pesa STK push via isolated integration adapter', async () => {
      const res = await fetch(`${baseUrl}/billing/payments/mpesa/stk-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          phoneNumber: '0712345678',
          amount: 1500,
          accountReference: 'INV-TEST-001',
          transactionDesc: 'Payment for Afya Poa Lab & Meds',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isSimulated).toBe(true);
      expect(body.data.checkoutRequestId).toBeDefined();
      expect(body.data.responseCode).toBe('0');
    });

    it('should process a cash payment and generate an official receipt', async () => {
      // Get invoice details to know the exact balance
      const invRes = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}`, {
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });
      const invData = await invRes.json();
      const balanceDue = Number(invData.data.balanceDue);
      expect(balanceDue).toBeGreaterThan(0);

      const paymentAmount = 1000;
      const idempotencyKey = `PAY-IDEM-${Date.now()}`;

      const res = await fetch(`${baseUrl}/billing/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          paymentMethod: PaymentMethod.CASH,
          amount: paymentAmount,
          idempotencyKey,
          allocations: [
            {
              invoiceId: testInvoiceId,
              amountAllocated: paymentAmount,
            },
          ],
          notes: 'Partial cash settlement at OPD Cashier 1',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.paymentNumber).toMatch(/^PAY-/);
      expect(body.data.receiptNumber).toMatch(/^RCT-/);
      expect(body.data.status).toBe(PaymentStatus.COMPLETED);
      expect(body.data.isDuplicateReplay).toBe(false);
      testPaymentId = body.data.id;

      // Verify invoice balance due updated
      const updatedInv = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}`, {
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });
      const updatedData = await updatedInv.json();
      expect(Number(updatedData.data.paidAmount)).toBe(paymentAmount);
      expect(Number(updatedData.data.balanceDue)).toBe(balanceDue - paymentAmount);
    });

    it('should guarantee idempotency on duplicate payment submissions', async () => {
      const idempotencyKey = `PAY-IDEM-IDEMP-TEST-999`;

      // 1st request
      const res1 = await fetch(`${baseUrl}/billing/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          paymentMethod: PaymentMethod.MPESA,
          amount: 500,
          idempotencyKey,
          allocations: [
            {
              invoiceId: testInvoiceId,
              amountAllocated: 500,
            },
          ],
        }),
      });

      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.data.isDuplicateReplay).toBe(false);

      // 2nd request with exact same idempotencyKey
      const res2 = await fetch(`${baseUrl}/billing/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          paymentMethod: PaymentMethod.MPESA,
          amount: 500,
          idempotencyKey,
          allocations: [
            {
              invoiceId: testInvoiceId,
              amountAllocated: 500,
            },
          ],
        }),
      });

      expect(res2.status).toBe(201);
      const data2 = await res2.json();
      expect(data2.data.id).toBe(data1.data.id);
      expect(data2.data.isDuplicateReplay).toBe(true);
      expect(data2.data.paymentNumber).toBe(data1.data.paymentNumber);
    });

    it('should reject payment allocation exceeding invoice balance due', async () => {
      const res = await fetch(`${baseUrl}/billing/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          paymentMethod: PaymentMethod.CASH,
          amount: 999999,
          allocations: [
            {
              invoiceId: testInvoiceId,
              amountAllocated: 999999,
            },
          ],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      const errMsg = body.message || body.error?.message;
      expect(errMsg).toContain('Allocated payment KES');
    });
  });

  // =========================================================================
  // 7. REFUNDS, REVERSALS & AUDIT INTEGRITY
  // =========================================================================
  describe('7. Refund & Reversal Workflows (Immutable Records)', () => {
    it('should prevent cashier from unilaterally reversing a payment (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/billing/payments/${testPaymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          reversalType: 'REFUND',
          amount: 1000,
          reason: 'Cashier trying to refund without supervisor authorization',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should allow authorized administrator to reverse payment and restore invoice balance', async () => {
      const res = await fetch(`${baseUrl}/billing/payments/${testPaymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          reversalType: 'REVERSAL',
          amount: 1000,
          reason: 'Erroneous duplicate entry, customer refunded via original payment channel',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.reversalNumber).toMatch(/^REV-/);
      expect(body.data.status).toBe('APPROVED');

      // Verify payment is marked REVERSED, not deleted!
      const paymentRes = await fetch(`${baseUrl}/billing/payments?patientId=${testPatientAId}`, {
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });
      const paymentsBody = await paymentRes.json();
      const reversedPayment = paymentsBody.data.find((p: any) => p.id === testPaymentId);
      expect(reversedPayment).toBeDefined();
      expect(reversedPayment.status).toBe(PaymentStatus.REVERSED);
    });
  });

  // =========================================================================
  // 8. PATIENT STATEMENTS & OUTSTANDING BALANCES
  // =========================================================================
  describe('8. Outstanding Balances & Patient Statement Ledger', () => {
    it('should generate an itemized, chronological patient account statement', async () => {
      const res = await fetch(`${baseUrl}/billing/patients/${testPatientAId}/statement`, {
        headers: { Authorization: `Bearer ${cashierAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.patient.mrn).toBe('MRN-BILL-001');
      expect(body.data.summary).toBeDefined();
      expect(Number(body.data.summary.totalInvoiced)).toBeGreaterThan(0);
      expect(body.data.statementLedger.length).toBeGreaterThan(0);

      // Verify ledger sorting
      const firstEntry = body.data.statementLedger[0];
      expect(firstEntry.date).toBeDefined();
      expect(firstEntry.runningBalance).toBeDefined();
    });
  });

  // =========================================================================
  // 9. DAILY SHIFT RECONCILIATION & DISCREPANCY SIGNOFF
  // =========================================================================
  describe('9. Daily Shift Reconciliation & Variance Management', () => {
    it('should close shift and flag variance if counted physical cash differs from expected cash', async () => {
      // Cashier expected cash = opening float (5000) + completed cash payments (1000 - 1000 reversed = 0 net cash)
      // If cashier enters 4,800 counted cash, discrepancy is -200 (shortage)
      const res = await fetch(`${baseUrl}/billing/reconciliations/shifts/${testShiftId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          countedCash: 4800,
          cashierNotes: 'KES 200 petty cash variance for change shortage',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('DISCREPANCY_FLAGGED');
      expect(Number(body.data.cashDiscrepancy)).toBe(-200);
    });

    it('should prevent cashier from signing off on a flagged variance shift (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/billing/reconciliations/shifts/${testShiftId}/signoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierAToken}`,
        },
        body: JSON.stringify({
          supervisorNotes: 'Cashier trying to sign off own shift discrepancy',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('should allow supervisor/facility admin to sign off on flagged shift discrepancy', async () => {
      const res = await fetch(`${baseUrl}/billing/reconciliations/shifts/${testShiftId}/signoff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          supervisorNotes: 'Shortage reviewed and investigated. Deducted from cashier petty allowance.',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.status).toBe('RECONCILED');
      expect(body.data.supervisorNotes).toContain('Shortage reviewed');
    });
  });

  // =========================================================================
  // 10. MULTI-TENANT ISOLATION (ROW LEVEL SECURITY)
  // =========================================================================
  describe('10. Multi-Tenant Financial Security & Isolation', () => {
    it('should forbid Tenant B clinician from viewing Tenant A invoice (404 RLS isolation)', async () => {
      const res = await fetch(`${baseUrl}/billing/invoices/${testInvoiceId}`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(404);
    });

    it('should return empty list when Tenant B queries invoices and payments', async () => {
      const invRes = await fetch(`${baseUrl}/billing/invoices`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });
      const invBody = await invRes.json();
      expect(invBody.data.length).toBe(0);

      const payRes = await fetch(`${baseUrl}/billing/payments`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });
      const payBody = await payRes.json();
      expect(payBody.data.length).toBe(0);
    });
  });
});
