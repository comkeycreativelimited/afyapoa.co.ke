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
} from '@afyapoa/domain-core';
import { PharmacyService } from './pharmacy.service.js';
import {
  CreatePharmacyProductDto,
  UpdatePharmacyProductDto,
  CreatePharmacySupplierDto,
  UpdatePharmacySupplierDto,
  ReceiveStockDto,
  StockTransferDto,
  StockAdjustmentDto,
  DispenseMedicationDto,
  ReturnDispensedMedicationDto,
  AdministerMedicationDto,
  QueryPharmacyFilterDto,
} from './dto/pharmacy.dto.js';

@ApiTags('Pharmacy & Medication-Dispensing Module (Milestone 8)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(
    @Inject(PharmacyService)
    private readonly pharmacyService: PharmacyService,
  ) {}

  private async resolveFacilityId(ctx: TenantContext): Promise<string> {
    if (ctx.facilityId) return ctx.facilityId;
    return await this.pharmacyService.getFirstFacilityId(ctx.tenantId);
  }

  // ==========================================
  // 1. CATALOGUE MANAGEMENT & SEEDING
  // ==========================================

  @Post('catalogue/seed')
  @RequirePermissions(Permission.PHARMACY_ADMIN, Permission.PHARMACY_WRITE)
  @ApiOperation({ summary: 'Seed standard Kenya Essential Medicines List (KEML 2023) and licensed suppliers' })
  async seedCatalogue(@CurrentTenantContext() ctx: TenantContext) {
    return await this.pharmacyService.seedDefaultCatalogue(ctx.tenantId, ctx.userId);
  }

  @Get('products')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'List medicine and medical-product catalogue with filters' })
  async getProducts(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() filter: QueryPharmacyFilterDto,
  ) {
    return await this.pharmacyService.getProducts(ctx.tenantId, filter);
  }

  @Get('products/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get specific pharmacy product by ID' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async getProductById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.getProductById(ctx.tenantId, id);
  }

  @Post('products')
  @RequirePermissions(Permission.PHARMACY_WRITE)
  @ApiOperation({ summary: 'Create new pharmacy catalogue product' })
  async createProduct(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreatePharmacyProductDto,
  ) {
    return await this.pharmacyService.createProduct(ctx.tenantId, dto, ctx.userId);
  }

  @Patch('products/:id')
  @RequirePermissions(Permission.PHARMACY_WRITE)
  @ApiOperation({ summary: 'Update pharmacy catalogue product' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async updateProduct(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePharmacyProductDto,
  ) {
    return await this.pharmacyService.updateProduct(ctx.tenantId, id, dto, ctx.userId);
  }

  // ==========================================
  // 2. SUPPLIERS
  // ==========================================

  @Get('suppliers')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'List pharmaceutical suppliers and procurement partners' })
  async getSuppliers(@CurrentTenantContext() ctx: TenantContext) {
    return await this.pharmacyService.getSuppliers(ctx.tenantId);
  }

  @Get('suppliers/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  async getSupplierById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.getSupplierById(ctx.tenantId, id);
  }

  @Post('suppliers')
  @RequirePermissions(Permission.PHARMACY_WRITE)
  @ApiOperation({ summary: 'Register a new licensed pharmaceutical supplier' })
  async createSupplier(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: CreatePharmacySupplierDto,
  ) {
    return await this.pharmacyService.createSupplier(ctx.tenantId, dto, ctx.userId);
  }

  @Patch('suppliers/:id')
  @RequirePermissions(Permission.PHARMACY_WRITE)
  @ApiOperation({ summary: 'Update pharmaceutical supplier record' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  async updateSupplier(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePharmacySupplierDto,
  ) {
    return await this.pharmacyService.updateSupplier(ctx.tenantId, id, dto, ctx.userId);
  }

  // ==========================================
  // 3. INVENTORY & BATCH MANAGEMENT
  // ==========================================

  @Get('batches')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'List pharmacy batches with expiry dates and stock levels' })
  @ApiQuery({ name: 'productId', required: false })
  async getBatches(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('productId') productId?: string,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.getBatches(ctx.tenantId, facilityId, productId);
  }

  @Get('batches/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get batch details by ID' })
  @ApiParam({ name: 'id', description: 'Batch UUID' })
  async getBatchById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.getBatchById(ctx.tenantId, id);
  }

  @Post('inventory/receive')
  @RequirePermissions(Permission.PHARMACY_INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Receive incoming stock from supplier and record in stock movement ledger' })
  async receiveStock(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ReceiveStockDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.receiveStock(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Post('inventory/transfer')
  @RequirePermissions(Permission.PHARMACY_INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Transfer stock between sub-stores or facilities' })
  async transferStock(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: StockTransferDto,
  ) {
    const sourceFacilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.transferStock(ctx.tenantId, sourceFacilityId, dto, ctx.userId);
  }

  @Post('inventory/adjust')
  @RequirePermissions(Permission.PHARMACY_INVENTORY_MANAGE)
  @ApiOperation({ summary: 'Record controlled inventory adjustment (damage, expiry disposal, cycle-count reconciliation)' })
  async adjustStock(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: StockAdjustmentDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.adjustStock(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  // ==========================================
  // 4. PRESCRIPTION WORKLISTS
  // ==========================================

  @Get('prescriptions/worklist')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get prescription dispensing worklist with fulfillment statuses' })
  async getPrescriptionWorklist(@CurrentTenantContext() ctx: TenantContext) {
    return await this.pharmacyService.getPrescriptionWorklist(ctx.tenantId, ctx.facilityId);
  }

  // ==========================================
  // 5. MEDICATION DISPENSING
  // ==========================================

  @Post('dispense')
  @RequirePermissions(Permission.PHARMACY_DISPENSE)
  @ApiOperation({ summary: 'Dispense medication (full or partial) with FEFO allocation and concurrency lock' })
  async dispenseMedication(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: DispenseMedicationDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.dispenseMedication(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Post('dispense/return')
  @RequirePermissions(Permission.PHARMACY_RETURN)
  @ApiOperation({ summary: 'Controlled reversal of dispensed medication returning units to batch inventory' })
  async returnDispense(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ReturnDispensedMedicationDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.returnDispense(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  // ==========================================
  // 6. MEDICATION ADMINISTRATION
  // ==========================================

  @Post('administration')
  @RequirePermissions(Permission.MEDICATION_ADMINISTER)
  @ApiOperation({ summary: 'Record clinical bedside medication administration event' })
  async administerMedication(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: AdministerMedicationDto,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.administerMedication(ctx.tenantId, facilityId, dto, ctx.userId);
  }

  @Get('administrations')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'List medication administration records for encounter or patient' })
  @ApiQuery({ name: 'encounterId', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  async getAdministrations(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('encounterId') encounterId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return await this.pharmacyService.getAdministrations(ctx.tenantId, encounterId, patientId);
  }

  // ==========================================
  // 7. STOCK MOVEMENTS LEDGER & AUDIT
  // ==========================================

  @Get('movements')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Query immutable stock movement ledger for audit and verification' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiQuery({ name: 'batchId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getStockMovements(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('productId') productId?: string,
    @Query('batchId') batchId?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.pharmacyService.getStockMovements(
      ctx.tenantId,
      ctx.facilityId,
      productId,
      batchId,
      limit ? Number(limit) : 100,
    );
  }

  // ==========================================
  // 8. ALERTS, VALUATION & REPORTING
  // ==========================================

  @Get('alerts/low-stock')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get low-stock and stockout alerts based on reorder thresholds' })
  async getLowStockAlerts(@CurrentTenantContext() ctx: TenantContext) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.getLowStockAlerts(ctx.tenantId, facilityId);
  }

  @Get('alerts/expiry')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Get batches near expiry or expired (FEFO alerts)' })
  @ApiQuery({ name: 'daysThreshold', required: false })
  async getExpiryAlerts(
    @CurrentTenantContext() ctx: TenantContext,
    @Query('daysThreshold') daysThreshold?: number,
  ) {
    const facilityId = await this.resolveFacilityId(ctx);
    return await this.pharmacyService.getExpiryAlerts(
      ctx.tenantId,
      facilityId,
      daysThreshold ? Number(daysThreshold) : 90,
    );
  }

  @Get('valuation')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Calculate pharmacy inventory valuation at acquisition cost and retail' })
  async getInventoryValuation(@CurrentTenantContext() ctx: TenantContext) {
    return await this.pharmacyService.getInventoryValuation(ctx.tenantId, ctx.facilityId);
  }

  // ==========================================
  // 9. FHIR R4 SERIALIZATION ENDPOINTS
  // ==========================================

  @Get('fhir/medication/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Export product as FHIR R4 Medication resource' })
  @ApiParam({ name: 'id', description: 'Product UUID' })
  async exportFHIRMedication(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.exportFHIRMedication(ctx.tenantId, id);
  }

  @Get('fhir/dispense/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Export dispense as Kenya Core FHIR R4 MedicationDispense resource' })
  @ApiParam({ name: 'id', description: 'Dispense UUID' })
  async exportFHIRMedicationDispense(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.exportFHIRMedicationDispense(ctx.tenantId, id);
  }

  @Get('fhir/administration/:id')
  @RequirePermissions(Permission.PHARMACY_READ)
  @ApiOperation({ summary: 'Export administration as Kenya Core FHIR R4 MedicationAdministration resource' })
  @ApiParam({ name: 'id', description: 'Administration UUID' })
  async exportFHIRMedicationAdministration(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.pharmacyService.exportFHIRMedicationAdministration(ctx.tenantId, id);
  }
}
