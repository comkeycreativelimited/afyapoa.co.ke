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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
  LabDepartment,
  SpecimenStatus,
} from '@afyapoa/domain-core';
import { LaboratoryService } from './laboratory.service.js';
import {
  CollectSpecimenDto,
  ReceiveSpecimenDto,
  RejectSpecimenDto,
  EnterLabResultDto,
  VerifyLabResultDto,
  CorrectLabResultDto,
  CreateDiagnosticReportDto,
  AuthorizeDiagnosticReportDto,
  AmendDiagnosticReportDto,
  DeductConsumableDto,
} from './dto/laboratory.dto.js';

@ApiTags('Laboratory Information Module (Milestone 7)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('laboratory')
export class LaboratoryController {
  constructor(
    @Inject(LaboratoryService)
    private readonly labService: LaboratoryService,
  ) {}

  // ==========================================
  // CATALOGUE & CONSUMABLES
  // ==========================================

  @Post('seed')
  @RequirePermissions(Permission.LAB_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seed standard Kenya MOH laboratory test catalog and consumables' })
  @ApiResponse({ status: 200, description: 'Catalog seeded successfully' })
  async seedCatalog(
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.labService.seedCatalogAndConsumables(
      ctx.tenantId,
      ctx.facilityId || ctx.tenantId,
      ctx.userId,
    );
  }

  @Get('catalog')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Retrieve laboratory test catalogue with published reference ranges' })
  @ApiQuery({ name: 'department', enum: LabDepartment, required: false })
  async getCatalog(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('department') department?: LabDepartment,
  ) {
    return await this.labService.getTestCatalog(ctx.tenantId, department);
  }

  // ==========================================
  // INCOMING ORDERS & PHLEBOTOMY
  // ==========================================

  @Get('orders/incoming')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Fetch incoming laboratory orders awaiting phlebotomy or processing' })
  async getIncomingOrders(
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.labService.getIncomingOrders(ctx.tenantId, ctx.facilityId);
  }

  @Post('specimens/collect')
  @RequirePermissions(Permission.LAB_ORDER_EXECUTE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Collect specimen, generate accession number/barcode, and deduct consumable' })
  @ApiResponse({ status: 201, description: 'Specimen collected and accessioned' })
  async collectSpecimen(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CollectSpecimenDto,
  ) {
    return await this.labService.collectSpecimen(
      ctx.tenantId,
      ctx.facilityId || ctx.tenantId,
      ctx.userId,
      dto,
    );
  }

  @Patch('specimens/:id/receive')
  @RequirePermissions(Permission.LAB_WRITE)
  @ApiOperation({ summary: 'Acknowledge physical specimen receipt in the laboratory' })
  @ApiParam({ name: 'id', description: 'Specimen UUID' })
  async receiveSpecimen(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveSpecimenDto,
  ) {
    return await this.labService.receiveSpecimenInLab(ctx.tenantId, id, ctx.userId, dto);
  }

  @Post('specimens/:id/reject')
  @RequirePermissions(Permission.LAB_REJECT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject specimen due to pre-analytical errors and trigger recollection' })
  @ApiParam({ name: 'id', description: 'Specimen UUID' })
  async rejectSpecimen(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectSpecimenDto,
  ) {
    return await this.labService.rejectSpecimen(ctx.tenantId, id, ctx.userId, dto);
  }

  // ==========================================
  // BENCH WORKLISTS & RESULT ENTRY
  // ==========================================

  @Get('worklist')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Get laboratory departmental bench worklists' })
  @ApiQuery({ name: 'department', enum: LabDepartment, required: false })
  @ApiQuery({ name: 'status', enum: SpecimenStatus, required: false })
  async getWorklist(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('department') department?: LabDepartment,
    @Query('status') status?: SpecimenStatus,
  ) {
    return await this.labService.getWorklist(ctx.tenantId, department, status);
  }

  @Post('results')
  @RequirePermissions(Permission.LAB_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enter test analytic results with automated abnormal-flag evaluation' })
  @ApiResponse({ status: 201, description: 'Result recorded with flag evaluation' })
  async enterResult(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: EnterLabResultDto,
  ) {
    return await this.labService.enterResult(
      ctx.tenantId,
      ctx.facilityId || ctx.tenantId,
      ctx.userId,
      dto,
    );
  }

  @Patch('results/:id/verify')
  @RequirePermissions(Permission.LAB_RESULT_AUTHORIZE)
  @ApiOperation({ summary: 'Supervisory verification and sign-off of laboratory result' })
  @ApiParam({ name: 'id', description: 'Lab Result UUID' })
  async verifyResult(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyLabResultDto,
  ) {
    return await this.labService.verifyResult(
      ctx.tenantId,
      id,
      ctx.userId,
      dto,
      ctx.permissions,
    );
  }

  @Post('results/:id/correct')
  @RequirePermissions(Permission.LAB_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Correct or amend an existing laboratory result with audit justification' })
  @ApiParam({ name: 'id', description: 'Lab Result UUID' })
  async correctResult(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectLabResultDto,
  ) {
    return await this.labService.correctResult(ctx.tenantId, id, ctx.userId, dto);
  }

  // ==========================================
  // DIAGNOSTIC REPORTS
  // ==========================================

  @Post('reports')
  @RequirePermissions(Permission.LAB_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Compile laboratory diagnostic report for clinical review' })
  @ApiResponse({ status: 201, description: 'Diagnostic report compiled' })
  async createReport(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateDiagnosticReportDto,
  ) {
    return await this.labService.createDiagnosticReport(
      ctx.tenantId,
      ctx.facilityId || ctx.tenantId,
      ctx.userId,
      dto,
    );
  }

  @Patch('reports/:id/authorize')
  @RequirePermissions(Permission.LAB_RESULT_AUTHORIZE)
  @ApiOperation({ summary: 'Final authorization and electronic signature of diagnostic report' })
  @ApiParam({ name: 'id', description: 'Diagnostic Report UUID' })
  async authorizeReport(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeDiagnosticReportDto,
  ) {
    return await this.labService.authorizeDiagnosticReport(
      ctx.tenantId,
      id,
      ctx.userId,
      dto,
      ctx.permissions,
    );
  }

  @Post('reports/:id/amend')
  @RequirePermissions(Permission.LAB_RESULT_AUTHORIZE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Amend previously finalized diagnostic report with clinical rationale' })
  @ApiParam({ name: 'id', description: 'Diagnostic Report UUID' })
  async amendReport(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AmendDiagnosticReportDto,
  ) {
    return await this.labService.amendDiagnosticReport(
      ctx.tenantId,
      id,
      ctx.userId,
      dto,
      ctx.permissions,
    );
  }

  // ==========================================
  // OPERATIONAL METRICS & CONSUMABLES
  // ==========================================

  @Get('metrics/operational')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Compute turnaround-time (TAT) breakdowns and operational workload metrics' })
  async getOperationalMetrics(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.labService.getOperationalMetrics(
      ctx.tenantId,
      ctx.facilityId,
      startDate,
      endDate,
    );
  }

  @Get('consumables')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'List laboratory consumables inventory and low-stock alerts' })
  async listConsumables(
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.labService.listConsumables(ctx.tenantId, ctx.facilityId);
  }

  @Post('consumables/deduct')
  @RequirePermissions(Permission.LAB_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manual or automated deduction of laboratory consumables' })
  async deductConsumable(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: DeductConsumableDto,
  ) {
    return await this.labService.deductConsumable(
      ctx.tenantId,
      ctx.facilityId || ctx.tenantId,
      ctx.userId,
      dto,
    );
  }

  // ==========================================
  // FHIR R4 EXPORT ENDPOINTS
  // ==========================================

  @Get('fhir/specimens/:id')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Export Specimen as Kenya Core HL7 FHIR R4 Specimen resource' })
  @ApiParam({ name: 'id', description: 'Specimen UUID' })
  async getSpecimenFHIR(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.labService.getSpecimenFHIR(ctx.tenantId, id);
  }

  @Get('fhir/observations/:id')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Export Lab Result as Kenya Core HL7 FHIR R4 Observation resource' })
  @ApiParam({ name: 'id', description: 'Result UUID' })
  async getObservationFHIR(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.labService.getObservationFHIR(ctx.tenantId, id);
  }

  @Get('fhir/diagnostic-reports/:id')
  @RequirePermissions(Permission.LAB_READ)
  @ApiOperation({ summary: 'Export Diagnostic Report as Kenya Core HL7 FHIR R4 DiagnosticReport resource' })
  @ApiParam({ name: 'id', description: 'Report UUID' })
  async getDiagnosticReportFHIR(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.labService.getDiagnosticReportFHIR(ctx.tenantId, id);
  }
}
