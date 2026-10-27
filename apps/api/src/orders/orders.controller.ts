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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
import { OrdersService } from './orders.service.js';
import {
  RecordDiagnosisDto,
  UpdateDiagnosisDto,
  CreateClinicalOrderDto,
  AuthorizeOrderDto,
  CancelOrderDto,
  AmendOrderDto,
  ClinicalOrderSearchQueryDto,
} from './dto/orders.dto.js';

@ApiTags('Clinical Terminology, Diagnoses & CPOE Orders (Milestone 6)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OrdersController {
  constructor(
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  // ==========================================
  // DIAGNOSIS ENDPOINTS
  // ==========================================

  @Post('encounters/:encounterId/diagnoses')
  @RequirePermissions(Permission.DIAGNOSIS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record diagnosis for an encounter',
    description: 'Enters an ICD-11 (or ICD-10) diagnosis. Validates code against standard Kenyan catalogues and rejects invented codes.',
  })
  @ApiParam({ name: 'encounterId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Diagnosis successfully recorded' })
  @ApiResponse({ status: 400, description: 'Invalid code or closed encounter' })
  @ApiResponse({ status: 409, description: 'Duplicate active diagnosis on encounter' })
  async recordDiagnosis(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Body() dto: RecordDiagnosisDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.recordDiagnosis(encounterId, dto, context);
  }

  @Get('encounters/:encounterId/diagnoses')
  @RequirePermissions(Permission.DIAGNOSIS_READ)
  @ApiOperation({
    summary: 'Get all diagnoses for an encounter',
    description: 'Retrieves active and historical diagnoses recorded during the specified encounter.',
  })
  @ApiParam({ name: 'encounterId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Diagnoses list retrieved' })
  async getEncounterDiagnoses(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.getEncounterDiagnoses(encounterId, context);
  }

  @Patch('diagnoses/:diagnosisId')
  @RequirePermissions(Permission.DIAGNOSIS_WRITE)
  @ApiOperation({
    summary: 'Update clinical status or verification of a diagnosis',
    description: 'Transitions diagnosis clinical or verification status (e.g. from PROVISIONAL to CONFIRMED).',
  })
  @ApiParam({ name: 'diagnosisId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Diagnosis updated successfully' })
  async updateDiagnosis(
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @Body() dto: UpdateDiagnosisDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.updateDiagnosis(diagnosisId, dto, context);
  }

  @Delete('diagnoses/:diagnosisId')
  @RequirePermissions(Permission.DIAGNOSIS_WRITE)
  @ApiOperation({
    summary: 'Deactivate / Mark diagnosis as entered in error',
    description: 'Deactivates the diagnosis and sets verification status to ENTERED_IN_ERROR with full audit provenance.',
  })
  @ApiParam({ name: 'diagnosisId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Diagnosis deactivated' })
  async removeDiagnosis(
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.removeDiagnosis(diagnosisId, context);
  }

  @Get('encounters/:encounterId/diagnoses/fhir')
  @RequirePermissions(Permission.DIAGNOSIS_READ)
  @ApiOperation({
    summary: 'Export encounter diagnoses as Kenya Core FHIR R4 Condition resources',
    description: 'Serializes encounter diagnoses into authentic FHIR Condition specifications.',
  })
  @ApiParam({ name: 'encounterId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'FHIR Condition bundle/resources' })
  async getEncounterFHIRConditions(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.getEncounterFHIRConditions(encounterId, context);
  }

  // ==========================================
  // CLINICAL ORDERS ENDPOINTS
  // ==========================================

  @Post('encounters/:encounterId/orders')
  @RequirePermissions(Permission.CLINICAL_ORDER_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create clinical order (Medication, Lab, Radiology, Procedure)',
    description: 'Creates a physician clinical order linked to the encounter and patient. Enforces 24h accidental duplicate detection.',
  })
  @ApiParam({ name: 'encounterId', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 409, description: 'Potential duplicate order detected' })
  async createOrder(
    @Param('encounterId', ParseUUIDPipe) encounterId: string,
    @Body() dto: CreateClinicalOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.createOrder(encounterId, dto, context);
  }

  @Get('orders')
  @RequirePermissions(Permission.CLINICAL_ORDER_READ)
  @ApiOperation({
    summary: 'Search and list clinical orders',
    description: 'Filters orders by encounter, patient, type, status, and priority.',
  })
  @ApiResponse({ status: 200, description: 'Paginated orders list' })
  async listOrders(
    @Query() query: ClinicalOrderSearchQueryDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.listOrders(query, context);
  }

  @Get('orders/:orderId')
  @RequirePermissions(Permission.CLINICAL_ORDER_READ)
  @ApiOperation({
    summary: 'Get clinical order by ID with details',
    description: 'Returns master order record and itemized medication or service request detail.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Clinical order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderById(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.getOrderById(orderId, context);
  }

  @Post('orders/:orderId/authorize')
  @RequirePermissions(Permission.CLINICAL_ORDER_AUTHORIZE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Review and authorize clinical order',
    description: 'Licensed practitioner review and authorization of submitted clinical order.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Order authorized' })
  async authorizeOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AuthorizeOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.authorizeOrder(orderId, dto, context);
  }

  @Post('orders/:orderId/cancel')
  @RequirePermissions(Permission.CLINICAL_ORDER_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel clinical order',
    description: 'Requires a mandatory clinical justification (minimum 10 characters). Completed orders cannot be cancelled.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  async cancelOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.cancelOrder(orderId, dto, context);
  }

  @Post('orders/:orderId/amend')
  @RequirePermissions(Permission.CLINICAL_ORDER_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Amend clinical order',
    description: 'Marks current order as AMENDED and generates superseding order linked via supersededOrderId.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Order amended and superseding order placed' })
  async amendOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AmendOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.amendOrder(orderId, dto, context);
  }

  @Get('orders/:orderId/fhir')
  @RequirePermissions(Permission.CLINICAL_ORDER_READ)
  @ApiOperation({
    summary: 'Export order as FHIR R4 MedicationRequest or ServiceRequest',
    description: 'Serializes order into Kenya Core FHIR R4 resource.',
  })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'FHIR R4 resource' })
  async getOrderFHIR(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.ordersService.getOrderFHIR(orderId, context);
  }
}
