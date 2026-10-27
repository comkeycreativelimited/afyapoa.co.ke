import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  facilities,
  patients,
  shaPreauthorizations,
  shaClaims,
  shaClaimItems,
  shaClaimSubmissions,
  shaClaimAttachments,
  shaCallbackEvents,
} from '@afyapoa/database';
import {
  AuditEventType,
  ShaAccessPoint,
  ShaClaimStatus,
  ShaPreauthStatus,
  validateClaimBusinessRules,
  computeClaimSubmissionFingerprint,
} from '@afyapoa/domain-core';
import {
  createIntegrationClients,
  IntegrationClients,
  sanitizeForLogging,
} from '@afyapoa/integration-adapters';
import { config } from '@afyapoa/config';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CheckEligibilityDto,
  CreatePreauthDto,
  CancelPreauthDto,
  CreateClaimDto,
  InpatientDischargeDto,
  CorrectClaimDto,
  AttachDocumentDto,
  ShaCallbackPayloadDto,
  ReconcileClaimsQueryDto,
} from './dto/claims.dto.js';

@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);
  private readonly integrationClients: IntegrationClients;

  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {
    this.integrationClients = createIntegrationClients(config.INTEGRATION_MODE);
  }

  /**
   * Generates a unique, human-readable claim number: CLM-YYYYMMDD-XXXXX
   */
  private generateClaimNumber(): string {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `CLM-${ymd}-${rand}`;
  }

  /**
   * Generates a unique preauth number: PA-YYYYMMDD-XXXXX
   */
  private generatePreauthNumber(): string {
    const d = new Date();
    const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `PA-${ymd}-${rand}`;
  }

  // ===========================================================================
  // 1. ELIGIBILITY & COVERAGE VERIFICATION (STEP 3, 4, 5)
  // ===========================================================================

  async checkEligibility(
    tenantId: string,
    facilityId: string,
    dto: CheckEligibilityDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;
      const correlationId = `CORR-ELIG-${Date.now()}`;

      const res = await this.integrationClients.shaEligibility.checkEligibility(
        dto.identificationType,
        dto.identificationNumber,
        kmflCode,
        correlationId,
      );

      if (!res.isSuccess()) {
        throw res.getError();
      }

      const eligibility = res.getValue();

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_ELIGIBILITY_CHECKED,
        resource: 'SHA_ELIGIBILITY',
        resourceId: dto.identificationNumber,
        clientIp: ipAddress,
        details: {
          eligible: eligibility.eligible,
          fundType: eligibility.fundType,
          coverageStatus: eligibility.coverageStatus,
          correlationId,
        },
      });

      return eligibility;
    });
  }

  async getSubBenefits(
    tenantId: string,
    facilityId: string,
    patientCrId: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;
      const res = await this.integrationClients.shaEligibility.getSubBenefits(patientCrId, kmflCode);
      if (!res.isSuccess()) {
        throw res.getError();
      }
      return res.getValue();
    });
  }

  async getInterventions(
    tenantId: string,
    facilityId: string,
    patientCrId: string,
    subBenefitCode: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;
      const res = await this.integrationClients.shaEligibility.getInterventions(
        patientCrId,
        subBenefitCode,
        kmflCode,
      );
      if (!res.isSuccess()) {
        throw res.getError();
      }
      return res.getValue();
    });
  }

  // ===========================================================================
  // 2. PREAUTHORIZATIONS
  // ===========================================================================

  async requestPreauthorization(
    tenantId: string,
    facilityId: string,
    dto: CreatePreauthDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;
      const preauthNumber = this.generatePreauthNumber();
      const correlationId = `CORR-PA-${Date.now()}`;

      // Dispatch to SHA preauth service
      const remoteRes = await this.integrationClients.shaPreauth.submitPreauthorization(
        {
          patientCrId: dto.patientCrId,
          subBenefitCode: dto.subBenefitCode,
          interventionCode: dto.interventionCode,
          requestedAmountKES: dto.requestedAmountKES,
          preauthType: dto.preauthType,
          clinicalSummary: dto.clinicalSummary,
          estimatedStayDays: dto.estimatedStayDays,
          supportingDocumentUrls: dto.supportingDocumentUrls,
        },
        kmflCode,
        dto.practitionerPuid,
        correlationId,
      );

      if (!remoteRes.isSuccess()) {
        throw remoteRes.getError();
      }

      const remoteData = remoteRes.getValue();

      // Persist in local database
      const [record] = await db
        .insert(shaPreauthorizations)
        .values({
          tenantId,
          facilityId,
          patientId: dto.patientId,
          preauthNumber,
          preauthType: dto.preauthType,
          fund: dto.fund,
          subBenefitCode: dto.subBenefitCode,
          interventionCode: dto.interventionCode,
          requestedAmountKES: dto.requestedAmountKES.toString(),
          approvedAmountKES: remoteData.approvedAmountKES.toString(),
          status: remoteData.status as ShaPreauthStatus,
          clinicalSummary: dto.clinicalSummary,
          practitionerPuid: dto.practitionerPuid,
          supportingDocumentUrls: dto.supportingDocumentUrls || [],
          shaReferenceId: remoteData.preauthId,
          decisionReason: remoteData.decisionReason,
          requestedById: actorUserId,
          validFrom: new Date(),
          validUntil: new Date(remoteData.validUntil),
        })
        .returning();

      if (!record) {
        throw new Error('Failed to persist pre-authorization record');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_PREAUTH_REQUESTED,
        resource: 'SHA_PREAUTH',
        resourceId: record.id,
        clientIp: ipAddress,
        details: {
          preauthNumber,
          preauthType: dto.preauthType,
          status: remoteData.status,
          approvedAmountKES: remoteData.approvedAmountKES,
        },
      });

      return record;
    });
  }

  async cancelPreauthorization(
    tenantId: string,
    facilityId: string,
    preauthId: string,
    dto: CancelPreauthDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [preauth] = await db
        .select()
        .from(shaPreauthorizations)
        .where(
          and(
            eq(shaPreauthorizations.tenantId, tenantId),
            eq(shaPreauthorizations.id, preauthId),
          ),
        )
        .limit(1);

      if (!preauth) {
        throw new NotFoundException(`Preauthorization with ID ${preauthId} not found`);
      }

      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;

      if (preauth.shaReferenceId) {
        await this.integrationClients.shaPreauth.cancelPreauthorization(
          preauth.shaReferenceId,
          dto.reason,
          kmflCode,
        );
      }

      const [updated] = await db
        .update(shaPreauthorizations)
        .set({
          status: ShaPreauthStatus.CANCELLED,
          decisionReason: dto.reason,
          updatedAt: new Date(),
        })
        .where(eq(shaPreauthorizations.id, preauthId))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_PREAUTH_CANCELLED,
        resource: 'SHA_PREAUTH',
        resourceId: preauthId,
        clientIp: ipAddress,
        details: { reason: dto.reason },
      });

      return updated;
    });
  }

  // ===========================================================================
  // 3. CLAIM PREPARATION & VALIDATION
  // ===========================================================================

  async createClaim(
    tenantId: string,
    facilityId: string,
    dto: CreateClaimDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Verify patient exists
      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient ${dto.patientId} not found`);
      }

      // 2. Calculate totals
      let totalAmount = 0;
      for (const item of dto.items) {
        totalAmount += item.quantity * item.unitPriceKES;
      }

      // 3. Verify preauth if applicable
      let approvedPreauthId: string | undefined = undefined;
      if (dto.preauthId) {
        const [pa] = await db
          .select()
          .from(shaPreauthorizations)
          .where(
            and(
              eq(shaPreauthorizations.tenantId, tenantId),
              eq(shaPreauthorizations.id, dto.preauthId),
              eq(shaPreauthorizations.status, ShaPreauthStatus.APPROVED),
            ),
          )
          .limit(1);

        if (!pa) {
          throw new BadRequestException(`Linked preauthorization ${dto.preauthId} is not approved or invalid`);
        }
        approvedPreauthId = pa.id;
      }

      // 4. Validate claim statutory business rules
      const validation = validateClaimBusinessRules({
        fund: dto.fund,
        scenario: dto.scenario,
        serviceStartDate: new Date(dto.serviceStartDate),
        serviceEndDate: dto.serviceEndDate ? new Date(dto.serviceEndDate) : undefined,
        practitionerPuid: dto.practitionerPuid,
        diagnosesCount: 1 + (dto.secondaryDiagnoses?.length || 0),
        itemsCount: dto.items.length,
        totalAmountKES: totalAmount,
        needsPreauth: Boolean(dto.preauthId),
        approvedPreauthId,
        isDischarged: dto.accessPoint === ShaAccessPoint.IP ? false : true,
      });

      const initialStatus = validation.isValid ? ShaClaimStatus.QUEUED : ShaClaimStatus.DRAFT;
      const claimNumber = this.generateClaimNumber();

      // 5. Compute idempotency fingerprint
      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const fingerprint = computeClaimSubmissionFingerprint({
        tenantId,
        facilityKmflCode: facility?.kmflCode || 'FID-DEFAULT',
        patientCrId: patient.dhaCrid || patient.mrn,
        fund: dto.fund,
        scenario: dto.scenario,
        serviceStartDate: dto.serviceStartDate,
        totalAmountKES: totalAmount,
        itemCodes: dto.items.map((i) => i.code),
      });

      // 6. Insert Claim record
      const [createdClaim] = await db
        .insert(shaClaims)
        .values({
          tenantId,
          facilityId,
          claimNumber,
          version: 1,
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          invoiceId: dto.invoiceId,
          preauthId: dto.preauthId,
          fund: dto.fund,
          scenario: dto.scenario,
          accessPoint: dto.accessPoint,
          paymentMechanism: dto.paymentMechanism,
          status: initialStatus,
          serviceStartDate: new Date(dto.serviceStartDate),
          serviceEndDate: dto.serviceEndDate ? new Date(dto.serviceEndDate) : undefined,
          totalClaimAmountKES: totalAmount.toString(),
          submissionFingerprint: fingerprint,
          rejectionCodes: validation.isValid ? [] : validation.errors,
        })
        .returning();

      if (!createdClaim) {
        throw new Error('Failed to create claim record');
      }

      // 7. Insert Claim Line Items
      for (const item of dto.items) {
        const itemTotal = item.quantity * item.unitPriceKES;
        await db.insert(shaClaimItems).values({
          tenantId,
          claimId: createdClaim.id,
          lineType: item.lineType,
          code: item.code,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPriceKES: item.unitPriceKES.toString(),
          totalAmountKES: itemTotal.toString(),
          serviceDate: new Date(item.serviceDate),
          practitionerPuid: item.practitionerPuid || dto.practitionerPuid,
        });
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_CLAIM_PREPARED,
        resource: 'SHA_CLAIM',
        resourceId: createdClaim.id,
        clientIp: ipAddress,
        details: {
          claimNumber,
          status: initialStatus,
          totalAmountKES: totalAmount,
          validationOutcome: validation,
        },
      });

      return {
        ...createdClaim,
        validation,
      };
    });
  }

  // ===========================================================================
  // 4. CLAIM SUBMISSION & ACKNOWLEDGEMENT
  // ===========================================================================

  async submitClaim(
    tenantId: string,
    facilityId: string,
    claimId: string,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Fetch claim and facility
      const [claim] = await db
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.id, claimId)))
        .limit(1);

      if (!claim) {
        throw new NotFoundException(`Claim ${claimId} not found`);
      }

      // Check double-submission barrier
      if (
        claim.status === ShaClaimStatus.SUBMITTED ||
        claim.status === ShaClaimStatus.ACKNOWLEDGED ||
        claim.status === ShaClaimStatus.ACCEPTED ||
        claim.status === ShaClaimStatus.ADJUDICATED ||
        claim.status === ShaClaimStatus.PAID
      ) {
        throw new ConflictException(
          `Claim ${claim.claimNumber} (v${claim.version}) is already in state '${claim.status}'. Duplicate submissions are strictly prevented.`,
        );
      }

      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;

      // 2. Fetch line items
      const items = await db
        .select()
        .from(shaClaimItems)
        .where(and(eq(shaClaimItems.tenantId, tenantId), eq(shaClaimItems.claimId, claimId)));

      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, claim.patientId)))
        .limit(1);

      const correlationId = `CORR-CLM-SUB-${Date.now()}`;
      const traceId = `TRACE-SHA-${Date.now()}`;

      // Transition to SUBMITTED
      await db
        .update(shaClaims)
        .set({ status: ShaClaimStatus.SUBMITTED, updatedAt: new Date() })
        .where(eq(shaClaims.id, claimId));

      const payload = {
        resourceType: 'Claim',
        id: claim.claimNumber,
        status: 'active',
        type: { coding: [{ code: claim.accessPoint === 'IP' ? 'institutional' : 'professional' }] },
        patient: { reference: `Patient/${patient?.dhaCrid || patient?.mrn || 'UNINDEXED'}` },
        facility: { identifier: { value: kmflCode } },
        total: { value: Number(claim.totalClaimAmountKES), currency: 'KES' },
        item: items.map((it, idx) => ({
          sequence: idx + 1,
          productOrService: { coding: [{ code: it.code, display: it.description }] },
          quantity: { value: Number(it.quantity) },
          unitPrice: { value: Number(it.unitPriceKES), currency: 'KES' },
          net: { value: Number(it.totalAmountKES), currency: 'KES' },
        })),
      };

      const payloadDigest = computeClaimSubmissionFingerprint({
        tenantId,
        facilityKmflCode: kmflCode,
        patientCrId: patient?.dhaCrid || patient?.mrn || 'UNINDEXED',
        fund: claim.fund,
        scenario: claim.scenario,
        serviceStartDate: claim.serviceStartDate.toISOString(),
        totalAmountKES: Number(claim.totalClaimAmountKES),
        itemCodes: items.map((i) => i.code),
      });

      try {
        // Dispatch via IShaClaimsClient
        const dispatchRes = await this.integrationClients.shaClaims.submitClaim(
          payload as any,
          kmflCode,
          items[0]?.practitionerPuid || 'PUID-DEFAULT',
          correlationId,
        );

        if (!dispatchRes.isSuccess()) {
          const err = dispatchRes.getError();
          // Record failure in submissions
          await db.insert(shaClaimSubmissions).values({
            tenantId,
            claimId,
            version: claim.version,
            submissionType: claim.resubmissionCount > 0 ? 'CORRECTED_RESUBMISSION' : 'INITIAL',
            correlationId,
            traceId,
            payloadDigest,
            requestPayloadRedacted: sanitizeForLogging(payload) as any,
            httpStatus: (err as any).statusCode || 500,
            outcome: 'REJECTED',
            errorMessage: err.message,
            submittedById: actorUserId,
          });

          // Transition to REJECTED
          await db
            .update(shaClaims)
            .set({
              status: ShaClaimStatus.REJECTED,
              rejectionReason: err.message,
              updatedAt: new Date(),
            })
            .where(eq(shaClaims.id, claimId));

          throw err;
        }

        const data = dispatchRes.getValue();

        // Record successful submission
        await db.insert(shaClaimSubmissions).values({
          tenantId,
          claimId,
          version: claim.version,
          submissionType: claim.resubmissionCount > 0 ? 'CORRECTED_RESUBMISSION' : 'INITIAL',
          correlationId,
          traceId,
          payloadDigest,
          requestPayloadRedacted: sanitizeForLogging(payload) as any,
          responsePayload: data as any,
          httpStatus: 200,
          outcome: 'SUCCESS',
          submittedById: actorUserId,
        });

        // Determine final state from SHA response
        const nextStatus = data.status === 'APPROVED' ? ShaClaimStatus.ACCEPTED : ShaClaimStatus.ACKNOWLEDGED;
        const [updatedClaim] = await db
          .update(shaClaims)
          .set({
            status: nextStatus,
            shaTrackingNumber: data.trackingNumber,
            approvedAmountKES: (data.adjudicatedAmountKES || 0).toString(),
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(shaClaims.id, claimId))
          .returning();

        await this.auditService.recordEvent({
          tenantId,
          userId: actorUserId,
          action: AuditEventType.SHA_CLAIM_SUBMITTED,
          resource: 'SHA_CLAIM',
          resourceId: claimId,
          clientIp: ipAddress,
          details: {
            claimNumber: claim.claimNumber,
            status: nextStatus,
            trackingNumber: data.trackingNumber,
            correlationId,
          },
        });

        return updatedClaim;
      } catch (err: any) {
        // Safe timeout handling: if network timed out, record for reconciliation
        if (err.code === 'TIMEOUT' || err.statusCode === 504) {
          await db.insert(shaClaimSubmissions).values({
            tenantId,
            claimId,
            version: claim.version,
            submissionType: 'INITIAL',
            correlationId,
            traceId,
            payloadDigest,
            requestPayloadRedacted: sanitizeForLogging(payload) as any,
            httpStatus: 504,
            outcome: 'TIMEOUT',
            errorMessage: 'Gateway Timeout during submission. Enqueued for reconciliation.',
            submittedById: actorUserId,
          });

          // Keep in SUBMITTED state to allow reconciliation worker to query
          this.logger.warn(`Submission timed out for claim ${claim.claimNumber}. Flagged for reconciliation.`);
        }
        throw err;
      }
    });
  }

  // ===========================================================================
  // 5. INPATIENT DISCHARGE DISPATCH
  // ===========================================================================

  async dischargeInpatientClaim(
    tenantId: string,
    facilityId: string,
    claimId: string,
    dto: InpatientDischargeDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [claim] = await db
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.id, claimId)))
        .limit(1);

      if (!claim) {
        throw new NotFoundException(`Claim ${claimId} not found`);
      }

      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;
      const correlationId = `CORR-DISCH-${Date.now()}`;

      // Dispatch to SHA Inpatient Discharge Endpoint
      const res = await this.integrationClients.shaClaims.dischargeInpatientClaim(
        {
          claimId: claim.claimNumber,
          dischargeDate: dto.dischargeDate,
          dischargeDisposition: dto.dischargeDisposition,
          finalDiagnosisIcd11: dto.finalDiagnosisIcd11,
          summaryNotes: dto.summaryNotes,
        },
        kmflCode,
        dto.attendingPractitionerPuid,
        correlationId,
      );

      if (!res.isSuccess()) {
        throw res.getError();
      }

      const remoteData = res.getValue();

      const [updated] = await db
        .update(shaClaims)
        .set({
          status: ShaClaimStatus.ACCEPTED,
          serviceEndDate: new Date(dto.dischargeDate),
          dischargeInfo: {
            dischargeDate: dto.dischargeDate,
            dischargeDisposition: dto.dischargeDisposition,
            summaryNotes: dto.summaryNotes,
            finalDiagnosisIcd11: dto.finalDiagnosisIcd11,
            attendingPractitionerPuid: dto.attendingPractitionerPuid,
          },
          shaTrackingNumber: remoteData.trackingNumber,
          approvedAmountKES: (remoteData.adjudicatedAmountKES || 0).toString(),
          updatedAt: new Date(),
        })
        .where(eq(shaClaims.id, claimId))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_INPATIENT_DISCHARGE_SUBMITTED,
        resource: 'SHA_CLAIM',
        resourceId: claimId,
        clientIp: ipAddress,
        details: {
          dischargeDisposition: dto.dischargeDisposition,
          trackingNumber: remoteData.trackingNumber,
        },
      });

      return updated;
    });
  }

  // ===========================================================================
  // 6. SUPPORTING DOCUMENT ATTACHMENT
  // ===========================================================================

  async attachDocument(
    tenantId: string,
    claimId: string,
    dto: AttachDocumentDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [claim] = await db
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.id, claimId)))
        .limit(1);

      if (!claim) {
        throw new NotFoundException(`Claim ${claimId} not found`);
      }

      const [attachment] = await db
        .insert(shaClaimAttachments)
        .values({
          tenantId,
          claimId,
          documentType: dto.documentType,
          title: dto.title,
          mimeType: dto.mimeType,
          fileUrl: dto.fileUrl,
          fileSizeBytes: dto.fileSizeBytes,
          shaUploadStatus: 'UPLOADED_TO_SHA',
          uploadedById: actorUserId,
        })
        .returning();

      if (!attachment) {
        throw new Error('Failed to record attachment');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.FILE_UPLOADED,
        resource: 'SHA_ATTACHMENT',
        resourceId: attachment.id,
        clientIp: ipAddress,
        details: { claimId, documentType: dto.documentType, title: dto.title },
      });

      return attachment;
    });
  }

  // ===========================================================================
  // 7. STATUS TRACKING & WEBHOOK CALLBACK PROCESSING
  // ===========================================================================

  async trackClaimStatus(
    tenantId: string,
    facilityId: string,
    claimId: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [claim] = await db
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.id, claimId)))
        .limit(1);

      if (!claim) {
        throw new NotFoundException(`Claim ${claimId} not found`);
      }

      const [facility] = await db
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, tenantId), eq(facilities.id, facilityId)))
        .limit(1);

      const kmflCode = facility?.kmflCode || config.SHA_FACILITY_CODE;

      const res = await this.integrationClients.shaClaims.queryClaimStatus(claim.claimNumber, kmflCode);
      if (!res.isSuccess()) {
        throw res.getError();
      }

      return {
        localClaim: claim,
        remoteStatus: res.getValue(),
      };
    });
  }

  async processCallback(
    tenantId: string,
    payload: ShaCallbackPayloadDto,
    traceId?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Log event in callback table
      const [event] = await db
        .insert(shaCallbackEvents)
        .values({
          tenantId,
          eventType: payload.eventType,
          claimNumber: payload.claimNumber,
          preauthNumber: payload.preauthNumber,
          traceId,
          rawPayload: payload as any,
          processed: false,
        })
        .returning();

      if (!event) {
        throw new Error('Failed to record callback event');
      }

      // 2. Process event actions
      if (payload.claimNumber) {
        const [claim] = await db
          .select()
          .from(shaClaims)
          .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.claimNumber, payload.claimNumber)))
          .orderBy(desc(shaClaims.version))
          .limit(1);

        if (claim) {
          if (payload.eventType === 'CLAIM_PROCESSED' || payload.status === 'ADJUDICATED') {
            await db
              .update(shaClaims)
              .set({
                status: ShaClaimStatus.ADJUDICATED,
                approvedAmountKES: (payload.approvedAmountKES ?? 0).toString(),
                patientCopayKES: (payload.patientCopayKES ?? 0).toString(),
                deductionAmountKES: (payload.deductionAmountKES ?? 0).toString(),
                adjudicatedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(shaClaims.id, claim.id));
          } else if (payload.eventType === 'REMITTANCE_ISSUED' || payload.status === 'PAID') {
            await db
              .update(shaClaims)
              .set({
                status: ShaClaimStatus.PAID,
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(shaClaims.id, claim.id));
          } else if (payload.eventType === 'CLAIM_DISPUTED' || payload.status === 'REJECTED') {
            await db
              .update(shaClaims)
              .set({
                status: ShaClaimStatus.REJECTED,
                rejectionReason: payload.rejectionReason || 'Rejected by SHA adjudication rules',
                updatedAt: new Date(),
              })
              .where(eq(shaClaims.id, claim.id));
          }
        }
      }

      await db
        .update(shaCallbackEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(shaCallbackEvents.id, event.id));

      await this.auditService.recordEvent({
        tenantId,
        userId: undefined,
        action: AuditEventType.SHA_CALLBACK_RECEIVED,
        resource: 'SHA_CALLBACK',
        resourceId: event.id,
        details: { eventType: payload.eventType, claimNumber: payload.claimNumber },
      });

      return { processed: true, eventId: event.id };
    });
  }

  // ===========================================================================
  // 8. CORRECTED CLAIMS RESUBMISSION
  // ===========================================================================

  async prepareCorrectedClaim(
    tenantId: string,
    facilityId: string,
    originalClaimId: string,
    dto: CorrectClaimDto,
    actorUserId: string,
    ipAddress?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [original] = await db
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, tenantId), eq(shaClaims.id, originalClaimId)))
        .limit(1);

      if (!original) {
        throw new NotFoundException(`Original claim ${originalClaimId} not found`);
      }

      if (original.status !== ShaClaimStatus.REJECTED && original.status !== ShaClaimStatus.DISPUTED) {
        throw new BadRequestException(
          `Only REJECTED or DISPUTED claims can be corrected. Current status is ${original.status}.`,
        );
      }

      const nextVersion = original.version + 1;
      const resubmissionCount = original.resubmissionCount + 1;

      // Create new version record preserving original claim ID linkage
      const [newClaim] = await db
        .insert(shaClaims)
        .values({
          tenantId,
          facilityId,
          claimNumber: original.claimNumber,
          version: nextVersion,
          patientId: original.patientId,
          encounterId: original.encounterId,
          invoiceId: original.invoiceId,
          preauthId: original.preauthId,
          fund: original.fund,
          scenario: original.scenario,
          accessPoint: original.accessPoint,
          paymentMechanism: original.paymentMechanism,
          status: ShaClaimStatus.DRAFT,
          serviceStartDate: original.serviceStartDate,
          serviceEndDate: original.serviceEndDate,
          totalClaimAmountKES: original.totalClaimAmountKES,
          originalClaimId: original.id,
          resubmissionCount,
          rejectionReason: `Corrected v${nextVersion}: ${dto.correctionReason}`,
        })
        .returning();

      if (!newClaim) {
        throw new Error('Failed to create corrected claim');
      }

      let finalClaim = newClaim;

      // Copy or update line items
      if (dto.updatedItems && dto.updatedItems.length > 0) {
        let newTotal = 0;
        for (const item of dto.updatedItems) {
          const itemTotal = item.quantity * item.unitPriceKES;
          newTotal += itemTotal;
          await db.insert(shaClaimItems).values({
            tenantId,
            claimId: newClaim.id,
            lineType: item.lineType,
            code: item.code,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPriceKES: item.unitPriceKES.toString(),
            totalAmountKES: itemTotal.toString(),
            serviceDate: new Date(item.serviceDate),
            practitionerPuid: item.practitionerPuid,
          });
        }
        const [updated] = await db
          .update(shaClaims)
          .set({ totalClaimAmountKES: newTotal.toString(), updatedAt: new Date() })
          .where(eq(shaClaims.id, newClaim.id))
          .returning();

        if (updated) {
          finalClaim = updated;
        }
      } else {
        const oldItems = await db
          .select()
          .from(shaClaimItems)
          .where(and(eq(shaClaimItems.tenantId, tenantId), eq(shaClaimItems.claimId, original.id)));

        for (const item of oldItems) {
          await db.insert(shaClaimItems).values({
            tenantId,
            claimId: newClaim.id,
            lineType: item.lineType,
            code: item.code,
            description: item.description,
            quantity: item.quantity,
            unitPriceKES: item.unitPriceKES,
            totalAmountKES: item.totalAmountKES,
            serviceDate: item.serviceDate,
            practitionerPuid: item.practitionerPuid,
          });
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_CLAIM_CORRECTION_PREPARED,
        resource: 'SHA_CLAIM',
        resourceId: finalClaim.id,
        clientIp: ipAddress,
        details: {
          originalClaimId,
          claimNumber: original.claimNumber,
          newVersion: nextVersion,
          reason: dto.correctionReason,
        },
      });

      return finalClaim;
    });
  }

  // ===========================================================================
  // 9. RECONCILIATION OF AMBIGUOUS & TIMED-OUT SUBMISSIONS
  // ===========================================================================

  async reconcileClaims(
    tenantId: string,
    facilityId: string,
    queryDto: ReconcileClaimsQueryDto,
    actorUserId: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // Find all claims matching query or in SUBMITTED state (potentially timed-out or unacknowledged)
      const conditions = [
        eq(shaClaims.tenantId, tenantId),
        eq(shaClaims.facilityId, facilityId),
      ];

      if (queryDto.status) {
        conditions.push(eq(shaClaims.status, queryDto.status as ShaClaimStatus));
      } else {
        conditions.push(eq(shaClaims.status, ShaClaimStatus.SUBMITTED));
      }

      if (queryDto.claimNumber) {
        conditions.push(eq(shaClaims.claimNumber, queryDto.claimNumber));
      }

      const pendingClaims = await db
        .select()
        .from(shaClaims)
        .where(and(...conditions));

      const reconciledResults: Array<{ claimNumber: string; resolvedStatus: string }> = [];

      for (const clm of pendingClaims) {
        try {
          const check = await this.integrationClients.shaClaims.queryClaimStatus(
            clm.claimNumber,
            facilityId,
          );

          if (check.isSuccess()) {
            const remote = check.getValue();
            const nextStatus = remote.status === 'APPROVED' ? ShaClaimStatus.ACCEPTED : ShaClaimStatus.ACKNOWLEDGED;
            await db
              .update(shaClaims)
              .set({
                status: nextStatus,
                shaTrackingNumber: remote.trackingNumber,
                approvedAmountKES: (remote.adjudicatedAmountKES || 0).toString(),
                updatedAt: new Date(),
              })
              .where(eq(shaClaims.id, clm.id));

            reconciledResults.push({ claimNumber: clm.claimNumber, resolvedStatus: nextStatus });
          }
        } catch (err: any) {
          // If remote check fails, keep for next cycle
          this.logger.warn(`Reconciliation probe failed for ${clm.claimNumber}: ${err.message}`);
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.SHA_CLAIM_RECONCILED,
        resource: 'SHA_RECONCILIATION',
        details: { totalProbed: pendingClaims.length, resolvedCount: reconciledResults.length },
      });

      return {
        totalProbed: pendingClaims.length,
        resolved: reconciledResults,
      };
    });
  }
}
