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
  InpatientAdmissionStatus,
  BedStatus,
} from '@afyapoa/domain-core';
import { InpatientService } from './inpatient.service.js';
import {
  CreateWardDto,
  CreateBedDto,
  UpdateBedStatusDto,
  CreateInpatientAdmissionDto,
  TransferBedDto,
  DischargePatientDto,
  CancelAdmissionDto,
} from './dto/inpatient.dto.js';

@ApiTags('Inpatient ADT & Ward/Bed Management (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inpatient')
export class InpatientController {
  constructor(
    @Inject(InpatientService)
    private readonly inpatientService: InpatientService,
  ) {}

  // ==========================================
  // WARDS
  // ==========================================

  @Post('wards')
  @RequirePermissions(Permission.WARD_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a hospital ward' })
  async createWard(
    @Body() dto: CreateWardDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.createWard(dto, context);
  }

  @Get('wards')
  @RequirePermissions(Permission.BED_VIEW)
  @ApiOperation({ summary: 'List wards for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  async listWards(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.listWards(facilityId, context);
  }

  @Get('wards/:id')
  @RequirePermissions(Permission.BED_VIEW)
  @ApiOperation({ summary: 'Get ward details by ID' })
  async getWardById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.getWardById(id, context);
  }

  // ==========================================
  // BEDS
  // ==========================================

  @Post('beds')
  @RequirePermissions(Permission.BED_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a bed within a ward' })
  async createBed(
    @Body() dto: CreateBedDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.createBed(dto, context);
  }

  @Get('wards/:wardId/beds')
  @RequirePermissions(Permission.BED_VIEW)
  @ApiOperation({ summary: 'List beds in a ward' })
  @ApiQuery({ name: 'status', required: false, enum: BedStatus })
  async listBeds(
    @Param('wardId', ParseUUIDPipe) wardId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('status') status?: BedStatus,
  ) {
    return await this.inpatientService.listBeds(wardId, context, status);
  }

  @Patch('beds/:id/status')
  @RequirePermissions(Permission.BED_MANAGE)
  @ApiOperation({ summary: 'Update bed operational status (Vacant, Cleaning, Maintenance)' })
  async updateBedStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBedStatusDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.updateBedStatus(id, dto, context);
  }

  // ==========================================
  // ADMISSION, DISCHARGE & TRANSFER (ADT)
  // ==========================================

  @Post('admissions')
  @RequirePermissions(Permission.INPATIENT_ADMIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Admit patient with transactional bed double-booking prevention' })
  async admitPatient(
    @Body() dto: CreateInpatientAdmissionDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.admitPatient(dto, context);
  }

  @Get('admissions')
  @RequirePermissions(Permission.INPATIENT_READ)
  @ApiOperation({ summary: 'List admissions for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, enum: InpatientAdmissionStatus })
  async listAdmissions(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('status') status?: InpatientAdmissionStatus,
  ) {
    return await this.inpatientService.listAdmissions(facilityId, context, status);
  }

  @Get('admissions/:id')
  @RequirePermissions(Permission.INPATIENT_READ)
  @ApiOperation({ summary: 'Get admission record by ID' })
  async getAdmissionById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.getAdmissionById(id, context);
  }

  @Post('admissions/:id/transfer')
  @RequirePermissions(Permission.INPATIENT_TRANSFER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer patient to a new ward or bed' })
  async transferBed(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferBedDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.transferBed(id, dto, context);
  }

  @Post('admissions/:id/discharge')
  @RequirePermissions(Permission.INPATIENT_DISCHARGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Discharge an inpatient and vacate their bed' })
  async dischargePatient(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DischargePatientDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.dischargePatient(id, dto, context);
  }

  @Post('admissions/:id/cancel')
  @RequirePermissions(Permission.INPATIENT_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an admission and release the bed' })
  async cancelAdmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAdmissionDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.inpatientService.cancelAdmission(id, dto, context);
  }
}
