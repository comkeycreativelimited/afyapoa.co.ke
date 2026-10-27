import { Injectable } from '@nestjs/common';
import {
  withTenantContext,
  withSuperAdminContext,
  Database,
} from '@afyapoa/database';
import {
  TenantContext,
  getTenantCacheKey,
  getTenantStoragePath,
  TenantJobPayload,
} from '@afyapoa/domain-core';

@Injectable()
export class TenancyService {
  /**
   * Executes a database query inside a transaction strictly bound to the authenticated tenant RLS context.
   */
  async runInTenantContext<T>(
    tenantId: string,
    action: (db: Database) => Promise<T>,
  ): Promise<T> {
    return await withTenantContext(tenantId, action);
  }

  /**
   * Platform Super Administrator cross-tenant execution context.
   */
  async runInSuperAdminContext<T>(
    action: (db: Database) => Promise<T>,
  ): Promise<T> {
    return await withSuperAdminContext(action);
  }

  /**
   * Resolves a strictly tenant-isolated Redis cache key.
   */
  getCacheKey(tenantId: string, key: string): string {
    return getTenantCacheKey(tenantId, key);
  }

  /**
   * Resolves a strictly tenant-isolated object storage path.
   */
  getStoragePath(tenantId: string, filename: string): string {
    return getTenantStoragePath(tenantId, filename);
  }

  /**
   * Prepares a background job payload carrying verified tenant context.
   */
  createJobPayload<T>(ctx: TenantContext, jobType: string, data: T): TenantJobPayload<T> {
    return {
      tenantId: ctx.tenantId,
      facilityCode: ctx.facilityCode,
      userId: ctx.userId,
      isSuperAdmin: ctx.isSuperAdmin,
      jobType,
      data,
      enqueuedAt: new Date().toISOString(),
    };
  }
}
