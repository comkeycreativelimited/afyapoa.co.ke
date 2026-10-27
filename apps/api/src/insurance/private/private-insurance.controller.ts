import {
  Controller,
  Get,
  Post,
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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../../auth/decorators/auth.decorators.js';
import {
  Permission,
  TenantContext,
} from '@afyapoa/domain-core';
import { PrivateInsuranceService } from './private-insurance.service.js';
import {
  RegisterInsurancePolicyDto,
  RequestPreauthorizationDto,
} from './dto/private-insurance.dto.js';

@ApiTags('Private Commercial Insurance Adapters (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('insurance/private')
export class PrivateInsuranceController {
  constructor(
    @Inject(PrivateInsuranceService)
    private readonly insuranceService: PrivateInsuranceService,
  ) {}

  @Post('policies')
  @RequirePermissions(Permission.PRIVATE_INSURANCE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register private commercial insurance policy (Jubilee, AAR, APA, Britam, Old Mutual)' })
  async registerPolicy(
    @Body() dto: RegisterInsurancePolicyDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.insuranceService.registerPolicy(dto, context);
  }

  @Get('policies')
  @RequirePermissions(Permission.PRIVATE_INSURANCE_READ)
  @ApiOperation({ summary: 'List insurance policies for a patient' })
  @ApiQuery({ name: 'patientId', required: true, type: String })
  async listPolicies(
    @Query('patientId', ParseUUIDPipe) patientId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.insuranceService.listPolicies(patientId, context);
  }

  @Get('policies/:id/eligibility')
  @RequirePermissions(Permission.PRIVATE_INSURANCE_READ)
  @ApiOperation({ summary: 'Verify real-time eligibility, copay, and available limit' })
  @ApiQuery({ name: 'estimatedAmount', required: true, type: Number })
  async verifyEligibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('estimatedAmount') estimatedAmount: number,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.insuranceService.verifyEligibility(id, Number(estimatedAmount), context);
  }

  @Post('preauthorizations')
  @RequirePermissions(Permission.PRIVATE_INSURANCE_AUTH)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit pre-authorization request to private payer adapter' })
  async requestPreauthorization(
    @Body() dto: RequestPreauthorizationDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.insuranceService.requestPreauthorization(dto, context);
  }

  @Get('preauthorizations/:id')
  @RequirePermissions(Permission.PRIVATE_INSURANCE_READ)
  @ApiOperation({ summary: 'Get pre-authorization details by ID' })
  async getAuthorizationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.insuranceService.getAuthorizationById(id, context);
  }
}
