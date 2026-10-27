import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles, CurrentTenantContext } from '../auth/decorators/auth.decorators.js';
import { UserRole, TenantContext } from '@afyapoa/domain-core';
import { SaasService } from './saas.service.js';
import { SaasBillingService } from './saas-billing.service.js';
import { SaasSupportService } from './saas-support.service.js';
import { SaasOffboardingService } from './saas-offboarding.service.js';
import {
  UpgradePlanDto,
  DowngradePlanDto,
  RecordUsageDto,
  ProcessPlatformPaymentDto,
  CreateSupportCaseDto,
  AddCaseMessageDto,
  GrantSupportAccessDto,
  RequestOffboardingDto,
} from './dto/index.js';

@ApiTags('Hospital SaaS Administration & Commercial Billing')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.FINANCE_USER, UserRole.BILLING_CLERK)
@Controller('saas')
export class SaasTenantController {
  constructor(
    @Inject(SaasService) private saasService: SaasService,
    @Inject(SaasBillingService) private saasBillingService: SaasBillingService,
    @Inject(SaasSupportService) private saasSupportService: SaasSupportService,
    @Inject(SaasOffboardingService) private saasOffboardingService: SaasOffboardingService,
  ) {}

  // 1. Subscription & Entitlements
  @Get('plans')
  @ApiOperation({ summary: 'View available SaaS subscription plans' })
  async getAvailablePlans() {
    return await this.saasService.listPlans();
  }

  @Get('subscription')
  @ApiOperation({ summary: 'View current tenant subscription, plan, and active entitlements' })
  async getTenantSubscription(@CurrentTenantContext() ctx: TenantContext) {
    return await this.saasService.getSubscription(ctx.tenantId);
  }

  @Post('subscription/upgrade')
  @ApiOperation({ summary: 'Upgrade hospital subscription plan tier' })
  async upgradeSubscription(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: UpgradePlanDto,
  ) {
    return await this.saasService.upgradeSubscription(ctx.tenantId, dto, ctx.userId);
  }

  @Post('subscription/downgrade')
  @ApiOperation({ summary: 'Downgrade subscription plan tier with resource quota validation' })
  async downgradeSubscription(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: DowngradePlanDto,
  ) {
    return await this.saasService.downgradeSubscription(ctx.tenantId, dto, ctx.userId);
  }

  // 2. Usage Metering
  @Post('usage/record')
  @ApiOperation({ summary: 'Record metered usage metric for tenant' })
  async recordUsage(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: RecordUsageDto,
  ) {
    return await this.saasService.recordUsage(ctx.tenantId, dto);
  }

  @Get('usage')
  @ApiOperation({ summary: 'View current monthly usage vs quota limits with 80% & 100% threshold warnings' })
  async getUsageSummary(@CurrentTenantContext() ctx: TenantContext) {
    return await this.saasService.getUsageSummary(ctx.tenantId);
  }

  // 3. Platform SaaS Invoices & Payments
  @Get('invoices')
  @ApiOperation({ summary: 'List platform SaaS subscription invoices for this hospital' })
  async getTenantInvoices(@CurrentTenantContext() ctx: TenantContext) {
    return await this.saasBillingService.getInvoices(ctx.tenantId);
  }

  @Post('invoices/:id/pay')
  @ApiOperation({ summary: 'Pay platform SaaS invoice via M-Pesa STK push or bank transfer (idempotent)' })
  async payInvoice(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id') invoiceId: string,
    @Body() dto: ProcessPlatformPaymentDto,
  ) {
    return await this.saasBillingService.processPayment(ctx.tenantId, {
      ...dto,
      invoiceId,
    });
  }

  // 4. Administrative Support Cases
  @Post('support/cases')
  @ApiOperation({ summary: 'Create new administrative or clinical workflow support case' })
  async createSupportCase(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateSupportCaseDto,
  ) {
    return await this.saasSupportService.createCase(ctx.tenantId, ctx.userId, dto);
  }

  @Get('support/cases')
  @ApiOperation({ summary: 'List support cases filed by this hospital' })
  async listSupportCases(@CurrentTenantContext() ctx: TenantContext) {
    return await this.saasSupportService.getCases(ctx.tenantId);
  }

  @Get('support/cases/:id')
  @ApiOperation({ summary: 'Get support case thread by ID' })
  async getSupportCase(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id') caseId: string,
  ) {
    return await this.saasSupportService.getCaseById(caseId, ctx.tenantId);
  }

  @Post('support/cases/:id/messages')
  @ApiOperation({ summary: 'Add message to support case conversation thread' })
  async addSupportMessage(
    @Param('id') caseId: string,
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: AddCaseMessageDto,
  ) {
    return await this.saasSupportService.addMessage(caseId, ctx.userId, false, dto);
  }

  // 5. Controlled Support Access Grants
  @Post('support/access-grants')
  @ApiOperation({ summary: 'Grant time-bound (max 24h), auditable support access to COMKEY platform engineer' })
  async grantSupportAccess(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: GrantSupportAccessDto,
  ) {
    return await this.saasSupportService.grantSupportAccess(ctx.tenantId, ctx.userId, dto);
  }

  @Post('support/access-grants/verify')
  @ApiOperation({ summary: 'Verify support access token and authorize temporary session' })
  async verifySupportAccess(
    @CurrentTenantContext() ctx: TenantContext,
    @Body('accessToken') accessToken: string,
  ) {
    return await this.saasSupportService.verifySupportAccess(accessToken, ctx.tenantId);
  }

  @Post('support/access-grants/:id/revoke')
  @ApiOperation({ summary: 'Immediately revoke active support access grant' })
  async revokeSupportAccess(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id') grantId: string,
  ) {
    return await this.saasSupportService.revokeSupportAccess(grantId, ctx.userId, ctx.tenantId);
  }

  // 6. Tenant Offboarding
  @Post('offboarding/request')
  @ApiOperation({ summary: 'Request hospital offboarding and schedule statutory medical records retention' })
  async requestOffboarding(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: RequestOffboardingDto,
  ) {
    return await this.saasOffboardingService.requestOffboarding(ctx.tenantId, ctx.userId, dto);
  }
}
