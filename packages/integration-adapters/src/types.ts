/**
 * COMKEY AFYA POA — External Healthcare Integration Ports & Data Contracts
 * Grounded in DHA-REQ-2026-V1 (Digital Health Agency) and SHA-INT-2026-V1 (Social Health Authority).
 */

import { KenyaCoreBundle, KenyaCoreClaim } from '@afyapoa/fhir-models';
import { Result } from '@afyapoa/domain-core';

// =============================================================================
// 1. INTEGRATION OPERATIONAL MODES & ENVIRONMENT CONTROLS
// =============================================================================

export type IntegrationMode = 'MOCK' | 'UAT' | 'PROD';

export interface IntegrationClientOptions {
  mode?: IntegrationMode;
  dhaBaseUrl?: string;
  shaBaseUrl?: string;
  etimsBaseUrl?: string;
  mpesaBaseUrl?: string;
  dhaClientId?: string;
  dhaClientSecret?: string;
  shaApiKey?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// =============================================================================
// 2. STRUCTURED ERROR HANDLING & CLASSIFICATION
// =============================================================================

export enum IntegrationErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  TIMEOUT = 'TIMEOUT',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  GATEWAY_ERROR = 'GATEWAY_ERROR',
  DUPLICATE_SUBMISSION = 'DUPLICATE_SUBMISSION',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  CONSENT_REQUIRED = 'CONSENT_REQUIRED',
  PREAUTH_REQUIRED = 'PREAUTH_REQUIRED',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  PRODUCTION_GUARD_TRIGGERED = 'PRODUCTION_GUARD_TRIGGERED',
}

