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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
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
import { SaasMonitoringService } from './saas-monitoring.service.js';
import {
  OnboardTenantDto,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  IssuePlatformInvoiceDto,
  SuspendSubscriptionDto,
  CancelSubscriptionDto,
  UpdateCaseStatusDto,
} from './dto/index.js';

@ApiTags('Platform Administration & Commercial SaaS Operations (Super Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('platform')
export class SaasAdminController {
  constructor(
    @Inject(SaasService) private saasService: SaasService,
    @Inject(SaasBillingService) private saasBillingService: SaasBillingService,
    @Inject(SaasSupportService) private saasSupportService: SaasSupportService,
    @Inject(SaasOffboardingService) private saasOffboardingService: SaasOffboardingService,
    @Inject(SaasMonitoringService) private saasMonitoringService: SaasMonitoringService,
  ) {}

  // 1. Tenant Onboarding
  @Post('tenants/onboard')
  @ApiOperation({ summary: 'Onboard new hospital organization with primary KMFL facility & admin user' })
  @ApiResponse({ status: 201, description: 'Tenant, primary facility, admin, and subscription provisioned' })
  async onboardTenant(@Body() dto: OnboardTenantDto) {
    return await this.saasService.onboardTenant(dto);
  }

  // 2. Subscription Plans
  @Post('plans')
  @ApiOperation({ summary: 'Define new subscription tier plan with limits & entitlements' })
  @ApiResponse({ status: 201, description: 'Plan defined' })
  async createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return await this.saasService.createPlan(dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all subscription plans' })
  async listPlans() {
    return await this.saasService.listPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get subscription plan by ID' })
  async getPlan(@Param('id') id: string) {
    return await this.saasService.getPlanById(id);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update subscription plan limits & pricing' })
  async updatePlan(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return await this.saasService.updatePlan(id, dto);
  }

  // 3. Platform Invoicing
  @Post('invoices')
  @ApiOperation({ summary: 'Issue new platform SaaS invoice (idempotent)' })
  @ApiResponse({ status: 201, description: 'Invoice issued with itemized line rows' })
  async issueInvoice(@Body() dto: IssuePlatformInvoiceDto) {
    return await this.saasBillingService.issueInvoice(dto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List all platform SaaS invoices across tenants' })
  async getInvoices(@Query('tenantId') tenantId?: string) {
    return await this.saasBillingService.getInvoices(tenantId);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get platform invoice details with line items and payments' })
  async getInvoice(@Param('id') id: string) {
    return await this.saasBillingService.getInvoiceById(id);
  }

  // 4. Subscription State Transitions & Dunning
  @Post('subscriptions/:id/suspend')
  @ApiOperation({ summary: 'Suspend tenant subscription (enforces clinical safety safeguard)' })
  async suspendSubscription(
    @Param('id') id: string,
    @Body() dto: SuspendSubscriptionDto,
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.saasService.suspendSubscription(id, dto.reason, ctx.userId);
  }

  @Post('subscriptions/:id/cancel')
  @ApiOperation({ summary: 'Cancel tenant subscription' })
  async cancelSubscription(
    @Param('id') id: string,
    @Body() dto: CancelSubscriptionDto,
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.saasService.cancelSubscription(id, dto.reason, ctx.userId);
  }

  @Post('invoices/:id/simulate-failure')
  @ApiOperation({ summary: 'Simulate failed payment and execute dunning stage progression' })
  async simulatePaymentFailure(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return await this.saasBillingService.handlePaymentFailure(
      id,
      reason || 'Card expired / M-Pesa timeout',
    );
  }

  // 5. Reporting & Financial Reconciliation
  @Get('reports/subscriptions')
  @ApiOperation({ summary: 'Get SaaS subscription MRR, ARR, active counts, and churn metrics' })
  async getSubscriptionReports() {
    return await this.saasBillingService.getSubscriptionReporting();
  }

  @Post('reconciliation/run')
  @ApiOperation({ summary: 'Execute platform payment reconciliation against issued invoices' })
  async runReconciliation() {
    return await this.saasBillingService.reconcilePayments();
  }

  // 6. Platform Health & Integration Monitoring
  @Get('health/status')
  @ApiOperation({ summary: 'Get aggregate platform component & national integration health' })
  async getHealthStatus() {
    return await this.saasMonitoringService.getPlatformHealthStatus();
  }

  @Get('metrics/integrations')
  @ApiOperation({ summary: 'Get integration reliability, uptime and latency percentiles' })
  async getIntegrationMetrics() {
    return await this.saasMonitoringService.getIntegrationMetrics();
  }

  // 7. Administrative Support Cases
  @Get('support/cases')
  @ApiOperation({ summary: 'List administrative support cases across all tenants' })
  async listSupportCases(@Query('tenantId') tenantId?: string) {
    return await this.saasSupportService.getCases(tenantId);
  }

  @Patch('support/cases/:id/status')
  @ApiOperation({ summary: 'Update support case status or assign support engineer' })
  async updateSupportCase(
    @Param('id') id: string,
    @Body() dto: UpdateCaseStatusDto,
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.saasSupportService.updateCaseStatus(id, ctx.userId, dto);
  }

  // 8. Tenant Offboarding
  @Get('offboarding/requests')
  @ApiOperation({ summary: 'List tenant offboarding requests' })
  async listOffboardingRequests(@Query('tenantId') tenantId?: string) {
    return await this.saasOffboardingService.getOffboardingRequests(tenantId);
  }

  @Post('offboarding/requests/:id/export')
  @ApiOperation({ summary: 'Generate data archive export package with SHA-256 checksum' })
  async generateExportPackage(@Param('id') id: string) {
    return await this.saasOffboardingService.generateDataExport(id);
  }

  @Post('offboarding/requests/:id/complete')
  @ApiOperation({ summary: 'Complete offboarding and archive tenant organization' })
  async completeOffboarding(
    @Param('id') id: string,
    @CurrentTenantContext() ctx: TenantContext,
  ) {
    return await this.saasOffboardingService.completeOffboarding(id, ctx.userId);
  }
}
