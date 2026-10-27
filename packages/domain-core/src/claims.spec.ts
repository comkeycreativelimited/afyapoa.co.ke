import { describe, it, expect } from 'vitest';
import {
  ShaFundType,
  ShaIntegrationScenario,
  ShaPaymentMechanism,
  ShaAccessPoint,
  ShaClaimStatus,
  ShaPreauthType,
  ShaPreauthStatus,
  ShaDocumentType,
  isValidClaimStatusTransition,
  validateClaimBusinessRules,
  computeClaimSubmissionFingerprint,
} from './claims.js';

describe('SHA eClaims Domain Core Unit Tests (SHIA 2023 / Regulations 2024)', () => {
  describe('Claim Lifecycle State Machine Transitions', () => {
    it('allows valid lifecycle progression: DRAFT -> QUEUED -> SUBMITTED -> ACKNOWLEDGED -> ACCEPTED -> ADJUDICATED -> PAID', () => {
      expect(isValidClaimStatusTransition(ShaClaimStatus.DRAFT, ShaClaimStatus.QUEUED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.QUEUED, ShaClaimStatus.SUBMITTED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.SUBMITTED, ShaClaimStatus.ACKNOWLEDGED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.ACKNOWLEDGED, ShaClaimStatus.ACCEPTED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.ACCEPTED, ShaClaimStatus.ADJUDICATED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.ADJUDICATED, ShaClaimStatus.PAID)).toBe(true);
    });

    it('allows retry on timeout (SUBMITTED -> SUBMITTED) and re-queueing (QUEUED -> DRAFT)', () => {
      expect(isValidClaimStatusTransition(ShaClaimStatus.SUBMITTED, ShaClaimStatus.SUBMITTED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.QUEUED, ShaClaimStatus.DRAFT)).toBe(true);
    });

    it('allows dispute and resubmission paths on rejection (REJECTED -> DISPUTED / DRAFT)', () => {
      expect(isValidClaimStatusTransition(ShaClaimStatus.REJECTED, ShaClaimStatus.DISPUTED)).toBe(true);
      expect(isValidClaimStatusTransition(ShaClaimStatus.REJECTED, ShaClaimStatus.DRAFT)).toBe(true);
    });

    it('enforces terminal states: PAID cannot transition to any other status', () => {
      expect(isValidClaimStatusTransition(ShaClaimStatus.PAID, ShaClaimStatus.SUBMITTED)).toBe(false);
      expect(isValidClaimStatusTransition(ShaClaimStatus.PAID, ShaClaimStatus.DRAFT)).toBe(false);
      expect(isValidClaimStatusTransition(ShaClaimStatus.PAID, ShaClaimStatus.CANCELLED)).toBe(false);
    });

    it('disallows illegal skips (e.g. DRAFT -> PAID or SUBMITTED -> PAID directly)', () => {
      expect(isValidClaimStatusTransition(ShaClaimStatus.DRAFT, ShaClaimStatus.PAID)).toBe(false);
      expect(isValidClaimStatusTransition(ShaClaimStatus.SUBMITTED, ShaClaimStatus.PAID)).toBe(false);
      expect(isValidClaimStatusTransition(ShaClaimStatus.DRAFT, ShaClaimStatus.ACCEPTED)).toBe(false);
    });
  });

  describe('Statutory Business Rules & Deadline Validation', () => {
    const baseServiceStart = new Date('2026-05-01T08:00:00Z');
    const baseServiceEnd = new Date('2026-05-05T12:00:00Z');

    it('passes validation for valid SHIF Inpatient claim (SC-01)', () => {
      const outcome = validateClaimBusinessRules({
        fund: ShaFundType.SHIF,
        scenario: ShaIntegrationScenario.SC_01_SHIF_IP_PER_DIEM,
        serviceStartDate: baseServiceStart,
        serviceEndDate: baseServiceEnd,
        submissionDate: new Date('2026-05-06T10:00:00Z'),
        practitionerPuid: 'PUID-DOC-001',
        diagnosesCount: 2,
        itemsCount: 4,
        totalAmountKES: 18000,
        isDischarged: true,
      });

      expect(outcome.isValid).toBe(true);
      expect(outcome.errors).toHaveLength(0);
      expect(outcome.deadlines.isStandardWithin90d).toBe(true);
    });

    it('fails when standard claim submitted after 90 days statutory limitation', () => {
      // 95 days after May 5th
      const lateSubmission = new Date('2026-08-10T12:00:00Z');
      const outcome = validateClaimBusinessRules({
        fund: ShaFundType.SHIF,
        scenario: ShaIntegrationScenario.SC_01_SHIF_IP_PER_DIEM,
        serviceStartDate: baseServiceStart,
        serviceEndDate: baseServiceEnd,
        submissionDate: lateSubmission,
        practitionerPuid: 'PUID-DOC-001',
        diagnosesCount: 1,
        itemsCount: 1,
        totalAmountKES: 5000,
        isDischarged: true,
      });

      expect(outcome.isValid).toBe(false);
      expect(outcome.deadlines.isStandardWithin90d).toBe(false);
      expect(outcome.errors.some((e) => e.includes('90-day statutory limitation'))).toBe(true);
    });

    it('enforces strict 24-hour statutory deadline for ECCIF emergency claims (SC-07)', () => {
      const emergencyArrival = new Date('2026-05-01T10:00:00Z');

      // 1. Within 24h
      const promptOutcome = validateClaimBusinessRules({
        fund: ShaFundType.ECCIF,
        scenario: ShaIntegrationScenario.SC_07_ECCIF_EMERGENCY_IDENTIFIED,
        serviceStartDate: emergencyArrival,
        submissionDate: new Date('2026-05-02T08:00:00Z'), // 22h later
        practitionerPuid: 'PUID-ER-001',
        diagnosesCount: 1,
        itemsCount: 3,
        totalAmountKES: 25000,
      });
      expect(promptOutcome.isValid).toBe(true);
      expect(promptOutcome.deadlines.isEmergencyWithin24h).toBe(true);

      // 2. Beyond 24h
      const lateOutcome = validateClaimBusinessRules({
        fund: ShaFundType.ECCIF,
        scenario: ShaIntegrationScenario.SC_07_ECCIF_EMERGENCY_IDENTIFIED,
        serviceStartDate: emergencyArrival,
        submissionDate: new Date('2026-05-02T12:00:00Z'), // 26h later
        practitionerPuid: 'PUID-ER-001',
        diagnosesCount: 1,
        itemsCount: 3,
        totalAmountKES: 25000,
      });
      expect(lateOutcome.isValid).toBe(false);
      expect(lateOutcome.deadlines.isEmergencyWithin24h).toBe(false);
      expect(lateOutcome.errors.some((e) => e.includes('24-hour statutory deadline'))).toBe(true);
    });

    it('requires approved preauthorization when needsPreauth is true (e.g. SC-02 / SC-03)', () => {
      const withinWindowSubmission = new Date('2026-05-06T10:00:00Z');

      const outcomeMissingPreauth = validateClaimBusinessRules({
        fund: ShaFundType.SHIF,
        scenario: ShaIntegrationScenario.SC_02_SHIF_IP_FFS_NORMAL_PREAUTH,
        serviceStartDate: baseServiceStart,
        serviceEndDate: baseServiceEnd,
        submissionDate: withinWindowSubmission,
        practitionerPuid: 'PUID-SURG-001',
        diagnosesCount: 1,
        itemsCount: 2,
        totalAmountKES: 65000,
        needsPreauth: true,
        approvedPreauthId: undefined,
        isDischarged: true,
      });

      expect(outcomeMissingPreauth.isValid).toBe(false);
      expect(outcomeMissingPreauth.errors.some((e) => e.includes('requires prior authorization'))).toBe(true);

      const outcomeWithPreauth = validateClaimBusinessRules({
        fund: ShaFundType.SHIF,
        scenario: ShaIntegrationScenario.SC_02_SHIF_IP_FFS_NORMAL_PREAUTH,
        serviceStartDate: baseServiceStart,
        serviceEndDate: baseServiceEnd,
        submissionDate: withinWindowSubmission,
        practitionerPuid: 'PUID-SURG-001',
        diagnosesCount: 1,
        itemsCount: 2,
        totalAmountKES: 65000,
        needsPreauth: true,
        approvedPreauthId: 'PREAUTH-APPROVED-UUID',
        isDischarged: true,
      });

      expect(outcomeWithPreauth.isValid).toBe(true);
    });

    it('requires discharge to be completed prior to submitting inpatient claims (SC-01, SC-02, SC-03)', () => {
      const unDischargedOutcome = validateClaimBusinessRules({
        fund: ShaFundType.SHIF,
        scenario: ShaIntegrationScenario.SC_01_SHIF_IP_PER_DIEM,
        serviceStartDate: baseServiceStart,
        serviceEndDate: baseServiceEnd,
        submissionDate: new Date('2026-05-06T10:00:00Z'),
        practitionerPuid: 'PUID-DOC-001',
        diagnosesCount: 1,
        itemsCount: 3,
        totalAmountKES: 12000,
        isDischarged: false,
      });

      expect(unDischargedOutcome.isValid).toBe(false);
      expect(unDischargedOutcome.errors.some((e) => e.includes('require patient discharge to be finalized'))).toBe(true);
    });

    it('validates mandatory practitioner PUID, primary diagnosis, and non-zero line items', () => {
      const invalidOutcome = validateClaimBusinessRules({
        fund: ShaFundType.PHC,
        scenario: ShaIntegrationScenario.SC_06_UHC_PHC_OP_CAPITATION,
        serviceStartDate: baseServiceStart,
        submissionDate: new Date('2026-05-06T10:00:00Z'),
        practitionerPuid: '',
        diagnosesCount: 0,
        itemsCount: 0,
        totalAmountKES: 0,
      });

      expect(invalidOutcome.isValid).toBe(false);
      expect(invalidOutcome.errors.some((e) => e.includes('Practitioner Unique Identifier (PUID) missing'))).toBe(true);
      expect(invalidOutcome.errors.some((e) => e.includes('verified primary diagnosis'))).toBe(true);
      expect(invalidOutcome.errors.some((e) => e.includes('no billable interventions'))).toBe(true);
      expect(invalidOutcome.errors.some((e) => e.includes('must be greater than zero'))).toBe(true);
    });
  });

  describe('Deterministic Submission Fingerprint (Idempotency Control)', () => {
    it('produces identical fingerprints for identical clinical/financial inputs regardless of item order', () => {
      const fp1 = computeClaimSubmissionFingerprint({
        tenantId: 'TENANT-01',
        facilityKmflCode: '12345',
        patientCrId: 'CR-998877',
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: '2026-05-01',
        totalAmountKES: 15000.5,
        itemCodes: ['BED-GEN', 'CONSULT-01', 'LAB-FBC'],
      });

      const fp2 = computeClaimSubmissionFingerprint({
        tenantId: 'TENANT-01',
        facilityKmflCode: '12345',
        patientCrId: 'CR-998877',
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: '2026-05-01',
        totalAmountKES: 15000.5,
        itemCodes: ['LAB-FBC', 'BED-GEN', 'CONSULT-01'], // permutated order
      });

      expect(fp1).toBe(fp2);
      expect(fp1.startsWith('SHA-FINGERPRINT-')).toBe(true);
    });

    it('produces different fingerprints when financial or clinical facts change', () => {
      const original = computeClaimSubmissionFingerprint({
        tenantId: 'TENANT-01',
        facilityKmflCode: '12345',
        patientCrId: 'CR-998877',
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: '2026-05-01',
        totalAmountKES: 15000.0,
        itemCodes: ['BED-GEN'],
      });

      const changedAmount = computeClaimSubmissionFingerprint({
        tenantId: 'TENANT-01',
        facilityKmflCode: '12345',
        patientCrId: 'CR-998877',
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: '2026-05-01',
        totalAmountKES: 15001.0, // different amount
        itemCodes: ['BED-GEN'],
      });

      const changedPatient = computeClaimSubmissionFingerprint({
        tenantId: 'TENANT-01',
        facilityKmflCode: '12345',
        patientCrId: 'CR-112233', // different patient
        fund: 'SHIF',
        scenario: 'SC-01',
        serviceStartDate: '2026-05-01',
        totalAmountKES: 15000.0,
        itemCodes: ['BED-GEN'],
      });

      expect(original).not.toBe(changedAmount);
      expect(original).not.toBe(changedPatient);
    });
  });
});
