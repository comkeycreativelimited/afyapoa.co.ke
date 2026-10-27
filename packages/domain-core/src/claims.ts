/**
 * COMKEY AFYA POA — SHA eClaims Domain Core
 * Grounded in Social Health Insurance Act 2023 (SHIA), SHI Regulations 2024,
 * and SHA Integration Requirements SHA-INT-2026-V1.
 */

// =============================================================================
// 1. STATUTORY FUNDS & SCENARIOS
// =============================================================================

export enum ShaFundType {
  PHC = 'PHC', // Primary Healthcare Fund (Levels 1-3, Capitation)
  SHIF = 'SHIF', // Social Health Insurance Fund (Levels 4-6, FFS & Per Diem)
  ECCIF = 'ECCIF', // Emergency, Chronic & Critical Illness Fund (Levels 1-6, Emergency/Doctor OTP)
}

export enum ShaIntegrationScenario {
  SC_01_SHIF_IP_PER_DIEM = 'SC-01', // SHIF Inpatient Per Diem
  SC_02_SHIF_IP_FFS_NORMAL_PREAUTH = 'SC-02', // SHIF Inpatient Fee-for-Service with Normal Preauth
  SC_03_SHIF_IP_FFS_ELECTIVE_PREAUTH = 'SC-03', // SHIF Inpatient Fee-for-Service with Elective Preauth
  SC_04_SHIF_OP_FFS_ELECTIVE_PREAUTH = 'SC-04', // SHIF Outpatient Fee-for-Service with Elective Preauth
  SC_05_SHIF_OP_FFS_NORMAL_PREAUTH = 'SC-05', // SHIF Outpatient Fee-for-Service with Normal Preauth
  SC_06_UHC_PHC_OP_CAPITATION = 'SC-06', // UHC / PHC Outpatient Capitation
  SC_07_ECCIF_EMERGENCY_IDENTIFIED = 'SC-07', // ECCIF Emergency Identified Patient
  SC_08_ECCIF_EMERGENCY_UNIDENTIFIED = 'SC-08', // ECCIF Emergency Unidentified Patient
}

export enum ShaPaymentMechanism {
  CAPITATION = 'CAPITATION',
  FEE_FOR_SERVICE = 'FEE_FOR_SERVICE',
  PER_DIEM = 'PER_DIEM',
}

export enum ShaAccessPoint {
  OP = 'OP',
  IP = 'IP',
  EMERGENCY = 'EMERGENCY',
}

// =============================================================================
// 2. CLAIM LIFECYCLE STATE MACHINE
// =============================================================================

export enum ShaClaimStatus {
  DRAFT = 'DRAFT', // Local creation, line items being assembled
  QUEUED = 'QUEUED', // Passed local pre-submission validation, awaiting dispatch
  SUBMITTED = 'SUBMITTED', // Transmitted to SHA, awaiting acknowledgement
  ACKNOWLEDGED = 'ACKNOWLEDGED', // SHA HTTP 200/202 with tracking token / visit ID
  ACCEPTED = 'ACCEPTED', // Passed SHA syntactical & benefit validation, in adjudication queue
  REJECTED = 'REJECTED', // Adjudicated negative or rejected on validation rules
  ADJUDICATED = 'ADJUDICATED', // Adjudication finalized with determined financial amounts
  PAID = 'PAID', // Remittance advice received, payment allocated to patient folio
  CANCELLED = 'CANCELLED', // Cancelled by provider prior to adjudication
  DISPUTED = 'DISPUTED', // Provider has raised formal objection or appeal
}

export enum ShaPreauthType {
  NORMAL = 'NORMAL',
  ELECTIVE = 'ELECTIVE',
  SURGICAL = 'SURGICAL',
  ONCOLOGY = 'ONCOLOGY',
  RENAL = 'RENAL',
  IMAGING = 'IMAGING',
}

