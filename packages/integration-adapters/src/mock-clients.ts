/**
 * COMKEY AFYA POA — Synthetic In-Memory Mock Adapters
 * Implements deterministic local simulations for all verified DHA & SHA capabilities.
 * Clearly labels all synthetic outputs and identifies mock assumptions.
 */

import { KenyaCoreBundle, KenyaCoreClaim } from '@afyapoa/fhir-models';
import { Result } from '@afyapoa/domain-core';
import {
  IDhaClientRegistryClient,
  IDhaFacilityRegistryClient,
  IDhaHealthWorkerRegistryClient,
  IDhaConsentClient,
  IDhaSharedHealthRecordClient,
  IDhaTerminologyClient,
  IShaEligibilityClient,
  IShaPreauthClient,
  IShaClaimsClient,
  IKraEtimsClient,
  IMpesaPaymentClient,
  ClientRegistryPatient,
  ClientRegistryResult,
  FacilityRegistryResult,
  HealthWorkerResult,
  OpenVisitCheckResult,
  PatientContactOption,
  OtpConsentRequestResult,
  VerifyConsentResult,
  BiometricConsentResult,
  ShrBundleIngestionResult,
  ShrPatientRecordsQuery,
  ShrPatientRecordsResult,
  TerminologyValidationResult,
  ShaEligibilityResult,
  ShaSubBenefitItem,
  ShaInterventionItem,
  PreauthSubmissionRequest,
  PreauthResult,
  StartClaimVisitRequest,
  StartClaimVisitResult,
  ShaClaimResult,
  InpatientDischargeClaimRequest,
  EtimsInvoiceResult,
  MpesaStkPushRequest,
  MpesaStkPushResult,
  MpesaQueryResult,
  IntegrationError,
  IntegrationErrorCode,
} from './types.js';

export const MOCK_ASSUMPTION_NOTE =
  'SYNTHETIC IN-MEMORY SIMULATION: Verified against DHA-REQ-2026-V1 and SHA-INT-2026-V1. Not connected to external DHA/SHA production network.';

// =============================================================================
// 1. MOCK DHA HIE CLIENT (Client Registry, FR, HWR, Consent, SHR, Terminology)
// =============================================================================

