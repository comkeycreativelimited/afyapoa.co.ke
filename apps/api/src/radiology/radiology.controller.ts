import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import {
  Permission,
  TenantContext,
  RadiologyOrderStatus,
} from '@afyapoa/domain-core';
import { RadiologyService } from './radiology.service.js';
import {
  CreateRadiologyOrderDto,
  CreateRadiologyReportDto,
  AddendumReportDto,
} from './dto/radiology.dto.js';

@ApiTags('Radiology & Imaging Integration (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('radiology')
export class RadiologyController {
  constructor(
    @Inject(RadiologyService)
    private readonly radiologyService: RadiologyService,
  ) {}

  @Post('orders')
  @RequirePermissions(Permission.RADIOLOGY_ORDER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a radiology exam order' })
  async createOrder(
    @Body() dto: CreateRadiologyOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.radiologyService.createOrder(dto, context);
  }

  @Get('orders')
  @RequirePermissions(Permission.RADIOLOGY_READ)
  @ApiOperation({ summary: 'List radiology orders for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: RadiologyOrderStatus })
  async listOrders(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('patientId') patientId?: string,
    @Query('status') status?: RadiologyOrderStatus,
  ) {
    return await this.radiologyService.listOrders(facilityId, context, patientId, status);
  }

  @Get('orders/:id')
  @RequirePermissions(Permission.RADIOLOGY_READ)
  @ApiOperation({ summary: 'Get radiology order and reports (Protected for confidential specialist imaging)' })
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.radiologyService.getOrderById(id, context);
  }

  @Post('reports')
  @RequirePermissions(Permission.RADIOLOGY_REPORT_SIGN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit and sign radiologist report with DICOM PACS integration' })
  async createReport(
    @Body() dto: CreateRadiologyReportDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.radiologyService.createReport(dto, context);
  }

  @Post('reports/:id/addendum')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RADIOLOGY_REPORT_WRITE)
  @ApiOperation({ summary: 'Add an addendum to an existing signed radiology report (POST)' })
  async addAddendumPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddendumReportDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.radiologyService.addAddendum(id, dto, context);
  }

  @Patch('reports/:id/addendum')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RADIOLOGY_REPORT_WRITE)
  @ApiOperation({ summary: 'Add an addendum to an existing signed radiology report (PATCH)' })
  async addAddendumPatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddendumReportDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.radiologyService.addAddendum(id, dto, context);
  }
}
