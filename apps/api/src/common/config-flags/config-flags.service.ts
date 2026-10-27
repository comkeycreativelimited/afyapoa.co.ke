import { Injectable, Inject } from '@nestjs/common';
import { ConfigValueType, AuditEventType } from '@afyapoa/domain-core';
import { TenancyService } from '../../tenancy/tenancy.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { appConfigurations, Database } from '@afyapoa/database';
import { eq, and, isNull } from 'drizzle-orm';

export interface SetConfigFlagParams {
  tenantId?: string;
  facilityId?: string;
  configKey: string;
  configValue: string;
  valueType?: ConfigValueType;
  isEnabled?: boolean;
  description?: string;
  userId?: string;
}

@Injectable()
export class ConfigFlagsService {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Sets or updates an application configuration or feature flag.
   */
  async setConfig(params: SetConfigFlagParams) {
    const {
      tenantId,
      facilityId,
      configKey,
      configValue,
      valueType = ConfigValueType.STRING,
      isEnabled = true,
      description,
      userId,
    } = params;

    const runner = tenantId
      ? (fn: (db: Database) => Promise<any>) => this.tenancyService.runInTenantContext(tenantId, fn)
      : (fn: (db: Database) => Promise<any>) => this.tenancyService.runInSuperAdminContext(fn);

    return await runner(async (db: Database) => {
      const conditions = [eq(appConfigurations.configKey, configKey)];
      if (tenantId) {
        conditions.push(eq(appConfigurations.tenantId, tenantId));
      } else {
        conditions.push(isNull(appConfigurations.tenantId));
      }
      if (facilityId) {
        conditions.push(eq(appConfigurations.facilityId, facilityId));
      } else {
        conditions.push(isNull(appConfigurations.facilityId));
      }

      const existing = await db
        .select()
        .from(appConfigurations)
        .where(and(...conditions));

      let configRecord;
      if (existing.length > 0 && existing[0]) {
        const [updated] = await db
          .update(appConfigurations)
          .set({
            configValue,
            valueType,
            isEnabled,
            description,
            updatedAt: new Date(),
          })
          .where(eq(appConfigurations.id, existing[0].id))
          .returning();
        configRecord = updated;
      } else {
        const [inserted] = await db
          .insert(appConfigurations)
          .values({
            tenantId,
            facilityId,
            configKey,
            configValue,
            valueType,
            isEnabled,
            description,
          })
          .returning();
        configRecord = inserted;
      }

      if (tenantId && configRecord) {
        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.FEATURE_FLAG_UPDATED,
          resource: 'AppConfiguration',
          resourceId: configRecord.id,
          details: JSON.stringify({ configKey, isEnabled, configValue }),
        });
      }

      return configRecord;
    });
  }

  /**
   * Evaluates a feature flag or config value with hierarchical fallback:
   * 1. Facility-specific value
   * 2. Tenant-wide value
   * 3. Global platform default
   */
  async getConfig(
    configKey: string,
    tenantId?: string,
    facilityId?: string,
  ): Promise<{ value: string; isEnabled: boolean } | null> {
    const runner = tenantId
      ? (fn: (db: Database) => Promise<{ value: string; isEnabled: boolean } | null>) =>
          this.tenancyService.runInTenantContext(tenantId, fn)
      : (fn: (db: Database) => Promise<{ value: string; isEnabled: boolean } | null>) =>
          this.tenancyService.runInSuperAdminContext(fn);

    return await runner(async (db: Database): Promise<{ value: string; isEnabled: boolean } | null> => {
      // 1. Check facility level
      if (tenantId && facilityId) {
        const [facConfig] = await db
          .select()
          .from(appConfigurations)
          .where(
            and(
              eq(appConfigurations.tenantId, tenantId),
              eq(appConfigurations.facilityId, facilityId),
              eq(appConfigurations.configKey, configKey),
            ),
          );
        if (facConfig) {
          return { value: facConfig.configValue, isEnabled: facConfig.isEnabled };
        }
      }

      // 2. Check tenant level
      if (tenantId) {
        const [tenantConfig] = await db
          .select()
          .from(appConfigurations)
          .where(
            and(
              eq(appConfigurations.tenantId, tenantId),
              isNull(appConfigurations.facilityId),
              eq(appConfigurations.configKey, configKey),
            ),
          );
        if (tenantConfig) {
          return { value: tenantConfig.configValue, isEnabled: tenantConfig.isEnabled };
        }
      }

      // 3. Fallback to global platform default
      const [globalConfig] = await db
        .select()
        .from(appConfigurations)
        .where(
          and(
            isNull(appConfigurations.tenantId),
            isNull(appConfigurations.facilityId),
            eq(appConfigurations.configKey, configKey),
          ),
        );

      if (globalConfig) {
        return { value: globalConfig.configValue, isEnabled: globalConfig.isEnabled };
      }

      return null;
    });
  }
}
