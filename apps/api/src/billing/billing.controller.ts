import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  BillingCategory,
} from '@afyapoa/domain-core';
import { BillingService } from './billing.service.js';
import {
  CreateBillingServiceDto,
  UpdateBillingServiceDto,
  CreateInvoiceDto,
  CreateInvoiceFromEncounterDto,
  AddInvoiceLineItemDto,
  CancelInvoiceDto,
  RequestAdjustmentDto,
  ReviewAdjustmentDto,
  ProcessPaymentDto,
  ReversePaymentDto,
  OpenShiftDto,
  CloseShiftDto,
  SupervisorSignoffDto,
  QueryInvoiceFilterDto,
  QueryPaymentFilterDto,
  PatientStatementQueryDto,
  InitiateMpesaStkPushDto,
} from './dto/billing.dto.js';

@ApiTags('Patient Billing & Payments Module (Milestone 9)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(
    @Inject(BillingService)
    private readonly billingService: BillingService,
  ) {}

  private async resolveFacilityId(ctx: TenantContext): Promise<string> {
    if (ctx.facilityId) return ctx.facilityId;
    return await this.billingService.getFirstFacilityId(ctx.tenantId);
  }

  // ==========================================
  // 1. BILLING CATALOGUE & TARIFF MANAGEMENT
  // ==========================================

  @Post('catalogue/seed')
  @RequirePermissions(Permission.BILL_MANAGE)
  @ApiOperation({ summary: 'Seed standard Kenya Hospital billing tariffs and service catalog' })
  async seedCatalogue(@CurrentTenantContext() ctx: TenantContext) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.seedStandardTariffs(ctx.tenantId, facilityId);
  }

  @Get('catalogue')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'List billing services and tariffs with search and category filters' })
  @ApiQuery({ name: 'category', enum: BillingCategory, required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'search', required: false })
  async getCatalogue(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('category') category?: BillingCategory,
    @Query('department') department?: string,
    @Query('search') search?: string,
  ) {
    return await this.billingService.getBillingServices(ctx.tenantId, { category, department, search });
  }

  @Post('catalogue')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Create new hospital billing tariff item' })
  async createBillingService(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateBillingServiceDto,
  ) {
    return await this.billingService.createBillingService(ctx.tenantId, dto, ctx.userId);
  }

  @Patch('catalogue/:id')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Update an existing hospital billing tariff item' })
  @ApiParam({ name: 'id', description: 'Tariff UUID' })
  async updateBillingService(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBillingServiceDto,
  ) {
    return await this.billingService.updateBillingService(ctx.tenantId, id, dto, ctx.userId);
  }

  // ==========================================
  // 2. INVOICE CREATION, ITEMIZATION & CLINICAL LINKAGE
  // ==========================================

  @Post('invoices')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Create manual itemized patient invoice' })
  async createInvoice(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateInvoiceDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.createInvoice(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Post('invoices/encounter')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Auto-generate unified invoice from clinical encounter, lab orders & pharmacy dispenses' })
  async createInvoiceFromEncounter(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreateInvoiceFromEncounterDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.createInvoiceFromEncounter(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Get('invoices')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'Query patient invoices with status and patient filters' })
  async getInvoices(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() filter: QueryInvoiceFilterDto,
  ) {
    return await this.billingService.getInvoices(ctx.tenantId, filter);
  }

  @Get('invoices/:id')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'Get full invoice details with line items, adjustments, and payment allocations' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async getInvoiceById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.billingService.getInvoiceById(ctx.tenantId, id);
  }

  @Post('invoices/:id/lines')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Add line item to a draft invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async addLineItem(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddInvoiceLineItemDto,
  ) {
    return await this.billingService.addLineItem(ctx.tenantId, id, dto, ctx.userId);
  }

  @Delete('invoices/:id/lines/:lineId')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Remove line item from a draft invoice' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiParam({ name: 'lineId', description: 'Line Item UUID' })
  async removeLineItem(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return await this.billingService.removeLineItem(ctx.tenantId, id, lineId, ctx.userId);
  }

  // ==========================================
  // 3. FINALIZATION, ETIMS SIGNING & CANCELLATION
  // ==========================================

  @Post('invoices/:id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Finalize invoice, lock financial mutability, and sign with KRA eTIMS' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async finalizeInvoice(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.billingService.finalizeInvoice(ctx.tenantId, id, ctx.userId);
  }

  @Post('invoices/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Cancel invoice with statutory rationale (emits KRA Credit Note if finalized)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async cancelInvoice(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return await this.billingService.cancelInvoice(ctx.tenantId, id, dto, ctx.userId);
  }

  // ==========================================
  // 4. DISCOUNTS & ADJUSTMENTS (SEGREGATION OF DUTIES)
  // ==========================================

  @Post('invoices/:id/adjust')
  @RequirePermissions(Permission.BILL_WRITE)
  @ApiOperation({ summary: 'Request discount or waiver on invoice (auto-approves if within cashier limit, else requires supervisor)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  async requestAdjustment(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestAdjustmentDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.requestAdjustment(ctx.tenantId, facilityId, id, dto, ctx.userId);
  }

  @Post('adjustments/:id/review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.BILL_ADJUST_AUTHORIZE)
  @ApiOperation({ summary: 'Authorize or reject discount/waiver above cashier threshold (Segregation of duties: Admin only)' })
  @ApiParam({ name: 'id', description: 'Adjustment UUID' })
  async reviewAdjustment(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewAdjustmentDto,
  ) {
    return await this.billingService.reviewAdjustment(ctx.tenantId, id, dto, ctx.userId);
  }

  // ==========================================
  // 5. PAYMENTS, M-PESA & ALLOCATIONS
  // ==========================================

  @Post('payments')
  @RequirePermissions(Permission.PAYMENT_PROCESS)
  @ApiOperation({ summary: 'Process payment with idempotency key, invoice allocations, and receipt generation' })
  async processPayment(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ProcessPaymentDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.processPayment(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Get('payments')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'List and filter payments' })
  async getPayments(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() filter: QueryPaymentFilterDto,
  ) {
    return await this.billingService.getPayments(ctx.tenantId, filter);
  }

  @Post('payments/mpesa/stk-push')
  @RequirePermissions(Permission.PAYMENT_PROCESS)
  @ApiOperation({ summary: 'Initiate M-Pesa STK push via isolated adapter' })
  async initiateMpesaStkPush(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: InitiateMpesaStkPushDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.initiateMpesaStkPush(ctx.tenantId, facilityId, dto);
  }

  // ==========================================
  // 6. REFUNDS & REVERSALS (SEGREGATION OF DUTIES)
  // ==========================================

  @Post('payments/:id/reverse')
  @RequirePermissions(Permission.PAYMENT_REFUND)
  @ApiOperation({ summary: 'Reverse/refund payment (Segregation of duties: Admin only). Restores balance and preserves audit history' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  async reversePayment(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.reversePayment(ctx.tenantId, facilityId, id, dto, ctx.userId);
  }

  // ==========================================
  // 7. PATIENT STATEMENTS & BALANCES
  // ==========================================

  @Get('patients/:patientId/statement')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'Get comprehensive chronological patient account statement and outstanding balances' })
  @ApiParam({ name: 'patientId', description: 'Patient UUID' })
  async getPatientStatement(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PatientStatementQueryDto,
  ) {
    return await this.billingService.getPatientStatement(ctx.tenantId, patientId, query);
  }

  // ==========================================
  // 8. DAILY SHIFT RECONCILIATIONS & REPORTS
  // ==========================================

  @Post('reconciliations/shifts/open')
  @RequirePermissions(Permission.PAYMENT_PROCESS)
  @ApiOperation({ summary: 'Open cashier shift drawer with opening float' })
  async openShift(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: OpenShiftDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.billingService.openShift(ctx.tenantId, facilityId, ctx.userId, dto);
  }

  @Post('reconciliations/shifts/:id/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.PAYMENT_PROCESS)
  @ApiOperation({ summary: 'Close cashier shift with physical cash count and discrepancy detection' })
  @ApiParam({ name: 'id', description: 'Shift Reconciliation UUID' })
  async closeShift(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return await this.billingService.closeShift(ctx.tenantId, id, dto, ctx.userId);
  }

  @Post('reconciliations/shifts/:id/signoff')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.RECONCILIATION_MANAGE)
  @ApiOperation({ summary: 'Supervisor reviews shift variance and signs off (Admin only)' })
  @ApiParam({ name: 'id', description: 'Shift Reconciliation UUID' })
  async supervisorSignoff(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SupervisorSignoffDto,
  ) {
    return await this.billingService.supervisorSignoff(ctx.tenantId, id, dto, ctx.userId);
  }

  @Get('reconciliations/shifts')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'List daily cashier shift reconciliations' })
  async getDailyReconciliations(@CurrentTenantContext() ctx: TenantContext) {
    return await this.billingService.getDailyReconciliations(ctx.tenantId);
  }

  @Get('reports/financial')
  @RequirePermissions(Permission.BILL_VIEW)
  @ApiOperation({ summary: 'Tenant-aware financial reports: revenue by department, collections by method, debtor aging, eTIMS compliance' })
  async getFinancialReports(@CurrentTenantContext() ctx: TenantContext) {
    return await this.billingService.getFinancialReports(ctx.tenantId);
  }
}
