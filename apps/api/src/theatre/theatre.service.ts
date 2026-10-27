import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, ne, desc, lt, gt } from 'drizzle-orm';
import {
  theatres,
  theatreBookings,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  TheatreBookingStatus,
  TheatreUrgency,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateTheatreDto,
  CreateTheatreBookingDto,
  UpdateTheatreBookingStatusDto,
  SignWhoChecklistDto,
  CancelTheatreBookingDto,
} from './dto/theatre.dto.js';

@Injectable()
export class TheatreService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateBookingNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `THB-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // THEATRE FACILITY MANAGEMENT
  // ==========================================

  async createTheatre(dto: CreateTheatreDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [theatre] = await tx
        .insert(theatres)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          name: dto.name,
          theatreType: dto.theatreType,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.THEATRE_CONFIGURED,
        resource: 'theatres',
        resourceId: theatre!.id,
        details: { name: theatre!.name },
      });

      return theatre!;
    });
  }

  async listTheatres(facilityId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(theatres)
        .where(and(eq(theatres.tenantId, context.tenantId), eq(theatres.facilityId, facilityId)))
        .orderBy(theatres.name);
    });
  }

  async getTheatreById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [theatre] = await tx
        .select()
        .from(theatres)
        .where(and(eq(theatres.tenantId, context.tenantId), eq(theatres.id, id)))
        .limit(1);

      if (!theatre) {
        throw new NotFoundException(`Theatre with ID ${id} not found.`);
      }

      return theatre;
    });
  }

  // ==========================================
  // THEATRE BOOKINGS & CONCURRENCY CONTROLS
  // ==========================================

  async createBooking(dto: CreateTheatreBookingDto, context: TenantContext) {
    const startTime = new Date(dto.scheduledStartTime);
    const endTime = new Date(dto.scheduledEndTime);

    if (startTime >= endTime) {
      throw new BadRequestException('Scheduled start time must precede scheduled end time.');
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify theatre exists and is active
      const [theatre] = await tx
        .select()
        .from(theatres)
        .where(and(eq(theatres.tenantId, context.tenantId), eq(theatres.id, dto.theatreId)))
        .limit(1);

      if (!theatre) {
        throw new NotFoundException(`Theatre with ID ${dto.theatreId} not found.`);
      }

      if (!theatre.active) {
        throw new BadRequestException(`Theatre ${theatre.name} is currently inactive.`);
      }

      // 2. Verify patient exists
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      // 3. Prevent Double-Booking: Detect overlapping schedules in this theatre
      const overlappingBookings = await tx
        .select()
        .from(theatreBookings)
        .where(
          and(
            eq(theatreBookings.tenantId, context.tenantId),
            eq(theatreBookings.theatreId, dto.theatreId),
            ne(theatreBookings.status, TheatreBookingStatus.CANCELLED),
            lt(theatreBookings.scheduledStartTime, endTime),
            gt(theatreBookings.scheduledEndTime, startTime),
          ),
        );

      if (overlappingBookings.length > 0) {
        const conflict = overlappingBookings[0]!;
        throw new ConflictException(
          `Theatre conflict double-booking collision: Slot conflicts with existing booking ${conflict.bookingNumber} (${conflict.scheduledStartTime.toISOString()} - ${conflict.scheduledEndTime.toISOString()}).`,
        );
      }

      const bookingNumber = this.generateBookingNumber();

      const [newBooking] = await tx
        .insert(theatreBookings)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          bookingNumber,
          theatreId: dto.theatreId,
          patientId: dto.patientId,
          admissionId: dto.admissionId || null,
          leadSurgeonId: dto.leadSurgeonId,
          anesthetistId: dto.anesthetistId || null,
          procedureCode: dto.procedureCode || 'PROC-GEN-01',
          procedureName: dto.procedureName,
          urgency: dto.urgency || TheatreUrgency.ELECTIVE,
          status: TheatreBookingStatus.SCHEDULED,
          scheduledStartTime: startTime,
          scheduledEndTime: endTime,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.THEATRE_BOOKING_CREATED,
        resource: 'theatre_bookings',
        resourceId: newBooking!.id,
        details: {
          bookingNumber: newBooking!.bookingNumber,
          theatreId: dto.theatreId,
          patientId: dto.patientId,
          procedureName: dto.procedureName,
        },
      });

      return newBooking!;
    });
  }

  async updateBookingStatus(
    bookingId: string,
    dto: UpdateTheatreBookingStatusDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [booking] = await tx
        .select()
        .from(theatreBookings)
        .where(
          and(
            eq(theatreBookings.tenantId, context.tenantId),
            eq(theatreBookings.id, bookingId),
          ),
        )
        .limit(1);

      if (!booking) {
        throw new NotFoundException(`Theatre booking with ID ${bookingId} not found.`);
      }

      if (booking.status === TheatreBookingStatus.CANCELLED) {
        throw new BadRequestException('Cannot modify status of a cancelled theatre booking.');
      }

      const updateData: Record<string, any> = {
        status: dto.status,
        updatedAt: new Date(),
      };

      if (dto.actualStartTime) {
        updateData.actualStartTime = new Date(dto.actualStartTime);
      }
      if (dto.actualEndTime) {
        updateData.actualEndTime = new Date(dto.actualEndTime);
      }
      if (dto.anesthesiaNotes) {
        updateData.anesthesiaNotes = dto.anesthesiaNotes;
      }
      if (dto.operativeNotes) {
        updateData.operativeNotes = dto.operativeNotes;
      }

      const [updated] = await tx
        .update(theatreBookings)
        .set(updateData)
        .where(eq(theatreBookings.id, bookingId))
        .returning();

      return updated;
    });
  }

  // ==========================================
  // WHO SURGICAL SAFETY CHECKLIST SIGN-OFF
  // ==========================================

  async signWhoChecklist(bookingId: string, dto: SignWhoChecklistDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [booking] = await tx
        .select()
        .from(theatreBookings)
        .where(
          and(
            eq(theatreBookings.tenantId, context.tenantId),
            eq(theatreBookings.id, bookingId),
          ),
        )
        .limit(1);

      if (!booking) {
        throw new NotFoundException(`Theatre booking with ID ${bookingId} not found.`);
      }

      const existingData = (booking.whoChecklistData as Record<string, any>) || {};
      const responses = dto.checklistData || { ...(dto as any) };
      delete (responses as any).phase;

      const phaseKey =
        dto.phase === 'SIGN_IN' ? 'signIn' : dto.phase === 'TIME_OUT' ? 'timeOut' : 'signOut';

      const updatedChecklistJson = {
        ...existingData,
        [phaseKey]: responses,
        [dto.phase]: {
          completedAt: new Date().toISOString(),
          signedByUserId: context.userId,
          responses,
        },
      };

      const [updated] = await tx
        .update(theatreBookings)
        .set({
          whoChecklistData: updatedChecklistJson,
          updatedAt: new Date(),
        })
        .where(eq(theatreBookings.id, bookingId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.WHO_SURGICAL_CHECKLIST_SIGNED,
        resource: 'theatre_bookings',
        resourceId: bookingId,
        details: { phase: dto.phase },
      });

      return {
        ...updated,
        whoChecklistCompleted: true,
        whoChecklistJson: updatedChecklistJson,
      };
    });
  }

  // ==========================================
  // CANCEL BOOKING
  // ==========================================

  async cancelBooking(bookingId: string, dto: CancelTheatreBookingDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [booking] = await tx
        .select()
        .from(theatreBookings)
        .where(
          and(
            eq(theatreBookings.tenantId, context.tenantId),
            eq(theatreBookings.id, bookingId),
          ),
        )
        .limit(1);

      if (!booking) {
        throw new NotFoundException(`Theatre booking with ID ${bookingId} not found.`);
      }

      if (booking.status === TheatreBookingStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel an already completed procedure.');
      }

      const [cancelled] = await tx
        .update(theatreBookings)
        .set({
          status: TheatreBookingStatus.CANCELLED,
          cancellationReason: dto.cancellationReason,
          cancelledByUserId: context.userId,
          updatedAt: new Date(),
        })
        .where(eq(theatreBookings.id, bookingId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.THEATRE_BOOKING_CANCELLED,
        resource: 'theatre_bookings',
        resourceId: bookingId,
        details: { reason: dto.cancellationReason },
      });

      return cancelled;
    });
  }

  async listBookings(
    facilityId: string,
    context: TenantContext,
    theatreId?: string,
    status?: TheatreBookingStatus,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(theatreBookings.tenantId, context.tenantId),
        eq(theatreBookings.facilityId, facilityId),
      ];
      if (theatreId) {
        conditions.push(eq(theatreBookings.theatreId, theatreId));
      }
      if (status) {
        conditions.push(eq(theatreBookings.status, status));
      }

      return await tx
        .select()
        .from(theatreBookings)
        .where(and(...conditions))
        .orderBy(desc(theatreBookings.scheduledStartTime));
    });
  }

  async getBookingById(bookingId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [booking] = await tx
        .select()
        .from(theatreBookings)
        .where(
          and(
            eq(theatreBookings.tenantId, context.tenantId),
            eq(theatreBookings.id, bookingId),
          ),
        )
        .limit(1);

      if (!booking) {
        throw new NotFoundException(`Theatre booking with ID ${bookingId} not found.`);
      }

      return booking;
    });
  }
}
