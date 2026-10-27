import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RecordsService, CreateRecordDto, UpdateRecordDto } from './records.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions, CurrentTenantContext } from '../auth/decorators/auth.decorators.js';
import { Permission, TenantContext } from '@afyapoa/domain-core';

@ApiTags('Patient Records (Multi-Tenant Demo)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('records')
export class RecordsController {
  constructor(@Inject(RecordsService) private recordsService: RecordsService) {}

  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'List tenant patient records under Row-Level Security' })
  @ApiResponse({ status: 200, description: 'Tenant records retrieved' })
  async findAll(@CurrentTenantContext() ctx: TenantContext) {
    const data = await this.recordsService.findAll(ctx);
    return { tenantId: ctx.tenantId, count: data.length, records: data };
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Retrieve specific patient record by ID' })
  @ApiResponse({ status: 200, description: 'Record found' })
  @ApiResponse({ status: 404, description: 'Record not found in caller tenant' })
  async findOne(@CurrentTenantContext() ctx: TenantContext, @Param('id') id: string) {
    return await this.recordsService.findOne(ctx, id);
  }

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create patient record in current tenant organization' })
  @ApiResponse({ status: 201, description: 'Record created' })
  async create(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateRecordDto,
  ) {
    return await this.recordsService.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({ summary: 'Update patient record by ID' })
  @ApiResponse({ status: 200, description: 'Record updated' })
  @ApiResponse({ status: 404, description: 'Record not found or cross-tenant access denied' })
  async update(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return await this.recordsService.update(ctx, id, dto);
  }

  @Get('export/all')
  @RequirePermissions(Permission.AUDIT_EXPORT)
  @ApiOperation({ summary: 'Privileged data export (Requires AUDIT_EXPORT permission)' })
  @ApiResponse({ status: 200, description: 'Export payload generated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions to export data' })
  async exportRecords(@CurrentTenantContext() ctx: TenantContext) {
    const data = await this.recordsService.findAll(ctx);
    return {
      exportedAt: new Date().toISOString(),
      tenantId: ctx.tenantId,
      exportedBy: ctx.userId,
      records: data,
    };
  }
}
