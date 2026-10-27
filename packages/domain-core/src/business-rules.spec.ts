import { describe, it, expect } from 'vitest';
import {
  calculateBmi,
  evaluateAbnormalFlag,
  calculateTurnaroundTimes,
  canTransitionOrderStatus,
  canTransitionSpecimenStatus,
  canTransitionReportStatus,
  allocateBatchesFEFO,
  calculateExpiryRisk,
  BatchStatus,
  ExpiryAlertLevel,
  LabAbnormalFlag,
  ClinicalOrderStatus,
  SpecimenStatus,
  DiagnosticReportStatus,
} from './index.js';

describe('Domain Core — Clinical & Operational Business Rules Unit Tests', () => {
  // ==========================================
  // 1. TRIAGE & CLINICAL VITALS RULES
  // ==========================================
  describe('Rule BR-VIT-01: Body Mass Index (BMI) Computation', () => {
    it('accurately computes BMI rounded to 1 decimal place', () => {
      // 70kg / (1.75m)^2 = 70 / 3.0625 = 22.857... -> 22.9
      const bmi = calculateBmi(70, 175);
      expect(bmi).toBe(22.9);
    });

    it('correctly handles obesity class thresholds', () => {
      // 110kg / (1.70m)^2 = 110 / 2.89 = 38.06... -> 38.1
      const bmi = calculateBmi(110, 170);
      expect(bmi).toBe(38.1);
    });

    it('returns undefined when either weight or height is missing or zero', () => {
      expect(calculateBmi(undefined, 175)).toBeUndefined();
      expect(calculateBmi(70, undefined)).toBeUndefined();
      expect(calculateBmi(0, 175)).toBeUndefined();
      expect(calculateBmi(70, 0)).toBeUndefined();
    });
  });

  // ==========================================
  // 2. LABORATORY PANIC VALUES & ABNORMAL FLAGS
  // ==========================================
  describe('Rule BR-LAB-01: Laboratory Panic Values and Reference Flagging', () => {
    it('flags panic low (critical low) when numeric value is at or below criticalLow', () => {
      // Potassium: normal 3.5 - 5.0, critical low <= 2.5
      const flag = evaluateAbnormalFlag({
        numericValue: 2.3,
        rangeLow: 3.5,
        rangeHigh: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
      });
      expect(flag).toBe(LabAbnormalFlag.CRITICAL_LOW);
    });

    it('flags panic high (critical high) when numeric value is at or above criticalHigh', () => {
      // Potassium: critical high >= 6.5
      const flag = evaluateAbnormalFlag({
        numericValue: 7.1,
        rangeLow: 3.5,
        rangeHigh: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
      });
      expect(flag).toBe(LabAbnormalFlag.CRITICAL_HIGH);
    });

    it('flags standard low and high when outside reference range but not critical', () => {
      const flagLow = evaluateAbnormalFlag({
        numericValue: 3.2,
        rangeLow: 3.5,
        rangeHigh: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
      });
      expect(flagLow).toBe(LabAbnormalFlag.LOW);

      const flagHigh = evaluateAbnormalFlag({
        numericValue: 5.4,
        rangeLow: 3.5,
        rangeHigh: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
      });
      expect(flagHigh).toBe(LabAbnormalFlag.HIGH);
    });

    it('flags normal when within standard physiological limits', () => {
      const flag = evaluateAbnormalFlag({
        numericValue: 4.2,
        rangeLow: 3.5,
        rangeHigh: 5.0,
        criticalLow: 2.5,
        criticalHigh: 6.5,
      });
      expect(flag).toBe(LabAbnormalFlag.NORMAL);
    });

    it('evaluates qualitative serology / microbiology text results', () => {
      // HIV Serology: expected "Non-Reactive"
      const normalResult = evaluateAbnormalFlag({
        textValue: 'Non-Reactive',
        expectedText: 'Non-Reactive',
      });
      expect(normalResult).toBe(LabAbnormalFlag.NORMAL);

      const reactiveResult = evaluateAbnormalFlag({
        textValue: 'Reactive',
        expectedText: 'Non-Reactive',
      });
      expect(reactiveResult).toBe(LabAbnormalFlag.CRITICAL_HIGH);

      const positiveSmear = evaluateAbnormalFlag({
        textValue: 'Positive for P. falciparum',
        expectedText: 'Negative',
      });
      expect(positiveSmear).toBe(LabAbnormalFlag.CRITICAL_HIGH);
    });
  });

  describe('Rule BR-LAB-02: Turnaround Time (TAT) Calculation', () => {
    it('calculates stage-by-stage TAT in minutes accurately', () => {
      const orderedAt = new Date('2026-10-27T08:00:00Z');
      const collectedAt = new Date('2026-10-27T08:15:00Z'); // 15 mins
      const receivedAt = new Date('2026-10-27T08:30:00Z');  // 15 mins
      const resultedAt = new Date('2026-10-27T09:15:00Z');  // 45 mins
      const authorizedAt = new Date('2026-10-27T09:30:00Z'); // 15 mins

      const tat = calculateTurnaroundTimes({
        orderedAt,
        collectedAt,
        receivedAt,
        resultedAt,
        authorizedAt,
      });

      expect(tat.orderToCollectionMinutes).toBe(15);
      expect(tat.collectionToReceiptMinutes).toBe(15);
      expect(tat.receiptToResultMinutes).toBe(45);
      expect(tat.resultToAuthorizationMinutes).toBe(15);
      expect(tat.totalTurnaroundMinutes).toBe(90);
    });
  });

  // ==========================================
  // 3. CLINICAL STATE MACHINE WORKFLOW RULES
  // ==========================================
  describe('Rule BR-WF-01: Order & Diagnostic State Machine Transitions', () => {
    it('enforces valid forward order transitions', () => {
      expect(canTransitionOrderStatus(ClinicalOrderStatus.SUBMITTED, ClinicalOrderStatus.ACTIVE)).toBe(true);
      expect(canTransitionOrderStatus(ClinicalOrderStatus.ACTIVE, ClinicalOrderStatus.COMPLETED)).toBe(true);
      expect(canTransitionOrderStatus(ClinicalOrderStatus.SUBMITTED, ClinicalOrderStatus.CANCELLED)).toBe(true);
    });

    it('rejects illegal order status regressions or skipping', () => {
      // Completed orders cannot be reverted to Draft or Submitted
      expect(canTransitionOrderStatus(ClinicalOrderStatus.COMPLETED, ClinicalOrderStatus.DRAFT)).toBe(false);
      expect(canTransitionOrderStatus(ClinicalOrderStatus.COMPLETED, ClinicalOrderStatus.SUBMITTED)).toBe(false);
      // Cancelled orders cannot be reopened
      expect(canTransitionOrderStatus(ClinicalOrderStatus.CANCELLED, ClinicalOrderStatus.ACTIVE)).toBe(false);
    });

    it('enforces specimen status integrity', () => {
      expect(canTransitionSpecimenStatus(SpecimenStatus.PENDING_COLLECTION, SpecimenStatus.COLLECTED)).toBe(true);
      expect(canTransitionSpecimenStatus(SpecimenStatus.COLLECTED, SpecimenStatus.RECEIVED_IN_LAB)).toBe(true);
      expect(canTransitionSpecimenStatus(SpecimenStatus.COLLECTED, SpecimenStatus.REJECTED)).toBe(true);
      // Completed specimen cannot regress to pending collection
      expect(canTransitionSpecimenStatus(SpecimenStatus.COMPLETED, SpecimenStatus.PENDING_COLLECTION)).toBe(false);
    });

    it('enforces diagnostic report authorization workflow', () => {
      expect(canTransitionReportStatus(DiagnosticReportStatus.REGISTERED, DiagnosticReportStatus.PARTIAL)).toBe(true);
      expect(canTransitionReportStatus(DiagnosticReportStatus.PARTIAL, DiagnosticReportStatus.PRELIMINARY)).toBe(true);
      expect(canTransitionReportStatus(DiagnosticReportStatus.PRELIMINARY, DiagnosticReportStatus.FINAL)).toBe(true);
      expect(canTransitionReportStatus(DiagnosticReportStatus.FINAL, DiagnosticReportStatus.AMENDED)).toBe(true);
      // Finalized report cannot regress to Registered
      expect(canTransitionReportStatus(DiagnosticReportStatus.FINAL, DiagnosticReportStatus.REGISTERED)).toBe(false);
    });
  });

  // ==========================================
  // 4. PHARMACY FEFO BATCH ALLOCATION & EXPIRY
  // ==========================================
  describe('Rule BR-PHARM-01: FEFO (First-Expired, First-Out) Inventory Allocation', () => {
    const referenceDate = new Date('2026-10-27T00:00:00Z');

    it('allocates strictly from the earliest expiring active batch first', () => {
      const batches = [
        {
          id: 'b-later',
          batchNumber: 'BATCH-2027',
          expiryDate: '2027-06-30',
          quantityOnHand: 100,
          status: BatchStatus.ACTIVE,
        },
        {
          id: 'b-soon',
          batchNumber: 'BATCH-2026-NOV',
          expiryDate: '2026-11-30',
          quantityOnHand: 20,
          status: BatchStatus.ACTIVE,
        },
        {
          id: 'b-mid',
          batchNumber: 'BATCH-2027-JAN',
          expiryDate: '2027-01-15',
          quantityOnHand: 50,
          status: BatchStatus.ACTIVE,
        },
      ];

      // Request 30 tablets: should take 20 from BATCH-2026-NOV and 10 from BATCH-2027-JAN
      const plan = allocateBatchesFEFO(batches, 30, referenceDate);

      expect(plan.isFullyAllocated).toBe(true);
      expect(plan.allocatedTotal).toBe(30);
      expect(plan.shortfall).toBe(0);
      expect(plan.allocations).toHaveLength(2);

      expect(plan.allocations[0].batchNumber).toBe('BATCH-2026-NOV');
      expect(plan.allocations[0].allocatedQuantity).toBe(20);

      expect(plan.allocations[1].batchNumber).toBe('BATCH-2027-JAN');
      expect(plan.allocations[1].allocatedQuantity).toBe(10);
    });

    it('disregards expired, quarantined, or recalled batches', () => {
      const batches = [
        {
          id: 'b-expired',
          batchNumber: 'BATCH-EXPIRED',
          expiryDate: '2026-10-01', // Expired relative to 2026-10-27
          quantityOnHand: 100,
          status: BatchStatus.ACTIVE,
        },
        {
          id: 'b-quarantine',
          batchNumber: 'BATCH-QUARANTINE',
          expiryDate: '2027-12-31',
          quantityOnHand: 100,
          status: BatchStatus.QUARANTINED,
        },
        {
          id: 'b-valid',
          batchNumber: 'BATCH-VALID',
          expiryDate: '2027-05-01',
          quantityOnHand: 15,
          status: BatchStatus.ACTIVE,
        },
      ];

      // Request 20: only 15 available in valid batch
      const plan = allocateBatchesFEFO(batches, 20, referenceDate);

      expect(plan.isFullyAllocated).toBe(false);
      expect(plan.allocatedTotal).toBe(15);
      expect(plan.shortfall).toBe(5);
      expect(plan.allocations).toHaveLength(1);
      expect(plan.allocations[0].batchNumber).toBe('BATCH-VALID');
    });

    it('correctly accounts for quantityReserved on batches', () => {
      const batches = [
        {
          id: 'b-1',
          batchNumber: 'BATCH-RESERVED',
          expiryDate: '2027-01-01',
          quantityOnHand: 50,
          quantityReserved: 35, // Only 15 available
          status: BatchStatus.ACTIVE,
        },
      ];

      const plan = allocateBatchesFEFO(batches, 20, referenceDate);
      expect(plan.allocatedTotal).toBe(15);
      expect(plan.shortfall).toBe(5);
      expect(plan.isFullyAllocated).toBe(false);
    });
  });

  describe('Rule BR-PHARM-02: Expiry Risk Category Assessment', () => {
    const referenceDate = new Date('2026-10-27T00:00:00Z');

    it('categorizes batches into correct risk levels based on remaining shelf life', () => {
      // Past expiry date -> EXPIRED
      expect(calculateExpiryRisk('2026-10-20', referenceDate)).toBe(ExpiryAlertLevel.EXPIRED);

      // <= 30 days -> EXPIRING_CRITICAL
      expect(calculateExpiryRisk('2026-11-15', referenceDate)).toBe(ExpiryAlertLevel.EXPIRING_CRITICAL);

      // <= 90 days -> EXPIRING_WARNING
      expect(calculateExpiryRisk('2026-12-25', referenceDate)).toBe(ExpiryAlertLevel.EXPIRING_WARNING);

      // > 90 days -> GOOD
      expect(calculateExpiryRisk('2027-06-01', referenceDate)).toBe(ExpiryAlertLevel.GOOD);
    });
  });
});
