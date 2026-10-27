import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { patientRecords, facilities } from '@afyapoa/database';
import { eq } from 'drizzle-orm';
import { TenantContext } from '@afyapoa/domain-core';

export interface CreateRecordDto {
  recordNumber: string;
  patientAlias: string;
  notes?: string;
}

export interface UpdateRecordDto {
  notes?: string;
  patientAlias?: string;
}

@Injectable()
export class RecordsService {
  constructor(@Inject(TenancyService) private tenancyService: TenancyService) {}

  /**
   * Retrieves all records for the calling tenant organization under RLS.
   */
  async findAll(ctx: TenantContext) {
    return await this.tenancyService.runInTenantContext(ctx.tenantId, async (db) => {
      return await db.select().from(patientRecords);
    });
  }

  /**
   * Retrieves a specific record by ID under RLS.
   * If the record belongs to another tenant, RLS returns nothing, resulting in a 404.
   */
  async findOne(ctx: TenantContext, id: string) {
    return await this.tenancyService.runInTenantContext(ctx.tenantId, async (db) => {
      const [record] = await db
        .select()
        .from(patientRecords)
        .where(eq(patientRecords.id, id));

      if (!record) {
        throw new NotFoundException(`Record with ID ${id} not found`);
      }
      return record;
    });
  }

  /**
   * Creates a new tenant-owned record.
   */
  async create(ctx: TenantContext, dto: CreateRecordDto) {
    return await this.tenancyService.runInTenantContext(ctx.tenantId, async (db) => {
      let facilityId = ctx.facilityId;
      if (!facilityId) {
        const [fac] = await db
          .select({ id: facilities.id })
          .from(facilities)
          .where(eq(facilities.tenantId, ctx.tenantId))
          .limit(1);
        facilityId = fac?.id;
      }

      if (!facilityId) {
        throw new ForbiddenException('No active facility associated with tenant');
      }

      const [newRecord] = await db
        .insert(patientRecords)
        .values({
          tenantId: ctx.tenantId,
          facilityId,
          recordNumber: dto.recordNumber,
          patientAlias: dto.patientAlias,
          notes: dto.notes || null,
        })
        .returning();

      return newRecord;
    });
  }

  /**
   * Updates a record under RLS.
   * If attempting to mutate another tenant's record, RLS renders the row invisible (0 rows updated).
   */
  async update(ctx: TenantContext, id: string, dto: UpdateRecordDto) {
    return await this.tenancyService.runInTenantContext(ctx.tenantId, async (db) => {
      const updated = await db
        .update(patientRecords)
        .set({
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.patientAlias !== undefined && { patientAlias: dto.patientAlias }),
          updatedAt: new Date(),
        })
        .where(eq(patientRecords.id, id))
        .returning();

      if (updated.length === 0) {
        throw new NotFoundException(`Record with ID ${id} not found`);
      }

      return updated[0];
    });
  }
}
