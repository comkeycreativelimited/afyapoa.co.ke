import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  insurancePolicies,
  insuranceAuthorizations,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  InsurancePolicyStatus,
  InsuranceAuthStatus,
} from '@afyapoa/domain-core';
import { AuditService } from '../../audit/audit.service.js';
import {
  RegisterInsurancePolicyDto,
  RequestPreauthorizationDto,
} from './dto/private-insurance.dto.js';

@Injectable()
export class PrivateInsuranceService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateAuthCode(payerCode: string): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `AUTH-${payerCode}-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // POLICY REGISTRATION & ELIGIBILITY
  // ==========================================

  async registerPolicy(dto: RegisterInsurancePolicyDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      const [policy] = await tx
        .insert(insurancePolicies)
        .values({
          tenantId: context.tenantId,
          payerCode: dto.payerCode,
          payerName: dto.payerName,
          patientId: dto.patientId,
          policyNumber: dto.policyNumber,
          memberNumber: dto.memberNumber,
          principalMemberName: dto.principalMemberName || 'Principal Member',
          relationshipToPrincipal: dto.relationshipToPrincipal || 'SELF',
          benefitScheme: dto.benefitScheme || dto.schemeType || 'STANDARD',
          annualLimit: dto.annualLimit || dto.benefitLimitInpatient || '1000000.00',
          balanceAvailable: dto.balanceAvailable || dto.annualLimit || dto.benefitLimitInpatient || '1000000.00',
          copayAmount: dto.copayAmount || '0.00',
          copayPercentage: dto.copayPercentage || '0.00',
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          expiryDate: dto.expiryDate
            ? new Date(dto.expiryDate)
            : dto.endDate
              ? new Date(dto.endDate)
              : new Date(Date.now() + 365 * 24 * 3600 * 1000),
          status: InsurancePolicyStatus.ACTIVE,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PRIVATE_INSURANCE_POLICY_REGISTERED,
        resource: 'insurance_policies',
        resourceId: policy!.id,
        details: {
          payerCode: policy!.payerCode,
          memberNumber: policy!.memberNumber,
          patientId: policy!.patientId,
        },
      });

      return policy!;
    });
  }

  async verifyEligibility(policyId: string, estimatedAmount: number, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [policy] = await tx
        .select()
        .from(insurancePolicies)
        .where(
          and(
            eq(insurancePolicies.tenantId, context.tenantId),
            eq(insurancePolicies.id, policyId),
          ),
        )
        .limit(1);

      if (!policy) {
        throw new NotFoundException(`Insurance policy with ID ${policyId} not found.`);
      }

      const now = new Date();
      const isExpired = policy.expiryDate < now;
      const isActive = policy.status === InsurancePolicyStatus.ACTIVE && !isExpired;
      const availableBalance = parseFloat(policy.balanceAvailable);
      const copayFixed = parseFloat(policy.copayAmount);
      const copayPercent = parseFloat(policy.copayPercentage);
      const calculatedCopay = copayFixed + (estimatedAmount * copayPercent) / 100;

      const isCovered = isActive && availableBalance >= estimatedAmount;

      return {
        policyId: policy.id,
        payerCode: policy.payerCode,
        payerName: policy.payerName,
        memberNumber: policy.memberNumber,
        benefitScheme: policy.benefitScheme,
        isActive,
        isExpired,
        availableBalance,
        estimatedAmount,
        isCovered,
        eligible: isCovered,
        copayRequired: calculatedCopay,
        copayPayableByPatient: calculatedCopay,
        coverageEstimate: estimatedAmount - calculatedCopay,
        inpatientLimitRemaining: availableBalance,
        recommendedPreauth: isCovered ? 'ELIGIBLE' : 'DECLINE_OR_PARTIAL',
      };
    });
  }

  // ==========================================
  // PRE-AUTHORIZATION REQUESTS
  // ==========================================

  async requestPreauthorization(dto: RequestPreauthorizationDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [policy] = await tx
        .select()
        .from(insurancePolicies)
        .where(
          and(
            eq(insurancePolicies.tenantId, context.tenantId),
            eq(insurancePolicies.id, dto.policyId),
          ),
        )
        .limit(1);

      if (!policy) {
        throw new NotFoundException(`Policy with ID ${dto.policyId} not found.`);
      }

      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, policy.patientId)))
        .limit(1);

      const facilityId = dto.facilityId || patient?.primaryFacilityId;
      const reqAmount = parseFloat(String(dto.requestedAmount));
      const availBalance = parseFloat(policy.balanceAvailable);
      const now = new Date();

      let authStatus: InsuranceAuthStatus = InsuranceAuthStatus.APPROVED;
      let approvedAmount = reqAmount;
      let declineReason: string | null = null;

      if (policy.status !== InsurancePolicyStatus.ACTIVE || policy.expiryDate < now) {
        authStatus = InsuranceAuthStatus.DECLINED;
        approvedAmount = 0;
        declineReason = 'Policy is expired or inactive.';
      } else if (availBalance < reqAmount) {
        if (availBalance > 0) {
          authStatus = InsuranceAuthStatus.APPROVED;
          approvedAmount = availBalance; // Partial approval up to available limit
        } else {
          authStatus = InsuranceAuthStatus.DECLINED;
          approvedAmount = 0;
          declineReason = 'Annual benefit limit exhausted.';
        }
      }

      const authCode = this.generateAuthCode(policy.payerCode);
      const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days validity

      const [auth] = await tx
        .insert(insuranceAuthorizations)
        .values({
          tenantId: context.tenantId,
          facilityId: facilityId!,
          policyId: dto.policyId,
          patientId: dto.patientId || policy.patientId,
          encounterId: dto.encounterId || null,
          admissionId: dto.admissionId || null,
          authCode,
          requestedAmount: String(dto.requestedAmount),
          approvedAmount: approvedAmount.toFixed(2),
          requestedServices: dto.requestedServices || (dto as any).serviceCategory || 'GENERAL_PROCEDURE',
          status: authStatus,
          validUntil,
          declineReason: declineReason || null,
        })
        .returning();

      // If approved, reserve/deduct the approved amount from policy balance
      if (authStatus === InsuranceAuthStatus.APPROVED && approvedAmount > 0) {
        const newBalance = Math.max(0, availBalance - approvedAmount);
        await tx
          .update(insurancePolicies)
          .set({
            balanceAvailable: newBalance.toFixed(2),
            updatedAt: new Date(),
          })
          .where(eq(insurancePolicies.id, policy.id));
      }

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PRIVATE_INSURANCE_AUTH_REQUESTED,
        resource: 'insurance_authorizations',
        resourceId: auth!.id,
        details: {
          authCode: auth!.authCode,
          payerCode: policy.payerCode,
          status: auth!.status,
          approvedAmount: auth!.approvedAmount,
        },
      });

      return auth!;
    });
  }

  async listPolicies(patientId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(insurancePolicies)
        .where(
          and(
            eq(insurancePolicies.tenantId, context.tenantId),
            eq(insurancePolicies.patientId, patientId),
          ),
        )
        .orderBy(desc(insurancePolicies.createdAt));
    });
  }

  async getAuthorizationById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [auth] = await tx
        .select()
        .from(insuranceAuthorizations)
        .where(
          and(
            eq(insuranceAuthorizations.tenantId, context.tenantId),
            eq(insuranceAuthorizations.id, id),
          ),
        )
        .limit(1);

      if (!auth) {
        throw new NotFoundException(`Authorization with ID ${id} not found.`);
      }

      return auth;
    });
  }
}
