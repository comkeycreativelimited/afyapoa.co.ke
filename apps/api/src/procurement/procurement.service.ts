import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  procurementOrders,
  procurementOrderItems,
  goodsReceivedNotes,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  ProcurementOrderStatus,
  GrnStatus,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateProcurementOrderDto,
  CreateGrnDto,
} from './dto/procurement.dto.js';

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generatePoNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PO-${yearMonth}-${randomSuffix}`;
  }

  private generateGrnNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `GRN-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================

  async createOrder(dto: CreateProcurementOrderDto, context: TenantContext) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one procurement item must be included.');
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      let totalAmount = 0;
      for (const item of dto.items) {
        const rawQty = item.quantityOrdered ?? item.quantity ?? 1;
        const rawPrice = item.unitPrice ?? 0;
        const qty = parseFloat(String(rawQty));
        const price = parseFloat(String(rawPrice));
        totalAmount += (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price);
      }

      const poNumber = this.generatePoNumber();

      const [order] = await tx
        .insert(procurementOrders)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          poNumber,
          supplierId: dto.supplierId || null,
          supplierName: dto.supplierName,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          status: dto.status || ProcurementOrderStatus.SUBMITTED,
          totalAmount: totalAmount.toFixed(2),
          notes: dto.notes || null,
        })
        .returning();

      const orderItems = [];
      for (const item of dto.items) {
        const rawQty = item.quantityOrdered ?? item.quantity ?? 1;
        const rawPrice = item.unitPrice ?? 0;
        const qty = parseFloat(String(rawQty));
        const price = parseFloat(String(rawPrice));
        const itemTotal = ((isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price)).toFixed(2);

        const [createdItem] = await tx
          .insert(procurementOrderItems)
          .values({
            tenantId: context.tenantId,
            orderId: order!.id,
            itemType: item.itemType || 'MEDICATION',
            itemId: item.itemId || null,
            itemDescription: item.itemDescription,
            quantityOrdered: String(rawQty),
            quantityReceived: '0.00',
            unitPrice: String(rawPrice),
            totalPrice: itemTotal,
          })
          .returning();

        orderItems.push(createdItem);
      }

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PROCUREMENT_ORDER_CREATED,
        resource: 'procurement_orders',
        resourceId: order!.id,
        details: { poNumber: order!.poNumber, supplierName: order!.supplierName, totalAmount },
      });

      return {
        ...order!,
        orderNumber: order!.poNumber,
        items: orderItems,
      };
    });
  }

  async approveOrder(orderId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(procurementOrders)
        .where(
          and(
            eq(procurementOrders.tenantId, context.tenantId),
            eq(procurementOrders.id, orderId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Procurement order with ID ${orderId} not found.`);
      }

      if (order.status !== ProcurementOrderStatus.DRAFT && order.status !== ProcurementOrderStatus.SUBMITTED) {
        throw new BadRequestException(`Cannot approve order in ${order.status} state.`);
      }

      const [approved] = await tx
        .update(procurementOrders)
        .set({
          status: ProcurementOrderStatus.APPROVED,
          authorizedByUserId: context.userId,
          updatedAt: new Date(),
        })
        .where(eq(procurementOrders.id, orderId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PROCUREMENT_ORDER_APPROVED,
        resource: 'procurement_orders',
        resourceId: orderId,
        details: { poNumber: order.poNumber },
      });

      return approved;
    });
  }

  async listOrders(facilityId: string, context: TenantContext, status?: ProcurementOrderStatus) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(procurementOrders.tenantId, context.tenantId),
        eq(procurementOrders.facilityId, facilityId),
      ];
      if (status) {
        conditions.push(eq(procurementOrders.status, status));
      }

      return await tx
        .select()
        .from(procurementOrders)
        .where(and(...conditions))
        .orderBy(desc(procurementOrders.orderDate));
    });
  }

  async getOrderById(orderId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(procurementOrders)
        .where(
          and(
            eq(procurementOrders.tenantId, context.tenantId),
            eq(procurementOrders.id, orderId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Procurement order ${orderId} not found.`);
      }

      const items = await tx
        .select()
        .from(procurementOrderItems)
        .where(
          and(
            eq(procurementOrderItems.tenantId, context.tenantId),
            eq(procurementOrderItems.orderId, orderId),
          ),
        );

      const grns = await tx
        .select()
        .from(goodsReceivedNotes)
        .where(
          and(
            eq(goodsReceivedNotes.tenantId, context.tenantId),
            eq(goodsReceivedNotes.procurementOrderId, orderId),
          ),
        );

      return {
        ...order,
        items,
        grns,
      };
    });
  }

  // ==========================================
  // GOODS RECEIVED NOTES (GRN)
  // ==========================================

  async createGrn(dto: CreateGrnDto, context: TenantContext) {
    const poId = dto.procurementOrderId || (dto as any).orderId;
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(procurementOrders)
        .where(
          and(
            eq(procurementOrders.tenantId, context.tenantId),
            eq(procurementOrders.id, poId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Procurement order with ID ${poId} not found.`);
      }

      const grnNumber = this.generateGrnNumber();
      const grnStatus = dto.status || GrnStatus.ACCEPTED;
      const binLocation =
        dto.storageBinLocation ||
        (dto as any).storageLocationNotes ||
        ((dto as any).itemsReceived && (dto as any).itemsReceived[0]?.storageBin) ||
        'MAIN-STORE-BIN-01';

      const [grn] = await tx
        .insert(goodsReceivedNotes)
        .values({
          tenantId: context.tenantId,
          facilityId: order.facilityId,
          grnNumber,
          procurementOrderId: order.id,
          supplierInvoiceNumber: dto.supplierInvoiceNumber || (dto as any).deliveryNoteNumber || 'DN-PENDING',
          receivedByUserId: dto.receivedByUserId || context.userId,
          inspectedByUserId: dto.inspectedByUserId || context.userId,
          inspectionPassed: dto.inspectionPassed !== false,
          inspectionNotes: dto.inspectionNotes || (dto as any).storageLocationNotes || null,
          storageBinLocation: binLocation,
          status: grnStatus,
        })
        .returning();

      // If accepted, update PO status to RECEIVED
      if (grnStatus === GrnStatus.ACCEPTED) {
        await tx
          .update(procurementOrders)
          .set({
            status: ProcurementOrderStatus.RECEIVED,
            updatedAt: new Date(),
          })
          .where(eq(procurementOrders.id, order.id));
      }

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.GOODS_RECEIVED_RECORDED,
        resource: 'goods_received_notes',
        resourceId: grn!.id,
        details: {
          grnNumber: grn!.grnNumber,
          poNumber: order.poNumber,
          storageBin: grn!.storageBinLocation,
        },
      });

      return grn!;
    });
  }

  async listGrns(facilityId: string, context: TenantContext, poId?: string) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(goodsReceivedNotes.tenantId, context.tenantId),
        eq(goodsReceivedNotes.facilityId, facilityId),
      ];
      if (poId) {
        conditions.push(eq(goodsReceivedNotes.procurementOrderId, poId));
      }

      return await tx
        .select()
        .from(goodsReceivedNotes)
        .where(and(...conditions))
        .orderBy(desc(goodsReceivedNotes.receivedDate));
    });
  }
}