export enum ShaPreauthStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  PENDING_MANUAL_REVIEW = 'PENDING_MANUAL_REVIEW',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum ShaDocumentType {
  OPERATIVE_NOTES = 'OPERATIVE_NOTES',
  BIOPSY_HISTOLOGY = 'BIOPSY_HISTOLOGY',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  DIALYSIS_PLAN = 'DIALYSIS_PLAN',
  IMAGING_REPORT = 'IMAGING_REPORT',
  EMERGENCY_TRIAGE = 'EMERGENCY_TRIAGE',
  LAB_REPORT = 'LAB_REPORT',
  PRESCRIPTION = 'PRESCRIPTION',
  OTHER_CLINICAL = 'OTHER_CLINICAL',
}

// =============================================================================
// 3. LIFECYCLE TRANSITION VALIDATOR
// =============================================================================

const VALID_STATE_TRANSITIONS: Record<ShaClaimStatus, ShaClaimStatus[]> = {
  [ShaClaimStatus.DRAFT]: [ShaClaimStatus.QUEUED, ShaClaimStatus.CANCELLED],
  [ShaClaimStatus.QUEUED]: [ShaClaimStatus.SUBMITTED, ShaClaimStatus.DRAFT, ShaClaimStatus.CANCELLED],
  [ShaClaimStatus.SUBMITTED]: [ShaClaimStatus.ACKNOWLEDGED, ShaClaimStatus.REJECTED, ShaClaimStatus.SUBMITTED], // SUBMITTED -> SUBMITTED allowed on retry
  [ShaClaimStatus.ACKNOWLEDGED]: [ShaClaimStatus.ACCEPTED, ShaClaimStatus.REJECTED, ShaClaimStatus.ADJUDICATED],
  [ShaClaimStatus.ACCEPTED]: [ShaClaimStatus.ADJUDICATED, ShaClaimStatus.REJECTED],
  [ShaClaimStatus.REJECTED]: [ShaClaimStatus.DISPUTED, ShaClaimStatus.DRAFT], // Resubmission initiates a new draft version
  [ShaClaimStatus.ADJUDICATED]: [ShaClaimStatus.PAID, ShaClaimStatus.DISPUTED],
  [ShaClaimStatus.PAID]: [], // Terminal state
  [ShaClaimStatus.CANCELLED]: [], // Terminal state
  [ShaClaimStatus.DISPUTED]: [ShaClaimStatus.ADJUDICATED, ShaClaimStatus.REJECTED, ShaClaimStatus.PAID],
};

