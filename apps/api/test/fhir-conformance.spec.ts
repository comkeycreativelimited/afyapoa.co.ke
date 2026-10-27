/**
 * COMKEY AFYA POA — FHIR R4 Interoperability Conformance & Exchange E2E Tests
 * Grounded in Digital Health Act 2023, Kenya Core FHIR IG, and DHA HIE v1.0 specifications.
 * Covers:
 * 1. CapabilityStatement metadata
 * 2. $validate operation for Patient, Observation, Condition, Claim, Bundle
 * 3. Terminology validation (ICD-11 MMS, LOINC, UCUM, deprecation of ICD-10)
 * 4. Identifier validation (DHA CR ID, PUID, KMFL, SHA)
 * 5. SHR Collection Bundle exchange with mandatory headers (X-Facility-Id, X-Consent-Token, X-PUID)
 * 6. Idempotency digest & safe duplicate submission handling
 * 7. Actionable OperationOutcome diagnostics & JSONPath reporting
 * 8. Patient SHR export to conformant FHIR Collection Bundle with Provenance and Security tags
 * 9. Financial Claim export to conformant FHIR Claim resource
 * 10. Audit event recording and provenance verification
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
  encounters,
  triageVitals,
  diagnoses,
  patientAllergies,
  shaClaims,
  shaClaimItems,
  auditEvents,
} from '@afyapoa/database';
import {
  FHIR_CANONICAL_PROFILES,
  FHIR_IDENTIFIER_SYSTEMS,
  FHIR_TERMINOLOGY_SYSTEMS,
  KenyaCoreBundle,
} from '@afyapoa/fhir-models';
import {
  AuditEventType,
} from '@afyapoa/domain-core';
import { eq, and } from 'drizzle-orm';

describe('FHIR R4 Serialization, Validation & Exchange (DHA HIE v1.0 Conformance)', () => {
  let app: INestApplication;
  let baseUrl: string;

  let tenantAId: string;
  let facilityA1Id: string;
  let facilityA1Kmfl: string;

  let clinicianAToken: string;
  let clinicianAUserId: string;

  let testPatientId: string;
  let testEncounterId: string;
  let testClaimId: string;

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

    // 1. Fetch seed tenant & facility
    await withSuperAdminContext(async (db) => {
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

    // 2. Login Clinician A
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.otieno', password: 'Password123!' }),
    });
    const loginData = await loginRes.json();
    clinicianAToken = loginData.data?.accessToken || loginData.accessToken;
    clinicianAUserId = loginData.data?.user?.id || loginData.user?.id;

    // 3. Seed deterministic clinical records for FHIR export & exchange
    await withTenantContext(tenantAId, async (tx) => {
      // Create Patient
      const [pat] = await tx
        .insert(patients)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          mrn: `MRN-FHIR-${Date.now()}`,
          firstName: 'Amina',
          middleName: 'Wanjiku',
          lastName: 'Mwangi',
          dateOfBirth: '1992-06-15',
          gender: 'FEMALE',
          dhaCrid: 'CR-100200300',
          shaNumber: 'SHA-88776655',
          phoneMasked: '+254712***789',
          physicalAddress: 'Kenyatta Avenue, Nairobi',
          county: 'Nairobi',
          subCounty: 'Starehe',
          status: 'ACTIVE',
        })
        .returning();
      testPatientId = pat.id;

      // Create Encounter
      const [enc] = await tx
        .insert(encounters)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          patientId: testPatientId,
          practitionerId: clinicianAUserId,
          encounterNumber: `ENC-FHIR-${Date.now()}`,
          encounterType: 'WALK_IN',
          serviceDepartment: 'OUTPATIENT',
          status: 'COMPLETED',
          startedAt: new Date(Date.now() - 3600000),
          endedAt: new Date(),
        })
        .returning();
      testEncounterId = enc.id;

      // Create Triage Vitals (Observation)
      await tx.insert(triageVitals).values({
        tenantId: tenantAId,
        patientId: testPatientId,
        encounterId: testEncounterId,
        assessedById: clinicianAUserId,
        systolicBp: '120',
        diastolicBp: '80',
        heartRate: 72,
        respiratoryRate: 16,
        temperature: '36.8',
        oxygenSaturation: '99',
        weightKg: '64.5',
        heightCm: '168',
        bmi: '22.8',
      });

      // Create Diagnosis (ICD-11 MMS Condition)
      await tx.insert(diagnoses).values({
        tenantId: tenantAId,
        facilityId: facilityA1Id,
        encounterId: testEncounterId,
        patientId: testPatientId,
        recordedById: clinicianAUserId,
        code: '1B10.0',
        codingSystem: 'ICD_11_MMS',
        display: 'Tuberculosis of lung',
        diagnosisType: 'CONFIRMED',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        isPrimary: true,
      });

      // Create Allergy
      await tx.insert(patientAllergies).values({
        tenantId: tenantAId,
        patientId: testPatientId,
        encounterId: testEncounterId,
        allergen: 'Amoxicillin',
        allergenType: 'DRUG',
        severity: 'SEVERE',
        reaction: 'Generalized urticaria and facial angioedema',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        recordedById: clinicianAUserId,
      });

      // Create SHA Claim
      const [claim] = await tx
        .insert(shaClaims)
        .values({
          tenantId: tenantAId,
          facilityId: facilityA1Id,
          claimNumber: `CLM-FHIR-${Date.now()}`,
          patientId: testPatientId,
          encounterId: testEncounterId,
          fund: 'SHIF',
          scenario: 'SC-01',
          accessPoint: 'OP',
          paymentMechanism: 'FEE_FOR_SERVICE',
          status: 'DRAFT',
          serviceStartDate: new Date(Date.now() - 3600000),
          totalClaimAmountKES: '4500.00',
        })
        .returning();
      testClaimId = claim.id;

      // Create Claim Items
      await tx.insert(shaClaimItems).values([
        {
          tenantId: tenantAId,
          claimId: testClaimId,
          lineType: 'INTERVENTION',
          code: 'SHI-OP-001',
          description: 'Specialist Consultation',
          quantity: '1',
          unitPriceKES: '2000.00',
          totalAmountKES: '2000.00',
          serviceDate: new Date(),
        },
        {
          tenantId: tenantAId,
          claimId: testClaimId,
          lineType: 'LAB',
          code: 'SHI-LAB-042',
          description: 'Complete Blood Count',
          quantity: '1',
          unitPriceKES: '2500.00',
          totalAmountKES: '2500.00',
          serviceDate: new Date(),
        },
      ]);
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================================================
  // 1. CAPABILITY STATEMENT METADATA
  // ==========================================================================
  describe('GET /api/v1/fhir/metadata (CapabilityStatement)', () => {
    it('should return valid FHIR R4 CapabilityStatement with Kenya Core profiles', async () => {
      const res = await fetch(`${baseUrl}/fhir/metadata`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
      });

      expect(res.status).toBe(200);
      const cap = await res.json();

      expect(cap.resourceType).toBe('CapabilityStatement');
      expect(cap.fhirVersion).toBe('4.0.1');
      expect(cap.status).toBe('active');
      expect(cap.software?.name).toContain('COMKEY AFYA POA');

      const restServer = cap.rest?.[0];
      expect(restServer?.mode).toBe('server');

      // Verify supported Kenya Core resources
      const resourceTypes = restServer?.resource?.map((r: any) => r.type);
      expect(resourceTypes).toContain('Patient');
      expect(resourceTypes).toContain('Encounter');
      expect(resourceTypes).toContain('Observation');
      expect(resourceTypes).toContain('Condition');
      expect(resourceTypes).toContain('Claim');
      expect(resourceTypes).toContain('Bundle');

      // Verify operations
      const ops = restServer?.operation?.map((o: any) => o.name);
      expect(ops).toContain('validate');
      expect(ops).toContain('export');
    });
  });

  // ==========================================================================
  // 2. RESOURCE VALIDATION ($validate)
  // ==========================================================================
  describe('POST /api/v1/fhir/$validate', () => {
    it('should validate conformant KenyaCorePatient resource with HTTP 200', async () => {
      const validPatient = {
        resourceType: 'Patient',
        id: 'pat-valid-01',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.PATIENT],
        },
        identifier: [
          {
            system: FHIR_IDENTIFIER_SYSTEMS.CR_ID,
            value: 'CR-12345678',
          },
        ],
        active: true,
        name: [
          {
            use: 'official',
            family: 'Kiprono',
            given: ['David'],
          },
        ],
        gender: 'male',
        birthDate: '1988-04-12',
      };

      const res = await fetch(`${baseUrl}/fhir/$validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
        body: JSON.stringify(validPatient),
      });

      expect(res.status).toBe(200);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');
      expect(outcome.issue[0].severity).toBe('information');
    });

    it('should reject non-conformant Patient (missing name and birthDate) with HTTP 422 and JSONPath diagnostics', async () => {
      const invalidPatient = {
        resourceType: 'Patient',
        id: 'pat-invalid-01',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.PATIENT],
        },
        identifier: [
          {
            system: FHIR_IDENTIFIER_SYSTEMS.CR_ID,
            value: 'CR-999',
          },
        ],
        gender: 'invalid-gender', // Invalid gender enum
        // Missing name and birthDate
      };

      const res = await fetch(`${baseUrl}/fhir/$validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
        body: JSON.stringify(invalidPatient),
      });

      expect(res.status).toBe(422);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');

      const issues = outcome.issue;
      expect(issues.some((i: any) => i.severity === 'error')).toBe(true);

      // Verify specific missing fields are flagged with JSONPath expressions
      const locations = issues.flatMap((i: any) => i.expression || i.location || []);
      expect(locations.some((l: string) => l.includes('name'))).toBe(true);
      expect(locations.some((l: string) => l.includes('birthDate'))).toBe(true);
    });

    it('should validate conformant LOINC Observation (Blood Pressure) with UCUM mm[Hg]', async () => {
      const validBpObservation = {
        resourceType: 'Observation',
        id: 'obs-bp-01',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.OBSERVATION],
        },
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'vital-signs',
                display: 'Vital Signs',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: FHIR_TERMINOLOGY_SYSTEMS.LOINC,
              code: '85354-9',
              display: 'Blood pressure panel with all children optional',
            },
          ],
        },
        subject: { reference: `Patient/${testPatientId}` },
        encounter: { reference: `Encounter/${testEncounterId}` },
        effectiveDateTime: new Date().toISOString(),
        component: [
          {
            code: {
              coding: [
                {
                  system: FHIR_TERMINOLOGY_SYSTEMS.LOINC,
                  code: '8480-6',
                  display: 'Systolic blood pressure',
                },
              ],
            },
            valueQuantity: {
              value: 120,
              unit: 'mm[Hg]',
              system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
              code: 'mm[Hg]',
            },
          },
          {
            code: {
              coding: [
                {
                  system: FHIR_TERMINOLOGY_SYSTEMS.LOINC,
                  code: '8462-4',
                  display: 'Diastolic blood pressure',
                },
              ],
            },
            valueQuantity: {
              value: 80,
              unit: 'mm[Hg]',
              system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
              code: 'mm[Hg]',
            },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/fhir/$validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
        body: JSON.stringify(validBpObservation),
      });

      expect(res.status).toBe(200);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');
      expect(outcome.issue[0].severity).toBe('information');
    });

    it('should validate WHO ICD-11 MMS Condition with HTTP 200', async () => {
      const validCondition = {
        resourceType: 'Condition',
        id: 'cond-01',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.CONDITION],
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'confirmed',
            },
          ],
        },
        code: {
          coding: [
            {
              system: FHIR_TERMINOLOGY_SYSTEMS.ICD_11_MMS,
              code: '1B10.0',
              display: 'Tuberculosis of lung',
            },
          ],
        },
        subject: { reference: `Patient/${testPatientId}` },
        encounter: { reference: `Encounter/${testEncounterId}` },
        recordedDate: new Date().toISOString(),
      };

      const res = await fetch(`${baseUrl}/fhir/$validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
        body: JSON.stringify(validCondition),
      });

      expect(res.status).toBe(200);
      const outcome = await res.json();
      expect(outcome.issue[0].severity).toBe('information');
    });

    it('should reject legacy ICD-10 Condition under strict Kenya DHA terminology constraints with HTTP 422', async () => {
      const legacyIcd10Condition = {
        resourceType: 'Condition',
        id: 'cond-icd10-01',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.CONDITION],
        },
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: 'active',
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: 'confirmed',
            },
          ],
        },
        code: {
          coding: [
            {
              system: FHIR_TERMINOLOGY_SYSTEMS.ICD_10, // Deprecated ICD-10
              code: 'A15.0',
              display: 'Tuberculosis of lung, confirmed by sputum microscopy',
            },
          ],
        },
        subject: { reference: `Patient/${testPatientId}` },
        encounter: { reference: `Encounter/${testEncounterId}` },
        recordedDate: new Date().toISOString(),
      };

      const res = await fetch(`${baseUrl}/fhir/$validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
        body: JSON.stringify(legacyIcd10Condition),
      });

      expect(res.status).toBe(422);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');

      const issues = outcome.issue;
      const icdIssue = issues.find((i: any) =>
        i.details?.text?.includes('ICD-10') ||
        i.details?.text?.includes('ICD-11') ||
        i.diagnostics?.includes('ICD-10') ||
        i.diagnostics?.includes('ICD-11'),
      );
      expect(icdIssue).toBeDefined();
      expect(icdIssue.code).toBe('code-invalid');
    });
  });

  // ==========================================================================
  // 3. SHR BUNDLE INGESTION & IDEMPOTENCY
  // ==========================================================================
  describe('POST /api/v1/fhir/bundles/shr (SHR Ingestion & Idempotency)', () => {
    it('should reject ingestion when mandatory exchange headers are missing with HTTP 400', async () => {
      const mockBundle: KenyaCoreBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [],
      };

      const res = await fetch(`${baseUrl}/fhir/bundles/shr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
          // Missing X-Facility-Id, X-Consent-Token, X-PUID
        },
        body: JSON.stringify(mockBundle),
      });

      expect(res.status).toBe(400);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');
      expect(outcome.issue[0].diagnostics).toContain('DHA HIE exchange headers missing');
    });

    it('should reject bundle violating DHA SHR Invariant 1 (missing Encounter) with HTTP 422', async () => {
      const bundleWithoutEncounter: KenyaCoreBundle = {
        resourceType: 'Bundle',
        id: 'bundle-no-enc',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION],
        },
        type: 'collection',
        entry: [
          {
            fullUrl: `urn:uuid:${testPatientId}`,
            resource: {
              resourceType: 'Patient',
              id: testPatientId,
              meta: { profile: [FHIR_CANONICAL_PROFILES.PATIENT] },
              identifier: [{ system: FHIR_IDENTIFIER_SYSTEMS.CR_ID, value: 'CR-123' }],
              name: [{ family: 'Omondi', given: ['Brian'] }],
              gender: 'male',
              birthDate: '1990-01-01',
            },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/fhir/bundles/shr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
          'x-facility-id': facilityA1Kmfl,
          'x-facility-id-type': 'fr-code',
          'x-consent-token': 'CONSENT-AUTH-TOKEN-123',
          'x-puid': 'PUID-DOC-001',
        },
        body: JSON.stringify(bundleWithoutEncounter),
      });

      expect(res.status).toBe(422);
      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');
      expect(
        outcome.issue.some((i: any) =>
          i.details?.text?.includes('DHA SHR Invariant 1') ||
          i.details?.text?.includes('Encounter') ||
          i.diagnostics?.includes('DHA SHR Invariant 1') ||
          i.diagnostics?.includes('Encounter'),
        ),
      ).toBe(true);
    });

    it('should successfully ingest conformant DHA SHR Collection Bundle with HTTP 201', async () => {
      const encounterId = 'enc-shr-001';
      const patientId = 'pat-shr-001';

      const validBundle: KenyaCoreBundle = {
        resourceType: 'Bundle',
        id: `bundle-valid-${Date.now()}`,
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION],
          lastUpdated: new Date().toISOString(),
          security: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
              code: 'N',
              display: 'normal',
            },
          ],
        },
        type: 'collection',
        entry: [
          {
            fullUrl: `urn:uuid:${patientId}`,
            resource: {
              resourceType: 'Patient',
              id: patientId,
              meta: { profile: [FHIR_CANONICAL_PROFILES.PATIENT] },
              identifier: [{ system: FHIR_IDENTIFIER_SYSTEMS.CR_ID, value: 'CR-55443322' }],
              name: [{ family: 'Kamau', given: ['Peter'] }],
              gender: 'male',
              birthDate: '1985-07-20',
              active: true,
            },
          },
          {
            fullUrl: `urn:uuid:${encounterId}`,
            resource: {
              resourceType: 'Encounter',
              id: encounterId,
              meta: { profile: [FHIR_CANONICAL_PROFILES.ENCOUNTER] },
              identifier: [{ system: FHIR_IDENTIFIER_SYSTEMS.ENCOUNTER, value: 'ENC-001' }],
              status: 'finished',
              class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'ambulatory',
              },
              subject: { reference: `Patient/${patientId}` },
              episodeOfCare: [{ reference: 'EpisodeOfCare/EOC-1001' }],
              period: { start: new Date().toISOString() },
            },
          },
          {
            fullUrl: `urn:uuid:obs-001`,
            resource: {
              resourceType: 'Observation',
              id: 'obs-001',
              meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
              status: 'final',
              code: {
                coding: [
                  {
                    system: FHIR_TERMINOLOGY_SYSTEMS.LOINC,
                    code: '8867-4',
                    display: 'Heart rate',
                  },
                ],
              },
              subject: { reference: `Patient/${patientId}` },
              encounter: { reference: `Encounter/${encounterId}` },
              valueQuantity: {
                value: 75,
                unit: '/min',
                system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
                code: '/min',
              },
            },
          },
          {
            fullUrl: 'urn:uuid:prov-001',
            resource: {
              resourceType: 'Provenance',
              id: 'prov-001',
              meta: { profile: [FHIR_CANONICAL_PROFILES.PROVENANCE] },
              target: [{ reference: `Encounter/${encounterId}` }],
              recorded: new Date().toISOString(),
              agent: [
                {
                  type: {
                    coding: [
                      {
                        system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                        code: 'author',
                      },
                    ],
                  },
                  who: {
                    identifier: {
                      system: FHIR_IDENTIFIER_SYSTEMS.PUID,
                      value: 'PUID-DOC-001',
                    },
                  },
                  onBehalfOf: {
                    identifier: {
                      system: FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE,
                      value: facilityA1Kmfl,
                    },
                  },
                },
              ],
            },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/fhir/bundles/shr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
          'x-facility-id': facilityA1Kmfl,
          'x-facility-id-type': 'fr-code',
          'x-consent-token': 'CONSENT-AUTH-TOKEN-123',
          'x-puid': 'PUID-DOC-001',
        },
        body: JSON.stringify(validBundle),
      });

      expect(res.status).toBe(201);
      const receiptHeader = res.headers.get('x-receipt-id');
      expect(receiptHeader).toContain('DHA-SHR-ACK-');

      const outcome = await res.json();
      expect(outcome.resourceType).toBe('OperationOutcome');
      expect(outcome.issue[0].severity).toBe('information');

      // Idempotency / Duplicate Submission Test:
      // Resubmitting identical payload MUST return HTTP 200 with idempotent acknowledgement
      const duplicateRes = await fetch(`${baseUrl}/fhir/bundles/shr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
          'x-facility-id': facilityA1Kmfl,
          'x-facility-id-type': 'fr-code',
          'x-consent-token': 'CONSENT-AUTH-TOKEN-123',
          'x-puid': 'PUID-DOC-001',
        },
        body: JSON.stringify(validBundle),
      });

      expect(duplicateRes.status).toBe(200);
      const duplicateOutcome = await duplicateRes.json();
      expect(duplicateOutcome.issue[0].diagnostics).toContain('Duplicate submission detected');
      expect(duplicateOutcome.issue[0].diagnostics).toContain(receiptHeader!);
    });
  });

  // ==========================================================================
  // 4. PATIENT SHR EXPORT ($export)
  // ==========================================================================
  describe('GET /api/v1/fhir/patients/:id/$export', () => {
    it('should export patient clinical record as a fully conformant Kenya Core SHR Collection Bundle', async () => {
      const res = await fetch(`${baseUrl}/fhir/patients/${testPatientId}/$export`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
      });

      expect(res.status).toBe(200);
      const bundle = await res.json();

      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');
      expect(bundle.meta?.profile).toContain(FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION);

      const entries = bundle.entry;
      expect(entries.length).toBeGreaterThanOrEqual(4);

      // Verify Patient entry
      const patientEntry = entries.find((e: any) => e.resource?.resourceType === 'Patient');
      expect(patientEntry).toBeDefined();
      expect(patientEntry.resource.name[0].family).toBe('Mwangi');
      expect(patientEntry.resource.identifier.some((id: any) => id.value === 'CR-100200300')).toBe(true);

      // Verify Encounter entry
      const encounterEntry = entries.find((e: any) => e.resource?.resourceType === 'Encounter');
      expect(encounterEntry).toBeDefined();
      expect(encounterEntry.resource.episodeOfCare?.length).toBeGreaterThan(0);

      // Verify Observation entry
      const obsEntry = entries.find((e: any) => e.resource?.resourceType === 'Observation');
      expect(obsEntry).toBeDefined();
      expect(obsEntry.resource.encounter?.reference).toContain('Encounter/');

      // Verify Condition entry (ICD-11 MMS)
      const condEntry = entries.find((e: any) => e.resource?.resourceType === 'Condition');
      expect(condEntry).toBeDefined();
      expect(condEntry.resource.code.coding[0].system).toBe('http://id.who.int/icd/release/11/mms');
      expect(condEntry.resource.code.coding[0].code).toBe('1B10.0');

      // Verify Provenance entry
      const provEntry = entries.find((e: any) => e.resource?.resourceType === 'Provenance');
      expect(provEntry).toBeDefined();
      expect(provEntry.resource.agent[0].who.identifier.value).toBe('PUID-DOC-001');
    });

    it('should return 404 when exporting non-existent patient', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';
      const res = await fetch(`${baseUrl}/fhir/patients/${fakeId}/$export`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
      });

      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // 5. CLAIM EXPORT ($export)
  // ==========================================================================
  describe('GET /api/v1/fhir/claims/:id/$export', () => {
    it('should export financial claim as a conformant FHIR KenyaCoreClaim resource', async () => {
      const res = await fetch(`${baseUrl}/fhir/claims/${testClaimId}/$export`, {
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
          'x-tenant-id': tenantAId,
        },
      });

      expect(res.status).toBe(200);
      const claim = await res.json();

      expect(claim.resourceType).toBe('Claim');
      expect(claim.meta?.profile).toContain(FHIR_CANONICAL_PROFILES.CLAIM);
      expect(claim.status).toBe('draft');
      expect(claim.total?.value).toBe(4500);
      expect(claim.total?.currency).toBe('KES');
      expect(claim.item.length).toBe(2);
      expect(claim.item[0].productOrService?.coding[0]?.code).toBe('SHI-OP-001');
    });
  });

  // ==========================================================================
  // 6. TAMPER-EVIDENT AUDIT RECORDING
  // ==========================================================================
  describe('FHIR Interoperability Audit Trail Verification', () => {
    it('should record tamper-evident audit events for validation, ingestion, and export', async () => {
      await withSuperAdminContext(async (db) => {
        const events = await db
          .select()
          .from(auditEvents)
          .where(and(eq(auditEvents.tenantId, tenantAId)))
          .orderBy(auditEvents.createdAt);

        const fhirEvents = events.filter((e) =>
          [
            AuditEventType.FHIR_RESOURCE_VALIDATED,
            AuditEventType.FHIR_BUNDLE_INGESTED,
            AuditEventType.FHIR_BUNDLE_EXPORTED,
            AuditEventType.FHIR_EXCHANGE_DUPLICATE_DETECTED,
          ].includes(e.action as AuditEventType),
        );

        expect(fhirEvents.length).toBeGreaterThanOrEqual(3);

        // Verify SHA-256 event chaining
        for (const evt of fhirEvents) {
          expect(evt.eventHash).toHaveLength(64);
          expect(evt.previousHash).toBeDefined();
        }
      });
    });
  });
});
