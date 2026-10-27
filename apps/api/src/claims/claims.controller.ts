import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import { Permission, TenantContext } from '@afyapoa/domain-core';
import { config } from '@afyapoa/config';
import { ClaimsService } from './claims.service.js';
import {
  CheckEligibilityDto,
  CreatePreauthDto,
  CancelPreauthDto,
  CreateClaimDto,
  InpatientDischargeDto,
  AttachDocumentDto,
  CorrectClaimDto,
  ShaCallbackPayloadDto,
  ReconcileClaimsQueryDto,
} from './dto/claims.dto.js';

@ApiTags('Social Health Authority (SHA) — eClaims & Pre-Authorization')
@Controller('claims')
export class ClaimsController {
  constructor(
    @Inject(ClaimsService)
    private readonly claimsService: ClaimsService,
  ) {}

  // ===========================================================================
  // 1. ELIGIBILITY & COVERAGE
  // ===========================================================================

  @Post('eligibility')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check SHA beneficiary eligibility across PHC, SHIF, ECCIF' })
  async checkEligibility(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CheckEligibilityDto,
  ) {
    return await this.claimsService.checkEligibility(
      ctx.tenantId,
      ctx.facilityId || '',
      dto,
      ctx.userId,
    );
  }

  @Get('sub-benefits/:patientCrId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve authorized sub-benefits for patient' })
  @ApiParam({ name: 'patientCrId', description: 'Canonical CR ID' })
  async getSubBenefits(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('patientCrId') patientCrId: string,
  ) {
    return await this.claimsService.getSubBenefits(ctx.tenantId, ctx.facilityId || '', patientCrId);
  }

  @Get('interventions/:patientCrId/:subBenefitCode')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve interventions and tariff rules for sub-benefit' })
  @ApiParam({ name: 'patientCrId' })
  @ApiParam({ name: 'subBenefitCode' })
  async getInterventions(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('patientCrId') patientCrId: string,
    @Param('subBenefitCode') subBenefitCode: string,
  ) {
    return await this.claimsService.getInterventions(
      ctx.tenantId,
      ctx.facilityId || '',
      patientCrId,
      subBenefitCode,
    );
  }

  // ===========================================================================
  // 2. PREAUTHORIZATIONS
  // ===========================================================================

  @Post('preauth')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_PREAUTH_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit preauthorization request (surgical, oncology, renal, imaging)' })
  async requestPreauthorization(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreatePreauthDto,
  ) {
    return await this.claimsService.requestPreauthorization(
      ctx.tenantId,
      ctx.facilityId || '',
      dto,
      ctx.userId,
    );
  }

  @Post('preauth/:id/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_PREAUTH_MANAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel/revoke pending preauthorization prior to admission' })
  @ApiParam({ name: 'id', description: 'Preauth UUID' })
  async cancelPreauthorization(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPreauthDto,
  ) {
    return await this.claimsService.cancelPreauthorization(
      ctx.tenantId,
      ctx.facilityId || '',
      id,
      dto,
      ctx.userId,
    );
  }

  // ===========================================================================
  // 3. CLAIM CREATION & PREPARATION
  // ===========================================================================

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_SUBMIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create and validate new statutory claim draft' })
  async createClaim(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateClaimDto,
  ) {
    return await this.claimsService.createClaim(
      ctx.tenantId,
      ctx.facilityId || '',
      dto,
      ctx.userId,
    );
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_SUBMIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dispatch validated claim to SHA adjudication engine' })
  @ApiParam({ name: 'id', description: 'Claim UUID' })
  async submitClaim(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.claimsService.submitClaim(
      ctx.tenantId,
      ctx.facilityId || '',
      id,
      ctx.userId,
    );
  }

  @Post(':id/discharge')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_SUBMIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalize inpatient discharge and dispatch inpatient claim' })
  @ApiParam({ name: 'id', description: 'Claim UUID' })
  async dischargeInpatientClaim(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InpatientDischargeDto,
  ) {
    return await this.claimsService.dischargeInpatientClaim(
      ctx.tenantId,
      ctx.facilityId || '',
      id,
      dto,
      ctx.userId,
    );
  }

  @Post(':id/attachments')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_SUBMIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Attach supporting clinical documentation (PDF/imaging)' })
  @ApiParam({ name: 'id', description: 'Claim UUID' })
  async attachDocument(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttachDocumentDto,
  ) {
    return await this.claimsService.attachDocument(
      ctx.tenantId,
      id,
      dto,
      ctx.userId,
    );
  }

  @Get(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_READ)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query live claim adjudication status from SHA' })
  @ApiParam({ name: 'id', description: 'Claim UUID' })
  async trackClaimStatus(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.claimsService.trackClaimStatus(
      ctx.tenantId,
      ctx.facilityId || '',
      id,
    );
  }

  @Post(':id/resubmit')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_SUBMIT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prepare corrected claim resubmission (increments version)' })
  @ApiParam({ name: 'id', description: 'Original Claim UUID' })
  async prepareCorrectedClaim(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectClaimDto,
  ) {
    return await this.claimsService.prepareCorrectedClaim(
      ctx.tenantId,
      ctx.facilityId || '',
      id,
      dto,
      ctx.userId,
    );
  }

  @Post('reconcile')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.SHA_CLAIM_RECONCILE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reconcile ambiguous, timed-out, or pending claims' })
  async reconcileClaims(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() queryDto: ReconcileClaimsQueryDto,
  ) {
    return await this.claimsService.reconcileClaims(
      ctx.tenantId,
      ctx.facilityId || '',
      queryDto,
      ctx.userId,
    );
  }

  // ===========================================================================
  // 4. ASYNCHRONOUS WEBHOOK CALLBACK (PUBLIC INGESTION POINT)
  // ===========================================================================

  @Post('callbacks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asynchronous adjudication callback endpoint for SHA webhook engine' })
  async handleCallback(
    @Headers('X-Tenant-Id') tenantHeader: string | undefined,
    @Headers('X-Trace-Id') traceId: string | undefined,
    @Body() payload: ShaCallbackPayloadDto,
  ) {
    // Multi-tenant webhook ingestion
    const tenantId = tenantHeader || config.DHA_DEFAULT_FACILITY_ID;
    return await this.claimsService.processCallback(tenantId, payload, traceId);
  }
}