export class MockDhaHieClient
  implements
    IDhaClientRegistryClient,
    IDhaFacilityRegistryClient,
    IDhaHealthWorkerRegistryClient,
    IDhaConsentClient,
    IDhaSharedHealthRecordClient,
    IDhaTerminologyClient
{
  private readonly clients = new Map<string, ClientRegistryPatient>();
  private readonly facilities = new Map<string, FacilityRegistryResult>();
  private readonly healthWorkers = new Map<string, HealthWorkerResult>();
  private readonly openVisits = new Map<string, OpenVisitCheckResult>();
  private readonly storedBundles = new Map<string, KenyaCoreBundle>();
  private readonly activeConsents = new Map<string, { otp: string; crId: string; record: string }>();

  // Configurable deterministic fault injection for testing
  private simulatedFault: IntegrationErrorCode | null = null;

  constructor() {
    this.seedDefaults();
  }

  setSimulatedFault(fault: IntegrationErrorCode | null) {
    this.simulatedFault = fault;
  }

  setClient(nationalId: string, patient: ClientRegistryPatient) {
    this.clients.set(nationalId, patient);
  }

  setFacility(kmflCode: string, facility: FacilityRegistryResult) {
    this.facilities.set(kmflCode, facility);
  }

  setHealthWorker(puid: string, worker: HealthWorkerResult) {
    this.healthWorkers.set(puid, worker);
  }

  private checkFault(correlationId?: string): IntegrationError | null {
    if (this.simulatedFault) {
      const fault = this.simulatedFault;
      this.simulatedFault = null; // one-shot fault or manually persistent
      switch (fault) {
        case IntegrationErrorCode.TIMEOUT:
          return new IntegrationError(IntegrationErrorCode.TIMEOUT, 'Simulated DHA Gateway Timeout (504)', 504, correlationId, true);
        case IntegrationErrorCode.RATE_LIMITED:
          return new IntegrationError(IntegrationErrorCode.RATE_LIMITED, 'Simulated DHA Rate Limit Exceeded (429)', 429, correlationId, true, 1000);
        case IntegrationErrorCode.SERVICE_UNAVAILABLE:
          return new IntegrationError(IntegrationErrorCode.SERVICE_UNAVAILABLE, 'Simulated DHA Service Unavailable (503)', 503, correlationId, true);
        case IntegrationErrorCode.AUTH_FAILED:
          return new IntegrationError(IntegrationErrorCode.AUTH_FAILED, 'Simulated OAuth Token Expired or Invalid (401)', 401, correlationId, false);
        case IntegrationErrorCode.FORBIDDEN:
          return new IntegrationError(IntegrationErrorCode.FORBIDDEN, 'Simulated Unauthorized Practitioner PUID (403)', 403, correlationId, false);
        case IntegrationErrorCode.VALIDATION_FAILED:
          return new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'Simulated Schema Validation Error (422)', 422, correlationId, false);
        default:
          return new IntegrationError(fault, `Simulated Integration Fault: ${fault}`, 500, correlationId, false);
      }
    }
    return null;
  }

  private seedDefaults() {
    // 1. Client Registry Patients
    this.clients.set('12345678', {
      crId: 'CRID-KE-DHA-12345678',
      upi: 'UPI-KEN-2026-12345678',
      identificationType: 'KENYA_NATIONAL_ID',
      identificationNumber: '12345678',
      shaNumber: 'SHIF-9988776655',
      firstName: 'Jane',
      middleName: 'Muthoni',
      lastName: 'Mwangi',
      dateOfBirth: '1988-04-12',
      gender: 'FEMALE',
      primaryPhone: '+254712345678',
      nationality: 'KENYAN',
      status: 'VERIFIED',
      verifiedAt: '2026-10-19T00:00:00Z',
      source: 'MOCK_CLIENT_REGISTRY',
      isSynthetic: true,
    });

    this.clients.set('23456789', {
      crId: 'CRID-KE-DHA-23456789',
      upi: 'UPI-KEN-2026-23456789',
      identificationType: 'KENYA_NATIONAL_ID',
      identificationNumber: '23456789',
      shaNumber: 'SHIF-8877665544',
      firstName: 'David',
      middleName: 'Kiprono',
      lastName: 'Kipkorir',
      dateOfBirth: '1992-09-18',
      gender: 'MALE',
      primaryPhone: '+254722112233',
      nationality: 'KENYAN',
      status: 'VERIFIED',
      verifiedAt: '2026-10-19T00:00:00Z',
      source: 'MOCK_CLIENT_REGISTRY',
      isSynthetic: true,
    });

    // 2. Facility Registry
    this.facilities.set('FID-01-000101-1', {
      kmflCode: 'FID-01-000101-1',
      name: 'Nairobi Metropolitan Referral Hospital (Mock)',
      level: 'LEVEL_5',
      county: 'Nairobi',
      subCounty: 'Westlands',
      active: true,
      isSynthetic: true,
    });

    // 3. Health Workers
    this.healthWorkers.set('PUID-KMPDC-A0001', {
      puid: 'PUID-KMPDC-A0001',
      practitionerName: 'Dr. David Otieno (Mock)',
      cadre: 'Medical Officer',
      licenseNumber: 'KMPDC-LIC-99999',
      board: 'KMPDC',
      licenseStatus: 'ACTIVE',
      validUntil: '2027-12-31',
      isSynthetic: true,
    });
  }

  // --- Client Registry ---

  async lookupClient(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient>> {
    const fault = this.checkFault(correlationId);
    if (fault) {
      return Result.fail(fault);
    }
    const trimmed = identificationNumber.trim();

    if (!facilityCode) {
      return Result.fail(new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'Mandatory header X-Facility-Id is missing', 400, correlationId));
    }

    if (trimmed === '00000000') {
      return Result.fail(
        new IntegrationError(
          IntegrationErrorCode.TIMEOUT,
          '[MOCK_CLIENT_REGISTRY] Gateway Timeout connecting to DHA HIE Client Registry (504)',
          504,
          correlationId,
          true,
        ),
      );
    }

    const patient = this.clients.get(trimmed);
    if (patient) {
      return Result.ok({ ...patient, isSynthetic: true });
    }

    return Result.ok({
      crId: '',
      upi: '',
      identificationType,
      identificationNumber: trimmed,
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'UNKNOWN',
      nationality: 'KENYAN',
      status: 'UNINDEXED',
      verifiedAt: new Date().toISOString(),
      source: 'MOCK_CLIENT_REGISTRY',
      isSynthetic: true,
    });
  }

  async lookupClientByNationalId(
    nationalId: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryResult>> {
    this.checkFault(correlationId);
    const res = await this.lookupClient('KENYA_NATIONAL_ID', nationalId, 'FID-01-000101-1', correlationId);
    if (res.isFailure()) {
      return Result.fail(res.getError());
    }
    const p = res.getValue();
    return Result.ok({
      crid: p.crId || `CRID-2026-${nationalId}`,
      nationalId,
      fullName: p.status === 'VERIFIED' ? `${p.firstName} ${p.lastName}` : 'Unindexed Patient',
      birthDate: p.dateOfBirth || '1990-01-01',
      gender: p.gender.toLowerCase(),
      status: p.status === 'VERIFIED' ? 'VERIFIED' : 'UNINDEXED',
      isSynthetic: true,
    });
  }

  async resolveUpi(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ upi: string; crId: string }>> {
    this.checkFault(correlationId);
    const clientRes = await this.lookupClient(identificationType, identificationNumber, facilityCode, correlationId);
    if (clientRes.isFailure()) {
      return Result.fail(clientRes.getError());
    }
    const patient = clientRes.getValue();
    if (patient.status !== 'VERIFIED') {
      return Result.fail(
        new IntegrationError(
          IntegrationErrorCode.NOT_FOUND,
          `Patient identifier ${identificationNumber} is unindexed in Client Registry`,
          404,
          correlationId,
        ),
      );
    }
    return Result.ok({ upi: patient.upi, crId: patient.crId });
  }

  async searchBeneficiaries(
    query: { name?: string; phone?: string; county?: string },
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient[]>> {
    this.checkFault(correlationId);
    const list = Array.from(this.clients.values());
    const filtered = list.filter((p) => {
      if (query.name && !`${p.firstName} ${p.lastName}`.toLowerCase().includes(query.name.toLowerCase())) {
        return false;
      }
      if (query.phone && p.primaryPhone !== query.phone) {
        return false;
      }
      return true;
    });
    return Result.ok(filtered);
  }

  // --- Facility Registry ---

  async verifyFacilityByKmfl(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>> {
    this.checkFault(correlationId);
    const fac = this.facilities.get(kmflCode) || {
      kmflCode,
      name: `Healthcare Facility ${kmflCode} (Mock)`,
      level: 'LEVEL_4',
      county: 'Nairobi',
      active: true,
      isSynthetic: true,
    };
    return Result.ok(fac);
  }

  async getFacilityDetails(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>> {
    return this.verifyFacilityByKmfl(kmflCode, correlationId);
  }

  // --- Health Worker Registry ---

  async verifyHealthWorkerByPuid(
    puid: string,
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>> {
    this.checkFault(correlationId);
    if (puid.includes('SUSPENDED')) {
      return Result.ok({
        puid,
        practitionerName: 'Suspended Practitioner (Mock)',
        cadre: 'Medical Officer',
        licenseNumber: 'KMPDC-SUSP-001',
        board: 'KMPDC',
        licenseStatus: 'SUSPENDED',
        isSynthetic: true,
      });
    }

    const worker = this.healthWorkers.get(puid) || {
      puid,
      practitionerName: `Practitioner ${puid} (Mock)`,
      cadre: 'Medical Officer',
      licenseNumber: 'KMPDC-LIC-AUTO',
      board: 'KMPDC',
      licenseStatus: 'ACTIVE',
      validUntil: '2027-12-31',
      isSynthetic: true,
    };
    return Result.ok(worker);
  }

  async checkLicenseStatus(
    puid: string,
    board: 'KMPDC' | 'NCK' | 'PPB' | 'COC',
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>> {
    const res = await this.verifyHealthWorkerByPuid(puid, correlationId);
    if (res.isFailure()) return res;
    const worker = res.getValue();
    return Result.ok({ ...worker, board });
  }

  // --- Consent Management ---

  async checkOpenVisits(
    patientCrId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OpenVisitCheckResult>> {
    this.checkFault(correlationId);
    const existing = this.openVisits.get(patientCrId);
    if (existing) {
      return Result.ok(existing);
    }
    return Result.ok({ hasOpenVisit: false });
  }

  async getPatientContacts(
    patientCrId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PatientContactOption[]>> {
    this.checkFault(correlationId);
    return Result.ok([
      {
        contactId: `CNT-${patientCrId.slice(-4)}-1`,
        maskedPhone: '+254714***898',
        contactType: 'MOBILE',
        isPrimary: true,
      },
      {
        contactId: `CNT-${patientCrId.slice(-4)}-2`,
        maskedPhone: '+254733***112',
        contactType: 'MOBILE',
        isPrimary: false,
      },
    ]);
  }

  async requestOtpConsent(
    patientCrId: string,
    _contactId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OtpConsentRequestResult>> {
    this.checkFault(correlationId);
    const consentId = `CSNT-${Date.now()}`;
    const otpRecord = `REC-OTP-${Date.now()}`;
    // Standard synthetic test OTP is always 123456 for predictable testing
    this.activeConsents.set(consentId, { otp: '123456', crId: patientCrId, record: otpRecord });

    return Result.ok({
      consentId,
      otpRecord,
      expiresInSeconds: 300,
      maskedDestination: '+254714***898',
      status: 'PENDING_VERIFICATION',
    });
  }

  async verifyOtpConsent(
    consentId: string,
    otpCode: string,
    _otpRecord: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>> {
    this.checkFault(correlationId);
    const active = this.activeConsents.get(consentId);
    if (!active) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.NOT_FOUND, `Consent request ${consentId} expired or not found`, 404, correlationId),
      );
    }

    if (otpCode !== '123456' && otpCode !== active.otp) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.AUTH_FAILED, 'Invalid verification code submitted by patient', 401, correlationId),
      );
    }

    const visitId = `VISIT-${Date.now()}`;
    const consentToken = `JWT-CONSENT-${Date.now()}.${Buffer.from(JSON.stringify({ crId: active.crId, facilityCode, visitId })).toString('base64')}`;

    this.openVisits.set(active.crId, {
      hasOpenVisit: true,
      visitId,
      consentToken,
      openedAt: new Date().toISOString(),
      facilityCode,
    });

    return Result.ok({
      consentToken,
      visitId,
      patientCrId: active.crId,
      status: 'AUTHORIZED',
      validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
  }

  async authorizeBiometricConsent(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<BiometricConsentResult>> {
    this.checkFault(correlationId);
    const consentId = `BIO-${Date.now()}`;
    const visitId = `VISIT-BIO-${Date.now()}`;
    const consentToken = `JWT-BIO-CONSENT-${Date.now()}`;

    this.openVisits.set(patientCrId, {
      hasOpenVisit: true,
      visitId,
      consentToken,
      openedAt: new Date().toISOString(),
      facilityCode,
    });

    return Result.ok({
      consentId,
      iframeUrl: `https://mock-dha.local/biometric-capture?consentId=${consentId}`,
      status: 'AUTHORIZED',
      visitId,
      consentToken,
    });
  }

  async authorizeEmergencyConsent(
    patientCrId: string,
    incapacityReason: string,
    facilityCode: string,
    _doctorPuid: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>> {
    this.checkFault(correlationId);
    if (!incapacityReason || incapacityReason.length < 5) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'Emergency incapacity reason must be provided (min 5 chars)', 400, correlationId),
      );
    }

    const visitId = `VISIT-EMERG-${Date.now()}`;
    const consentToken = `JWT-EMERGENCY-${Date.now()}`;

    this.openVisits.set(patientCrId, {
      hasOpenVisit: true,
      visitId,
      consentToken,
      openedAt: new Date().toISOString(),
      facilityCode,
    });

    return Result.ok({
      consentToken,
      visitId,
      patientCrId,
      status: 'AUTHORIZED',
      validUntil: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      isEmergency: true,
    });
  }

  async closeVisit(
    visitId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ message: string; closedAt: string }>> {
    this.checkFault(correlationId);
    return Result.ok({
      message: `Visit ${visitId} successfully closed out in Shared Health Record.`,
      closedAt: new Date().toISOString(),
    });
  }

  // --- Shared Health Record (SHR) ---

  async ingestClinicalBundle(
    bundle: KenyaCoreBundle,
    _facilityCode: string,
    consentToken: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShrBundleIngestionResult>> {
    this.checkFault(correlationId);

    if (!consentToken) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.CONSENT_REQUIRED, 'Header X-Consent-Token is mandatory for SHR clinical ingestion', 403, correlationId),
      );
    }
    if (!puid) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.FORBIDDEN, 'Header X-PUID is mandatory for SHR clinical ingestion', 403, correlationId),
      );
    }

    // Verify Bundle invariant: must have Encounter and entries
    if (!bundle.entry || bundle.entry.length === 0) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'FHIR Bundle must contain at least one clinical resource', 422, correlationId),
      );
    }

    const bundleId = bundle.id || `DHA-SHR-BUNDLE-${Date.now()}`;
    this.storedBundles.set(bundleId, bundle);

    return Result.ok({
      bundleId,
      status: 'INGESTED',
      resourceCount: bundle.entry.length,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    });
  }

  async queryPatientRecords(
    query: ShrPatientRecordsQuery,
  ): Promise<Result<ShrPatientRecordsResult>> {
    this.checkFault(query.correlationId);

    if (!query.consentToken) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.CONSENT_REQUIRED, 'Valid X-Consent-Token required to query patient SHR records', 403, query.correlationId),
      );
    }

    // Return empty synthetic bundle if nothing ingested yet
    const bundle: KenyaCoreBundle = {
      resourceType: 'Bundle',
      id: `SHR-QUERY-${Date.now()}`,
      type: 'searchset',
      entry: [
        {
          fullUrl: `urn:uuid:observation-demo-01`,
          resource: {
            resourceType: 'Observation',
            id: 'obs-01',
            status: 'final',
            code: {
              coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel' }],
            },
            subject: { reference: `Patient/${query.patientCrId}` },
            effectiveDateTime: new Date().toISOString(),
          },
        },
      ],
    };

    return Result.ok({
      patientCrId: query.patientCrId,
      bundle,
      recordsCount: 1,
      retrievedAt: new Date().toISOString(),
      isSynthetic: true,
    });
  }

  // --- Terminology Service ---

  async validateConcept(
    system: string,
    code: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult>> {
    this.checkFault(correlationId);

    // Standard WHO ICD-11 check
    if (system === 'WHO_ICD_11' || system === 'http://id.who.int/icd/release/11/mms') {
      if (code === 'BA00' || code === '1B10' || code === '1A00' || code.startsWith('ICD11-')) {
        return Result.ok({
          isValid: true,
          system: 'WHO_ICD_11',
          code,
          display: 'Essential Hypertension (Validated ICD-11)',
        });
      }
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, `Unknown ICD-11 concept code: ${code}`, 422, correlationId),
      );
    }

    // LOINC check
    if (system === 'LOINC' || system === 'http://loinc.org') {
      if (code === '718-7' || code === '85354-9' || code.startsWith('LOINC-')) {
        return Result.ok({
          isValid: true,
          system: 'LOINC',
          code,
          display: 'Hemoglobin in Blood (Validated LOINC)',
        });
      }
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, `Unknown LOINC laboratory code: ${code}`, 422, correlationId),
      );
    }

    return Result.ok({
      isValid: true,
      system,
      code,
      display: `Concept ${code}`,
    });
  }

  async searchConcepts(
    system: string,
    queryText: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult[]>> {
    this.checkFault(correlationId);
    return Result.ok([
      {
        isValid: true,
        system,
        code: 'BA00',
        display: `Essential Hypertension (${queryText})`,
      },
      {
        isValid: true,
        system,
        code: '1B10',
        display: `Tuberculosis of Lung (${queryText})`,
      },
    ]);
  }
}

