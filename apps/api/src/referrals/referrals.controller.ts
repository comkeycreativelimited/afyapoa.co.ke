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
  ReferralDirection,
  ReferralStatus,
} from '@afyapoa/domain-core';
import { ReferralsService } from './referrals.service.js';
import {
  CreateReferralDto,
  UpdateReferralStatusDto,
  SubmitCounterReferralDto,
} from './dto/referral.dto.js';

@ApiTags('Referrals & Counter-Referrals (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(
    @Inject(ReferralsService)
    private readonly referralsService: ReferralsService,
  ) {}

  @Post()
  @RequirePermissions(Permission.REFERRAL_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Dispatch a medical referral to another KMFL health facility' })
  async createReferral(
    @Body() dto: CreateReferralDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.referralsService.createReferral(dto, context);
  }

  @Get()
  @RequirePermissions(Permission.REFERRAL_READ)
  @ApiOperation({ summary: 'List incoming or outgoing facility referrals' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'direction', required: false, enum: ReferralDirection })
  @ApiQuery({ name: 'status', required: false, enum: ReferralStatus })
  async listReferrals(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('direction') direction?: ReferralDirection,
    @Query('status') status?: ReferralStatus,
  ) {
    return await this.referralsService.listReferrals(facilityId, context, direction, status);
  }

  @Get(':id')
  @RequirePermissions(Permission.REFERRAL_READ)
  @ApiOperation({ summary: 'Get referral details by ID' })
  async getReferralById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.referralsService.getReferralById(id, context);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.REFERRAL_UPDATE)
  @ApiOperation({ summary: 'Update referral status (Accepted, Rejected, Completed)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferralStatusDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.referralsService.updateStatus(id, dto, context);
  }

  @Post(':id/counter-referral')
  @RequirePermissions(Permission.REFERRAL_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit counter-referral clinical feedback report' })
  async submitCounterReferral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitCounterReferralDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.referralsService.submitCounterReferral(id, dto, context);
  }
}
