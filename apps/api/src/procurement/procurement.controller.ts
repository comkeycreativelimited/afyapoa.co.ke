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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import {
  Permission,
  TenantContext,
  ProcurementOrderStatus,
} from '@afyapoa/domain-core';
import { ProcurementService } from './procurement.service.js';
import {
  CreateProcurementOrderDto,
  CreateGrnDto,
} from './dto/procurement.dto.js';

@ApiTags('Medical Supplies Procurement & GRN (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(
    @Inject(ProcurementService)
    private readonly procurementService: ProcurementService,
  ) {}

  @Post('orders')
  @RequirePermissions(Permission.PROCUREMENT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a medical supplies purchase order' })
  async createOrder(
    @Body() dto: CreateProcurementOrderDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.procurementService.createOrder(dto, context);
  }

  @Get('orders')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiOperation({ summary: 'List purchase orders for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ProcurementOrderStatus })
  async listOrders(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('status') status?: ProcurementOrderStatus,
  ) {
    return await this.procurementService.listOrders(facilityId, context, status);
  }

  @Get('orders/:id')
  @RequirePermissions(Permission.PROCUREMENT_READ)
  @ApiOperation({ summary: 'Get purchase order with line items and GRNs by ID' })
  async getOrderById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.procurementService.getOrderById(id, context);
  }

  @Post('orders/:id/approve')
  @RequirePermissions(Permission.PROCUREMENT_APPROVE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a procurement order' })
  async approveOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.procurementService.approveOrder(id, context);
  }

  @Post('grn')
  @RequirePermissions(Permission.GRN_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record Goods Received Note (GRN) with QA inspection and bin allocation' })
  async createGrn(
    @Body() dto: CreateGrnDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.procurementService.createGrn(dto, context);
  }

  @Post('orders/:orderId/grn')
  @RequirePermissions(Permission.GRN_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record Goods Received Note (GRN) for specific PO' })
  async createOrderGrn(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateGrnDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    if (!dto.procurementOrderId) {
      dto.procurementOrderId = orderId;
    }
    return await this.procurementService.createGrn(dto, context);
  }

  @Get('grn')
  @RequirePermissions(Permission.GRN_MANAGE)
  @ApiOperation({ summary: 'List Goods Received Notes' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'poId', required: false, type: String })
  async listGrns(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('poId') poId?: string,
  ) {
    return await this.procurementService.listGrns(facilityId, context, poId);
  }
}