// =============================================================================
// 2. MOCK SHA CLAIMS CLIENT (Eligibility, Preauth, Claims)
// =============================================================================

export class MockShaClaimsClient implements IShaEligibilityClient, IShaPreauthClient, IShaClaimsClient {
  private readonly preauths = new Map<string, PreauthResult>();
  private readonly claims = new Map<string, ShaClaimResult>();
  private simulatedFault: IntegrationErrorCode | null = null;

  setSimulatedFault(fault: IntegrationErrorCode | null) {
    this.simulatedFault = fault;
  }

  private checkFault(correlationId?: string): IntegrationError | null {
    if (this.simulatedFault) {
      const fault = this.simulatedFault;
      this.simulatedFault = null;
      let statusCode = 500;
      let retryable = false;
      if (fault === IntegrationErrorCode.TIMEOUT) {
        statusCode = 504;
        retryable = true;
      } else if (fault === IntegrationErrorCode.RATE_LIMITED) {
        statusCode = 429;
        retryable = true;
      } else if (fault === IntegrationErrorCode.SERVICE_UNAVAILABLE) {
        statusCode = 503;
        retryable = true;
      } else if (fault === IntegrationErrorCode.AUTH_FAILED) {
        statusCode = 401;
      } else if (fault === IntegrationErrorCode.FORBIDDEN) {
        statusCode = 403;
      }
      return new IntegrationError(fault, `Simulated SHA Fault: ${fault}`, statusCode, correlationId, retryable);
    }
    return null;
  }

