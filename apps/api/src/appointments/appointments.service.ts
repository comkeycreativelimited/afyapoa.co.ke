import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, desc, notInArray, lt, gt } from 'drizzle-orm';
import {
  appointments,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  AppointmentStatus,
  AppointmentServiceType,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
  CancelAppointmentDto,
} from './dto/appointment.dto.js';

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateAppointmentNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `APT-${yearMonth}-${randomSuffix}`;
  }

  async createAppointment(dto: CreateAppointmentDto, context: TenantContext) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (start >= end) {
      throw new BadRequestException('Appointment start time must precede end time.');
    }

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

      // 2. Prevent Double-Booking: Detect overlapping appointments for the practitioner
      const overlappingAppointments = await tx
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.tenantId, context.tenantId),
            eq(appointments.practitionerId, dto.practitionerId),
            notInArray(appointments.status, [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            lt(appointments.startTime, end),
            gt(appointments.endTime, start),
          ),
        );

      if (overlappingAppointments.length > 0) {
        const conflict = overlappingAppointments[0]!;
        throw new ConflictException(
          `Appointment conflict: Practitioner is already scheduled for appointment ${conflict.appointmentNumber} between ${conflict.startTime.toISOString()} and ${conflict.endTime.toISOString()}.`,
        );
      }

      const appointmentNumber = this.generateAppointmentNumber();

      const [newAppointment] = await tx
        .insert(appointments)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          appointmentNumber,
          patientId: dto.patientId,
          practitionerId: dto.practitionerId,
          department: dto.department || null,
          serviceType: dto.serviceType || AppointmentServiceType.GENERAL_CONSULTATION,
          startTime: start,
          endTime: end,
          durationMinutes: dto.durationMinutes || 30,
          status: AppointmentStatus.SCHEDULED,
          reason: dto.reason,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.APPOINTMENT_SCHEDULED,
        resource: 'appointments',
        resourceId: newAppointment!.id,
        details: {
          appointmentNumber: newAppointment!.appointmentNumber,
          patientId: dto.patientId,
          practitionerId: dto.practitionerId,
          startTime: dto.startTime,
        },
      });

      return newAppointment!;
    });
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.tenantId, context.tenantId), eq(appointments.id, id)))
        .limit(1);

      if (!appointment) {
        throw new NotFoundException(`Appointment with ID ${id} not found.`);
      }

      if (appointment.status === AppointmentStatus.CANCELLED) {
        throw new BadRequestException('Cannot modify status of a cancelled appointment.');
      }

      const updateData: Record<string, any> = {
        status: dto.status,
        updatedAt: new Date(),
      };

      if (dto.status === AppointmentStatus.CHECKED_IN && !appointment.checkInTime) {
        updateData.checkInTime = new Date();
      }

      const [updated] = await tx
        .update(appointments)
        .set(updateData)
        .where(eq(appointments.id, id))
        .returning();

      return updated;
    });
  }

  async cancelAppointment(id: string, dto: CancelAppointmentDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.tenantId, context.tenantId), eq(appointments.id, id)))
        .limit(1);

      if (!appointment) {
        throw new NotFoundException(`Appointment with ID ${id} not found.`);
      }

      if (appointment.status === AppointmentStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel an already completed appointment.');
      }

      const [cancelled] = await tx
        .update(appointments)
        .set({
          status: AppointmentStatus.CANCELLED,
          cancellationReason: dto.cancellationReason,
          cancelledByUserId: context.userId,
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, id))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.APPOINTMENT_CANCELLED,
        resource: 'appointments',
        resourceId: id,
        details: { reason: dto.cancellationReason },
      });

      return cancelled;
    });
  }

  async listAppointments(
    facilityId: string,
    context: TenantContext,
    practitionerId?: string,
    patientId?: string,
    status?: AppointmentStatus,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(appointments.tenantId, context.tenantId),
        eq(appointments.facilityId, facilityId),
      ];
      if (practitionerId) {
        conditions.push(eq(appointments.practitionerId, practitionerId));
      }
      if (patientId) {
        conditions.push(eq(appointments.patientId, patientId));
      }
      if (status) {
        conditions.push(eq(appointments.status, status));
      }

      return await tx
        .select()
        .from(appointments)
        .where(and(...conditions))
        .orderBy(desc(appointments.startTime));
    });
  }

  async getAppointmentById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [appointment] = await tx
        .select()
        .from(appointments)
        .where(and(eq(appointments.tenantId, context.tenantId), eq(appointments.id, id)))
        .limit(1);

      if (!appointment) {
        throw new NotFoundException(`Appointment with ID ${id} not found.`);
      }

      return appointment;
    });
  }
}