export class IntegrationError extends Error {
  constructor(
    public readonly code: IntegrationErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly correlationId?: string,
    public readonly retryable: boolean = false,
    public readonly retryAfterMs?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`[${code}] ${message}${correlationId ? ` (Correlation: ${correlationId})` : ''}`);
    this.name = 'IntegrationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// =============================================================================
// 3. DHA CLIENT REGISTRY (CR / MPI) CONTRACTS
// =============================================================================

export interface ClientRegistryPatient {
  crId: string;
  upi: string;
  identificationType: string;
  identificationNumber: string;
  shaNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  primaryPhone?: string;
  nationality: string;
  status: 'VERIFIED' | 'UNINDEXED' | 'PENDING';
  verifiedAt: string;
  source: string;
  isSynthetic?: boolean;
}

export interface ClientRegistryResult {
  crid: string;
  nationalId: string;
  fullName: string;
  birthDate: string;
  gender: string;
  status: 'VERIFIED' | 'UNINDEXED';
  isSynthetic?: boolean;
}

export interface IDhaClientRegistryClient {
  lookupClient(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient>>;

  lookupClientByNationalId(
    nationalId: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryResult>>;

  resolveUpi(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ upi: string; crId: string }>>;

  searchBeneficiaries(
    query: { name?: string; phone?: string; county?: string },
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient[]>>;
}

// =============================================================================
// 4. DHA FACILITY REGISTRY (FR / KMFL) CONTRACTS
// =============================================================================

export interface FacilityRegistryResult {
  kmflCode: string;
  name: string;
  level: string; // LEVEL_1 through LEVEL_6
  county: string;
  subCounty?: string;
  facilityType?: string;
  active: boolean;
  isSynthetic?: boolean;
}

export interface IDhaFacilityRegistryClient {
  verifyFacilityByKmfl(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>>;

  getFacilityDetails(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>>;
}

// =============================================================================
// 5. DHA HEALTH WORKER REGISTRY (HWR) CONTRACTS
// =============================================================================

export interface HealthWorkerResult {
  puid: string;
  practitionerName: string;
  cadre: string;
  licenseNumber: string;
  board: 'KMPDC' | 'NCK' | 'PPB' | 'COC';
  licenseStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  validUntil?: string;
  isSynthetic?: boolean;
}

export interface IDhaHealthWorkerRegistryClient {
  verifyHealthWorkerByPuid(
    puid: string,
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>>;

  checkLicenseStatus(
    puid: string,
    board: 'KMPDC' | 'NCK' | 'PPB' | 'COC',
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>>;
}

// =============================================================================
// 6. DHA PATIENT CONSENT MANAGEMENT CONTRACTS
// =============================================================================

export interface PatientContactOption {
  contactId: string;
  maskedPhone: string;
  contactType: 'MOBILE' | 'EMAIL';
  isPrimary: boolean;
}

export interface OpenVisitCheckResult {
  hasOpenVisit: boolean;
  visitId?: string;
  consentToken?: string;
  openedAt?: string;
  facilityCode?: string;
}

export interface OtpConsentRequestResult {
  consentId: string;
  otpRecord: string;
  expiresInSeconds: number;
  maskedDestination: string;
  status: 'PENDING_VERIFICATION';
}

export interface VerifyConsentResult {
  consentToken: string;
  visitId: string;
  patientCrId: string;
  status: 'AUTHORIZED' | 'REJECTED';
  validUntil: string;
  isEmergency?: boolean;
}

export interface BiometricConsentResult {
  consentId: string;
  iframeUrl: string;
  status: 'PENDING_BIOMETRIC' | 'AUTHORIZED';
  visitId?: string;
  consentToken?: string;
}

export interface IDhaConsentClient {
  checkOpenVisits(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OpenVisitCheckResult>>;

  getPatientContacts(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PatientContactOption[]>>;

  requestOtpConsent(
    patientCrId: string,
    contactId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OtpConsentRequestResult>>;

  verifyOtpConsent(
    consentId: string,
    otpCode: string,
    otpRecord: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>>;

  authorizeBiometricConsent(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<BiometricConsentResult>>;

  authorizeEmergencyConsent(
    patientCrId: string,
    incapacityReason: string,
    facilityCode: string,
    doctorPuid: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>>;

  closeVisit(
    visitId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ message: string; closedAt: string }>>;
}

// =============================================================================
// 7. DHA SHARED HEALTH RECORD (SHR) CONTRACTS
// =============================================================================

export interface ShrBundleIngestionResult {
  bundleId: string;
  status: 'INGESTED' | 'QUEUED';
  resourceCount: number;
  timestamp: string;
  isSynthetic?: boolean;
}

export interface ShrPatientRecordsQuery {
  patientCrId: string;
  puid: string;
  consentToken: string;
  facilityCode: string;
  resourceTypes?: string[]; // Observation, Condition, DiagnosticReport, etc.
  correlationId?: string;
}

export interface ShrPatientRecordsResult {
  patientCrId: string;
  bundle: KenyaCoreBundle;
  recordsCount: number;
  retrievedAt: string;
  isSynthetic?: boolean;
}

export interface IDhaSharedHealthRecordClient {
  ingestClinicalBundle(
    bundle: KenyaCoreBundle,
    facilityCode: string,
    consentToken: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShrBundleIngestionResult>>;

  queryPatientRecords(
    query: ShrPatientRecordsQuery,
  ): Promise<Result<ShrPatientRecordsResult>>;
}

// =============================================================================
// 8. DHA TERMINOLOGY SERVICE (TS) CONTRACTS
// =============================================================================

export interface TerminologyValidationResult {
  isValid: boolean;
  system: string; // WHO_ICD_11, LOINC, WHO_ICHI, KENYA_HPT
  code: string;
  display: string;
  category?: string;
  deprecated?: boolean;
}

export interface IDhaTerminologyClient {
  validateConcept(
    system: string,
    code: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult>>;

  searchConcepts(
    system: string,
    queryText: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult[]>>;
}

// =============================================================================
// 9. SHA BENEFICIARY ELIGIBILITY & SUB-BENEFITS CONTRACTS
// =============================================================================

export interface ShaEligibilityResult {
  eligible: boolean;
  memberNumber: string;
  fundType: 'PHC' | 'SHIF' | 'ECCIF';
  benefitBalanceKES: number;
  copayRequired: boolean;
  preauthRequired: boolean;
  coverageStatus: 'ACTIVE' | 'SUSPENDED' | 'EXHAUSTED' | 'INACTIVE';
  message?: string;
  activeSchemes: Array<{
    fund: 'PHC' | 'SHIF' | 'ECCIF';
    name: string;
    isActive: boolean;
  }>;
  isSynthetic?: boolean;
}

export interface ShaSubBenefitItem {
  subBenefitCode: string;
  subBenefitName: string;
  fund: 'PHC' | 'SHIF' | 'ECCIF';
  benefitCapKES: number;
  remainingBalanceKES: number;
  preauthMandatory: boolean;
}

export interface ShaInterventionItem {
  interventionCode: string;
  interventionName: string;
  subBenefitCode: string;
  paymentMechanism: 'PER_DIEM' | 'FEE_FOR_SERVICE' | 'CAPITATION';
  needsPreauth: boolean;
  needsManualPreauthApproval: boolean;
  accessPoint: 'IP' | 'OP' | 'BOTH';
  fund: 'PHC' | 'SHIF' | 'ECCIF';
  standardTariffKES: number;
}

export interface IShaEligibilityClient {
  checkEligibility(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaEligibilityResult>>;

  getSubBenefits(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaSubBenefitItem[]>>;

  getInterventions(
    patientCrId: string,
    subBenefitCode: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaInterventionItem[]>>;
}

// =============================================================================
// 10. SHA PREAUTHORIZATION CONTRACTS
// =============================================================================

export interface PreauthSubmissionRequest {
  patientCrId: string;
  subBenefitCode: string;
  interventionCode: string;
  requestedAmountKES: number;
  preauthType: 'NORMAL' | 'ELECTIVE' | 'SURGICAL' | 'ONCOLOGY' | 'RENAL' | 'IMAGING';
  clinicalSummary: string;
  estimatedStayDays?: number;
  supportingDocumentUrls?: string[];
}

export interface PreauthResult {
  preauthId: string;
  preauthNumber: string;
  status: 'APPROVED' | 'PENDING_MANUAL_REVIEW' | 'REJECTED';
  approvedAmountKES: number;
  decisionReason?: string;
  validUntil: string;
  isSynthetic?: boolean;
}

export interface IShaPreauthClient {
  submitPreauthorization(
    request: PreauthSubmissionRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>>;

  cancelPreauthorization(
    preauthId: string,
    reason: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ cancelled: boolean; message: string }>>;

  queryPreauthStatus(
    preauthId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>>;
}

// =============================================================================
// 11. SHA eCLAIMS PROCESSING CONTRACTS
// =============================================================================

export interface StartClaimVisitRequest {
  patientCrId: string;
  consentToken: string;
  encounterId: string;
  payerType: 'SHA_PHC' | 'SHA_SHIF' | 'SHA_ECCIF';
  emergencyFlag?: boolean;
}

export interface StartClaimVisitResult {
  shaVisitId: string;
  visitNumber: string;
  status: 'OPEN';
  startedAt: string;
}

export interface ShaClaimResult {
  claimId: string;
  status: 'QUEUED' | 'ADJUDICATED' | 'APPROVED' | 'REJECTED' | 'DISPUTED';
  trackingNumber: string;
  adjudicatedAmountKES?: number;
  rejectionReason?: string;
  timestamp: string;
  isSynthetic?: boolean;
}

export interface InpatientDischargeClaimRequest {
  claimId: string;
  dischargeDate: string;
  dischargeDisposition: 'HOME' | 'TRANSFERRED' | 'DECEASED';
  finalDiagnosisIcd11: string;
  summaryNotes: string;
}

export interface IShaClaimsClient {
  startClaimVisit(
    request: StartClaimVisitRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<StartClaimVisitResult>>;

  checkEligibility?(
    memberNumber: string,
    facilityCode?: string,
    correlationId?: string,
  ): Promise<Result<ShaEligibilityResult>>;

  submitClaim(
    claim: KenyaCoreClaim,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>>;

  dischargeInpatientClaim(
    request: InpatientDischargeClaimRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>>;

  queryClaimStatus(
    claimId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>>;

  reconcileBatch?(
    query: { fromDate?: string; toDate?: string; status?: string },
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ batchId: string; totalClaims: number; claims: ShaClaimResult[] }>>;

  uploadAttachment?(
    claimId: string,
    documentType: string,
    fileData: { title: string; mimeType: string; fileUrl: string },
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ attachmentId: string; status: string }>>;

  addIntervention?(
    visitId: string,
    interventionCode: string,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; status: string }>>;

  addBillingLines?(
    visitId: string,
    lines: Array<{ code: string; amountKES: number }>,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; linesAdded: number }>>;

  addDiagnoses?(
    visitId: string,
    diagnoses: Array<{ system: string; code: string }>,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; diagnosesRecorded: number }>>;
}

// =============================================================================
// 12. KRA eTIMS FISCAL SERVICE CONTRACTS
// =============================================================================

export interface EtimsInvoiceResult {
  controlCode: string;
  qrCodeUrl: string;
  status: 'SIGNED' | 'BUFFERED';
  timestamp: string;
  isSynthetic?: boolean;
}

export interface IKraEtimsClient {
  signInvoice(
    invoicePayload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>>;

  issueCreditNote(
    creditNotePayload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>>;
}

// =============================================================================
// 13. M-PESA DARAJA PAYMENT GATEWAY (PROVISIONAL ADAPTER PORT)
// =============================================================================

export interface MpesaStkPushRequest {
  phoneNumber: string; // Kenyan format +254... or 07...
  amount: number;
  accountReference: string; // Invoice number or Patient MRN
  transactionDesc: string;
}

export interface MpesaStkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string;
  responseCode: string;
  customerMessage: string;
  status: 'INITIATED' | 'COMPLETED' | 'FAILED';
  isSimulated: boolean;
}

export interface MpesaQueryResult {
  checkoutRequestId: string;
  mpesaReceiptNumber: string;
  resultCode: number;
  resultDesc: string;
  amount: number;
  phoneNumber: string;
  transactionDate: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  isSimulated: boolean;
}

export interface IMpesaPaymentClient {
  initiateStkPush(
    request: MpesaStkPushRequest,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaStkPushResult>>;

  queryPaymentStatus(
    checkoutRequestId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaQueryResult>>;
}

// =============================================================================
// 14. AGGREGATE INTEGRATION CLIENTS CONTAINER
// =============================================================================

export interface IntegrationClients {
  mode: IntegrationMode;
  dhaHie: IDhaClientRegistryClient &
    IDhaFacilityRegistryClient &
    IDhaHealthWorkerRegistryClient &
    IDhaConsentClient &
    IDhaSharedHealthRecordClient &
    IDhaTerminologyClient;
  shaEligibility: IShaEligibilityClient;
  shaPreauth: IShaPreauthClient;
  shaClaims: IShaClaimsClient;
  kraEtims: IKraEtimsClient;
  mpesa: IMpesaPaymentClient;
}
