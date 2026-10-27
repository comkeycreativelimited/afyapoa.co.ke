import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  referrals,
  patients,
  facilities,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  ReferralStatus,
  ReferralDirection,
  ReferralPriority,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateReferralDto,
  UpdateReferralStatusDto,
  SubmitCounterReferralDto,
} from './dto/referral.dto.js';

@Injectable()
export class ReferralsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateReferralNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `REF-${yearMonth}-${randomSuffix}`;
  }

  async createReferral(dto: CreateReferralDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      const [fac] = await tx
        .select()
        .from(facilities)
        .where(and(eq(facilities.tenantId, context.tenantId), eq(facilities.id, dto.facilityId)))
        .limit(1);

      const referralNumber = this.generateReferralNumber();

      const ambulanceInfo =
        typeof dto.ambulanceDetails === 'string'
          ? { notes: dto.ambulanceDetails }
          : dto.ambulanceDetails || (dto.ambulanceRequired ? { required: true } : null);

      const [referral] = await tx
        .insert(referrals)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          referralNumber,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          referralDirection: dto.referralDirection || ReferralDirection.OUTBOUND,
          referringFacilityKmfl: dto.referringFacilityKmfl || fac?.kmflCode || 'UNKNOWN',
          referringFacilityName: dto.referringFacilityName || fac?.name || 'Referring Facility',
          receivingFacilityKmfl: dto.receivingFacilityKmfl,
          receivingFacilityName: dto.receivingFacilityName,
          referringPractitionerId: dto.referringPractitionerId || context.userId,
          referringPractitionerName: dto.referringPractitionerName || 'Dr. Otieno',
          specialtyRequested: dto.specialtyRequested,
          clinicalSummary: dto.clinicalSummary,
          reasonForReferral: dto.reasonForReferral,
          priority: dto.priority || ReferralPriority.ROUTINE,
          status: ReferralStatus.DISPATCHED,
          transportType: dto.transportType || (dto.ambulanceRequired ? 'AMBULANCE' : 'AMBULANCE'),
          ambulanceDetails: ambulanceInfo,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.REFERRAL_DISPATCHED,
        resource: 'referrals',
        resourceId: referral!.id,
        details: {
          referralNumber: referral!.referralNumber,
          receivingFacilityKmfl: referral!.receivingFacilityKmfl,
          specialty: referral!.specialtyRequested,
        },
      });

      return referral!;
    });
  }

  async updateStatus(id: string, dto: UpdateReferralStatusDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [referral] = await tx
        .select()
        .from(referrals)
        .where(and(eq(referrals.tenantId, context.tenantId), eq(referrals.id, id)))
        .limit(1);

      if (!referral) {
        throw new NotFoundException(`Referral record with ID ${id} not found.`);
      }

      const updateData: Record<string, any> = {
        status: dto.status,
        updatedAt: new Date(),
      };

      if (dto.status === ReferralStatus.ACCEPTED) {
        updateData.acceptedAt = new Date();
      }

      const [updated] = await tx
        .update(referrals)
        .set(updateData)
        .where(eq(referrals.id, id))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.REFERRAL_STATUS_UPDATED,
        resource: 'referrals',
        resourceId: id,
        details: { status: dto.status },
      });

      return updated;
    });
  }

  async submitCounterReferral(id: string, dto: SubmitCounterReferralDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [referral] = await tx
        .select()
        .from(referrals)
        .where(and(eq(referrals.tenantId, context.tenantId), eq(referrals.id, id)))
        .limit(1);

      if (!referral) {
        throw new NotFoundException(`Referral record with ID ${id} not found.`);
      }

      const [updated] = await tx
        .update(referrals)
        .set({
          counterReferralNotes: dto.counterReferralNotes,
          counterReferralPractitionerName: dto.counterReferralPractitionerName || 'Receiving Specialist',
          counterReferralDate: dto.counterReferralDate ? new Date(dto.counterReferralDate) : new Date(),
          status: ReferralStatus.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(referrals.id, id))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.COUNTER_REFERRAL_RECEIVED,
        resource: 'referrals',
        resourceId: id,
        details: {
          referralNumber: referral.referralNumber,
          counterReferralPractitioner: dto.counterReferralPractitionerName,
        },
      });

      if (!updated) {
        throw new NotFoundException(`Referral with ID ${id} not found.`);
      }

      return {
        ...updated,
        counterReferralReceivedAt: updated.counterReferralDate,
      };
    });
  }

  async listReferrals(
    facilityId: string,
    context: TenantContext,
    direction?: ReferralDirection,
    status?: ReferralStatus,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(referrals.tenantId, context.tenantId),
        eq(referrals.facilityId, facilityId),
      ];
      if (direction) {
        conditions.push(eq(referrals.referralDirection, direction));
      }
      if (status) {
        conditions.push(eq(referrals.status, status));
      }

      return await tx
        .select()
        .from(referrals)
        .where(and(...conditions))
        .orderBy(desc(referrals.dispatchedAt));
    });
  }

  async getReferralById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [referral] = await tx
        .select()
        .from(referrals)
        .where(and(eq(referrals.tenantId, context.tenantId), eq(referrals.id, id)))
        .limit(1);

      if (!referral) {
        throw new NotFoundException(`Referral with ID ${id} not found.`);
      }

      return referral;
    });
  }
}