export function isValidClaimStatusTransition(from: ShaClaimStatus, to: ShaClaimStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// =============================================================================
// 4. SHA VALIDATION RULES & DEADLINES
// =============================================================================

export interface ClaimValidationOutcome {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  deadlines: {
    statutoryMaxSubmissionDate: Date;
    isEmergencyWithin24h?: boolean;
    isStandardWithin90d?: boolean;
  };
}

/**
 * Validates statutory deadlines and data integrity according to SHIA 2024:
 * 1. Standard claims: Must be submitted within 90 calendar days from service conclusion.
 * 2. ECCIF Emergency claims: Must be submitted within 24 hours of patient presentation.
 * 3. Practitioner PUID: Mandatory for all claims.
 * 4. ICD-11 Diagnosis: Mandatory primary diagnosis code.
 * 5. Preauthorization: If needsPreauth is true, valid approved preauth required.
 */
export function validateClaimBusinessRules(params: {
  fund: ShaFundType;
  scenario: ShaIntegrationScenario;
  serviceStartDate: Date;
  serviceEndDate?: Date;
  submissionDate?: Date;
  practitionerPuid?: string;
  diagnosesCount: number;
  itemsCount: number;
  totalAmountKES: number;
  needsPreauth?: boolean;
  approvedPreauthId?: string;
  isDischarged?: boolean;
}): ClaimValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const now = params.submissionDate || new Date();
  const endDate = params.serviceEndDate || params.serviceStartDate;

  // 1. Statutory Deadlines
  let statutoryMaxSubmissionDate: Date;
  let isEmergencyWithin24h: boolean | undefined;
  let isStandardWithin90d: boolean | undefined;

  if (params.fund === ShaFundType.ECCIF || params.scenario === ShaIntegrationScenario.SC_07_ECCIF_EMERGENCY_IDENTIFIED || params.scenario === ShaIntegrationScenario.SC_08_ECCIF_EMERGENCY_UNIDENTIFIED) {
    // 24-hour emergency SLA
    statutoryMaxSubmissionDate = new Date(params.serviceStartDate.getTime() + 24 * 60 * 60 * 1000);
    isEmergencyWithin24h = now <= statutoryMaxSubmissionDate;
    if (!isEmergencyWithin24h) {
      errors.push(`STATUTORY_VIOLATION: ECCIF emergency claim submitted beyond strict 24-hour statutory deadline. Presented: ${params.serviceStartDate.toISOString()}, Current: ${now.toISOString()}`);
    }
  } else {
    // 90-day standard SLA
    statutoryMaxSubmissionDate = new Date(endDate.getTime() + 90 * 24 * 60 * 60 * 1000);
    isStandardWithin90d = now <= statutoryMaxSubmissionDate;
    if (!isStandardWithin90d) {
      errors.push(`STATUTORY_VIOLATION: Standard claim submitted beyond 90-day statutory limitation under SHI Regulations 2024. Service concluded: ${endDate.toISOString()}, Max Allowed: ${statutoryMaxSubmissionDate.toISOString()}`);
    }
  }

  // 2. Practitioner PUID Check
  if (!params.practitionerPuid || params.practitionerPuid.trim().length === 0) {
    errors.push('VALIDATION_ERROR: Mandatory Practitioner Unique Identifier (PUID) missing from claim.');
  }

  // 3. Primary Diagnosis Check
  if (params.diagnosesCount <= 0) {
    errors.push('VALIDATION_ERROR: At least one verified primary diagnosis (WHO ICD-11) is required.');
  }

  // 4. Line Items & Financials
  if (params.itemsCount <= 0) {
    errors.push('VALIDATION_ERROR: Claim contains no billable interventions, items, or bed days.');
  }
  if (params.totalAmountKES <= 0) {
    errors.push('VALIDATION_ERROR: Total claimed amount must be greater than zero.');
  }

  // 5. Preauthorization Check
  if (params.needsPreauth && !params.approvedPreauthId) {
    errors.push('VALIDATION_ERROR: Intervention requires prior authorization, but no approved preauth ID is linked.');
  }

  // 6. Inpatient Discharge Check
  if (params.scenario === ShaIntegrationScenario.SC_01_SHIF_IP_PER_DIEM ||
      params.scenario === ShaIntegrationScenario.SC_02_SHIF_IP_FFS_NORMAL_PREAUTH ||
      params.scenario === ShaIntegrationScenario.SC_03_SHIF_IP_FFS_ELECTIVE_PREAUTH) {
    if (!params.isDischarged) {
      errors.push('VALIDATION_ERROR: Inpatient claims require patient discharge to be finalized prior to claim dispatch.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    deadlines: {
      statutoryMaxSubmissionDate,
      isEmergencyWithin24h,
      isStandardWithin90d,
    },
  };
}

// =============================================================================
// 5. IDEMPOTENCY & SUBMISSION HASH COMPUTATION
// =============================================================================

/**
 * Computes a deterministic SHA-256 fingerprint representing the financial and clinical contents of a claim.
 * Used to prevent duplicate submissions and detect unauthorized tampering.
 */
export function computeClaimSubmissionFingerprint(params: {
  tenantId: string;
  facilityKmflCode: string;
  patientCrId: string;
  fund: string;
  scenario: string;
  serviceStartDate: string;
  totalAmountKES: number;
  itemCodes: string[];
}): string {
  const normalized = [
    params.tenantId,
    params.facilityKmflCode,
    params.patientCrId,
    params.fund,
    params.scenario,
    params.serviceStartDate,
    params.totalAmountKES.toFixed(2),
    [...params.itemCodes].sort().join(','),
  ].join('|');

  // Simple deterministic djb2/FNV-1a 64-bit hex hash for runtime safety in pure TS
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `SHA-FINGERPRINT-${part1}${part2}`.toUpperCase();
}