  // --- Eligibility ---

  async checkEligibility(
    memberNumber: string,
    _identificationType: string = 'SHA_NUMBER',
    _facilityCode: string = 'FID-DEFAULT-001',
    correlationId?: string,
  ): Promise<Result<ShaEligibilityResult>> {
    const fault = this.checkFault(correlationId);
    if (fault) return Result.fail(fault);
    const trimmed = memberNumber.trim();

    if (trimmed.includes('EXHAUSTED')) {
      return Result.ok({
        eligible: false,
        memberNumber: trimmed,
        fundType: 'SHIF',
        benefitBalanceKES: 0,
        copayRequired: true,
        preauthRequired: false,
        coverageStatus: 'EXHAUSTED',
        message: 'Annual entitlement exhausted for selected benefit package',
        activeSchemes: [],
        isSynthetic: true,
      });
    }

    return Result.ok({
      eligible: true,
      memberNumber: trimmed || 'SHIF-9988776655',
      fundType: 'SHIF',
      benefitBalanceKES: 500000,
      copayRequired: false,
      preauthRequired: false,
      coverageStatus: 'ACTIVE',
      message: 'Active contributor in good standing across PHC, SHIF, and ECCIF',
      activeSchemes: [
        { fund: 'PHC', name: 'Primary Healthcare Fund (Capitation)', isActive: true },
        { fund: 'SHIF', name: 'Social Health Insurance Fund (Inpatient/Outpatient)', isActive: true },
        { fund: 'ECCIF', name: 'Emergency, Chronic & Critical Illness Fund', isActive: true },
      ],
      isSynthetic: true,
    });
  }

