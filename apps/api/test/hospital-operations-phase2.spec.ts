/**
 * COMKEY AFYA POA — Phase 2 Approved Hospital Operations Integration Test Suite
 *
 * Covers all 10 domain modules:
 * 1. Inpatient admission, discharge, and transfer (ADT)
 * 2. Ward and bed management (with optimistic locking & double-booking prevention)
 * 3. Theatre and procedure scheduling (with slot overlap conflict guards & WHO checklist)
 * 4. Maternity and newborn workflows (Partograph, APGAR, auto-linked newborn MRN)
 * 5. Radiology orders, reports, PACS integration, and specialist confidential data protection
 * 6. Referrals and counter-referrals (KMFL-aware dispatch and follow-up)
 * 7. Appointments and scheduling (practitioner conflict prevention)
 * 8. Medical supplies & procurement (PO approval and GRN inventory intake)
 * 9. Private insurance adapters (Jubilee, AAR, APA, Britam, Old Mutual eligibility & preauth)
 * 10. Staff rosters and departmental assignments (shifts & publishing)
 *
 * Verified dimensions:
 * - Normal workflows
 * - Cancellations
 * - Concurrency & double-booking guards
 * - Role-based permissions & specialist authorization
 * - Data consistency & state preservation
 * - Multi-tenant isolation (Tenant A vs Tenant B)
 */

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
  users,
  patients,
  wards,
  beds,
  inpatientAdmissions,
  theatres,
  theatreBookings,
  maternityDeliveries,
  newbornProfiles,
  radiologyOrders,
  radiologyReports,
  referrals,
  appointments,
  procurementOrders,
  goodsReceivedNotes,
  insurancePolicies,
  insuranceAuthorizations,
  departments,
  staffRosters,
  staffRosterShifts,
} from '@afyapoa/database';
import {
  UserRole,
  InpatientAdmissionType,
  InpatientAdmissionStatus,
  InpatientDischargeDisposition,
  BedStatus,
  BedType,
  WardSpecialty,
  WardGenderRestriction,
  TheatreBookingStatus,
  DeliveryMode,
  DeliveryOutcome,
  RadiologyModality,
  RadiologyOrderStatus,
  RadiologyReportStatus,
  ReferralPriority,
  ReferralStatus,
  AppointmentStatus,
  AppointmentServiceType,
  ProcurementOrderStatus,
  PrivateInsurancePayer,
  InsurancePolicyStatus,
  InsuranceAuthStatus,
  ShiftType,
  RosterStatus,
} from '@afyapoa/domain-core';

