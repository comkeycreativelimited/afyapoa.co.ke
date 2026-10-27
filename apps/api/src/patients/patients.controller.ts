import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import {
  Permission,
  TenantContext,
  PatientAccessPurpose,
} from '@afyapoa/domain-core';
import { PatientsService } from './patients.service.js';
import {
  CreatePatientDto,
  EmergencyIntakeDto,
  UpdatePatientDto,
} from './dto/create-patient.dto.js';
import {
  PatientSearchQueryDto,
  DuplicateCheckDto,
} from './dto/patient-search.dto.js';
import {
  PatientResponseDto,
  PatientDetailResponseDto,
  PatientIdentifierResponseDto,
  PatientConsentResponseDto,
  DuplicateCandidateResponseDto,
} from './dto/patient-response.dto.js';
import { AddIdentifierDto } from './dto/add-identifier.dto.js';
import { ReconcilePatientDto } from './dto/reconcile-patient.dto.js';
import {
  GrantConsentDto,
  RevokeConsentDto,
} from './dto/consent.dto.js';

@ApiTags('Patients & Identity Management (Milestone 4)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(
    @Inject(PatientsService)
    private readonly patientsService: PatientsService,
  ) {}

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({
    summary: 'Register new patient with demographic validation and duplicate prevention',
  })
  @ApiResponse({
    status: 201,
    description: 'Patient successfully registered with generated MRN',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate patient detected (National ID or probabilistic match >= 70%)',
  })
  async registerPatient(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreatePatientDto,
    @Req() req: Request,
  ): Promise<PatientResponseDto> {
    const facilityId = ctx.facilityId || '00000000-0000-0000-0000-000000000001';
    return await this.patientsService.registerPatient(
      ctx.tenantId,
      facilityId,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Post('emergency-intake')
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({
    summary: 'Fast emergency trauma intake for unidentified or unconscious patients',
  })
  @ApiResponse({
    status: 201,
    description: 'Emergency patient registered with temporary MRN and alias',
    type: PatientResponseDto,
  })
  async registerEmergencyIntake(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: EmergencyIntakeDto,
    @Req() req: Request,
  ): Promise<PatientResponseDto> {
    const facilityId = ctx.facilityId || '00000000-0000-0000-0000-000000000001';
    return await this.patientsService.registerEmergencyIntake(
      ctx.tenantId,
      facilityId,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({
    summary: 'Search patients using blind-indexed National ID/phone/SHA or partial name/MRN',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of patients matching search criteria',
  })
  async searchPatients(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PatientSearchQueryDto,
  ) {
    return await this.patientsService.searchPatients(ctx.tenantId, query);
  }

  @Post('check-duplicates')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({
    summary: 'Evaluate candidate demographic duplicate probability before registration',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of candidate matching patients with confidence scores',
    type: [DuplicateCandidateResponseDto],
  })
  async checkDuplicates(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: DuplicateCheckDto,
  ): Promise<DuplicateCandidateResponseDto[]> {
    return await this.patientsService.checkDuplicates(ctx.tenantId, dto);
  }

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PATIENT_RECONCILE)
  @ApiOperation({
    summary: 'Safe, non-destructive reconciliation and merge of duplicate patient records',
  })
  @ApiResponse({
    status: 200,
    description: 'Source record deprecated as MERGED; target record updated',
  })
  async reconcilePatients(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ReconcilePatientDto,
    @Req() req: Request,
  ) {
    return await this.patientsService.reconcilePatients(
      ctx.tenantId,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({
    summary: 'Get full patient details by ID with statutory access logging (DPA 2019 Sec 41)',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Patient detail with masked identifiers, consents, and external verification status',
    type: PatientDetailResponseDto,
  })
  async getPatientById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('purpose') purpose?: PatientAccessPurpose,
    @Req() req?: Request,
  ): Promise<PatientDetailResponseDto> {
    return await this.patientsService.getPatientById(
      ctx.tenantId,
      id,
      ctx.userId,
      purpose || PatientAccessPurpose.CLINICAL_TREATMENT,
      req?.ip,
      req?.headers['user-agent'],
    );
  }

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({
    summary: 'Update patient demographics with automatic field encryption and audit logging',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Updated patient demographic record',
    type: PatientResponseDto,
  })
  async updatePatient(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @Req() req: Request,
  ): Promise<PatientResponseDto> {
    return await this.patientsService.updatePatient(
      ctx.tenantId,
      id,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Post(':id/identifiers')
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({
    summary: 'Add official statutory identifier with issuing authority provenance',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 201,
    description: 'Identifier encrypted, blind-indexed, and attached',
    type: PatientIdentifierResponseDto,
  })
  async addIdentifier(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIdentifierDto,
    @Req() req: Request,
  ): Promise<PatientIdentifierResponseDto> {
    const facilityId = ctx.facilityId || '00000000-0000-0000-0000-000000000001';
    return await this.patientsService.addIdentifier(
      ctx.tenantId,
      facilityId,
      id,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Post(':id/verify-dha')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({
    summary: 'Verify patient identity with DHA Client Registry and resolve UPI',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Client Registry lookup result, assigning canonical CRID and UPI',
  })
  async verifyWithDha(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const facilityId = ctx.facilityId || '00000000-0000-0000-0000-000000000001';
    return await this.patientsService.verifyWithClientRegistry(
      ctx.tenantId,
      facilityId,
      id,
      ctx.userId,
      ctx.facilityCode || 'FR-KEN-001',
      req.ip,
    );
  }

  @Post(':id/consents')
  @RequirePermissions(Permission.PATIENT_CONSENT_MANAGE)
  @ApiOperation({
    summary: 'Capture explicit statutory patient consent under Kenya DPA 2019',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 201,
    description: 'Consent record created',
    type: PatientConsentResponseDto,
  })
  async grantConsent(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ): Promise<PatientConsentResponseDto> {
    const facilityId = ctx.facilityId || '00000000-0000-0000-0000-000000000001';
    return await this.patientsService.grantConsent(
      ctx.tenantId,
      facilityId,
      id,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Post(':id/consents/:consentId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PATIENT_CONSENT_MANAGE)
  @ApiOperation({
    summary: 'Revoke active consent under Kenya DPA 2019 right to object',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiParam({ name: 'consentId', description: 'Consent record UUID' })
  @ApiResponse({
    status: 200,
    description: 'Consent revoked',
    type: PatientConsentResponseDto,
  })
  async revokeConsent(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('consentId', ParseUUIDPipe) consentId: string,
    @Body() dto: RevokeConsentDto,
    @Req() req: Request,
  ): Promise<PatientConsentResponseDto> {
    return await this.patientsService.revokeConsent(
      ctx.tenantId,
      id,
      consentId,
      dto,
      ctx.userId,
      req.ip,
    );
  }

  @Get(':id/history')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({
    summary: 'Authorized timeline of registrations, merges, transitions, and access logs',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID' })
  @ApiResponse({
    status: 200,
    description: 'Patient historical timeline and record access trail',
  })
  async getPatientHistory(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.patientsService.getPatientHistory(
      ctx.tenantId,
      id,
      ctx.userId,
    );
  }
}