  async getSubBenefits(
    _patientCrId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaSubBenefitItem[]>> {
    this.checkFault(correlationId);
    return Result.ok([
      {
        subBenefitCode: 'SB-OP-GEN',
        subBenefitName: 'General Outpatient Primary Care',
        fund: 'PHC',
        benefitCapKES: 50000,
        remainingBalanceKES: 45000,
        preauthMandatory: false,
      },
      {
        subBenefitCode: 'SB-IP-MED',
        subBenefitName: 'General Inpatient Medical Care',
        fund: 'SHIF',
        benefitCapKES: 250000,
        remainingBalanceKES: 250000,
        preauthMandatory: false,
      },
      {
        subBenefitCode: 'SB-SURG-MAJ',
        subBenefitName: 'Major Specialized Surgery',
        fund: 'SHIF',
        benefitCapKES: 400000,
        remainingBalanceKES: 400000,
        preauthMandatory: true,
      },
    ]);
  }

  async getInterventions(
    _patientCrId: string,
    subBenefitCode: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaInterventionItem[]>> {
    this.checkFault(correlationId);
    return Result.ok([
      {
        interventionCode: 'INT-CONS-01',
        interventionName: 'Standard Medical Officer Consultation',
        subBenefitCode,
        paymentMechanism: 'FEE_FOR_SERVICE',
        needsPreauth: false,
        needsManualPreauthApproval: false,
        accessPoint: 'OP',
        fund: 'SHIF',
        standardTariffKES: 1000,
      },
      {
        interventionCode: 'INT-SURG-APP',
        interventionName: 'Laparoscopic Appendectomy',
        subBenefitCode,
        paymentMechanism: 'FEE_FOR_SERVICE',
        needsPreauth: true,
        needsManualPreauthApproval: false,
        accessPoint: 'IP',
        fund: 'SHIF',
        standardTariffKES: 65000,
      },
    ]);
  }

  // --- Preauthorization ---

  async submitPreauthorization(
    request: PreauthSubmissionRequest,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>> {
    this.checkFault(correlationId);

    const preauthId = `PREAUTH-${Date.now()}`;
    const preauthNumber = `PA-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const res: PreauthResult = {
      preauthId,
      preauthNumber,
      status: request.preauthType === 'ELECTIVE' ? 'PENDING_MANUAL_REVIEW' : 'APPROVED',
      approvedAmountKES: request.requestedAmountKES,
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      isSynthetic: true,
    };

    this.preauths.set(preauthId, res);
    return Result.ok(res);
  }

  async cancelPreauthorization(
    preauthId: string,
    reason: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ cancelled: boolean; message: string }>> {
    this.checkFault(correlationId);
    if (!reason || reason.length < 5) {
      return Result.fail(new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'Cancellation reason required', 400, correlationId));
    }
    this.preauths.delete(preauthId);
    return Result.ok({ cancelled: true, message: `Preauthorization ${preauthId} successfully revoked.` });
  }

  async queryPreauthStatus(
    preauthId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>> {
    this.checkFault(correlationId);
    const p = this.preauths.get(preauthId);
    if (!p) {
      return Result.fail(new IntegrationError(IntegrationErrorCode.NOT_FOUND, `Preauth ${preauthId} not found`, 404, correlationId));
    }
    return Result.ok(p);
  }

  // --- Claims Processing ---

  async startClaimVisit(
    _request: StartClaimVisitRequest,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<StartClaimVisitResult>> {
    this.checkFault(correlationId);
    return Result.ok({
      shaVisitId: `SHA-VISIT-${Date.now()}`,
      visitNumber: `VN-${Date.now().toString().slice(-6)}`,
      status: 'OPEN',
      startedAt: new Date().toISOString(),
    });
  }

  async submitClaim(
    claim: KenyaCoreClaim,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    this.checkFault(correlationId);

    const claimId = claim.id || `CLM-SHA-${Date.now()}`;
    const trackingNumber = `TRK-SHA-${Date.now()}`;

    // Verify duplicate claim submission
    if (this.claims.has(claimId)) {
      return Result.fail(
        new IntegrationError(
          IntegrationErrorCode.DUPLICATE_SUBMISSION,
          `Claim with ID ${claimId} was already submitted. Duplicate submissions are barred.`,
          409,
          correlationId,
        ),
      );
    }

    const result: ShaClaimResult = {
      claimId,
      status: 'APPROVED',
      trackingNumber,
      adjudicatedAmountKES: 12500,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    };

    this.claims.set(claimId, result);
    return Result.ok(result);
  }

  async dischargeInpatientClaim(
    request: InpatientDischargeClaimRequest,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    this.checkFault(correlationId);
    const claim = this.claims.get(request.claimId) || {
      claimId: request.claimId,
      status: 'APPROVED',
      trackingNumber: `TRK-DISCH-${Date.now()}`,
      adjudicatedAmountKES: 45000,
      timestamp: new Date().toISOString(),
      isSynthetic: true,
    };
    this.claims.set(request.claimId, claim);
    return Result.ok(claim);
  }

  async queryClaimStatus(
    claimId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    this.checkFault(correlationId);
    const c = this.claims.get(claimId);
    if (!c) {
      return Result.fail(new IntegrationError(IntegrationErrorCode.NOT_FOUND, `Claim ${claimId} not found`, 404, correlationId));
    }
    return Result.ok(c);
  }

  async reconcileBatch(
    _query: { fromDate?: string; toDate?: string; status?: string },
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ batchId: string; totalClaims: number; claims: ShaClaimResult[] }>> {
    this.checkFault(correlationId);
    const claims = Array.from(this.claims.values());
    return Result.ok({
      batchId: `REC-MOCK-BATCH-${Date.now()}`,
      totalClaims: claims.length,
      claims,
    });
  }

  async uploadAttachment(
    claimId: string,
    _documentType: string,
    _fileData: { title: string; mimeType: string; fileUrl: string },
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<{ attachmentId: string; status: string }>> {
    this.checkFault(correlationId);
    return Result.ok({
      attachmentId: `ATT-${claimId}-${Date.now()}`,
      status: 'UPLOADED_AND_VERIFIED',
    });
  }

  async addIntervention(
    visitId: string,
    _interventionCode: string,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; status: string }>> {
    this.checkFault(correlationId);
    return Result.ok({ visitId, status: 'ACTIVE' });
  }

  async addBillingLines(
    visitId: string,
    lines: Array<{ code: string; amountKES: number }>,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; linesAdded: number }>> {
    this.checkFault(correlationId);
    return Result.ok({ visitId, linesAdded: lines.length });
  }

  async addDiagnoses(
    visitId: string,
    diagnoses: Array<{ system: string; code: string }>,
    _facilityCode: string,
    _puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; diagnosesRecorded: number }>> {
    this.checkFault(correlationId);
    return Result.ok({ visitId, diagnosesRecorded: diagnoses.length });
  }
}

// =============================================================================
// 3. MOCK KRA eTIMS CLIENT
// =============================================================================

export class MockKraEtimsClient implements IKraEtimsClient {
  async signInvoice(
    invoicePayload: Record<string, unknown>,
    _correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>> {
    const timestamp = new Date().toISOString();
    const invNo = (invoicePayload.invoiceNumber as string) || `INV-${Date.now()}`;
    return Result.ok({
      controlCode: `KRA-ETIMS-MOCK-CTRL-${Date.now()}`,
      qrCodeUrl: `https://etims.kra.go.ke/verify?inv=${invNo}`,
      status: 'SIGNED',
      timestamp,
      isSynthetic: true,
    });
  }

  async issueCreditNote(
    creditNotePayload: Record<string, unknown>,
    _correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>> {
    const timestamp = new Date().toISOString();
    const crnNo = (creditNotePayload.creditNoteNumber as string) || `CRN-${Date.now()}`;
    return Result.ok({
      controlCode: `KRA-CRN-MOCK-CTRL-${Date.now()}`,
      qrCodeUrl: `https://etims.kra.go.ke/verify?crn=${crnNo}`,
      status: 'SIGNED',
      timestamp,
      isSynthetic: true,
    });
  }
}

// =============================================================================
// 4. MOCK M-PESA CLIENT (PROVISIONAL ADAPTER)
// =============================================================================

export class MockMpesaPaymentClient implements IMpesaPaymentClient {
  private readonly transactions = new Map<string, MpesaQueryResult>();

  async initiateStkPush(
    request: MpesaStkPushRequest,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaStkPushResult>> {
    const phone = request.phoneNumber.trim();
    if (!phone.startsWith('+254') && !phone.startsWith('254') && !phone.startsWith('07') && !phone.startsWith('01')) {
      return Result.fail(
        new IntegrationError(
          IntegrationErrorCode.VALIDATION_FAILED,
          'Invalid Kenyan phone number format. Must start with +254, 254, 07, or 01',
          400,
          correlationId,
        ),
      );
    }
    if (request.amount <= 0) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.VALIDATION_FAILED, 'Payment amount must be greater than zero', 400, correlationId),
      );
    }

    if (phone.includes('000000000') || phone.includes('700000000')) {
      return Result.fail(
        new IntegrationError(
          IntegrationErrorCode.GATEWAY_ERROR,
          'Simulated payment failure: Request cancelled by subscriber or timeout (DS-1032)',
          400,
          correlationId,
        ),
      );
    }

    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const merchantRequestId = `MR_${Date.now()}`;
    const mpesaReceiptNumber = `QAA${Math.floor(1000000 + Math.random() * 9000000)}`;

    const queryResult: MpesaQueryResult = {
      checkoutRequestId,
      mpesaReceiptNumber,
      resultCode: 0,
      resultDesc: 'The service request is processed successfully. (SIMULATED)',
      amount: request.amount,
      phoneNumber: request.phoneNumber,
      transactionDate: new Date().toISOString(),
      status: 'SUCCESS',
      isSimulated: true,
    };

    this.transactions.set(checkoutRequestId, queryResult);

    return Result.ok({
      checkoutRequestId,
      merchantRequestId,
      responseCode: '0',
      customerMessage: 'Success. Request accepted for processing (SIMULATED)',
      status: 'INITIATED',
      isSimulated: true,
    });
  }

  async queryPaymentStatus(
    checkoutRequestId: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaQueryResult>> {
    const tx = this.transactions.get(checkoutRequestId);
    if (!tx) {
      return Result.fail(
        new IntegrationError(IntegrationErrorCode.NOT_FOUND, `Transaction ${checkoutRequestId} not found in simulated gateway.`, 404, correlationId),
      );
    }
    return Result.ok(tx);
  }
}
