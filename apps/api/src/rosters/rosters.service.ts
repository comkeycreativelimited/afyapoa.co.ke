import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  departments,
  staffRosters,
  staffRosterShifts,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  RosterStatus,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateDepartmentDto,
  CreateStaffRosterDto,
  AssignShiftDto,
} from './dto/rosters.dto.js';

@Injectable()
export class RostersService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  async createDepartment(dto: CreateDepartmentDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(departments)
        .where(
          and(
            eq(departments.tenantId, context.tenantId),
            eq(departments.facilityId, dto.facilityId),
            eq(departments.code, dto.code),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException(`Department code ${dto.code} already exists.`);
      }

      const [dept] = await tx
        .insert(departments)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          code: dto.code,
          name: dto.name,
          headOfDepartmentId: dto.headOfDepartmentId || null,
        })
        .returning();

      return dept;
    });
  }

  async listDepartments(facilityId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(departments)
        .where(
          and(
            eq(departments.tenantId, context.tenantId),
            eq(departments.facilityId, facilityId),
          ),
        )
        .orderBy(departments.name);
    });
  }

  // ==========================================
  // STAFF ROSTERS
  // ==========================================

  async createRoster(dto: CreateStaffRosterDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(staffRosters)
        .where(
          and(
            eq(staffRosters.tenantId, context.tenantId),
            eq(staffRosters.departmentId, dto.departmentId),
            eq(staffRosters.rosterMonth, dto.rosterMonth),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException(
          `Roster for department in month ${dto.rosterMonth} already exists.`,
        );
      }

      const [roster] = await tx
        .insert(staffRosters)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          departmentId: dto.departmentId,
          rosterMonth: dto.rosterMonth,
          status: RosterStatus.DRAFT,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.STAFF_ROSTER_CREATED,
        resource: 'staff_rosters',
        resourceId: roster!.id,
        details: { month: roster!.rosterMonth, departmentId: roster!.departmentId },
      });

      return roster!;
    });
  }

  async publishRoster(rosterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [roster] = await tx
        .select()
        .from(staffRosters)
        .where(
          and(
            eq(staffRosters.tenantId, context.tenantId),
            eq(staffRosters.id, rosterId),
          ),
        )
        .limit(1);

      if (!roster) {
        throw new NotFoundException(`Staff roster ${rosterId} not found.`);
      }

      const [published] = await tx
        .update(staffRosters)
        .set({
          status: RosterStatus.PUBLISHED,
          publishedByUserId: context.userId,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(staffRosters.id, rosterId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.STAFF_ROSTER_PUBLISHED,
        resource: 'staff_rosters',
        resourceId: rosterId,
        details: { month: roster.rosterMonth },
      });

      return published;
    });
  }

  async assignShift(rosterId: string, dto: AssignShiftDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [roster] = await tx
        .select()
        .from(staffRosters)
        .where(
          and(
            eq(staffRosters.tenantId, context.tenantId),
            eq(staffRosters.id, rosterId),
          ),
        )
        .limit(1);

      if (!roster) {
        throw new NotFoundException(`Roster with ID ${rosterId} not found.`);
      }

      // Check if shift already assigned for this user on this date in this roster
      const [existing] = await tx
        .select()
        .from(staffRosterShifts)
        .where(
          and(
            eq(staffRosterShifts.tenantId, context.tenantId),
            eq(staffRosterShifts.rosterId, rosterId),
            eq(staffRosterShifts.userId, dto.userId),
            eq(staffRosterShifts.shiftDate, dto.shiftDate),
          ),
        )
        .limit(1);

      let shift;
      if (existing) {
        [shift] = await tx
          .update(staffRosterShifts)
          .set({
            shiftType: dto.shiftType,
            assignedWardId: dto.assignedWardId || null,
            handoverNotes: dto.handoverNotes || null,
            updatedAt: new Date(),
          })
          .where(eq(staffRosterShifts.id, existing.id))
          .returning();
      } else {
        [shift] = await tx
          .insert(staffRosterShifts)
          .values({
            tenantId: context.tenantId,
            rosterId,
            userId: dto.userId,
            shiftDate: dto.shiftDate,
            shiftType: dto.shiftType,
            assignedWardId: dto.assignedWardId || null,
            handoverNotes: dto.handoverNotes || null,
          })
          .returning();
      }

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.SHIFT_ASSIGNED,
        resource: 'staff_roster_shifts',
        resourceId: shift!.id,
        details: {
          rosterId,
          userId: dto.userId,
          date: dto.shiftDate,
          shiftType: dto.shiftType,
        },
      });

      return shift!;
    });
  }

  async listRosters(facilityId: string, context: TenantContext, departmentId?: string) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(staffRosters.tenantId, context.tenantId),
        eq(staffRosters.facilityId, facilityId),
      ];
      if (departmentId) {
        conditions.push(eq(staffRosters.departmentId, departmentId));
      }

      return await tx
        .select()
        .from(staffRosters)
        .where(and(...conditions))
        .orderBy(desc(staffRosters.rosterMonth));
    });
  }

  async getRosterById(rosterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [roster] = await tx
        .select()
        .from(staffRosters)
        .where(
          and(
            eq(staffRosters.tenantId, context.tenantId),
            eq(staffRosters.id, rosterId),
          ),
        )
        .limit(1);

      if (!roster) {
        throw new NotFoundException(`Roster with ID ${rosterId} not found.`);
      }

      const shifts = await tx
        .select()
        .from(staffRosterShifts)
        .where(
          and(
            eq(staffRosterShifts.tenantId, context.tenantId),
            eq(staffRosterShifts.rosterId, rosterId),
          ),
        )
        .orderBy(staffRosterShifts.shiftDate);

      return {
        ...roster,
        shifts,
      };
    });
  }
}
