import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/auth.decorators.js';
import { UserRole, AuditEventType } from '@afyapoa/domain-core';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { tenants, auditEvents } from '@afyapoa/database';
import { desc, eq } from 'drizzle-orm';

export class CreateTenantDto {
  @ApiProperty({ example: 'tenant-mombasa-general', description: 'Unique tenant organizational code' })
  code!: string;

  @ApiProperty({ example: 'Mombasa General Hospital Group', description: 'Hospital organization name' })
  name!: string;

  @ApiProperty({ example: 'ENTERPRISE', description: 'Licensing tier: PILOT, BASIC, STANDARD, ENTERPRISE' })
  tier?: string;
}

@ApiTags('Platform Administration (Super Admin Only)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('platform')
export class PlatformController {
  constructor(
    @Inject(TenancyService) private tenancyService: TenancyService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  @Get('tenants')
  @ApiOperation({ summary: 'List all hospital tenant organizations (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'All tenants retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden. Non-super-admin access blocked' })
  async listAllTenants() {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      return await db.select().from(tenants);
    });
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Provision new tenant organization (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant provisioned' })
  async createTenant(@Body() dto: CreateTenantDto) {
    const [tenant] = await this.tenancyService.runInSuperAdminContext(async (db) => {
      return await db
        .insert(tenants)
        .values({
          code: dto.code,
          name: dto.name,
          tier: dto.tier || 'COMMERCIAL',
          status: 'ACTIVE',
        })
        .returning();
    });

    await this.auditService.recordEvent({
      tenantId: tenant!.id,
      action: AuditEventType.TENANT_PROVISIONED,
      resource: 'Tenant',
      resourceId: tenant!.id,
      details: { code: dto.code, name: dto.name },
    });

    return tenant;
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Platform-wide audit inspection with cryptographic verification' })
  @ApiResponse({ status: 200, description: 'Audit trail retrieved' })
  async getAuditLogs(@Query('tenantId') filterTenantId?: string) {
    const events = await this.tenancyService.runInSuperAdminContext(async (db) => {
      const q = db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100);
      if (filterTenantId) {
        return await q.where(eq(auditEvents.tenantId, filterTenantId));
      }
      return await q;
    });

    let chainStatus = null;
    if (filterTenantId) {
      chainStatus = await this.auditService.verifyChainIntegrity(filterTenantId);
    }

    return {
      count: events.length,
      chainIntegrity: chainStatus,
      events,
    };
  }
}
