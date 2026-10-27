/**
 * COMKEY AFYA POA — Kenya Core HL7 FHIR R4 Validator & Conformance Test Suite
 * Tests profile validation, terminology verification, bundle invariants, and diagnostics.
 */

import { describe, it, expect } from 'vitest';
import {
  validateFHIRResource,
  buildKenyaShrCollectionBundle,
  buildKenyaTransactionBundle,
  toFHIRPatient,
  toFHIREncounter,
  toFHIRPractitioner,
  toFHIROrganization,
  toFHIRCondition,
  toFHIRObservations,
  toFHIRAllergyIntolerance,
  toFHIRMedicationRequest,
  toFHIRMedicationDispense,
  toFHIRMedicationAdministration,
  toFHIRServiceRequest,
  toFHIRSpecimen,
  toFHIRDiagnosticReport,
  toFHIRCoverage,
  toFHIRClaim,
  toFHIRConsent,
  parseOperationOutcome,
  FHIR_CANONICAL_PROFILES,
  FHIR_IDENTIFIER_SYSTEMS,
  FHIR_TERMINOLOGY_SYSTEMS,
} from './index.js';

describe('Kenya Core HL7 FHIR R4 Conformance & Validation Engine', () => {
  // ===========================================================================
  // 1. PATIENT PROFILE VALIDATION
  // ===========================================================================
  describe('1. Patient Profile Conformance', () => {
    it('validates a conformant KenyaCorePatient with DHA CR ID, National ID, and SHA Number', () => {
      const patient = toFHIRPatient({
        id: 'pat-test-001',
        mrn: 'MRN-001',
        dhaCrid: 'CRID-KE-2026-998877',
        shaNumber: 'SHA-00998877',
        nationalId: '12345678',
        firstName: 'Wanjiku',
        middleName: 'Njeri',
        lastName: 'Kamau',
        dateOfBirth: '1992-04-15',
        gender: 'FEMALE',
        phoneMasked: '+254712***456',
        email: 'wanjiku@example.co.ke',
        county: 'Nairobi',
        subCounty: 'Westlands',
        managingFacilityId: 'fac-001',
        status: 'ACTIVE',
      });

      const res = validateFHIRResource(patient, { enforceCanonicalProfile: true });
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      expect(res.parsedOutcome.valid).toBe(true);
    });

    it('rejects patient with missing required fields (birthDate, gender, name)', () => {
      const invalidPatient = {
        resourceType: 'Patient',
        id: 'pat-invalid-001',
        active: true,
        identifier: [],
      };

      const res = validateFHIRResource(invalidPatient);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.expression?.includes('Patient.gender'))).toBe(true);
      expect(res.issues.some((i) => i.expression?.includes('Patient.birthDate'))).toBe(true);
      expect(res.issues.some((i) => i.expression?.includes('Patient.name'))).toBe(true);
      expect(res.issues.some((i) => i.expression?.includes('Patient.identifier'))).toBe(true);
    });

    it('emits a warning when a patient lacks any national registry identifier', () => {
      const patientWithoutNationalId = toFHIRPatient({
        id: 'pat-local-only',
        mrn: 'MRN-LOCAL-001',
        firstName: 'Local',
        lastName: 'Patient',
        dateOfBirth: '2000-01-01',
        gender: 'MALE',
      });

      const res = validateFHIRResource(patientWithoutNationalId);
      expect(res.valid).toBe(true); // Warnings do not invalidate
      const nationalIdWarning = res.issues.find(
        (i) => i.details?.text?.includes('lacks a national registry identifier'),
      );
      expect(nationalIdWarning).toBeDefined();
      expect(nationalIdWarning?.severity).toBe('warning');
    });
  });

  // ===========================================================================
  // 2. ENCOUNTER PROFILE VALIDATION
  // ===========================================================================
  describe('2. Encounter Profile Conformance', () => {
    it('validates a conformant KenyaCoreEncounter with AMB class and patient reference', () => {
      const encounter = toFHIREncounter({
        id: 'enc-test-001',
        encounterNumber: 'ENC-2026-0001',
        patientId: 'pat-test-001',
        facilityId: 'fac-001',
        facilityCode: 'FID-47-115307-8',
        status: 'IN_PROGRESS',
        encounterType: 'OUTPATIENT',
        startedAt: new Date(),
        clinicianId: 'doc-001',
      });

      const res = validateFHIRResource(encounter, { enforceCanonicalProfile: true });
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('rejects encounter with missing subject or invalid status', () => {
      const invalidEncounter = {
        resourceType: 'Encounter',
        id: 'enc-invalid',
        status: 'NON_EXISTENT_STATUS',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'AMB',
        },
      };

      const res = validateFHIRResource(invalidEncounter);
      expect(res.valid).toBe(false);
      expect(res.issues.some((i) => i.expression?.includes('Encounter.status'))).toBe(true);
      expect(res.issues.some((i) => i.expression?.includes('Encounter.subject'))).toBe(true);
    });
  });

  // ===========================================================================
  // 3. CONDITION & TERMINOLOGY VALIDATION (WHO ICD-11 MANDATE)
  // ===========================================================================
  describe('3. Condition & Terminology Validation (WHO ICD-11)', () => {
    it('validates Condition with WHO ICD-11 MMS primary coding', () => {
      const condition = toFHIRCondition({
        id: 'cond-001',
        patientId: 'pat-001',
        encounterId: 'enc-001',
        code: '1A00',
        codingSystem: 'ICD_11_MMS',
        display: 'Cholera',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        isPrimary: true,
        recordedAt: new Date(),
      });

      const res = validateFHIRResource(condition, { enforceCanonicalProfile: true });
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('emits high-priority warning/error when legacy ICD-10 is used', () => {
      const legacyCondition = toFHIRCondition({
        id: 'cond-legacy-001',
        patientId: 'pat-001',
        encounterId: 'enc-001',
        code: 'A00.0',
        codingSystem: 'ICD_10',
        display: 'Cholera due to Vibrio cholerae 01, biovar cholerae',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        isPrimary: true,
        recordedAt: new Date(),
      });

      // Permissive terminology check gives warning
      const resPermissive = validateFHIRResource(legacyCondition, { strictTerminology: false });
      const warningIssue = resPermissive.issues.find((i) =>
        i.details?.text?.includes('Legacy ICD-10 detected'),
      );
      expect(warningIssue).toBeDefined();
      expect(warningIssue?.severity).toBe('warning');

      // Strict terminology check fails
      const resStrict = validateFHIRResource(legacyCondition, { strictTerminology: true });
      expect(resStrict.valid).toBe(false);
      const errorIssue = resStrict.issues.find((i) =>
        i.details?.text?.includes('Legacy ICD-10 detected'),
      );
      expect(errorIssue?.severity).toBe('error');
    });
  });

  // ===========================================================================
  // 4. OBSERVATION & LOINC VALIDATION
  // ===========================================================================
  describe('4. Observation & LOINC Validation', () => {
    it('validates Observations generated from vitals with standard LOINC codes and UCUM units', () => {
      const vitals = toFHIRObservations({
        id: 'vitals-001',
        patientId: 'pat-001',
        encounterId: 'enc-001',
        assessedById: 'doc-001',
        assessedAt: new Date(),
        systolicBp: 120,
        diastolicBp: 80,
        heartRate: 72,
        respiratoryRate: 16,
        temperature: 36.6,
        oxygenSaturation: 98,
        weightKg: 70,
        heightCm: 175,
        bmi: 22.9,
      });

      expect(vitals.length).toBeGreaterThan(0);
      for (const obs of vitals) {
        const res = validateFHIRResource(obs);
        expect(res.valid).toBe(true);
        expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      }
    });
  });

  // ===========================================================================
  // 5. MEDICATION WORKFLOW PROFILES
  // ===========================================================================
  describe('5. Medication Workflow Profiles (Request, Dispense, Admin)', () => {
    it('validates MedicationRequest with KEML coding and prescription dosage instructions', () => {
      const medRequest = toFHIRMedicationRequest(
        {
          id: 'ord-med-001',
          patientId: 'pat-001',
          encounterId: 'enc-001',
          orderNumber: 'ORD-2026-M001',
          status: 'ACTIVE',
          priority: 'ROUTINE',
          intent: 'ORDER',
          orderingPractitionerId: 'doc-001',
          orderedAt: new Date(),
        },
        {
          medicationCode: 'KEML-AMOX-500',
          medicationName: 'Amoxicillin 500mg Capsule',
          codingSystem: 'KENYA_EML',
          dosage: '500',
          dosageUnit: 'mg',
          route: 'Oral',
          frequency: 'TDS (Three times daily)',
          durationValue: 5,
          durationUnit: 'DAYS',
          totalQuantity: 15,
          quantityUnit: 'capsules',
        },
      );

      const res = validateFHIRResource(medRequest);
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('validates MedicationDispense with authorizing prescription and performer PUID', () => {
      const dispense = toFHIRMedicationDispense({
        id: 'disp-001',
        dispenseNumber: 'DSP-2026-0001',
        status: 'COMPLETED',
        dispenseType: 'FIRST_FILL',
        patientId: 'pat-001',
        encounterId: 'enc-001',
        orderId: 'ord-001',
        medicationRequestId: 'ord-med-001',
        medicationName: 'Amoxicillin 500mg Capsule',
        quantityDispensed: 15,
        dispenserId: 'pharm-001',
        dispensedAt: new Date(),
      });

      const res = validateFHIRResource(dispense);
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('validates MedicationAdministration bedside nurse documentation', () => {
      const admin = toFHIRMedicationAdministration({
        id: 'admin-001',
        status: 'COMPLETED',
        patientId: 'pat-001',
        encounterId: 'enc-001',
        medicationRequestId: 'ord-med-001',
        medicationName: 'Amoxicillin 500mg',
        doseQuantity: 500,
        doseUnit: 'mg',
        route: 'Oral',
        administratorId: 'nurse-001',
        administeredAt: new Date(),
      });

      const res = validateFHIRResource(admin);
      expect(res.valid).toBe(true);
    });
  });

  // ===========================================================================
  // 6. FINANCIAL CLAIM & COVERAGE PROFILES
  // ===========================================================================
  describe('6. Financial Claim & Coverage Profiles', () => {
    it('validates Coverage for SHA SHIF Fund', () => {
      const coverage = toFHIRCoverage({
        id: 'cov-001',
        patientId: 'pat-001',
        shaNumber: 'SHA-00998877',
        fundType: 'SHIF',
        status: 'ACTIVE',
      });

      const res = validateFHIRResource(coverage);
      expect(res.valid).toBe(true);
    });

    it('validates Claim with KMFL provider, patient, items, and total', () => {
      const claim = toFHIRClaim({
        id: 'clm-001',
        claimNumber: 'CLM-2026-0001',
        patientId: 'pat-001',
        facilityKmflCode: 'FID-47-115307-8',
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: new Date(),
        totalClaimAmountKES: 15000,
        status: 'QUEUED',
        practitionerPuid: 'PUID-KMPDC-A0001',
        primaryDiagnosisIcd11: '1A00',
        items: [
          {
            sequence: 1,
            code: 'BED-GEN',
            description: 'General Ward Bed Day',
            quantity: 3,
            unitPriceKES: 5000,
            totalAmountKES: 15000,
          },
        ],
      });

      const res = validateFHIRResource(claim);
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 7. DHA SHR COLLECTION BUNDLE & REFERENCING INVARIANTS
  // ===========================================================================
  describe('7. DHA SHR Collection Bundle Invariants', () => {
    it('builds a conformant SHR Collection Bundle satisfying all DHA invariants', () => {
      const patient = toFHIRPatient({
        id: 'pat-shr-001',
        mrn: 'MRN-SHR-001',
        dhaCrid: 'CRID-KE-2026-112233',
        firstName: 'Otieno',
        lastName: 'Ochieng',
        dateOfBirth: '1985-07-22',
        gender: 'MALE',
      });

      const encounter = toFHIREncounter({
        id: 'enc-shr-001',
        encounterNumber: 'ENC-SHR-001',
        patientId: patient.id!,
        facilityId: 'fac-001',
        facilityCode: 'FID-47-115307-8',
        status: 'IN_PROGRESS',
        encounterType: 'OUTPATIENT',
        startedAt: new Date(),
        episodeOfCareId: 'EOC-SHR-001',
      });

      const condition = toFHIRCondition({
        id: 'cond-shr-001',
        patientId: patient.id!,
        encounterId: encounter.id!,
        code: '1A00',
        codingSystem: 'ICD_11_MMS',
        display: 'Cholera',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        recordedAt: new Date(),
      });

      const bundle = buildKenyaShrCollectionBundle(
        patient,
        encounter,
        [condition],
        {
          facilityKmflCode: 'FID-47-115307-8',
          authorPractitionerPuid: 'PUID-KMPDC-A0001',
          authorPractitionerName: 'Dr. James Mwangi',
          episodeOfCareId: 'EOC-SHR-001',
          confidentiality: 'N',
        },
      );

      expect(bundle.resourceType).toBe('Bundle');
      expect(bundle.type).toBe('collection');

      const res = validateFHIRResource(bundle);
      expect(res.valid).toBe(true);
      expect(res.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    it('rejects SHR Collection Bundle when Encounter is missing (Invariant 1 violation)', () => {
      const invalidBundle = {
        resourceType: 'Bundle',
        id: 'bundle-no-encounter',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION],
        },
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Observation',
              id: 'obs-isolated',
              status: 'final',
              code: { coding: [{ system: 'http://loinc.org', code: '8867-4' }] },
              subject: { reference: 'Patient/p1' },
            },
          },
        ],
      };

      const res = validateFHIRResource(invalidBundle);
      expect(res.valid).toBe(false);
      const invariantIssue = res.issues.find((i) =>
        i.details?.text?.includes('DHA SHR Invariant 1'),
      );
      expect(invariantIssue).toBeDefined();
      expect(invariantIssue?.severity).toBe('error');
    });

    it('rejects SHR Collection Bundle when a clinical resource fails to reference the Encounter (Invariant 2 violation)', () => {
      const invalidBundle = {
        resourceType: 'Bundle',
        id: 'bundle-unlinked-item',
        meta: {
          profile: [FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION],
        },
        type: 'collection',
        entry: [
          {
            resource: {
              resourceType: 'Encounter',
              id: 'enc-001',
              status: 'in-progress',
              class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
              subject: { reference: 'Patient/p1' },
            },
          },
          {
            resource: {
              resourceType: 'Condition',
              id: 'cond-unlinked',
              clinicalStatus: { coding: [{ code: 'active' }] },
              code: { coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS, code: '1A00' }] },
              subject: { reference: 'Patient/p1' },
              // Missing encounter reference!
            },
          },
        ],
      };

      const res = validateFHIRResource(invalidBundle);
      expect(res.valid).toBe(false);
      const invariantIssue = res.issues.find((i) =>
        i.details?.text?.includes('DHA SHR Invariant 2'),
      );
      expect(invariantIssue).toBeDefined();
      expect(invariantIssue?.severity).toBe('error');
    });
  });

  // ===========================================================================
  // 8. OPERATION OUTCOME & REMEDIATION DIAGNOSTICS
  // ===========================================================================
  describe('8. OperationOutcome & Remediation Diagnostics', () => {
    it('parses OperationOutcome into clear user-friendly diagnostic guidance', () => {
      const invalidPayload = {
        resourceType: 'Condition',
        id: 'cond-bad',
        subject: { reference: 'Patient/p1' },
        code: {
          coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'A00' }],
        },
      };

      const validation = validateFHIRResource(invalidPayload, { strictTerminology: true });
      expect(validation.valid).toBe(false);

      const parsed = parseOperationOutcome(validation.operationOutcome);
      expect(parsed.valid).toBe(false);
      expect(parsed.errors.length).toBeGreaterThan(0);
      expect(parsed.errors[0]?.remediation).toContain('WHO ICD-11 MMS');
    });
  });
});
