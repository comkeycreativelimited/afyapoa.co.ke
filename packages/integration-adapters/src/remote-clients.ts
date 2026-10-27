/**
 * COMKEY AFYA POA — Remote HTTP Integration Adapters
 * Implements typed client interfaces connecting to DHA HIE, SHA Claims, KRA eTIMS, and M-Pesa gateways.
 * Utilizes ResilientHttpClient with circuit breaker, exponential backoff, request correlation, and safe guards.
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
import { ResilientHttpClient, HttpClientOptions } from './http-client.js';

// =============================================================================
// 1. REMOTE DHA HIE CLIENT
// =============================================================================

export class RemoteDhaHieClient
  implements
    IDhaClientRegistryClient,
    IDhaFacilityRegistryClient,
    IDhaHealthWorkerRegistryClient,
    IDhaConsentClient,
    IDhaSharedHealthRecordClient,
    IDhaTerminologyClient
{
  private readonly http: ResilientHttpClient;

  constructor(options: HttpClientOptions) {
    this.http = new ResilientHttpClient(options);
  }

  // --- Client Registry ---

  async lookupClient(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient>> {
    try {
      const query = new URLSearchParams({
        identification_type: identificationType,
        identification_number: identificationNumber,
      });
      const data = await this.http.request<ClientRegistryPatient>(
        `api/v1/patients?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async lookupClientByNationalId(
    nationalId: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryResult>> {
    try {
      const res = await this.lookupClient('KENYA_NATIONAL_ID', nationalId, 'FID-DEFAULT-001', correlationId);
      if (res.isFailure()) {
        return Result.fail(res.getError());
      }
      const p = res.getValue();
      return Result.ok({
        crid: p.crId,
        nationalId,
        fullName: `${p.firstName} ${p.lastName}`.trim(),
        birthDate: p.dateOfBirth,
        gender: p.gender.toLowerCase(),
        status: p.status === 'VERIFIED' ? 'VERIFIED' : 'UNINDEXED',
        isSynthetic: p.isSynthetic,
      });
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async resolveUpi(
    identificationType: string,
    identificationNumber: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ upi: string; crId: string }>> {
    try {
      const res = await this.lookupClient(identificationType, identificationNumber, facilityCode, correlationId);
      if (res.isFailure()) {
        return Result.fail(res.getError());
      }
      const p = res.getValue();
      if (p.status !== 'VERIFIED') {
        return Result.fail(
          new IntegrationError(
            IntegrationErrorCode.NOT_FOUND,
            `Identifier ${identificationNumber} is not verified in DHA Client Registry`,
            404,
            correlationId,
          ),
        );
      }
      return Result.ok({ upi: p.upi, crId: p.crId });
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async searchBeneficiaries(
    query: { name?: string; phone?: string; county?: string },
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ClientRegistryPatient[]>> {
    try {
      const params = new URLSearchParams();
      if (query.name) params.set('name', query.name);
      if (query.phone) params.set('phone', query.phone);
      if (query.county) params.set('county', query.county);

      const data = await this.http.request<ClientRegistryPatient[]>(
        `api/v1/patients/search?${params.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Facility Registry ---

  async verifyFacilityByKmfl(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>> {
    return this.getFacilityDetails(kmflCode, correlationId);
  }

  async getFacilityDetails(
    kmflCode: string,
    correlationId?: string,
  ): Promise<Result<FacilityRegistryResult>> {
    try {
      const data = await this.http.request<FacilityRegistryResult>(
        `api/v1/facilities/${encodeURIComponent(kmflCode)}`,
        {
          method: 'GET',
          facilityCode: kmflCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Health Worker Registry ---

  async verifyHealthWorkerByPuid(
    puid: string,
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>> {
    try {
      const data = await this.http.request<HealthWorkerResult>(
        `api/v1/practitioners/${encodeURIComponent(puid)}`,
        {
          method: 'GET',
          facilityCode: 'FID-DEFAULT-001',
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async checkLicenseStatus(
    puid: string,
    board: 'KMPDC' | 'NCK' | 'PPB' | 'COC',
    correlationId?: string,
  ): Promise<Result<HealthWorkerResult>> {
    try {
      const query = new URLSearchParams({ board });
      const data = await this.http.request<HealthWorkerResult>(
        `api/v1/practitioners/${encodeURIComponent(puid)}/license?${query.toString()}`,
        {
          method: 'GET',
          facilityCode: 'FID-DEFAULT-001',
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Consent Framework ---

  async checkOpenVisits(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OpenVisitCheckResult>> {
    try {
      const query = new URLSearchParams({ patient_id: patientCrId, facility_id: facilityCode });
      const data = await this.http.request<OpenVisitCheckResult>(
        `shr/open-visits?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async getPatientContacts(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PatientContactOption[]>> {
    try {
      const query = new URLSearchParams({ patient_id: patientCrId });
      const data = await this.http.request<PatientContactOption[]>(
        `api/v1/patients/contacts?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async requestOtpConsent(
    patientCrId: string,
    contactId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<OtpConsentRequestResult>> {
    try {
      const data = await this.http.request<OtpConsentRequestResult>('shr/consents', {
        method: 'POST',
        body: { patient_id: patientCrId, contact_id: contactId },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async verifyOtpConsent(
    consentId: string,
    otpCode: string,
    otpRecord: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>> {
    try {
      const data = await this.http.request<VerifyConsentResult>(
        `shr/consents/${encodeURIComponent(consentId)}/verify`,
        {
          method: 'POST',
          body: { otp: otpCode, otp_record: otpRecord },
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async authorizeBiometricConsent(
    patientCrId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<BiometricConsentResult>> {
    try {
      const data = await this.http.request<BiometricConsentResult>('api/v1/claims/authorize', {
        method: 'POST',
        body: { patient_id: patientCrId, mode: 'BIOMETRIC' },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async authorizeEmergencyConsent(
    patientCrId: string,
    incapacityReason: string,
    facilityCode: string,
    doctorPuid: string,
    correlationId?: string,
  ): Promise<Result<VerifyConsentResult>> {
    try {
      const data = await this.http.request<VerifyConsentResult>('shr/consents/emergency', {
        method: 'POST',
        body: {
          patient_id: patientCrId,
          incapacity_reason: incapacityReason,
          doctor_puid: doctorPuid,
        },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async closeVisit(
    visitId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ message: string; closedAt: string }>> {
    try {
      const data = await this.http.request<{ message: string; closedAt: string }>(
        `shr/visits/${encodeURIComponent(visitId)}/close`,
        {
          method: 'POST',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Shared Health Record (SHR) ---

  async ingestClinicalBundle(
    bundle: KenyaCoreBundle,
    facilityCode: string,
    consentToken: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShrBundleIngestionResult>> {
    try {
      const headers: Record<string, string> = {
        'X-PUID': puid,
        'X-Consent-Token': consentToken,
      };

      const data = await this.http.request<ShrBundleIngestionResult>('shr/bundles', {
        method: 'POST',
        body: bundle,
        headers,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async publishSharedHealthRecord(
    bundle: KenyaCoreBundle,
    facilityCode: string,
    puid: string,
    consentToken?: string,
    correlationId?: string,
  ): Promise<Result<ShrBundleIngestionResult>> {
    return this.ingestClinicalBundle(bundle, facilityCode, consentToken || 'SYSTEM-CONSENT', puid, correlationId);
  }

  async queryPatientRecords(
    query: ShrPatientRecordsQuery,
  ): Promise<Result<ShrPatientRecordsResult>> {
    try {
      const q = new URLSearchParams({
        cr_id: query.patientCrId,
        practitioner_id: query.puid,
      });
      if (query.resourceTypes && query.resourceTypes.length > 0) {
        q.set('resources', query.resourceTypes.join(','));
      }

      const headers: Record<string, string> = {
        'X-PUID': query.puid,
        'X-Consent-Token': query.consentToken,
      };

      const data = await this.http.request<ShrPatientRecordsResult>(
        `shr/patient-records?${q.toString()}`,
        {
          method: 'GET',
          headers,
          facilityCode: query.facilityCode,
          correlationId: query.correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Terminology Service ---

  async validateConcept(
    system: string,
    code: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult>> {
    try {
      const data = await this.http.request<TerminologyValidationResult>('api/v1/terminology/validate', {
        method: 'POST',
        body: { system, code },
        facilityCode: 'FID-DEFAULT-001',
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async searchConcepts(
    system: string,
    queryText: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult[]>> {
    try {
      const query = new URLSearchParams({ system, query: queryText });
      const data = await this.http.request<TerminologyValidationResult[]>(
        `api/v1/terminology/search?${query.toString()}`,
        {
          method: 'GET',
          facilityCode: 'FID-DEFAULT-001',
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async validateCode(
    system: 'ICD-11' | 'LOINC' | 'ICHI' | 'KEML',
    code: string,
    _facilityCode: string,
    correlationId?: string,
  ): Promise<Result<TerminologyValidationResult>> {
    return this.validateConcept(system, code, correlationId);
  }
}

// =============================================================================
// 2. REMOTE SHA CLAIMS CLIENT (Eligibility, Preauth, Claims Lifecycle)
// =============================================================================

export class RemoteShaClaimsClient implements IShaEligibilityClient, IShaPreauthClient, IShaClaimsClient {
  private readonly http: ResilientHttpClient;

  constructor(options: HttpClientOptions) {
    this.http = new ResilientHttpClient(options);
  }

  // --- Step 3, 4, 5: Eligibility & Interventions ---

  async checkEligibility(
    memberNumber: string,
    identificationType: string = 'SHA_NUMBER',
    facilityCode: string = 'FID-DEFAULT-001',
    correlationId?: string,
  ): Promise<Result<ShaEligibilityResult>> {
    try {
      const query = new URLSearchParams({
        identification_number: memberNumber,
        identification_type: identificationType,
      });
      const data = await this.http.request<ShaEligibilityResult>(
        `api/v1/patients/eligibility?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async getSubBenefits(
    crId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaSubBenefitItem[]>> {
    try {
      const query = new URLSearchParams({ patient_id: crId });
      const data = await this.http.request<ShaSubBenefitItem[]>(
        `api/v1/patients/sub-benefits?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async getInterventions(
    crId: string,
    subBenefitCode: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaInterventionItem[]>> {
    try {
      const query = new URLSearchParams({
        patient_id: crId,
        sub_benefit_code: subBenefitCode,
      });
      const data = await this.http.request<ShaInterventionItem[]>(
        `api/v1/patients/benefits/interventions?${query.toString()}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Preauthorizations ---

  async submitPreauthorization(
    request: PreauthSubmissionRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>> {
    try {
      const data = await this.http.request<PreauthResult>('api/v1/claims/preauth', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: request,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async queryPreauthStatus(
    preauthId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<PreauthResult>> {
    try {
      const data = await this.http.request<PreauthResult>(
        `api/v1/claims/preauth/${encodeURIComponent(preauthId)}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async cancelPreauthorization(
    preauthId: string,
    reason: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ cancelled: boolean; message: string }>> {
    try {
      const data = await this.http.request<{ cancelled: boolean; message: string }>(
        'api/v1/claims/preauth/cancel',
        {
          method: 'POST',
          body: { preauth_id: preauthId, reason },
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  // --- Claims Lifecycle ---

  async startClaimVisit(
    request: StartClaimVisitRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<StartClaimVisitResult>> {
    try {
      const data = await this.http.request<StartClaimVisitResult>('api/v1/claims/visit', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: request,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async submitClaim(
    claim: KenyaCoreClaim,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    try {
      const data = await this.http.request<ShaClaimResult>('api/v1/claims/submit', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: claim,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async dischargeInpatientClaim(
    request: InpatientDischargeClaimRequest,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    try {
      const data = await this.http.request<ShaClaimResult>('api/v1/claims/discharge_inpatient', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: request,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async queryClaimStatus(
    claimId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<ShaClaimResult>> {
    try {
      const data = await this.http.request<ShaClaimResult>(
        `api/v1/claims/${encodeURIComponent(claimId)}/status`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async reconcileBatch(
    query: { fromDate?: string; toDate?: string; status?: string },
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<{ batchId: string; totalClaims: number; claims: ShaClaimResult[] }>> {
    try {
      const data = await this.http.request<{ batchId: string; totalClaims: number; claims: ShaClaimResult[] }>(
        'api/v1/claims/reconciliation',
        {
          method: 'POST',
          body: query,
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async uploadAttachment(
    claimId: string,
    documentType: string,
    fileData: { title: string; mimeType: string; fileUrl: string },
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ attachmentId: string; status: string }>> {
    try {
      const data = await this.http.request<{ attachmentId: string; status: string }>('api/v1/claims/attachments', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: { claimId, documentType, ...fileData },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async addIntervention(
    visitId: string,
    interventionCode: string,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; status: string }>> {
    try {
      const data = await this.http.request<{ visitId: string; status: string }>('api/v1/claims/interventions', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: { visitId, interventionCode },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async addBillingLines(
    visitId: string,
    lines: Array<{ code: string; amountKES: number }>,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; linesAdded: number }>> {
    try {
      const data = await this.http.request<{ visitId: string; linesAdded: number }>('api/v1/claims/billing-lines', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: { visitId, lines },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async addDiagnoses(
    visitId: string,
    diagnoses: Array<{ system: string; code: string }>,
    facilityCode: string,
    puid: string,
    correlationId?: string,
  ): Promise<Result<{ visitId: string; diagnosesRecorded: number }>> {
    try {
      const data = await this.http.request<{ visitId: string; diagnosesRecorded: number }>('api/v1/claims/diagnoses', {
        method: 'POST',
        headers: { 'X-PUID': puid },
        body: { visitId, diagnoses },
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }
}

// =============================================================================
// 3. REMOTE KRA eTIMS CLIENT
// =============================================================================

export class RemoteKraEtimsClient implements IKraEtimsClient {
  private readonly http: ResilientHttpClient;

  constructor(options: HttpClientOptions) {
    this.http = new ResilientHttpClient(options);
  }

  async signInvoice(
    invoicePayload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>> {
    try {
      const data = await this.http.request<EtimsInvoiceResult>('api/v1/etims/sign', {
        method: 'POST',
        body: invoicePayload,
        facilityCode: (invoicePayload.facilityCode as string) || 'FID-ETIMS-001',
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async issueCreditNote(
    creditNotePayload: Record<string, unknown>,
    correlationId?: string,
  ): Promise<Result<EtimsInvoiceResult>> {
    try {
      const data = await this.http.request<EtimsInvoiceResult>('api/v1/etims/credit-note', {
        method: 'POST',
        body: creditNotePayload,
        facilityCode: (creditNotePayload.facilityCode as string) || 'FID-ETIMS-001',
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }
}

// =============================================================================
// 4. REMOTE M-PESA CLIENT (PROVISIONAL PORT)
// =============================================================================

export class RemoteMpesaClient implements IMpesaPaymentClient {
  private readonly http: ResilientHttpClient;

  constructor(options: HttpClientOptions) {
    this.http = new ResilientHttpClient(options);
  }

  async initiateStkPush(
    request: MpesaStkPushRequest,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaStkPushResult>> {
    try {
      const data = await this.http.request<MpesaStkPushResult>('api/v1/mpesa/stkpush', {
        method: 'POST',
        body: request,
        facilityCode,
        correlationId,
      });
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }

  async queryPaymentStatus(
    checkoutRequestId: string,
    facilityCode: string,
    correlationId?: string,
  ): Promise<Result<MpesaQueryResult>> {
    try {
      const data = await this.http.request<MpesaQueryResult>(
        `api/v1/mpesa/query/${encodeURIComponent(checkoutRequestId)}`,
        {
          method: 'GET',
          facilityCode,
          correlationId,
        },
      );
      return Result.ok(data);
    } catch (err: unknown) {
      return Result.fail(err as Error);
    }
  }
}
