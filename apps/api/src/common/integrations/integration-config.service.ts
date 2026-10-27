import { Injectable, Inject } from '@nestjs/common';
import {
  IntegrationSystemType,
  IntegrationEnvironment,
  IntegrationAuthType,
  InternalEntityType,
  ExternalSystem,
  ExternalReferenceStatus,
  AuditEventType,
} from '@afyapoa/domain-core';
import { TenancyService } from '../../tenancy/tenancy.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { integrationConfigs, externalReferences } from '@afyapoa/database';
import { eq, and } from 'drizzle-orm';

export interface UpsertIntegrationConfigParams {
  tenantId: string;
  facilityId?: string;
  systemType: IntegrationSystemType;
  environment?: IntegrationEnvironment;
  endpointUrl: string;
  authType?: IntegrationAuthType;
  credentialsEncrypted?: string;
  rateLimitPerMinute?: number;
  timeoutMs?: number;
  settings?: Record<string, unknown>;
  userId?: string;
}

export interface LinkExternalReferenceParams {
  tenantId: string;
  facilityId?: string;
  internalEntityType: InternalEntityType;
  internalEntityId: string;
  externalSystem: ExternalSystem;
  externalId: string;
  status?: ExternalReferenceStatus;
  responseMetadata?: Record<string, unknown>;
  userId?: string;
}

@Injectable()
export class IntegrationConfigService {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Upserts external integration configuration for a hospital tenant.
   */
  async upsertConfig(params: UpsertIntegrationConfigParams) {
    const {
      tenantId,
      facilityId,
      systemType,
      environment = IntegrationEnvironment.MOCK,
      endpointUrl,
      authType = IntegrationAuthType.OAUTH2,
      credentialsEncrypted,
      rateLimitPerMinute = 60,
      timeoutMs = 15000,
      settings,
      userId,
    } = params;

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const existing = await db
        .select()
        .from(integrationConfigs)
        .where(
          and(
            eq(integrationConfigs.tenantId, tenantId),
            eq(integrationConfigs.systemType, systemType),
          ),
        );

      let configRecord;
      if (existing.length > 0 && existing[0]) {
        const [updated] = await db
          .update(integrationConfigs)
          .set({
            facilityId,
            environment,
            endpointUrl,
            authType,
            credentialsEncrypted,
            rateLimitPerMinute,
            timeoutMs,
            settings: settings ? JSON.stringify(settings) : null,
            updatedAt: new Date(),
          })
          .where(eq(integrationConfigs.id, existing[0].id))
          .returning();
        configRecord = updated;
      } else {
        const [inserted] = await db
          .insert(integrationConfigs)
          .values({
            tenantId,
            facilityId,
            systemType,
            environment,
            endpointUrl,
            authType,
            credentialsEncrypted,
            rateLimitPerMinute,
            timeoutMs,
            settings: settings ? JSON.stringify(settings) : null,
          })
          .returning();
        configRecord = inserted;
      }

      if (!configRecord) {
        throw new Error('Failed to upsert integration configuration');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.INTEGRATION_CONFIG_UPDATED,
        resource: 'IntegrationConfig',
        resourceId: configRecord.id,
        details: JSON.stringify({ systemType, environment, endpointUrl }),
      });

      return configRecord;
    });
  }

  /**
   * Retrieves active integration config for a specific system type.
   */
  async getConfig(tenantId: string, systemType: IntegrationSystemType) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [config] = await db
        .select()
        .from(integrationConfigs)
        .where(
          and(
            eq(integrationConfigs.tenantId, tenantId),
            eq(integrationConfigs.systemType, systemType),
          ),
        );
      return config || null;
    });
  }

  /**
   * Tracks and links an external identifier (e.g. DHA CRID or SHA Claim Number) to an internal entity.
   */
  async linkExternalReference(params: LinkExternalReferenceParams) {
    const {
      tenantId,
      facilityId,
      internalEntityType,
      internalEntityId,
      externalSystem,
      externalId,
      status = ExternalReferenceStatus.SYNCED,
      responseMetadata,
      userId,
    } = params;

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const existing = await db
        .select()
        .from(externalReferences)
        .where(
          and(
            eq(externalReferences.tenantId, tenantId),
            eq(externalReferences.internalEntityType, internalEntityType),
            eq(externalReferences.internalEntityId, internalEntityId),
            eq(externalReferences.externalSystem, externalSystem),
          ),
        );

      let refRecord;
      if (existing.length > 0 && existing[0]) {
        const [updated] = await db
          .update(externalReferences)
          .set({
            externalId,
            status,
            syncAttempts: existing[0].syncAttempts + 1,
            lastSyncedAt: new Date(),
            responseMetadata: responseMetadata ? JSON.stringify(responseMetadata) : null,
            updatedAt: new Date(),
          })
          .where(eq(externalReferences.id, existing[0].id))
          .returning();
        refRecord = updated;
      } else {
        const [inserted] = await db
          .insert(externalReferences)
          .values({
            tenantId,
            facilityId,
            internalEntityType,
            internalEntityId,
            externalSystem,
            externalId,
            status,
            syncAttempts: 1,
            lastSyncedAt: new Date(),
            responseMetadata: responseMetadata ? JSON.stringify(responseMetadata) : null,
          })
          .returning();
        refRecord = inserted;
      }

      if (!refRecord) {
        throw new Error('Failed to link external reference');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.EXTERNAL_REFERENCE_SYNCED,
        resource: 'ExternalReference',
        resourceId: refRecord.id,
        details: JSON.stringify({
          internalEntityType,
          internalEntityId,
          externalSystem,
          externalId,
          status,
        }),
      });

      return refRecord;
    });
  }

  /**
   * Finds an external reference by internal entity or by external ID.
   */
  async findReferenceByExternalId(
    tenantId: string,
    externalSystem: ExternalSystem,
    externalId: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [ref] = await db
        .select()
        .from(externalReferences)
        .where(
          and(
            eq(externalReferences.tenantId, tenantId),
            eq(externalReferences.externalSystem, externalSystem),
            eq(externalReferences.externalId, externalId),
          ),
        );
      return ref || null;
    });
  }
}
