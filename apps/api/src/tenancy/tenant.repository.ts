import { Injectable } from '@nestjs/common';
import { TenancyService } from './tenancy.service.js';
import { Database } from '@afyapoa/database';

@Injectable()
export abstract class TenantRepository {
  constructor(protected readonly tenancyService: TenancyService) {}

  /**
   * Executes database operations safely wrapped inside PostgreSQL tenant RLS context.
   */
  protected async withTenant<T>(
    tenantId: string,
    operation: (db: Database) => Promise<T>,
  ): Promise<T> {
    return await this.tenancyService.runInTenantContext(tenantId, operation);
  }

  /**
   * Executes platform super-admin operations bypassing tenant RLS.
   */
  protected async withSuperAdmin<T>(
    operation: (db: Database) => Promise<T>,
  ): Promise<T> {
    return await this.tenancyService.runInSuperAdminContext(operation);
  }
}