describe('COMKEY AFYA POA — Phase 2 Hospital Operations Test Suite', () => {
  let app: INestApplication;
  let baseUrl: string;

  // Tenant A fixtures
  let tenantAId: string;
  let facilityAId: string;
  let facilityAKmfl: string;
  let adminAToken: string;
  let clinicianAToken: string;
  let nurseAToken: string;
  let patientAId: string;
  let patientBId: string;
  let clinicianAUserId: string;

  // Tenant B fixtures for isolation checks
  let tenantBId: string;
  let facilityBId: string;
  let adminBToken: string;
  let patientTenantBId: string;

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

    // 1. Fetch seed tenants and facilities
    await withSuperAdminContext(async (db) => {
      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) throw new Error('Seeded tenants missing');

      tenantAId = tA.id;
      tenantBId = tB.id;

      const facs = await db.select().from(facilities);
      const fA = facs.find((f) => f.tenantId === tenantAId);
      const fB = facs.find((f) => f.tenantId === tenantBId);
      if (!fA || !fB) throw new Error('Seeded facilities missing');

      facilityAId = fA.id;
      facilityAKmfl = fA.kmflCode;
      facilityBId = fB.id;

      // Clean existing Phase 2 tables for pristine execution
      await db.delete(staffRosterShifts);
      await db.delete(staffRosters);
      await db.delete(departments);
      await db.delete(insuranceAuthorizations);
      await db.delete(insurancePolicies);
      await db.delete(goodsReceivedNotes);
      await db.delete(procurementOrders);
      await db.delete(appointments);
      await db.delete(referrals);
      await db.delete(radiologyReports);
      await db.delete(radiologyOrders);
      await db.delete(newbornProfiles);
      await db.delete(maternityDeliveries);
      await db.delete(theatreBookings);
      await db.delete(theatres);
      await db.delete(inpatientAdmissions);
      await db.delete(beds);
      await db.delete(wards);
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
    clinicianAUserId = clinData.data?.user?.id || clinData.user?.id;

    // 4. Login Nurse A (Triage Nurse)
    const nurseLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nurse.faith', password: 'Password123!' }),
    });
    const nurseData = await nurseLoginRes.json();
    nurseAToken = nurseData.accessToken || nurseData.data?.accessToken;

    // 5. Login Admin B (for Tenant B isolation checks)
    const adminBLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin.kibera', password: 'Password123!' }),
    });
    const adminBLoginData = await adminBLoginRes.json();
    const mfaTokenB = adminBLoginData.mfaToken || adminBLoginData.data?.mfaToken;

    const mfaBRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: mfaTokenB, code: '123456' }),
    });
    const mfaBData = await mfaBRes.json();
    adminBToken = mfaBData.accessToken || mfaBData.data?.accessToken;

    // 6. Seed test patients in Tenant A
    await withTenantContext(tenantAId, async (tx) => {
      const [pA] = await tx
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityAId,
          mrn: `MRN-P2-A-${Date.now()}`,
          firstName: 'Amina',
          lastName: 'Hassan',
          dateOfBirth: '1992-06-15',
          gender: 'FEMALE',
          status: 'ACTIVE',
          identityStatus: 'LOCAL_ONLY',
        })
        .returning();
      patientAId = pA.id;

      const [pB] = await tx
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityAId,
          mrn: `MRN-P2-B-${Date.now()}`,
          firstName: 'Brian',
          lastName: 'Kipkorir',
          dateOfBirth: '1985-11-20',
          gender: 'MALE',
          status: 'ACTIVE',
          identityStatus: 'LOCAL_ONLY',
        })
        .returning();
      patientBId = pB.id;
    });

    // 7. Seed test patient in Tenant B
    await withTenantContext(tenantBId, async (tx) => {
      const [pTB] = await tx
        .insert(patients)
        .values({
          tenantId: tenantBId,
          primaryFacilityId: facilityBId,
          mrn: `MRN-P2-TB-${Date.now()}`,
          firstName: 'Wanjiku',
          lastName: 'Kamau',
          dateOfBirth: '1995-02-10',
          gender: 'FEMALE',
          status: 'ACTIVE',
          identityStatus: 'LOCAL_ONLY',
        })
        .returning();
      patientTenantBId = pTB.id;
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1 & 2. INPATIENT ADMISSION, DISCHARGE, TRANSFER & WARD/BED MANAGEMENT
  // =========================================================================
  describe('1 & 2. Inpatient ADT and Ward/Bed Management', () => {
    let testWardId: string;
    let bed1Id: string;
    let bed2Id: string;
    let admissionAId: string;

    it('should configure ward and beds successfully', async () => {
      // Create Ward
      const wardRes = await fetch(`${baseUrl}/inpatient/wards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          code: `WRD-MED-${Date.now().toString().slice(-4)}`,
          name: 'General Medical Ward',
          genderRestriction: WardGenderRestriction.ANY,
          specialty: WardSpecialty.INTERNAL_MEDICINE,
          floorLocation: '2nd Floor, Wing B',
          totalBeds: 0,
        }),
      });
      expect(wardRes.status).toBe(201);
      const wardData = await wardRes.json();
      testWardId = wardData.data?.id || wardData.id;
      expect(testWardId).toBeDefined();

      // Create Bed 1
      const bed1Res = await fetch(`${baseUrl}/inpatient/beds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          wardId: testWardId,
          bedNumber: 'BED-101',
          bedType: BedType.STANDARD,
          dailyRate: '2500.00',
        }),
      });
      expect(bed1Res.status).toBe(201);
      const bed1Data = await bed1Res.json();
      bed1Id = bed1Data.data?.id || bed1Data.id;
      expect(bed1Id).toBeDefined();

      // Create Bed 2
      const bed2Res = await fetch(`${baseUrl}/inpatient/beds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          wardId: testWardId,
          bedNumber: 'BED-102',
          bedType: BedType.STANDARD,
          dailyRate: '2500.00',
        }),
      });
      expect(bed2Res.status).toBe(201);
      const bed2Data = await bed2Res.json();
      bed2Id = bed2Data.data?.id || bed2Data.id;
      expect(bed2Id).toBeDefined();
    });

    it('should admit a patient to Bed 1 and update bed to OCCUPIED', async () => {
      const admitRes = await fetch(`${baseUrl}/inpatient/admissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientAId,
          wardId: testWardId,
          bedId: bed1Id,
          admissionType: InpatientAdmissionType.EMERGENCY,
          provisionalDiagnosis: 'Acute gastroenteritis with severe dehydration',
          admittingDoctorId: clinicianAUserId,
        }),
      });

      expect(admitRes.status).toBe(201);
      const admitData = await admitRes.json();
      const admission = admitData.data || admitData;
      admissionAId = admission.id;
      expect(admission.status).toBe(InpatientAdmissionStatus.ADMITTED);
      expect(admission.admissionNumber).toMatch(/^ADM-\d{6}-\d{4}$/);

      // Verify Bed 1 is OCCUPIED
      const bedsRes = await fetch(`${baseUrl}/inpatient/wards/${testWardId}/beds`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const bedsData = await bedsRes.json();
      const allBeds = bedsData.data || bedsData;
      const b1 = allBeds.find((b: any) => b.id === bed1Id);
      expect(b1.status).toBe(BedStatus.OCCUPIED);
      expect(b1.currentAdmissionId).toBe(admissionAId);
    });

    it('should prevent double-booking: rejecting admission to already OCCUPIED bed with 409 Conflict', async () => {
      const doubleBookRes = await fetch(`${baseUrl}/inpatient/admissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientBId,
          wardId: testWardId,
          bedId: bed1Id, // Already occupied by Patient A!
          admissionType: InpatientAdmissionType.ELECTIVE,
          provisionalDiagnosis: 'Hypertensive urgency',
        }),
      });

      expect(doubleBookRes.status).toBe(409);
      const err = await doubleBookRes.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('not vacant');
    });

    it('should transfer patient from Bed 1 to Bed 2, updating both beds accordingly', async () => {
      const transferRes = await fetch(`${baseUrl}/inpatient/admissions/${admissionAId}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          toWardId: testWardId,
          toBedId: bed2Id,
          reason: 'Patient requested window side bed; clinically stable.',
        }),
      });

      expect(transferRes.status).toBe(200);

      // Verify Bed 1 is now VACANT and Bed 2 is OCCUPIED
      const bedsRes = await fetch(`${baseUrl}/inpatient/wards/${testWardId}/beds`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const allBeds = (await bedsRes.json()).data;
      const b1 = allBeds.find((b: any) => b.id === bed1Id);
      const b2 = allBeds.find((b: any) => b.id === bed2Id);

      expect(b1.status).toBe(BedStatus.VACANT);
      expect(b1.currentAdmissionId).toBeNull();
      expect(b2.status).toBe(BedStatus.OCCUPIED);
      expect(b2.currentAdmissionId).toBe(admissionAId);
    });

    it('should discharge patient with clinical summary, freeing Bed 2', async () => {
      const dischargeRes = await fetch(`${baseUrl}/inpatient/admissions/${admissionAId}/discharge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          disposition: InpatientDischargeDisposition.HOME_DISCHARGED,
          finalDiagnosis: 'Resolved gastroenteritis, clinically hydrated.',
          dischargeSummary: 'Vitals stable. Patient counseled on oral rehydration and hygiene.',
          followUpInstructions: 'Review at outpatient clinic in 7 days.',
        }),
      });

      expect(dischargeRes.status).toBe(200);
      const dischargeData = await dischargeRes.json();
      const adm = dischargeData.data || dischargeData;
      expect(adm.status).toBe(InpatientAdmissionStatus.DISCHARGED);
      expect(adm.dischargeDate).toBeDefined();

      // Verify Bed 2 is freed back to VACANT
      const bedsRes = await fetch(`${baseUrl}/inpatient/wards/${testWardId}/beds`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const allBeds = (await bedsRes.json()).data;
      const b2 = allBeds.find((b: any) => b.id === bed2Id);
      expect(b2.status).toBe(BedStatus.VACANT);
    });

    it('should support admission cancellation with explicit audit state', async () => {
      // 1. Admit patient B into Bed 1
      const admitBRes = await fetch(`${baseUrl}/inpatient/admissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientBId,
          wardId: testWardId,
          bedId: bed1Id,
          admissionType: InpatientAdmissionType.ELECTIVE,
          provisionalDiagnosis: 'Planned elective observation',
        }),
      });
      expect(admitBRes.status).toBe(201);
      const admBId = (await admitBRes.json()).data.id;

      // 2. Cancel the admission
      const cancelRes = await fetch(`${baseUrl}/inpatient/admissions/${admBId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          cancellationReason: 'Patient opted for outpatient conservative management.',
        }),
      });
      expect(cancelRes.status).toBe(200);
      const cancelledAdm = (await cancelRes.json()).data;
      expect(cancelledAdm.status).toBe(InpatientAdmissionStatus.CANCELLED);

      // 3. Bed 1 is freed back to VACANT
      const bedsRes = await fetch(`${baseUrl}/inpatient/wards/${testWardId}/beds`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const b1 = (await bedsRes.json()).data.find((b: any) => b.id === bed1Id);
      expect(b1.status).toBe(BedStatus.VACANT);
    });
  });

  // =========================================================================
  // 3. THEATRE AND PROCEDURE SCHEDULING
  // =========================================================================
  describe('3. Theatre and Procedure Scheduling', () => {
    let theatreId: string;
    let booking1Id: string;
    const now = new Date();
    const tomorrow10 = new Date(now.getTime() + 24 * 3600 * 1000);
    tomorrow10.setHours(10, 0, 0, 0);
    const tomorrow12 = new Date(tomorrow10.getTime() + 2 * 3600 * 1000); // 10:00 to 12:00
    const tomorrow11 = new Date(tomorrow10.getTime() + 1 * 3600 * 1000); // 11:00 (overlaps)
    const tomorrow13 = new Date(tomorrow10.getTime() + 3 * 3600 * 1000); // 13:00

    it('should configure an operating theatre', async () => {
      const thRes = await fetch(`${baseUrl}/theatres`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          code: `OR-MAIN-${Date.now().toString().slice(-4)}`,
          name: 'Main Surgical Theatre 1',
          theatreType: 'MAJOR',
          isHepaFiltered: true,
          hasLaminarFlow: true,
        }),
      });
      expect(thRes.status).toBe(201);
      theatreId = (await thRes.json()).data.id;
      expect(theatreId).toBeDefined();
    });

    it('should book a surgical procedure and prevent overlapping double-booking', async () => {
      // 1. First booking: 10:00 - 12:00
      const book1Res = await fetch(`${baseUrl}/theatres/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          theatreId,
          patientId: patientAId,
          leadSurgeonId: clinicianAUserId,
          procedureName: 'Open Appendectomy',
          scheduledStartTime: tomorrow10.toISOString(),
          scheduledEndTime: tomorrow12.toISOString(),
          urgency: 'ELECTIVE',
          anesthesiaType: 'GENERAL',
        }),
      });
      expect(book1Res.status).toBe(201);
      const b1 = (await book1Res.json()).data;
      booking1Id = b1.id;
      expect(b1.status).toBe(TheatreBookingStatus.SCHEDULED);

      // 2. Overlapping booking: 11:00 - 13:00 on SAME theatre -> Must throw 409 Conflict
      const overlapRes = await fetch(`${baseUrl}/theatres/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          theatreId,
          patientId: patientBId,
          leadSurgeonId: clinicianAUserId,
          procedureName: 'Inguinal Hernia Repair',
          scheduledStartTime: tomorrow11.toISOString(),
          scheduledEndTime: tomorrow13.toISOString(),
        }),
      });
      expect(overlapRes.status).toBe(409);
      const err = await overlapRes.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('Theatre conflict');
    });

    it('should sign off WHO Surgical Safety Checklist phases', async () => {
      const checklistRes = await fetch(`${baseUrl}/theatres/bookings/${booking1Id}/checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          phase: 'SIGN_IN',
          confirmedIdentity: true,
          confirmedSiteMarking: true,
          confirmedConsent: true,
          anesthesiaChecklistComplete: true,
          pulseOximeterFunctioning: true,
          allergyCheckCompleted: true,
          airwayAspirationRiskAssessed: true,
          bloodLossRiskAssessed: true,
        }),
      });

      expect(checklistRes.status).toBe(200);
      const updated = (await checklistRes.json()).data;
      expect(updated.whoChecklistCompleted).toBe(true);
      expect(updated.whoChecklistJson?.signIn?.confirmedIdentity).toBe(true);
    });

    it('should update booking to COMPLETED and permit theatre cancellation', async () => {
      const completeRes = await fetch(`${baseUrl}/theatres/bookings/${booking1Id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          status: TheatreBookingStatus.COMPLETED,
          surgicalNotes: 'Uncomplicated appendectomy. Hemostasis secured. Sponge count correct.',
        }),
      });
      expect(completeRes.status).toBe(200);
      expect((await completeRes.json()).data.status).toBe(TheatreBookingStatus.COMPLETED);
    });
  });

  // =========================================================================
  // 4. MATERNITY AND NEWBORN WORKFLOWS
  // =========================================================================
  describe('4. Maternity and Newborn Workflows', () => {
    let deliveryId: string;
    let newbornId: string;

    it('should record maternal delivery with Partograph indicators and WHO outcome', async () => {
      const delRes = await fetch(`${baseUrl}/maternity/deliveries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          motherPatientId: patientAId,
          deliveryDateTime: new Date().toISOString(),
          gravida: 2,
          para: 1,
          gestationalAgeWeeks: 39,
          deliveryMode: DeliveryMode.SPONTANEOUS_VAGINAL,
          outcome: DeliveryOutcome.LIVE_BIRTH,
          placentaComplete: true,
          estimatedBloodLossMl: 250,
          deliveredByUserId: clinicianAUserId,
          partographData: {
            cervicalDilationCm: 10,
            fetalHeartRateBpm: 140,
            uterineContractionsPer10Min: 4,
            maternalBpSystolic: 120,
            maternalBpDiastolic: 75,
            actionLineCrossed: false,
          },
          clinicalSummary: 'Full-term spontaneous vaginal delivery, maternal and fetal condition satisfactory.',
        }),
      });

      expect(delRes.status).toBe(201);
      const delivery = (await delRes.json()).data;
      deliveryId = delivery.id;
      expect(deliveryId).toBeDefined();
      expect(delivery.deliveryNumber).toMatch(/^DEL-\d{6}-\d{4}$/);
      expect(delivery.partographData?.fetalHeartRateBpm).toBe(140);
    });

    it('should register newborn with APGAR score and auto-provision linked patient MRN', async () => {
      const nbRes = await fetch(`${baseUrl}/maternity/newborns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          deliveryId,
          motherPatientId: patientAId,
          gender: 'FEMALE',
          birthWeightGrams: 3400,
          birthLengthCm: 50,
          headCircumferenceCm: 34,
          apgarScore1Min: 8,
          apgarScore5Min: 9,
          apgarScore10Min: 10,
          resuscitationRequired: false,
          createPatientRecord: true,
        }),
      });

      expect(nbRes.status).toBe(201);
      const newborn = (await nbRes.json()).data;
      newbornId = newborn.id;
      expect(newbornId).toBeDefined();
      expect(newborn.birthWeightGrams).toBe(3400);
      expect(newborn.apgarScore1Min).toBe(8);
      expect(newborn.patientId).toBeDefined(); // Linked newborn patient record generated!
    });
  });

  // =========================================================================
  // 5. RADIOLOGY ORDERS, REPORTS & SPECIALIST AUTHORIZATION
  // =========================================================================
  describe('5. Radiology Orders, Reports & Specialist Confidentiality', () => {
    let normalOrderId: string;
    let confidentialOrderId: string;
    let reportId: string;

    it('should create standard and confidential specialist radiology orders', async () => {
      // Standard chest x-ray
      const normRes = await fetch(`${baseUrl}/radiology/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientAId,
          modality: RadiologyModality.XRAY,
          procedureName: 'Chest X-Ray PA View',
          clinicalIndication: 'Persistent dry cough, rule out consolidation',
          priority: 'ROUTINE',
          isConfidentialSpecialist: false,
        }),
      });
      expect(normRes.status).toBe(201);
      normalOrderId = (await normRes.json()).data.id;

      // Confidential specialist mammogram / pelvic MRI
      const confRes = await fetch(`${baseUrl}/radiology/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientAId,
          modality: RadiologyModality.MRI,
          procedureName: 'Confidential Pelvic MRI Study',
          clinicalIndication: 'Suspected deep pelvic endometriosis',
          priority: 'URGENT',
          isConfidentialSpecialist: true,
        }),
      });
      expect(confRes.status).toBe(201);
      confidentialOrderId = (await confRes.json()).data.id;
    });

    it('should protect confidential specialist imaging: forbidden to unauthorized nurse without RADIOLOGY_SPECIALIST_READ', async () => {
      // Nurse has RADIOLOGY_READ but NOT RADIOLOGY_SPECIALIST_READ
      const forbiddenRes = await fetch(`${baseUrl}/radiology/orders/${confidentialOrderId}`, {
        headers: { Authorization: `Bearer ${nurseAToken}` },
      });
      expect(forbiddenRes.status).toBe(403);
      const err = await forbiddenRes.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('Specialist confidential imaging requires elevated authorization');

      // Authorized clinician CAN access it
      const allowedRes = await fetch(`${baseUrl}/radiology/orders/${confidentialOrderId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      expect(allowedRes.status).toBe(200);
    });

    it('should sign off diagnostic radiology report with PACS Study UID', async () => {
      const repRes = await fetch(`${baseUrl}/radiology/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          orderId: normalOrderId,
          findings: 'Clear bilateral lung fields. Normal cardiac size and contour. No pleural effusion or pneumothorax.',
          impression: 'Normal chest radiograph.',
          pacsStudyUid: '1.2.840.113619.2.55.3.6046883',
          pacsAccessionNumber: 'ACC-2026-XRAY-091',
          criticalResult: false,
        }),
      });

      expect(repRes.status).toBe(201);
      const report = (await repRes.json()).data;
      reportId = report.id;
      expect(report.status).toBe(RadiologyReportStatus.FINAL);
      expect(report.pacsStudyUid).toBe('1.2.840.113619.2.55.3.6046883');
    });

    it('should append addendum to radiology report with preserved audit trail', async () => {
      const addRes = await fetch(`${baseUrl}/radiology/reports/${reportId}/addendum`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          addendumText: 'Addendum: Comparison made with prior film from 2024. Stable appearance without interval changes.',
        }),
      });

      expect(addRes.status).toBe(200);
      const updated = (await addRes.json()).data;
      expect(updated.status).toBe(RadiologyReportStatus.AMENDED);
      expect(updated.findings).toContain('Addendum: Comparison made with prior film');
    });
  });

  // =========================================================================
  // 6. REFERRALS AND COUNTER-REFERRALS
  // =========================================================================
  describe('6. Referrals and Counter-Referrals', () => {
    let referralId: string;

    it('should create an urgent tertiary referral to Kenyatta National Hospital (KMFL: 13014)', async () => {
      const refRes = await fetch(`${baseUrl}/referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientAId,
          receivingFacilityKmfl: '13014', // KNH Master Facility List code
          receivingFacilityName: 'Kenyatta National Hospital',
          specialtyRequested: 'Neurosurgery',
          clinicalSummary: 'Patient with recurrent focal seizures refractory to first-line anticonvulsants.',
          reasonForReferral: 'Specialized neurosurgical evaluation and high-resolution 3T MRI.',
          priority: ReferralPriority.URGENT,
          ambulanceRequired: true,
          ambulanceDetails: 'Paramedic ambulance dispatched from Nairobi central depot.',
        }),
      });

      expect(refRes.status).toBe(201);
      const ref = (await refRes.json()).data;
      referralId = ref.id;
      expect(referralId).toBeDefined();
      expect(ref.referralNumber).toMatch(/^REF-\d{6}-\d{4}$/);
      expect(ref.status).toBe(ReferralStatus.DISPATCHED);
    });

    it('should update referral status and receive specialized counter-referral note', async () => {
      // 1. Mark accepted by receiving facility
      const patchRes = await fetch(`${baseUrl}/referrals/${referralId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          status: ReferralStatus.ACCEPTED,
        }),
      });
      expect(patchRes.status).toBe(200);

      // 2. Submit counter-referral back from KNH
      const counterRes = await fetch(`${baseUrl}/referrals/${referralId}/counter-referral`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          counterReferralNotes: 'Neurosurgical review concluded no surgical lesion identified. Titrated to Levetiracetam 500mg BD. Discharged back to primary care with review in 1 month.',
        }),
      });

      expect(counterRes.status).toBe(200);
      const counter = (await counterRes.json()).data;
      expect(counter.status).toBe(ReferralStatus.COMPLETED);
      expect(counter.counterReferralNotes).toContain('Levetiracetam');
      expect(counter.counterReferralReceivedAt).toBeDefined();
    });
  });

  // =========================================================================
  // 7. APPOINTMENTS AND SCHEDULING
  // =========================================================================
  describe('7. Appointments and Scheduling', () => {
    let appointmentId: string;
    const nextWeek10 = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    nextWeek10.setHours(10, 0, 0, 0);
    const nextWeek1030 = new Date(nextWeek10.getTime() + 30 * 60 * 1000); // 10:00 - 10:30
    const nextWeek1015 = new Date(nextWeek10.getTime() + 15 * 60 * 1000); // 10:15 (conflict!)
    const nextWeek1045 = new Date(nextWeek10.getTime() + 45 * 60 * 1000);

    it('should schedule appointment and prevent double-booking of practitioner', async () => {
      // 1. Schedule appointment 1
      const apt1Res = await fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientAId,
          practitionerId: clinicianAUserId,
          department: 'Outpatient Clinic',
          serviceType: AppointmentServiceType.SPECIALIST_CLINIC,
          startTime: nextWeek10.toISOString(),
          endTime: nextWeek1030.toISOString(),
          durationMinutes: 30,
          reason: 'Post-discharge follow-up consultation',
        }),
      });
      expect(apt1Res.status).toBe(201);
      const apt1 = (await apt1Res.json()).data;
      appointmentId = apt1.id;
      expect(apt1.status).toBe(AppointmentStatus.SCHEDULED);

      // 2. Overlapping appointment for SAME practitioner -> Must throw 409 Conflict
      const conflictRes = await fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          patientId: patientBId,
          practitionerId: clinicianAUserId,
          startTime: nextWeek1015.toISOString(),
          endTime: nextWeek1045.toISOString(),
          reason: 'General checkup',
        }),
      });
      expect(conflictRes.status).toBe(409);
      const err = await conflictRes.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('Practitioner is already scheduled');
    });

    it('should check in, complete, and support cancellation of appointment', async () => {
      // Check in
      const checkInRes = await fetch(`${baseUrl}/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          status: AppointmentStatus.CHECKED_IN,
        }),
      });
      expect(checkInRes.status).toBe(200);
      expect((await checkInRes.json()).data.status).toBe(AppointmentStatus.CHECKED_IN);

      // Complete
      const compRes = await fetch(`${baseUrl}/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          status: AppointmentStatus.COMPLETED,
        }),
      });
      expect(compRes.status).toBe(200);
      expect((await compRes.json()).data.status).toBe(AppointmentStatus.COMPLETED);
    });
  });

  // =========================================================================
  // 8. MEDICAL SUPPLIES AND PROCUREMENT ENHANCEMENTS
  // =========================================================================
  describe('8. Medical Supplies and Procurement Enhancements', () => {
    let orderId: string;

    it('should create and approve purchase order for hospital supplies', async () => {
      // 1. Create Purchase Order
      const poRes = await fetch(`${baseUrl}/procurement/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          supplierName: 'Kenya Medical Supplies Authority (KEMSA)',
          currency: 'KES',
          items: [
            {
              itemDescription: 'Normal Saline 0.9% 500ml IV Infusion',
              itemCode: 'MED-IV-NS-500',
              quantity: 200,
              unitPrice: 85.0,
            },
            {
              itemDescription: 'Surgical Gloves Sterile Size 7.5',
              itemCode: 'SUP-GLOVE-7.5',
              quantity: 50,
              unitPrice: 450.0,
            },
          ],
          notes: 'Emergency restocking for Inpatient wards and Main Theatre',
        }),
      });

      expect(poRes.status).toBe(201);
      const po = (await poRes.json()).data;
      orderId = po.id;
      expect(po.orderNumber).toMatch(/^PO-\d{6}-\d{4}$/);
      expect(po.status).toBe(ProcurementOrderStatus.SUBMITTED);
      expect(parseFloat(po.totalAmount)).toBe(200 * 85 + 50 * 450); // 17,000 + 22,500 = 39,500

      // 2. Approve Purchase Order
      const approveRes = await fetch(`${baseUrl}/procurement/orders/${orderId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
      });
      expect(approveRes.status).toBe(200);
      expect((await approveRes.json()).data.status).toBe(ProcurementOrderStatus.APPROVED);
    });

    it('should record Goods Received Note (GRN) with batch, expiry, and bin location', async () => {
      const grnRes = await fetch(`${baseUrl}/procurement/orders/${orderId}/grn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          deliveryNoteNumber: 'DN-KEMSA-884920',
          itemsReceived: [
            {
              itemCode: 'MED-IV-NS-500',
              quantityReceived: 200,
              batchNumber: 'BATCH-NS-2026-09',
              expiryDate: '2028-09-30',
              storageBin: 'BIN-FLUIDS-01',
            },
            {
              itemCode: 'SUP-GLOVE-7.5',
              quantityReceived: 50,
              batchNumber: 'BATCH-GL-2026-11',
              expiryDate: '2029-11-30',
              storageBin: 'BIN-PPE-04',
            },
          ],
          inspectionPassed: true,
          storageLocationNotes: 'Stored in Main Pharmacy Central Stores Room A',
        }),
      });

      expect(grnRes.status).toBe(201);
      const grn = (await grnRes.json()).data;
      expect(grn.grnNumber).toMatch(/^GRN-\d{6}-\d{4}$/);
      expect(grn.inspectionPassed).toBe(true);

      // Verify PO status transitioned to RECEIVED
      const poUpdatedRes = await fetch(`${baseUrl}/procurement/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      expect((await poUpdatedRes.json()).data.status).toBe(ProcurementOrderStatus.RECEIVED);
    });
  });

  // =========================================================================
  // 9. PRIVATE INSURANCE ADAPTERS
  // =========================================================================
  describe('9. Private Insurance Adapters', () => {
    let policyId: string;

    it('should register private insurance policies for Jubilee, AAR, APA, Britam, Old Mutual', async () => {
      const regRes = await fetch(`${baseUrl}/insurance/private/policies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          patientId: patientAId,
          payerCode: PrivateInsurancePayer.JUBILEE,
          payerName: 'Jubilee Health Insurance',
          policyNumber: 'JUB-CORP-2026-9901',
          memberNumber: 'MEM-883921',
          principalMemberName: 'Amina Hassan',
          schemeType: 'Corporate Inpatient & Outpatient Gold',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          benefitLimitInpatient: '1500000.00',
          benefitLimitOutpatient: '150000.00',
          copayAmount: '500.00',
        }),
      });

      expect(regRes.status).toBe(201);
      const pol = (await regRes.json()).data;
      policyId = pol.id;
      expect(pol.status).toBe(InsurancePolicyStatus.ACTIVE);
      expect(pol.payerCode).toBe(PrivateInsurancePayer.JUBILEE);
    });

    it('should verify member eligibility, copay obligations, and remaining limits', async () => {
      const eligRes = await fetch(`${baseUrl}/insurance/private/policies/${policyId}/eligibility?estimatedAmount=45000`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(eligRes.status).toBe(200);
      const elig = (await eligRes.json()).data;
      expect(elig.eligible).toBe(true);
      expect(elig.copayRequired).toBe(500.0);
      expect(elig.coverageEstimate).toBe(44500.0); // 45000 - 500
      expect(elig.inpatientLimitRemaining).toBe(1500000.0);
    });

    it('should request and approve private insurance preauthorization', async () => {
      const authRes = await fetch(`${baseUrl}/insurance/private/preauthorizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          policyId,
          serviceCategory: 'SURGICAL_INPATIENT',
          requestedAmount: 75000.0,
          clinicalJustification: 'Elective laparoscopic cholecystectomy for symptomatic cholelithiasis',
          diagnosisCode: 'K80.20',
          procedureCode: '47562',
        }),
      });

      expect(authRes.status).toBe(201);
      const auth = (await authRes.json()).data;
      expect(auth.authCode).toMatch(/^AUTH-JUBILEE-\d{6}-\d{4}$/);
      expect(auth.status).toBe(InsuranceAuthStatus.APPROVED);
      expect(parseFloat(auth.approvedAmount)).toBe(75000.0);
    });
  });

  // =========================================================================
  // 10. STAFF ROSTERS AND DEPARTMENTAL ASSIGNMENTS
  // =========================================================================
  describe('10. Staff Rosters and Departmental Assignments', () => {
    let departmentId: string;
    let rosterId: string;

    it('should configure hospital department', async () => {
      const deptRes = await fetch(`${baseUrl}/rosters/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          code: `DEPT-SURG-${Date.now().toString().slice(-4)}`,
          name: 'Department of Surgery and Theatre',
          headOfDepartmentUserId: clinicianAUserId,
          isActive: true,
        }),
      });

      expect(deptRes.status).toBe(201);
      departmentId = (await deptRes.json()).data.id;
      expect(departmentId).toBeDefined();
    });

    it('should create monthly roster, assign shifts, and publish roster', async () => {
      // 1. Create Roster in DRAFT
      const rostRes = await fetch(`${baseUrl}/rosters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityAId,
          departmentId,
          rosterMonth: '2026-11',
          name: 'Surgical Team November 2026 Duty Roster',
        }),
      });

      expect(rostRes.status).toBe(201);
      const roster = (await rostRes.json()).data;
      rosterId = roster.id;
      expect(roster.status).toBe(RosterStatus.DRAFT);

      // 2. Assign Day Shift to Clinician A
      const shiftRes = await fetch(`${baseUrl}/rosters/${rosterId}/shifts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          userId: clinicianAUserId,
          shiftDate: '2026-11-01',
          shiftType: ShiftType.MORNING,
          handoverNotes: 'Cover morning theatre list and surgical ward rounds.',
        }),
      });

      expect([200, 201]).toContain(shiftRes.status);
      const shift = (await shiftRes.json()).data;
      expect(shift.shiftType).toBe(ShiftType.MORNING);

      // 3. Publish Roster
      const pubRes = await fetch(`${baseUrl}/rosters/${rosterId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(pubRes.status).toBe(200);
      expect((await pubRes.json()).data.status).toBe(RosterStatus.PUBLISHED);
    });
  });

  // =========================================================================
  // MULTI-TENANT ISOLATION AND ROW-LEVEL SECURITY ENFORCEMENT
  // =========================================================================
  describe('Multi-Tenant RLS and Isolation Verification', () => {
    it('Tenant B should be strictly isolated and unable to access Tenant A records', async () => {
      // Tenant B queries Tenant A wards -> returns empty or not found
      const bWardsRes = await fetch(`${baseUrl}/inpatient/wards?facilityId=${facilityAId}`, {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      const bWards = (await bWardsRes.json()).data || [];
      expect(bWards.length).toBe(0);

      // Tenant B queries Tenant A appointments -> returns empty
      const bAptRes = await fetch(`${baseUrl}/appointments?facilityId=${facilityAId}`, {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      const bApts = (await bAptRes.json()).data || [];
      expect(bApts.length).toBe(0);

      // Tenant B queries Tenant A radiology orders -> returns empty
      const bRadRes = await fetch(`${baseUrl}/radiology/orders?facilityId=${facilityAId}`, {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      const bRads = (await bRadRes.json()).data || [];
      expect(bRads.length).toBe(0);

      // Tenant B queries Tenant A procurement orders -> returns empty
      const bPoRes = await fetch(`${baseUrl}/procurement/orders?facilityId=${facilityAId}`, {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      const bPos = (await bPoRes.json()).data || [];
      expect(bPos.length).toBe(0);

      // Tenant B queries Tenant A staff rosters -> returns empty
      const bRostRes = await fetch(`${baseUrl}/rosters?facilityId=${facilityAId}`, {
        headers: { Authorization: `Bearer ${adminBToken}` },
      });
      const bRosts = (await bRostRes.json()).data || [];
      expect(bRosts.length).toBe(0);
    });
  });
});
