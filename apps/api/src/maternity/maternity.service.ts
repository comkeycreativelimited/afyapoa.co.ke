import {
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  maternityDeliveries,
  newbornProfiles,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  DeliveryOutcome,
  PerinealTear,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  RecordMaternityDeliveryDto,
  RegisterNewbornDto,
} from './dto/maternity.dto.js';

@Injectable()
export class MaternityService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateDeliveryNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `DEL-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // MATERNITY DELIVERIES
  // ==========================================

  async recordDelivery(dto: RecordMaternityDeliveryDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify mother exists
      const [mother] = await tx
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.tenantId, context.tenantId),
            eq(patients.id, dto.motherPatientId),
          ),
        )
        .limit(1);

      if (!mother) {
        throw new NotFoundException(`Mother patient with ID ${dto.motherPatientId} not found.`);
      }

      const deliveryNumber = this.generateDeliveryNumber();

      const [delivery] = await tx
        .insert(maternityDeliveries)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          motherPatientId: dto.motherPatientId,
          admissionId: dto.admissionId || null,
          deliveryNumber,
          gravida: dto.gravida || 1,
          parity: dto.parity ?? (dto as any).para ?? 0,
          gestationalAgeWeeks: dto.gestationalAgeWeeks ? String(dto.gestationalAgeWeeks) : null,
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : (dto as any).deliveryDateTime ? new Date((dto as any).deliveryDateTime) : new Date(),
          deliveryMode: dto.deliveryMode,
          deliveryOutcome: dto.deliveryOutcome || (dto as any).outcome || DeliveryOutcome.LIVE_BIRTH,
          perinealTear: dto.perinealTear || PerinealTear.NONE,
          estimatedBloodLossMl: dto.estimatedBloodLossMl || null,
          deliveringClinicianId: dto.deliveringClinicianId || (dto as any).deliveredByUserId || context.userId,
          partographSummary: dto.partographSummary || (dto as any).partographData || null,
          complications: dto.complications || (dto as any).clinicalSummary || null,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.MATERNITY_DELIVERY_RECORDED,
        resource: 'maternity_deliveries',
        resourceId: delivery!.id,
        details: {
          deliveryNumber: delivery!.deliveryNumber,
          motherPatientId: dto.motherPatientId,
          deliveryMode: dto.deliveryMode,
          outcome: dto.deliveryOutcome,
        },
      });

      return {
        ...delivery!,
        partographData: delivery!.partographSummary,
      };
    });
  }

  async listDeliveries(facilityId: string, context: TenantContext, motherPatientId?: string) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(maternityDeliveries.tenantId, context.tenantId),
        eq(maternityDeliveries.facilityId, facilityId),
      ];
      if (motherPatientId) {
        conditions.push(eq(maternityDeliveries.motherPatientId, motherPatientId));
      }

      return await tx
        .select()
        .from(maternityDeliveries)
        .where(and(...conditions))
        .orderBy(desc(maternityDeliveries.deliveryDate));
    });
  }

  async getDeliveryById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [delivery] = await tx
        .select()
        .from(maternityDeliveries)
        .where(
          and(
            eq(maternityDeliveries.tenantId, context.tenantId),
            eq(maternityDeliveries.id, id),
          ),
        )
        .limit(1);

      if (!delivery) {
        throw new NotFoundException(`Maternity delivery record ${id} not found.`);
      }

      // Fetch linked newborns
      const newborns = await tx
        .select()
        .from(newbornProfiles)
        .where(
          and(
            eq(newbornProfiles.tenantId, context.tenantId),
            eq(newbornProfiles.deliveryId, id),
          ),
        );

      return {
        ...delivery,
        newborns,
      };
    });
  }

  // ==========================================
  // NEWBORN PROFILES & REGISTRATION
  // ==========================================

  async registerNewborn(dto: RegisterNewbornDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify delivery exists
      const [delivery] = await tx
        .select()
        .from(maternityDeliveries)
        .where(
          and(
            eq(maternityDeliveries.tenantId, context.tenantId),
            eq(maternityDeliveries.id, dto.deliveryId),
          ),
        )
        .limit(1);

      if (!delivery) {
        throw new NotFoundException(`Delivery with ID ${dto.deliveryId} not found.`);
      }

      // 2. Fetch mother
      const [mother] = await tx
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.tenantId, context.tenantId),
            eq(patients.id, dto.motherPatientId),
          ),
        )
        .limit(1);

      if (!mother) {
        throw new NotFoundException(`Mother patient ${dto.motherPatientId} not found.`);
      }

      let newbornPatientId: string | null = null;

      // 3. Optional auto-provisioning of linked newborn patient record
      if (dto.createPatientRecord !== false) {
        const birthDateObj = dto.birthDate ? new Date(dto.birthDate) : new Date();
        const genderVal =
          dto.gender.toUpperCase() === 'MALE'
            ? 'MALE'
            : dto.gender.toUpperCase() === 'FEMALE'
              ? 'FEMALE'
              : 'OTHER';

        const babyNumber = Math.floor(1000 + Math.random() * 9000);
        const babyMrn = `MRN-BB-${Date.now().toString().slice(-6)}-${babyNumber}`;
        const [babyPatient] = await tx
          .insert(patients)
          .values({
            tenantId: context.tenantId,
            primaryFacilityId: dto.facilityId,
            mrn: babyMrn,
            firstName: 'Baby of',
            middleName: mother.firstName,
            lastName: mother.lastName,
            dateOfBirth: birthDateObj.toISOString().split('T')[0]!,
            gender: genderVal,
            physicalAddress: mother.physicalAddress || null,
            county: mother.county || null,
            subCounty: mother.subCounty || null,
            status: 'ACTIVE',
            identityStatus: 'PENDING_VERIFICATION',
            upi: mother.upi ? `MTHR-${mother.upi}` : null,
          })
          .returning();

        newbornPatientId = babyPatient?.id || null;
      }

      // 4. Create Newborn Profile
      const [newborn] = await tx
        .insert(newbornProfiles)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          deliveryId: dto.deliveryId,
          motherPatientId: dto.motherPatientId,
          patientId: newbornPatientId ?? null,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : new Date(),
          birthOrder: dto.birthOrder ?? 1,
          gender: dto.gender,
          birthWeightGrams: dto.birthWeightGrams,
          birthLengthCm: dto.birthLengthCm !== undefined && dto.birthLengthCm !== null ? String(dto.birthLengthCm) : null,
          headCircumferenceCm: dto.headCircumferenceCm !== undefined && dto.headCircumferenceCm !== null ? String(dto.headCircumferenceCm) : null,
          apgarScore1Min: dto.apgarScore1Min,
          apgarScore5Min: dto.apgarScore5Min,
          apgarScore10Min: dto.apgarScore10Min ?? null,
          resuscitationRequired: dto.resuscitationRequired ?? false,
          birthNotificationNumber: dto.birthNotificationNumber ?? null,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.NEWBORN_REGISTERED,
        resource: 'newborn_profiles',
        resourceId: newborn!.id,
        details: {
          deliveryId: dto.deliveryId,
          motherPatientId: dto.motherPatientId,
          birthWeightGrams: dto.birthWeightGrams,
          apgar1: dto.apgarScore1Min,
          apgar5: dto.apgarScore5Min,
          newbornPatientId,
        },
      });

      return newborn!;
    });
  }

  async listNewborns(facilityId: string, context: TenantContext, deliveryId?: string) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(newbornProfiles.tenantId, context.tenantId),
        eq(newbornProfiles.facilityId, facilityId),
      ];
      if (deliveryId) {
        conditions.push(eq(newbornProfiles.deliveryId, deliveryId));
      }

      return await tx
        .select()
        .from(newbornProfiles)
        .where(and(...conditions))
        .orderBy(desc(newbornProfiles.birthDate));
    });
  }
}
