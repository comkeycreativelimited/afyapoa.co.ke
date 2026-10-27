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
  triageVitals,
  patientAllergies,
  clinicalNotes,
  clinicalNoteAmendments,
  auditEvents,
} from '@afyapoa/database';
import {
  EncounterType,
  EncounterStatus,
  ServiceDepartment,
  TriagePriority,
  AvpuLevel,
  ClinicalNoteType,
  ClinicalNoteStatus,
  AllergenType,
  AllergySeverity,
  AllergyClinicalStatus,
  AllergyVerificationStatus,
  AuditEventType,
} from '@afyapoa/domain-core';
import { eq, and } from 'drizzle-orm';

describe('Encounters, Triage & Outpatient Clinical Documentation Integration Tests (Milestone 5)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityB1Id: string;

  let clinicianAToken: string;
  let nurseAToken: string;
  let adminAToken: string;
  let clinicianBToken: string;

  let testPatientAId: string;
  let testPatientBId: string;

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

      // Clean existing data for clean, deterministic testing
      await db.delete(patientAllergies);
      await db.delete(clinicalNoteAmendments);
      await db.delete(clinicalNotes);
      await db.delete(triageVitals);
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

    // 3. Login Nurse A (nurse.faith)
    const loginNurseA = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nurse.faith', password: 'Password123!' }),
    });
    const nAData = await loginNurseA.json();
    nurseAToken = nAData.data?.accessToken || nAData.accessToken;

    // 4. Login Hospital Admin A (admin.nmhg) with MFA
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

    // 5. Login Clinician B (dr.mary - Kibera Net)
    const loginClinicianB = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.mary', password: 'Password123!' }),
    });
    const cBData = await loginClinicianB.json();
    clinicianBToken = cBData.data?.accessToken || cBData.accessToken;

    // 6. Create Test Patient for Tenant A
    const patientARes = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianAToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityA1Id,
        firstName: 'Juma',
        lastName: 'Mwangi',
        gender: 'MALE',
        dateOfBirth: '1988-06-14',
        phone: '+254711223344',
      }),
    });
    expect(patientARes.status).toBe(201);
    const patientAJson = await patientARes.json();
    testPatientAId = patientAJson.data?.id || patientAJson.id;
    expect(testPatientAId).toBeDefined();

    // 7. Create Test Patient for Tenant B
    const patientBRes = await fetch(`${baseUrl}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clinicianBToken}`,
      },
      body: JSON.stringify({
        primaryFacilityId: facilityB1Id,
        firstName: 'Zainab',
        lastName: 'Hassan',
        gender: 'FEMALE',
        dateOfBirth: '1995-11-20',
        phone: '+254722334455',
      }),
    });
    expect(patientBRes.status).toBe(201);
    const patientBJson = await patientBRes.json();
    testPatientBId = patientBJson.data?.id || patientBJson.id;
    expect(testPatientBId).toBeDefined();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ==========================================
  // Section 1: Encounter Creation & Queue
  // ==========================================
  describe('Encounter Registration and Queue Lifecycle', () => {
    let createdEncounterId: string;
    let createdEncounterNumber: string;

    it('should register a walk-in encounter and automatically set status to ARRIVED', async () => {
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
          serviceDepartment: ServiceDepartment.OUTPATIENT,
          priority: TriagePriority.ROUTINE,
          reasonForVisit: 'Persistent headaches and fever for 3 days',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const encounter = body.data || body;

      expect(encounter.id).toBeDefined();
      expect(encounter.status).toBe(EncounterStatus.ARRIVED);
      expect(encounter.encounterType).toBe(EncounterType.WALK_IN);
      expect(encounter.encounterNumber).toMatch(/^ENC-\d{6}-\d{4}$/);
      expect(encounter.patientId).toBe(testPatientAId);
      expect(encounter.facilityId).toBe(facilityA1Id);

      createdEncounterId = encounter.id;
      createdEncounterNumber = encounter.encounterNumber;
    });

    it('should register an appointment encounter and set status to PLANNED', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 2).toISOString();
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.APPOINTMENT,
          serviceDepartment: ServiceDepartment.DENTAL,
          priority: TriagePriority.ROUTINE,
          scheduledStartTime: futureDate,
          reasonForVisit: 'Routine dental prophylaxis',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const encounter = body.data || body;

      expect(encounter.status).toBe(EncounterStatus.PLANNED);
      expect(encounter.encounterType).toBe(EncounterType.APPOINTMENT);
    });

    it('should reject encounter creation with missing required fields', async () => {
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          facilityId: facilityA1Id,
          // Missing patientId
        }),
      });

      expect(res.status).toBe(400);
    });

    it('should reject encounter creation for a non-existent patient', async () => {
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: '00000000-0000-0000-0000-000000000000',
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
        }),
      });

      expect(res.status).toBe(404);
    });

    it('should query the queue filtered by facility and status', async () => {
      const res = await fetch(
        `${baseUrl}/encounters?facilityId=${facilityA1Id}&status=${EncounterStatus.ARRIVED}`,
        {
          headers: { Authorization: `Bearer ${nurseAToken}` },
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      const items = body.data?.items || body.data;

      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThanOrEqual(1);
      const found = items.find((e: any) => e.id === createdEncounterId);
      expect(found).toBeDefined();
      expect(found.encounterNumber).toBe(createdEncounterNumber);
    });
  });

  // ==========================================
  // Section 2: Triage Observations & Vital Signs
  // ==========================================
  describe('Triage Observations and Vital Signs Module', () => {
    let encounterId: string;

    beforeAll(async () => {
      // Register a fresh walk-in encounter for triage
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
          serviceDepartment: ServiceDepartment.OUTPATIENT,
        }),
      });
      const data = await res.json();
      encounterId = data.data?.id || data.id;
    });

    it('should record comprehensive triage vitals, calculate BMI, and advance encounter to TRIAGED', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          systolicBp: 124,
          diastolicBp: 82,
          heartRate: 74,
          respiratoryRate: 16,
          temperature: 36.8,
          oxygenSaturation: 98,
          weightKg: 70,
          heightCm: 175,
          bloodGlucose: 5.4,
          avpuLevel: AvpuLevel.ALERT,
          triagePriority: TriagePriority.URGENT,
          triageNotes: 'Patient alert, oriented x3. Complains of mild cephalalgia.',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const vitals = body.data || body;

      expect(vitals.id).toBeDefined();
      expect(vitals.systolicBp).toBe(124);
      expect(vitals.diastolicBp).toBe(82);
      expect(vitals.heartRate).toBe(74);
      expect(vitals.respiratoryRate).toBe(16);
      expect(Number(vitals.temperature)).toBe(36.8);
      expect(vitals.oxygenSaturation).toBe(98);
      expect(Number(vitals.weightKg)).toBe(70);
      expect(Number(vitals.heightCm)).toBe(175);
      // BMI: 70 / (1.75^2) = 22.86
      expect(Number(vitals.bmi)).toBeCloseTo(22.86, 1);
      expect(vitals.avpuLevel).toBe(AvpuLevel.ALERT);
      expect(vitals.triagePriority).toBe(TriagePriority.URGENT);

      // Verify that encounter status advanced from ARRIVED to TRIAGED
      const encRes = await fetch(`${baseUrl}/encounters/${encounterId}`, {
        headers: { Authorization: `Bearer ${nurseAToken}` },
      });
      const encBody = await encRes.json();
      const updatedEnc = encBody.data || encBody;
      expect(updatedEnc.status).toBe(EncounterStatus.TRIAGED);
      expect(updatedEnc.priority).toBe(TriagePriority.URGENT);
    });

    it('should retrieve vitals history for an encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/vitals`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const list = body.data || body;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(1);
      expect(list[0].systolicBp).toBe(124);
    });
  });

  // ==========================================
  // Section 3: Clinical Notes & Legal Amendment
  // ==========================================
  describe('Outpatient Clinical Notes, Finalization & Legal Amendments', () => {
    let encounterId: string;
    let draftNoteId: string;

    beforeAll(async () => {
      // Create and triage an encounter
      const encRes = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
        }),
      });
      const encData = await encRes.json();
      encounterId = encData.data?.id || encData.id;

      await fetch(`${baseUrl}/encounters/${encounterId}/vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          systolicBp: 120,
          diastolicBp: 80,
          heartRate: 72,
          temperature: 36.6,
          oxygenSaturation: 99,
        }),
      });
    });

    it('should create a structured clinical note in DRAFT status and transition encounter to IN_PROGRESS', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          noteType: ClinicalNoteType.OUTPATIENT_SOAP,
          chiefComplaint: 'Throbbing frontal headache for 3 days',
          historyOfPresentIllness: '34yo male presenting with bilateral frontal headache, worsening in late afternoons.',
          pastMedicalHistory: 'No known chronic medical illnesses.',
          reviewOfSystems: 'Denies vision changes, nausea, photophobia, or neck stiffness.',
          physicalExamination: 'Alert, normotensive, supple neck, negative Kernig and Brudzinski signs.',
          assessment: 'Tension-type headache, uncomplicated.',
          plan: 'Prescribe Paracetamol 1g PO TDS for 3 days. Recommend adequate hydration and stress reduction. Return to clinic if symptoms worsen.',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const note = body.data || body;

      expect(note.id).toBeDefined();
      expect(note.status).toBe(ClinicalNoteStatus.DRAFT);
      expect(note.noteType).toBe(ClinicalNoteType.CONSULTATION_NOTE);
      expect(note.authorId || note.authorUserId).toBeDefined();
      expect(note.chiefComplaint).toBe('Throbbing frontal headache for 3 days');
      draftNoteId = note.id;

      // Verify encounter transitioned to IN_PROGRESS with clinician assigned
      const encRes = await fetch(`${baseUrl}/encounters/${encounterId}`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });
      const encData = await encRes.json();
      const enc = encData.data || encData;
      expect(enc.status).toBe(EncounterStatus.IN_PROGRESS);
    });

    it('should allow modifying a clinical note while in DRAFT status', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes/${draftNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          chiefComplaint: 'Updated: Throbbing frontal headache with mild fatigue',
          assessment: 'Tension headache aggravated by digital eyestrain.',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const note = body.data || body;
      expect(note.chiefComplaint).toBe('Updated: Throbbing frontal headache with mild fatigue');
      expect(note.assessment).toBe('Tension headache aggravated by digital eyestrain.');
    });

    it('should finalize and digitally sign a clinical note', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes/${draftNoteId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          signatureConfirmation: true,
          digitalSignature: 'SIG-DR-OTIENO-A99281746B',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const note = body.data || body;
      expect(note.status).toBe(ClinicalNoteStatus.FINALIZED);
      expect(note.finalizedAt).toBeDefined();
      expect(note.digitalSignature).toBe('SIG-DR-OTIENO-A99281746B');
    });

    it('CRITICAL CLINICAL SAFETY: Direct update of a FINALIZED note must be strictly blocked (422)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes/${draftNoteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          assessment: 'Illegal direct alteration of finalized medical chart',
        }),
      });

      // Must be rejected with 422 Unprocessable Entity
      expect(res.status).toBe(422);
      const err = await res.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('cannot be directly updated');
    });

    it('should create a legal addendum amendment for a finalized note with provenance', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes/${draftNoteId}/amend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient recalled taking over-the-counter Ibuprofen earlier with partial relief.',
          amendmentText: 'ADDENDUM 15:45 - Patient clarified taking Ibuprofen 400mg 4 hours ago. Advised not to duplicate NSAIDs.',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const result = body.data || body;

      expect(result.note.status).toBe(ClinicalNoteStatus.AMENDED);
      expect(result.amendment).toBeDefined();
      expect(result.amendment.clinicalNoteId).toBe(draftNoteId);
      expect(result.amendment.reason).toBe(
        'Patient recalled taking over-the-counter Ibuprofen earlier with partial relief.',
      );
      expect(result.amendment.amendmentText).toContain('ADDENDUM 15:45');
    });

    it('should retrieve all notes and attached amendments for an encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/notes`, {
        headers: { Authorization: `Bearer ${clinicianAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const notes = body.data || body;

      expect(Array.isArray(notes)).toBe(true);
      expect(notes.length).toBe(1);
      expect(notes[0].amendments).toBeDefined();
      expect(notes[0].amendments.length).toBe(1);
      expect(notes[0].amendments[0].amendmentText).toContain('ADDENDUM 15:45');
    });
  });

  // ==========================================
  // Section 4: Patient Allergies & History
  // ==========================================
  describe('Patient Allergies Management', () => {
    let recordedAllergyId: string;

    it('should record an allergy with severity and reaction', async () => {
      const res = await fetch(`${baseUrl}/encounters/patients/${testPatientAId}/allergies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          allergenType: AllergenType.MEDICATION,
          allergen: 'Penicillin V',
          severity: AllergySeverity.SEVERE,
          clinicalStatus: AllergyClinicalStatus.ACTIVE,
          verificationStatus: AllergyVerificationStatus.CONFIRMED,
          reaction: 'Severe urticaria, angioedema, and wheezing upon oral ingestion',
          recordedAt: new Date().toISOString(),
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      const allergy = body.data || body;

      expect(allergy.id).toBeDefined();
      expect(allergy.allergen).toBe('Penicillin V');
      expect(allergy.severity).toBe(AllergySeverity.SEVERE);
      expect(allergy.patientId).toBe(testPatientAId);
      recordedAllergyId = allergy.id;
    });

    it('should retrieve patient allergies', async () => {
      const res = await fetch(`${baseUrl}/encounters/patients/${testPatientAId}/allergies`, {
        headers: { Authorization: `Bearer ${nurseAToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const allergies = body.data || body;
      expect(Array.isArray(allergies)).toBe(true);
      expect(allergies.some((a: any) => a.id === recordedAllergyId)).toBe(true);
    });

    it('should update allergy clinical status to RESOLVED', async () => {
      const res = await fetch(
        `${baseUrl}/encounters/patients/${testPatientAId}/allergies/${recordedAllergyId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${clinicianAToken}`,
          },
          body: JSON.stringify({
            clinicalStatus: AllergyClinicalStatus.RESOLVED,
            reaction: 'Resolved following formal desensitization therapy.',
          }),
        },
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      const updated = body.data || body;
      expect(updated.clinicalStatus).toBe(AllergyClinicalStatus.RESOLVED);
    });
  });

  // ==========================================
  // Section 5: Encounter Closure and Reopening Rules
  // ==========================================
  describe('Encounter Closure and Reopening Rules', () => {
    let encounterId: string;
    let openNoteId: string;

    beforeAll(async () => {
      // Create encounter with a DRAFT note
      const encRes = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
        }),
      });
      const encData = await encRes.json();
      encounterId = encData.data?.id || encData.id;

      const noteRes = await fetch(`${baseUrl}/encounters/${encounterId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          noteType: ClinicalNoteType.CONSULTATION_NOTE,
          chiefComplaint: 'Chest tightness on exertion',
          assessment: 'Initial assessment incomplete',
          plan: 'Pending lab results',
        }),
      });
      const noteData = await noteRes.json();
      openNoteId = noteData.data?.id || noteData.id;
    });

    it('should REJECT closing an encounter when draft clinical notes remain open (422)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          closureSummary: 'Attempting premature encounter closure with draft note',
        }),
      });

      expect(res.status).toBe(422);
      const err = await res.json();
      const errMsg = err.error?.message || err.message || JSON.stringify(err);
      expect(errMsg).toContain('draft clinical note(s) must be finalized');
    });

    it('should close encounter after all notes are finalized', async () => {
      // Finalize note first
      await fetch(`${baseUrl}/encounters/${encounterId}/notes/${openNoteId}/finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          signatureConfirmation: true,
          digitalSignature: 'SIG-DR-OTIENO-CLOSURE',
        }),
      });

      // Now close
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          closureSummary: 'Patient seen, treated, and discharged with oral medication.',
          disposition: 'DISCHARGED_HOME',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const closed = body.data || body;
      expect(closed.status).toBe(EncounterStatus.COMPLETED);
      expect(closed.endedAt).toBeDefined();
    });

    it('should reopen a completed encounter with mandatory justification', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          reason: 'Patient returned within 1 hour experiencing nausea from medication.',
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const reopened = body.data || body;
      expect(reopened.status).toBe(EncounterStatus.REOPENED);
    });

    it('should reject reopening an already reopened or active encounter', async () => {
      const res = await fetch(`${baseUrl}/encounters/${encounterId}/reopen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          reason: 'Attempting invalid double-reopen on non-completed encounter.',
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================
  // Section 6: Cross-Tenant Isolation (RLS)
  // ==========================================
  describe('Cross-Tenant Isolation and Record-Access Restrictions', () => {
    let tenantAEncounterId: string;

    beforeAll(async () => {
      const res = await fetch(`${baseUrl}/encounters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${nurseAToken}`,
        },
        body: JSON.stringify({
          patientId: testPatientAId,
          facilityId: facilityA1Id,
          encounterType: EncounterType.WALK_IN,
        }),
      });
      const data = await res.json();
      tenantAEncounterId = data.data?.id || data.id;
    });

    it('Clinician B (Tenant B) must NOT see Tenant A encounters in queue', async () => {
      const res = await fetch(`${baseUrl}/encounters`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const items = body.data?.items || body.data;

      const leak = items.find((e: any) => e.id === tenantAEncounterId);
      expect(leak).toBeUndefined();
    });

    it('Clinician B (Tenant B) must be denied direct GET of Tenant A encounter (404)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${tenantAEncounterId}`, {
        headers: { Authorization: `Bearer ${clinicianBToken}` },
      });

      expect(res.status).toBe(404);
    });

    it('Clinician B (Tenant B) must be blocked from adding vitals to Tenant A encounter (404)', async () => {
      const res = await fetch(`${baseUrl}/encounters/${tenantAEncounterId}/vitals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianBToken}`,
        },
        body: JSON.stringify({
          systolicBp: 120,
          diastolicBp: 80,
          heartRate: 70,
        }),
      });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================
  // Section 7: Clinical Audit Trails
  // ==========================================
  describe('Clinical Audit Trails Verification', () => {
    it('should have recorded audit events for all clinical actions', async () => {
      await withTenantContext(tenantAId, async (tx) => {
        const events = await tx
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.tenantId, tenantAId));

        const actions = events.map((e) => e.action);

        expect(actions).toContain(AuditEventType.ENCOUNTER_CREATED);
        expect(actions).toContain(AuditEventType.TRIAGE_VITALS_RECORDED);
        expect(actions).toContain(AuditEventType.CLINICAL_NOTE_CREATED);
        expect(actions).toContain(AuditEventType.CLINICAL_NOTE_FINALIZED);
        expect(actions).toContain(AuditEventType.CLINICAL_NOTE_AMENDED);
        expect(actions).toContain(AuditEventType.PATIENT_ALLERGY_RECORDED);
        expect(actions).toContain(AuditEventType.ENCOUNTER_CLOSED);
        expect(actions).toContain(AuditEventType.ENCOUNTER_REOPENED);
      });
    });
  });
});
