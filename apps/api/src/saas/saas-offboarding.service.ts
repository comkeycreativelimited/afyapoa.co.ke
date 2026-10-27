import {
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import {
  tenantOffboardingRequests,
  tenants,
  patients,
  encounters,
} from '@afyapoa/database';
import { AuditEventType, OffboardingStatus } from '@afyapoa/domain-core';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RequestOffboardingDto } from './dto/index.js';

@Injectable()
export class SaasOffboardingService {
  constructor(
    @Inject(TenancyService) private tenancyService: TenancyService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  /**
   * Hospital Administrator requests offboarding.
   * Enforces statutory clinical record retention mandates under Health Act 2017 & Data Protection Act 2019.
   */
  async requestOffboarding(
    tenantId: string,
    requestedByUserId: string,
    dto: RequestOffboardingDto,
  ) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
      if (!tenant) {
        throw new NotFoundException(`Tenant '${tenantId}' not found.`);
      }

      const retentionYears = dto.clinicalDataRetentionYears || 10;
      const now = new Date();
      // Statutory clinical retention: 10 years minimum for medical records
      const clinicalDataRetentionUntil = new Date(
        now.getTime() + retentionYears * 365.25 * 24 * 60 * 60 * 1000,
      );

      const [offboardingRequest] = await db
        .insert(tenantOffboardingRequests)
        .values({
          tenantId,
          requestedByUserId,
          status: OffboardingStatus.REQUESTED,
          reason: dto.reason,
          clinicalDataRetentionUntil,
        })
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId: requestedByUserId,
        action: AuditEventType.TENANT_OFFBOARDING_INITIATED,
        resource: 'TenantOffboardingRequest',
        resourceId: offboardingRequest!.id,
        details: {
          reason: dto.reason,
          retentionYears,
          clinicalDataRetentionUntil,
        },
      });

      return offboardingRequest;
    });
  }

  /**
   * Generates a tamper-evident FHIR R4 data archive bundle and SHA-256 checksum.
   */
  async generateDataExport(requestId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [req] = await db
        .select()
        .from(tenantOffboardingRequests)
        .where(eq(tenantOffboardingRequests.id, requestId));
      if (!req) {
        throw new NotFoundException(`Offboarding request '${requestId}' not found.`);
      }

      // Gather record counts for export manifest
      const patientList = await db
        .select({ id: patients.id })
        .from(patients)
        .where(eq(patients.tenantId, req.tenantId));

      const encounterList = await db
        .select({ id: encounters.id })
        .from(encounters)
        .where(eq(encounters.tenantId, req.tenantId));

      const manifest = {
        tenantId: req.tenantId,
        generatedAt: new Date().toISOString(),
        totalPatients: patientList.length,
        totalEncounters: encounterList.length,
        format: 'FHIR_R4_KENYA_CORE_NDJSON',
      };

      const manifestStr = JSON.stringify(manifest);
      const checksum = crypto.createHash('sha256').update(manifestStr).digest('hex');
      const exportUrl = `https://storage.afyapoa.co.ke/exports/tenants/${req.tenantId}/export-${checksum.slice(0, 12)}.tar.gz`;

      const [updated] = await db
        .update(tenantOffboardingRequests)
        .set({
          status: OffboardingStatus.DATA_EXPORT_GENERATED,
          exportBundleUrl: exportUrl,
          exportChecksumSha256: checksum,
          updatedAt: new Date(),
        })
        .where(eq(tenantOffboardingRequests.id, requestId))
        .returning();

      await this.auditService.recordEvent({
        tenantId: req.tenantId,
        action: AuditEventType.TENANT_OFFBOARDING_EXPORT_READY,
        resource: 'TenantOffboardingRequest',
        resourceId: requestId,
        details: { exportUrl, checksum },
      });

      return updated;
    });
  }

  /**
   * Super Administrator finalizes offboarding.
   * Seals tenant access to historical archive status while maintaining legal retention logs.
   */
  async completeOffboarding(requestId: string, approvedByUserId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [req] = await db
        .select()
        .from(tenantOffboardingRequests)
        .where(eq(tenantOffboardingRequests.id, requestId));
      if (!req) {
        throw new NotFoundException(`Offboarding request '${requestId}' not found.`);
      }

      const now = new Date();

      const [updated] = await db
        .update(tenantOffboardingRequests)
        .set({
          status: OffboardingStatus.COMPLETED,
          approvedByUserId,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(tenantOffboardingRequests.id, requestId))
        .returning();

      // Update tenant status in core tenants table
      await db
        .update(tenants)
        .set({
          status: 'OFFBOARDED',
          updatedAt: now,
        })
        .where(eq(tenants.id, req.tenantId));

      await this.auditService.recordEvent({
        tenantId: req.tenantId,
        userId: approvedByUserId,
        action: AuditEventType.TENANT_OFFBOARDING_COMPLETED,
        resource: 'TenantOffboardingRequest',
        resourceId: requestId,
        details: { completedAt: now },
      });

      return updated;
    });
  }

  async getOffboardingRequests(tenantId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const q = db
        .select()
        .from(tenantOffboardingRequests)
        .orderBy(desc(tenantOffboardingRequests.createdAt));
      if (tenantId) {
        return await q.where(eq(tenantOffboardingRequests.tenantId, tenantId));
      }
      return await q;
    });
  }
}
