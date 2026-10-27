import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  wards,
  beds,
  inpatientAdmissions,
  inpatientBedTransfers,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  InpatientAdmissionStatus,
  InpatientAdmissionType,
  InpatientDischargeDisposition,
  BedStatus,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateWardDto,
  CreateBedDto,
  UpdateBedStatusDto,
  CreateInpatientAdmissionDto,
  TransferBedDto,
  DischargePatientDto,
  CancelAdmissionDto,
} from './dto/inpatient.dto.js';

@Injectable()
export class InpatientService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateAdmissionNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ADM-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // WARD MANAGEMENT
  // ==========================================

  async createWard(dto: CreateWardDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(wards)
        .where(
          and(
            eq(wards.tenantId, context.tenantId),
            eq(wards.facilityId, dto.facilityId),
            eq(wards.code, dto.code),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException(`Ward with code ${dto.code} already exists in facility.`);
      }

      const [newWard] = await tx
        .insert(wards)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          code: dto.code,
          name: dto.name,
          genderRestriction: dto.genderRestriction,
          specialty: dto.specialty,
          floorLocation: dto.floorLocation,
          totalBeds: dto.totalBeds || 0,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.WARD_CREATED,
        resource: 'wards',
        resourceId: newWard!.id,
        details: { code: newWard!.code, name: newWard!.name },
      });

      return newWard!;
    });
  }

  async listWards(facilityId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(wards)
        .where(and(eq(wards.tenantId, context.tenantId), eq(wards.facilityId, facilityId)))
        .orderBy(wards.name);
    });
  }

  async getWardById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [ward] = await tx
        .select()
        .from(wards)
        .where(and(eq(wards.tenantId, context.tenantId), eq(wards.id, id)))
        .limit(1);

      if (!ward) {
        throw new NotFoundException(`Ward with ID ${id} not found.`);
      }

      return ward;
    });
  }

  // ==========================================
  // BED MANAGEMENT & CONCURRENCY CONTROLS
  // ==========================================

  async createBed(dto: CreateBedDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // Verify ward belongs to tenant
      const [ward] = await tx
        .select()
        .from(wards)
        .where(and(eq(wards.tenantId, context.tenantId), eq(wards.id, dto.wardId)))
        .limit(1);

      if (!ward) {
        throw new NotFoundException(`Ward with ID ${dto.wardId} not found.`);
      }

      const [existing] = await tx
        .select()
        .from(beds)
        .where(
          and(
            eq(beds.tenantId, context.tenantId),
            eq(beds.wardId, dto.wardId),
            eq(beds.bedNumber, dto.bedNumber),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException(`Bed number ${dto.bedNumber} already exists in ward.`);
      }

      const [newBed] = await tx
        .insert(beds)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId || ward.facilityId,
          wardId: dto.wardId,
          bedNumber: dto.bedNumber,
          roomNumber: dto.roomNumber || null,
          bedType: dto.bedType,
          status: BedStatus.VACANT,
          dailyRate: dto.dailyRate || '0.00',
        })
        .returning();

      // Update ward bed count
      await tx
        .update(wards)
        .set({ totalBeds: sql`${wards.totalBeds} + 1` })
        .where(eq(wards.id, dto.wardId));

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.BED_CONFIGURED,
        resource: 'beds',
        resourceId: newBed!.id,
        details: { bedNumber: newBed!.bedNumber, wardId: dto.wardId },
      });

      return newBed!;
    });
  }

  async listBeds(wardId: string, context: TenantContext, status?: BedStatus) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [eq(beds.tenantId, context.tenantId), eq(beds.wardId, wardId)];
      if (status) {
        conditions.push(eq(beds.status, status));
      }
      return await tx.select().from(beds).where(and(...conditions)).orderBy(beds.bedNumber);
    });
  }

  async updateBedStatus(bedId: string, dto: UpdateBedStatusDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [bed] = await tx
        .select()
        .from(beds)
        .where(and(eq(beds.tenantId, context.tenantId), eq(beds.id, bedId)))
        .limit(1);

      if (!bed) {
        throw new NotFoundException(`Bed with ID ${bedId} not found.`);
      }

      if (bed.status === BedStatus.OCCUPIED && dto.status === BedStatus.VACANT) {
        throw new BadRequestException('Cannot mark occupied bed as vacant directly. Discharge or transfer patient first.');
      }

      const [updatedBed] = await tx
        .update(beds)
        .set({
          status: dto.status,
          currentAdmissionId: dto.status === BedStatus.VACANT ? null : bed.currentAdmissionId,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, bedId))
        .returning();

      return updatedBed;
    });
  }

  // ==========================================
  // INPATIENT ADMISSIONS & CONCURRENCY CONTROLS
  // ==========================================

  async admitPatient(dto: CreateInpatientAdmissionDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify patient exists
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      // 2. Check if patient is already actively admitted
      const [activeAdmission] = await tx
        .select()
        .from(inpatientAdmissions)
        .where(
          and(
            eq(inpatientAdmissions.tenantId, context.tenantId),
            eq(inpatientAdmissions.patientId, dto.patientId),
            eq(inpatientAdmissions.status, InpatientAdmissionStatus.ADMITTED),
          ),
        )
        .limit(1);

      if (activeAdmission) {
        throw new ConflictException(
          `Patient is already admitted under admission number ${activeAdmission.admissionNumber}.`,
        );
      }

      // 3. Atomically check and lock the bed against double-booking
      const [bed] = await tx
        .select()
        .from(beds)
        .where(
          and(
            eq(beds.tenantId, context.tenantId),
            eq(beds.id, dto.bedId),
            eq(beds.wardId, dto.wardId),
          ),
        )
        .limit(1);

      if (!bed) {
        throw new NotFoundException(`Bed ${dto.bedId} does not exist in ward ${dto.wardId}.`);
      }

      if (bed.status !== BedStatus.VACANT) {
        throw new ConflictException(
          `Bed ${bed.bedNumber} is not vacant (Current Status: ${bed.status}). Double-booking prevented.`,
        );
      }

      const admissionNumber = this.generateAdmissionNumber();

      // 4. Create the admission record
      const [newAdmission] = await tx
        .insert(inpatientAdmissions)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          admissionNumber,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          admittingPractitionerId: dto.admittingPractitionerId || (dto as any).admittingDoctorId || context.userId,
          attendingPractitionerId: dto.attendingPractitionerId || dto.admittingPractitionerId || (dto as any).admittingDoctorId || context.userId,
          admissionType: dto.admissionType || InpatientAdmissionType.EMERGENCY,
          admissionDiagnosisIcd11: dto.admissionDiagnosisIcd11 || (dto as any).diagnosisCode || '1A00',
          admissionDiagnosisTitle: dto.admissionDiagnosisTitle || (dto as any).provisionalDiagnosis || 'Admitted for Inpatient Care',
          status: InpatientAdmissionStatus.ADMITTED,
          currentWardId: dto.wardId,
          currentBedId: dto.bedId,
          preauthorizationNumber: dto.preauthorizationNumber || null,
        })
        .returning();

      // 5. Concurrency-safe bed allocation using optimistic version increment
      const [allocatedBed] = await tx
        .update(beds)
        .set({
          status: BedStatus.OCCUPIED,
          currentAdmissionId: newAdmission!.id,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(beds.id, dto.bedId),
            eq(beds.status, BedStatus.VACANT),
            eq(beds.version, bed.version),
          ),
        )
        .returning();

      if (!allocatedBed) {
        throw new ConflictException(
          `Bed ${bed.bedNumber} was concurrently claimed by another operation. Transaction aborted.`,
        );
      }

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.INPATIENT_ADMITTED,
        resource: 'inpatient_admissions',
        resourceId: newAdmission!.id,
        details: {
          admissionNumber: newAdmission!.admissionNumber,
          patientId: dto.patientId,
          wardId: dto.wardId,
          bedId: dto.bedId,
        },
      });

      return newAdmission!;
    });
  }

  // ==========================================
  // INPATIENT BED TRANSFERS
  // ==========================================

  async transferBed(admissionId: string, dto: TransferBedDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [admission] = await tx
        .select()
        .from(inpatientAdmissions)
        .where(
          and(
            eq(inpatientAdmissions.tenantId, context.tenantId),
            eq(inpatientAdmissions.id, admissionId),
          ),
        )
        .limit(1);

      if (!admission) {
        throw new NotFoundException(`Admission with ID ${admissionId} not found.`);
      }

      if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
        throw new BadRequestException(
          `Cannot transfer patient in ${admission.status} state. Only active admissions can be transferred.`,
        );
      }

      if (admission.currentBedId === dto.toBedId) {
        throw new BadRequestException('Target bed is identical to the current assigned bed.');
      }

      // Check target bed
      const [targetBed] = await tx
        .select()
        .from(beds)
        .where(
          and(
            eq(beds.tenantId, context.tenantId),
            eq(beds.id, dto.toBedId),
            eq(beds.wardId, dto.toWardId),
          ),
        )
        .limit(1);

      if (!targetBed) {
        throw new NotFoundException(`Target bed ${dto.toBedId} does not exist in ward ${dto.toWardId}.`);
      }

      if (targetBed.status !== BedStatus.VACANT) {
        throw new ConflictException(
          `Target bed ${targetBed.bedNumber} is not vacant (Current Status: ${targetBed.status}).`,
        );
      }

      // 1. Release previous bed to VACANT
      await tx
        .update(beds)
        .set({
          status: BedStatus.VACANT,
          currentAdmissionId: null,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, admission.currentBedId));

      // 2. Occupy new bed
      const [occupiedTarget] = await tx
        .update(beds)
        .set({
          status: BedStatus.OCCUPIED,
          currentAdmissionId: admission.id,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(beds.id, dto.toBedId),
            eq(beds.status, BedStatus.VACANT),
            eq(beds.version, targetBed.version),
          ),
        )
        .returning();

      if (!occupiedTarget) {
        throw new ConflictException(
          `Target bed ${targetBed.bedNumber} was concurrently claimed. Transfer aborted.`,
        );
      }

      // 3. Record transfer history
      const [transfer] = await tx
        .insert(inpatientBedTransfers)
        .values({
          tenantId: context.tenantId,
          facilityId: admission.facilityId,
          admissionId: admission.id,
          fromWardId: admission.currentWardId,
          fromBedId: admission.currentBedId,
          toWardId: dto.toWardId,
          toBedId: dto.toBedId,
          reason: dto.reason,
          authorizedByPractitionerId: dto.authorizedByPractitionerId || context.userId,
        })
        .returning();

      // 4. Update admission record
      const [updatedAdmission] = await tx
        .update(inpatientAdmissions)
        .set({
          currentWardId: dto.toWardId,
          currentBedId: dto.toBedId,
          updatedAt: new Date(),
        })
        .where(eq(inpatientAdmissions.id, admissionId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.INPATIENT_TRANSFERRED,
        resource: 'inpatient_bed_transfers',
        resourceId: transfer!.id,
        details: {
          admissionId,
          fromBedId: admission.currentBedId,
          toBedId: dto.toBedId,
          reason: dto.reason,
        },
      });

      return updatedAdmission;
    });
  }

  // ==========================================
  // INPATIENT DISCHARGE
  // ==========================================

  async dischargePatient(admissionId: string, dto: DischargePatientDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [admission] = await tx
        .select()
        .from(inpatientAdmissions)
        .where(
          and(
            eq(inpatientAdmissions.tenantId, context.tenantId),
            eq(inpatientAdmissions.id, admissionId),
          ),
        )
        .limit(1);

      if (!admission) {
        throw new NotFoundException(`Admission with ID ${admissionId} not found.`);
      }

      if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
        throw new BadRequestException(
          `Cannot discharge patient in ${admission.status} state. Only active admissions can be discharged.`,
        );
      }

      // 1. Release bed to VACANT
      await tx
        .update(beds)
        .set({
          status: BedStatus.VACANT,
          currentAdmissionId: null,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, admission.currentBedId));

      const rawDisp = (dto.dischargeDisposition || dto.disposition || InpatientDischargeDisposition.HOME_IMPROVED) as string;
      const disposition = rawDisp === 'HOME_DISCHARGED' ? InpatientDischargeDisposition.HOME_IMPROVED : rawDisp;

      // 2. Finalize admission record
      const [discharged] = await tx
        .update(inpatientAdmissions)
        .set({
          status: InpatientAdmissionStatus.DISCHARGED,
          dischargeDate: new Date(),
          dischargeDisposition: disposition,
          dischargedByPractitionerId: dto.dischargedByPractitionerId || context.userId,
          finalDiagnosisIcd11: dto.finalDiagnosisIcd11 || admission.admissionDiagnosisIcd11,
          finalDiagnosisTitle: dto.finalDiagnosisTitle || dto.finalDiagnosis || admission.admissionDiagnosisTitle,
          dischargeSummaryNotes: dto.dischargeSummaryNotes || dto.dischargeSummary || dto.followUpInstructions || null,
          updatedAt: new Date(),
        })
        .where(eq(inpatientAdmissions.id, admissionId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.INPATIENT_DISCHARGED,
        resource: 'inpatient_admissions',
        resourceId: admissionId,
        details: {
          admissionNumber: admission.admissionNumber,
          disposition: dto.dischargeDisposition,
        },
      });

      return discharged;
    });
  }

  // ==========================================
  // CANCEL ADMISSION
  // ==========================================

  async cancelAdmission(admissionId: string, dto: CancelAdmissionDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [admission] = await tx
        .select()
        .from(inpatientAdmissions)
        .where(
          and(
            eq(inpatientAdmissions.tenantId, context.tenantId),
            eq(inpatientAdmissions.id, admissionId),
          ),
        )
        .limit(1);

      if (!admission) {
        throw new NotFoundException(`Admission with ID ${admissionId} not found.`);
      }

      if (admission.status !== InpatientAdmissionStatus.ADMITTED) {
        throw new BadRequestException(`Cannot cancel admission in ${admission.status} status.`);
      }

      // 1. Vacate bed immediately
      await tx
        .update(beds)
        .set({
          status: BedStatus.VACANT,
          currentAdmissionId: null,
          version: sql`${beds.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(beds.id, admission.currentBedId));

      // 2. Mark cancelled
      const [cancelled] = await tx
        .update(inpatientAdmissions)
        .set({
          status: InpatientAdmissionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: dto.cancellationReason,
          cancelledByUserId: context.userId,
          updatedAt: new Date(),
        })
        .where(eq(inpatientAdmissions.id, admissionId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.INPATIENT_CANCELLED,
        resource: 'inpatient_admissions',
        resourceId: admissionId,
        details: { reason: dto.cancellationReason },
      });

      return cancelled;
    });
  }

  // ==========================================
  // QUERY ADMISSIONS
  // ==========================================

  async listAdmissions(facilityId: string, context: TenantContext, status?: InpatientAdmissionStatus) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(inpatientAdmissions.tenantId, context.tenantId),
        eq(inpatientAdmissions.facilityId, facilityId),
      ];
      if (status) {
        conditions.push(eq(inpatientAdmissions.status, status));
      }
      return await tx
        .select()
        .from(inpatientAdmissions)
        .where(and(...conditions))
        .orderBy(desc(inpatientAdmissions.admissionDate));
    });
  }

  async getAdmissionById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [admission] = await tx
        .select()
        .from(inpatientAdmissions)
        .where(
          and(
            eq(inpatientAdmissions.tenantId, context.tenantId),
            eq(inpatientAdmissions.id, id),
          ),
        )
        .limit(1);

      if (!admission) {
        throw new NotFoundException(`Admission with ID ${id} not found.`);
      }

      return admission;
    });
  }
}
