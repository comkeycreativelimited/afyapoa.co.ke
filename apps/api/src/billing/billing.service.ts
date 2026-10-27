import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  withTenantContext,
  withTenantTransaction,
  billingServiceCatalogue,
  invoices,
  invoiceLineItems,
  invoiceAdjustments,
  payments,
  paymentAllocations,
  paymentReversals,
  dailyReconciliations,
  encounters,
  patients,
  facilities,
  clinicalOrders,
  serviceRequests,
  medicationDispenses,
  medicationDispenseItems,
  pharmacyProducts,
} from '@afyapoa/database';
import {
  eq,
  and,
  or,
  desc,
  asc,
  gte,
  sql as dSql,
} from 'drizzle-orm';
import {
  BillingCategory,
  InvoiceStatus,
  InvoiceType,
  PayerType,
  PaymentMethod,
  PaymentStatus,
  AdjustmentStatus,
  TaxCode,
  EtimsStatus,
  AuditEventType,
  roundCurrency,
  calculateLineItemTotals,
  calculateInvoiceTotals,
  checkDiscountRequiresApproval,
} from '@afyapoa/domain-core';
import { createIntegrationClients, IntegrationClients } from '@afyapoa/integration-adapters';
import { AuditService } from '../audit/audit.service.js';
import { STANDARD_BILLING_SERVICES } from './seed-data.js';
import {
  CreateBillingServiceDto,
  UpdateBillingServiceDto,
  CreateInvoiceDto,
  CreateInvoiceFromEncounterDto,
  InvoiceLineItemInputDto,
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

@Injectable()
export class BillingService {
  private readonly integrationClients: IntegrationClients;

  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {
    this.integrationClients = createIntegrationClients('MOCK');
  }

  async getFirstFacilityId(tenantId: string): Promise<string> {
    return await withTenantContext(tenantId, async (tx) => {
      const [fac] = await tx
        .select({ id: facilities.id })
        .from(facilities)
        .where(eq(facilities.tenantId, tenantId))
        .limit(1);
      return fac?.id || tenantId;
    });
  }

  // ==========================================
  // 1. BILLING & SERVICE CATALOGUE MANAGEMENT
  // ==========================================

  async seedStandardTariffs(tenantId: string, facilityId?: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const targetFacilityId = facilityId || (await this.getFirstFacilityId(tenantId));
      let seeded = 0;

      for (const item of STANDARD_BILLING_SERVICES) {
        const [existing] = await tx
          .select({ id: billingServiceCatalogue.id })
          .from(billingServiceCatalogue)
          .where(
            and(
              or(eq(billingServiceCatalogue.tenantId, tenantId), dSql`${billingServiceCatalogue.tenantId} IS NULL`),
              eq(billingServiceCatalogue.serviceCode, item.serviceCode),
            ),
          )
          .limit(1);

        if (!existing) {
          await tx.insert(billingServiceCatalogue).values({
            tenantId,
            facilityId: targetFacilityId,
            serviceCode: item.serviceCode,
            serviceName: item.serviceName,
            category: item.category,
            department: item.department,
            basePrice: String(item.basePrice),
            taxRate: String(item.taxRate),
            taxCode: item.taxCode,
            clinicalCode: item.clinicalCode,
            clinicalCodingSystem: item.clinicalCodingSystem,
            shaCovered: item.shaCovered,
            shaStandardTariff: String(item.shaStandardTariff),
            preauthorizationRequired: item.preauthorizationRequired,
            isActive: true,
          });
          seeded++;
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        action: 'BILLING_CATALOGUE_SEEDED',
        resource: 'billing_service_catalogue',
        details: { seededCount: seeded },
      });

      return {
        message: `Standard Kenyan billing catalogue successfully seeded (${seeded} tariffs created).`,
        seededCount: seeded,
      };
    });
  }

  async getBillingServices(
    tenantId: string,
    filter?: { category?: BillingCategory; department?: string; search?: string; isActive?: boolean },
  ) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [
        or(eq(billingServiceCatalogue.tenantId, tenantId), dSql`${billingServiceCatalogue.tenantId} IS NULL`),
      ];

      if (filter?.category) {
        conditions.push(eq(billingServiceCatalogue.category, filter.category));
      }
      if (filter?.department) {
        conditions.push(eq(billingServiceCatalogue.department, filter.department));
      }
      if (filter?.isActive !== undefined) {
        conditions.push(eq(billingServiceCatalogue.isActive, filter.isActive));
      }
      if (filter?.search) {
        const searchPattern = `%${filter.search}%`;
        conditions.push(
          or(
            dSql`${billingServiceCatalogue.serviceName} ILIKE ${searchPattern}`,
            dSql`${billingServiceCatalogue.serviceCode} ILIKE ${searchPattern}`,
          )!,
        );
      }

      return await tx
        .select()
        .from(billingServiceCatalogue)
        .where(and(...conditions))
        .orderBy(asc(billingServiceCatalogue.serviceCode));
    });
  }

  async createBillingService(tenantId: string, dto: CreateBillingServiceDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const facilityId = await this.getFirstFacilityId(tenantId);

      const [existing] = await tx
        .select({ id: billingServiceCatalogue.id })
        .from(billingServiceCatalogue)
        .where(
          and(
            eq(billingServiceCatalogue.tenantId, tenantId),
            eq(billingServiceCatalogue.serviceCode, dto.serviceCode),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException(`Service with code ${dto.serviceCode} already exists for this hospital.`);
      }

      const [created] = await tx
        .insert(billingServiceCatalogue)
        .values({
          tenantId,
          facilityId,
          serviceCode: dto.serviceCode,
          serviceName: dto.serviceName,
          category: dto.category,
          department: dto.department,
          basePrice: String(roundCurrency(dto.basePrice)),
          taxRate: String(dto.taxRate ?? 0),
          taxCode: dto.taxCode ?? TaxCode.E,
          clinicalCode: dto.clinicalCode,
          clinicalCodingSystem: dto.clinicalCodingSystem,
          shaCovered: dto.shaCovered ?? false,
          shaStandardTariff: String(roundCurrency(dto.shaStandardTariff ?? 0)),
          preauthorizationRequired: dto.preauthorizationRequired ?? false,
          isActive: true,
        })
        .returning();

      if (!created) {
        throw new BadRequestException('Failed to create billing service');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'BILLING_SERVICE_CREATED',
        resource: 'billing_service_catalogue',
        resourceId: created.id,
        details: { serviceCode: created.serviceCode, basePrice: created.basePrice },
      });

      return created;
    });
  }

  async updateBillingService(tenantId: string, id: string, dto: UpdateBillingServiceDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(billingServiceCatalogue)
        .where(and(eq(billingServiceCatalogue.tenantId, tenantId), eq(billingServiceCatalogue.id, id)))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Billing service ${id} not found.`);
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (dto.serviceName !== undefined) updateValues.serviceName = dto.serviceName;
      if (dto.basePrice !== undefined) updateValues.basePrice = String(roundCurrency(dto.basePrice));
      if (dto.taxCode !== undefined) updateValues.taxCode = dto.taxCode;
      if (dto.taxRate !== undefined) updateValues.taxRate = String(dto.taxRate);
      if (dto.shaCovered !== undefined) updateValues.shaCovered = dto.shaCovered;
      if (dto.shaStandardTariff !== undefined) updateValues.shaStandardTariff = String(roundCurrency(dto.shaStandardTariff));
      if (dto.isActive !== undefined) updateValues.isActive = dto.isActive;

      const [updated] = await tx
        .update(billingServiceCatalogue)
        .set(updateValues)
        .where(eq(billingServiceCatalogue.id, id))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'BILLING_SERVICE_UPDATED',
        resource: 'billing_service_catalogue',
        resourceId: id,
        details: updateValues,
      });

      return updated;
    });
  }

  // ==========================================
  // 2. INVOICE CREATION & CLINICAL INTEGRATION
  // ==========================================

  private generateSequenceNumber(prefix: string): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomHex = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${yearMonth}-${randomHex}`;
  }

  async createInvoice(tenantId: string, facilityId: string, dto: CreateInvoiceDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // Validate patient
      const [pat] = await tx
        .select({ id: patients.id, mrn: patients.mrn })
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!pat) {
        throw new NotFoundException(`Patient ${dto.patientId} not found.`);
      }

      if (dto.encounterId) {
        const [enc] = await tx
          .select({ id: encounters.id })
          .from(encounters)
          .where(and(eq(encounters.tenantId, tenantId), eq(encounters.id, dto.encounterId)))
          .limit(1);
        if (!enc) {
          throw new NotFoundException(`Encounter ${dto.encounterId} not found.`);
        }
      }

      const invoiceNumber = this.generateSequenceNumber('INV');

      // Process line items & calculations
      const calculatedLines = dto.lineItems.map((item) => {
        const lineCalc = calculateLineItemTotals({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
          taxCode: item.taxCode,
          shaCoverageAmount: dto.payerType === PayerType.SHA_REIMBURSEMENT ? item.unitPrice * item.quantity : item.shaCoverageAmount,
        });

        return {
          ...item,
          ...lineCalc,
        };
      });

      const totals = calculateInvoiceTotals(calculatedLines, 0);

      const [invoice] = await tx
        .insert(invoices)
        .values({
          tenantId,
          facilityId,
          patientId: dto.patientId,
          encounterId: dto.encounterId,
          invoiceNumber,
          invoiceType: InvoiceType.ORIGINAL,
          status: InvoiceStatus.DRAFT,
          payerType: dto.payerType || PayerType.OUT_OF_POCKET,
          shaFundType: dto.shaFundType,
          shaClaimReference: dto.shaClaimReference,
          currency: 'KES',
          subtotalAmount: String(totals.subtotalAmount),
          discountAmount: String(totals.discountAmount),
          taxAmount: String(totals.taxAmount),
          totalAmount: String(totals.totalAmount),
          shaPortionAmount: String(totals.shaPortionAmount),
          patientPortionAmount: String(totals.patientPortionAmount),
          paidAmount: '0.00',
          balanceDue: String(totals.balanceDue),
          isSimulated: dto.isSimulated ?? false,
          etimsStatus: EtimsStatus.PENDING,
          notes: dto.notes,
        })
        .returning();

      if (!invoice) {
        throw new BadRequestException('Failed to create invoice');
      }

      // Insert line items
      const insertedLines = [];
      for (const line of calculatedLines) {
        const [inserted] = await tx
          .insert(invoiceLineItems)
          .values({
            tenantId,
            invoiceId: invoice.id,
            billingServiceId: line.billingServiceId,
            sourceType: line.sourceType || 'MANUAL',
            sourceReferenceId: line.sourceReferenceId,
            itemCode: line.itemCode,
            itemDescription: line.itemDescription,
            category: line.category,
            quantity: String(line.quantity),
            unitPrice: String(line.unitPrice),
            grossAmount: String(line.grossAmount),
            discountAmount: String(line.discountAmount),
            taxRate: String(line.taxRate),
            taxCode: line.taxCode,
            taxAmount: String(line.taxAmount),
            netAmount: String(line.netAmount),
            shaCoverageAmount: String(line.shaCoverageAmount),
            patientPayableAmount: String(line.patientPayableAmount),
            notes: line.notes,
          })
          .returning();
        if (inserted) {
          insertedLines.push(inserted);
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.INVOICE_CREATED,
        resource: 'invoices',
        resourceId: invoice.id,
        details: {
          invoiceNumber,
          patientId: dto.patientId,
          totalAmount: totals.totalAmount,
          patientPortionAmount: totals.patientPortionAmount,
          lineItemCount: insertedLines.length,
          isSimulated: invoice.isSimulated,
        },
      });

      return {
        ...invoice,
        lineItems: insertedLines,
      };
    });
  }

  /**
   * Auto-generates an invoice by aggregating encounter consultation, executed lab tests,
   * and dispensed pharmacy medications into unified, itemized lines.
   */
  async createInvoiceFromEncounter(
    tenantId: string,
    facilityId: string,
    dto: CreateInvoiceFromEncounterDto,
    userId: string,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Fetch Encounter
      const [enc] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, tenantId), eq(encounters.id, dto.encounterId)))
        .limit(1);

      if (!enc) {
        throw new NotFoundException(`Encounter ${dto.encounterId} not found.`);
      }

      // Check if an invoice already exists for this encounter
      const [existingInvoice] = await tx
        .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.encounterId, dto.encounterId)))
        .limit(1);

      if (existingInvoice) {
        return await this.getInvoiceById(tenantId, existingInvoice.id);
      }

      const lineItems: InvoiceLineItemInputDto[] = [];

      // 2. Add Outpatient Consultation fee based on service department
      lineItems.push({
        itemCode: 'SRV-CONS-001',
        itemDescription: `Clinical Consultation (${enc.serviceDepartment} - ${enc.encounterType})`,
        category: BillingCategory.CONSULTATION,
        sourceType: 'ENCOUNTER_CONSULTATION',
        sourceReferenceId: enc.id,
        quantity: 1,
        unitPrice: enc.serviceDepartment === 'CASUALTY' ? 4500 : 1500,
        discountAmount: 0,
        taxCode: TaxCode.E,
        taxRate: 0,
        shaCoverageAmount: dto.payerType === PayerType.SHA_REIMBURSEMENT ? (enc.serviceDepartment === 'CASUALTY' ? 4500 : 1200) : 0,
      });

      // 3. Find Laboratory Orders & Executions for this encounter
      const labOrders = await tx
        .select()
        .from(clinicalOrders)
        .where(
          and(
            eq(clinicalOrders.tenantId, tenantId),
            eq(clinicalOrders.encounterId, enc.id),
            or(
              eq(clinicalOrders.orderType, 'LABORATORY'),
              eq(clinicalOrders.orderType, 'LAB_SERVICE_REQUEST'),
            ),
          ),
        );

      for (const lo of labOrders) {
        const sReqs = await tx
          .select()
          .from(serviceRequests)
          .where(and(eq(serviceRequests.tenantId, tenantId), eq(serviceRequests.orderId, lo.id)));

        for (const req of sReqs) {
          // Check standard tariff for lab test
          const [tariff] = await tx
            .select()
            .from(billingServiceCatalogue)
            .where(
              and(
                or(eq(billingServiceCatalogue.tenantId, tenantId), dSql`${billingServiceCatalogue.tenantId} IS NULL`),
                eq(billingServiceCatalogue.clinicalCode, req.serviceCode),
              ),
            )
            .limit(1);

          const unitPrice = tariff ? Number(tariff.basePrice) : 800;
          const shaCovered = tariff ? Number(tariff.shaStandardTariff) : 650;

          lineItems.push({
            itemCode: req.serviceCode,
            itemDescription: `Laboratory: ${req.serviceName}`,
            category: BillingCategory.LABORATORY,
            sourceType: 'LABORATORY_ORDER',
            sourceReferenceId: lo.id,
            quantity: 1,
            unitPrice,
            discountAmount: 0,
            taxCode: TaxCode.E,
            taxRate: 0,
            shaCoverageAmount: dto.payerType === PayerType.SHA_REIMBURSEMENT ? shaCovered : 0,
          });
        }
      }

      // 4. Find Pharmacy Dispenses for this encounter
      const dispenses = await tx
        .select()
        .from(medicationDispenses)
        .where(
          and(
            eq(medicationDispenses.tenantId, tenantId),
            eq(medicationDispenses.encounterId, enc.id),
          ),
        );

      for (const disp of dispenses) {
        const dispItems = await tx
          .select()
          .from(medicationDispenseItems)
          .where(
            and(
              eq(medicationDispenseItems.tenantId, tenantId),
              eq(medicationDispenseItems.dispenseId, disp.id),
            ),
          );

        for (const item of dispItems) {
          const [product] = await tx
            .select()
            .from(pharmacyProducts)
            .where(eq(pharmacyProducts.id, item.productId))
            .limit(1);

          lineItems.push({
            itemCode: product?.itemCode || 'MED-DISP',
            itemDescription: `Pharmacy: ${product?.genericName || 'Prescription Medication'} (${item.quantityDispensed} ${product?.dispensingUnit || 'units'})`,
            category: BillingCategory.PHARMACY,
            sourceType: 'PHARMACY_DISPENSE',
            sourceReferenceId: disp.id,
            quantity: item.quantityDispensed,
            unitPrice: Number(item.unitPrice),
            discountAmount: 0,
            taxCode: TaxCode.E,
            taxRate: 0,
            shaCoverageAmount: dto.payerType === PayerType.SHA_REIMBURSEMENT ? Number(item.totalPrice) : 0,
          });
        }

        if (dispItems.length === 0) {
          lineItems.push({
            itemCode: 'MED-DISP-001',
            itemDescription: `Pharmacy: Prescription Dispense (${disp.dispenseNumber})`,
            category: BillingCategory.PHARMACY,
            sourceType: 'PHARMACY_DISPENSE',
            sourceReferenceId: disp.id,
            quantity: disp.quantityDispensed || 1,
            unitPrice: 450,
            discountAmount: 0,
            taxCode: TaxCode.E,
            taxRate: 0,
            shaCoverageAmount: dto.payerType === PayerType.SHA_REIMBURSEMENT ? 400 : 0,
          });
        }
      }

      // 5. Create invoice
      return await this.createInvoice(
        tenantId,
        facilityId,
        {
          patientId: enc.patientId,
          encounterId: enc.id,
          payerType: dto.payerType,
          isSimulated: dto.isSimulated,
          notes: dto.notes || `Aggregated bill for encounter ${enc.encounterNumber}`,
          lineItems,
        },
        userId,
      );
    });
  }

  async getInvoiceById(tenantId: string, invoiceId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      const lines = await tx
        .select()
        .from(invoiceLineItems)
        .where(and(eq(invoiceLineItems.tenantId, tenantId), eq(invoiceLineItems.invoiceId, invoiceId)))
        .orderBy(asc(invoiceLineItems.createdAt));

      const adjustments = await tx
        .select()
        .from(invoiceAdjustments)
        .where(and(eq(invoiceAdjustments.tenantId, tenantId), eq(invoiceAdjustments.invoiceId, invoiceId)))
        .orderBy(desc(invoiceAdjustments.createdAt));

      const allocations = await tx
        .select({
          id: paymentAllocations.id,
          paymentId: paymentAllocations.paymentId,
          amountAllocated: paymentAllocations.amountAllocated,
          createdAt: paymentAllocations.createdAt,
          paymentNumber: payments.paymentNumber,
          receiptNumber: payments.receiptNumber,
          paymentMethod: payments.paymentMethod,
          paymentStatus: payments.status,
          receivedAt: payments.receivedAt,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.invoiceId, invoiceId)));

      return {
        ...invoice,
        lineItems: lines,
        adjustments,
        allocations,
      };
    });
  }

  async getInvoices(tenantId: string, filter?: QueryInvoiceFilterDto) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(invoices.tenantId, tenantId)];

      if (filter?.patientId) conditions.push(eq(invoices.patientId, filter.patientId));
      if (filter?.encounterId) conditions.push(eq(invoices.encounterId, filter.encounterId));
      if (filter?.status) conditions.push(eq(invoices.status, filter.status));
      if (filter?.search) {
        conditions.push(dSql`${invoices.invoiceNumber} ILIKE ${`%${filter.search}%`}`);
      }

      return await tx
        .select()
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt))
        .limit(filter?.limit || 50)
        .offset(filter?.offset || 0);
    });
  }

  async addLineItem(tenantId: string, invoiceId: string, dto: AddInvoiceLineItemDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      // Check immutability: Cannot silently edit finalized or paid invoices
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot add line items to invoice ${invoice.invoiceNumber} because status is ${invoice.status}. Financial records are immutable.`,
        );
      }

      const lineCalc = calculateLineItemTotals({
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        discountAmount: dto.discountAmount,
        taxRate: dto.taxRate,
        taxCode: dto.taxCode,
        shaCoverageAmount: dto.shaCoverageAmount,
      });

      const [line] = await tx
        .insert(invoiceLineItems)
        .values({
          tenantId,
          invoiceId,
          billingServiceId: dto.billingServiceId,
          sourceType: dto.sourceType || 'MANUAL',
          sourceReferenceId: dto.sourceReferenceId,
          itemCode: dto.itemCode,
          itemDescription: dto.itemDescription,
          category: dto.category,
          quantity: String(dto.quantity),
          unitPrice: String(dto.unitPrice),
          grossAmount: String(lineCalc.grossAmount),
          discountAmount: String(lineCalc.discountAmount),
          taxRate: String(dto.taxRate ?? 0),
          taxCode: dto.taxCode ?? TaxCode.E,
          taxAmount: String(lineCalc.taxAmount),
          netAmount: String(lineCalc.netAmount),
          shaCoverageAmount: String(lineCalc.shaCoverageAmount),
          patientPayableAmount: String(lineCalc.patientPayableAmount),
          notes: dto.notes,
        })
        .returning();

      if (!line) {
        throw new BadRequestException('Failed to add line item');
      }

      // Recalculate invoice totals
      await this.recalculateInvoiceTotals(tx, tenantId, invoiceId);

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'INVOICE_LINE_ITEM_ADDED',
        resource: 'invoices',
        resourceId: invoiceId,
        details: { itemCode: line.itemCode, netAmount: line.netAmount },
      });

      return line;
    });
  }

  async removeLineItem(tenantId: string, invoiceId: string, lineItemId: string, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      // Check immutability
      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot remove line items from invoice ${invoice.invoiceNumber} because status is ${invoice.status}. Use controlled adjustments or credit notes instead.`,
        );
      }

      await tx
        .delete(invoiceLineItems)
        .where(and(eq(invoiceLineItems.tenantId, tenantId), eq(invoiceLineItems.id, lineItemId)));

      await this.recalculateInvoiceTotals(tx, tenantId, invoiceId);

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'INVOICE_LINE_ITEM_REMOVED',
        resource: 'invoices',
        resourceId: invoiceId,
        details: { lineItemId },
      });

      return { message: 'Line item successfully removed and totals recalculated.' };
    });
  }

  private async recalculateInvoiceTotals(tx: any, tenantId: string, invoiceId: string) {
    const lines = await tx
      .select()
      .from(invoiceLineItems)
      .where(and(eq(invoiceLineItems.tenantId, tenantId), eq(invoiceLineItems.invoiceId, invoiceId)));

    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
      .limit(1);

    const calculatedLines = lines.map((l: any) => ({
      grossAmount: Number(l.grossAmount),
      discountAmount: Number(l.discountAmount),
      taxAmount: Number(l.taxAmount),
      netAmount: Number(l.netAmount),
      shaCoverageAmount: Number(l.shaCoverageAmount),
      patientPayableAmount: Number(l.patientPayableAmount),
    }));

    const totals = calculateInvoiceTotals(calculatedLines, Number(invoice.paidAmount));

    await tx
      .update(invoices)
      .set({
        subtotalAmount: String(totals.subtotalAmount),
        discountAmount: String(totals.discountAmount),
        taxAmount: String(totals.taxAmount),
        totalAmount: String(totals.totalAmount),
        shaPortionAmount: String(totals.shaPortionAmount),
        patientPortionAmount: String(totals.patientPortionAmount),
        balanceDue: String(totals.balanceDue),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));
  }

  // ==========================================
  // 3. FINALIZATION, ETIMS SIGNING & CANCELLATION
  // ==========================================

  async finalizeInvoice(tenantId: string, invoiceId: string, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is already finalized or closed (status: ${invoice.status}).`);
      }

      const lines = await tx
        .select()
        .from(invoiceLineItems)
        .where(and(eq(invoiceLineItems.tenantId, tenantId), eq(invoiceLineItems.invoiceId, invoiceId)));

      if (lines.length === 0) {
        throw new BadRequestException(`Cannot finalize invoice ${invoice.invoiceNumber} with zero line items.`);
      }

      // KRA eTIMS signing
      const etimsPayload = {
        invoiceNumber: invoice.invoiceNumber,
        currency: invoice.currency,
        totalAmount: Number(invoice.totalAmount),
        taxAmount: Number(invoice.taxAmount),
        lineCount: lines.length,
        lines: lines.map((l) => ({
          itemCode: l.itemCode,
          description: l.itemDescription,
          taxCode: l.taxCode,
          netAmount: Number(l.netAmount),
        })),
      };

      const etimsResult = await this.integrationClients.kraEtims.signInvoice(etimsPayload);
      let etimsStatus = EtimsStatus.SIGNED;
      let etimsControlCode = `KRA-ETIMS-${Date.now()}`;
      let etimsQrCode = `https://etims.kra.go.ke/verify?inv=${invoice.invoiceNumber}`;

      if (etimsResult.isSuccess()) {
        const val = etimsResult.getValue();
        etimsControlCode = val.controlCode;
        etimsQrCode = val.qrCodeUrl;
        etimsStatus = val.status === 'BUFFERED' ? EtimsStatus.BUFFERED : EtimsStatus.SIGNED;
      }

      const [updated] = await tx
        .update(invoices)
        .set({
          status: InvoiceStatus.FINALIZED,
          etimsStatus,
          etimsControlCode,
          etimsQrCode,
          etimsSignedAt: new Date(),
          finalizedAt: new Date(),
          finalizedById: userId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to finalize invoice');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.INVOICE_FINALIZED,
        resource: 'invoices',
        resourceId: invoiceId,
        details: {
          invoiceNumber: updated.invoiceNumber,
          totalAmount: updated.totalAmount,
          patientPortionAmount: updated.patientPortionAmount,
          etimsControlCode,
          etimsStatus,
        },
      });

      return updated;
    });
  }

  async cancelInvoice(tenantId: string, invoiceId: string, dto: CancelInvoiceDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException(`Invoice ${invoice.invoiceNumber} is already cancelled.`);
      }

      if (Number(invoice.paidAmount) > 0) {
        throw new BadRequestException(
          `Cannot cancel invoice ${invoice.invoiceNumber} with active payments (paid: KES ${invoice.paidAmount}). Process a payment refund/reversal first.`,
        );
      }

      let creditNoteInvoiceId: string | undefined;

      // If already finalized and signed with eTIMS, issue statutory Credit Note
      if (invoice.status === InvoiceStatus.FINALIZED && invoice.etimsControlCode) {
        const creditNoteNumber = this.generateSequenceNumber('CRN');
        const [creditNote] = await tx
          .insert(invoices)
          .values({
            tenantId,
            facilityId: invoice.facilityId,
            patientId: invoice.patientId,
            encounterId: invoice.encounterId,
            invoiceNumber: creditNoteNumber,
            invoiceType: InvoiceType.CREDIT_NOTE,
            status: InvoiceStatus.FINALIZED,
            payerType: invoice.payerType,
            currency: 'KES',
            subtotalAmount: `-${invoice.subtotalAmount}`,
            discountAmount: '0.00',
            taxAmount: `-${invoice.taxAmount}`,
            totalAmount: `-${invoice.totalAmount}`,
            shaPortionAmount: `-${invoice.shaPortionAmount}`,
            patientPortionAmount: `-${invoice.patientPortionAmount}`,
            paidAmount: '0.00',
            balanceDue: '0.00',
            etimsStatus: EtimsStatus.SIGNED,
            etimsControlCode: `KRA-CRN-${Date.now()}`,
            etimsQrCode: `https://etims.kra.go.ke/verify?crn=${creditNoteNumber}`,
            etimsSignedAt: new Date(),
            finalizedAt: new Date(),
            finalizedById: userId,
            notes: `Credit Note reversing invoice ${invoice.invoiceNumber}: ${dto.reason}`,
          })
          .returning();

        if (!creditNote) {
          throw new BadRequestException('Failed to create credit note');
        }

        creditNoteInvoiceId = creditNote.id;

        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.ETIMS_CREDIT_NOTE_ISSUED,
          resource: 'invoices',
          resourceId: creditNote.id,
          details: { creditNoteNumber, reversedInvoiceNumber: invoice.invoiceNumber },
        });
      }

      const [cancelled] = await tx
        .update(invoices)
        .set({
          status: InvoiceStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: userId,
          cancellationReason: dto.reason,
          creditNoteInvoiceId,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.INVOICE_CANCELLED,
        resource: 'invoices',
        resourceId: invoiceId,
        details: { invoiceNumber: invoice.invoiceNumber, reason: dto.reason, creditNoteInvoiceId },
      });

      return cancelled;
    });
  }

  // ==========================================
  // 4. DISCOUNTS & ADJUSTMENTS (SEGREGATION OF DUTIES)
  // ==========================================

  async requestAdjustment(tenantId: string, facilityId: string, invoiceId: string, dto: RequestAdjustmentDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${invoiceId} not found.`);
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException(`Cannot adjust cancelled invoice ${invoice.invoiceNumber}.`);
      }

      const reqAmount = roundCurrency(dto.amount);
      const invoiceTotal = Number(invoice.totalAmount);

      if (reqAmount > Number(invoice.balanceDue)) {
        throw new BadRequestException(`Adjustment amount (KES ${reqAmount}) cannot exceed invoice balance due (KES ${invoice.balanceDue}).`);
      }

      // Check segregation of duties threshold
      const threshold = checkDiscountRequiresApproval(reqAmount, invoiceTotal);
      const autoApprove = !threshold.requiresApproval;

      const [adj] = await tx
        .insert(invoiceAdjustments)
        .values({
          tenantId,
          facilityId,
          invoiceId,
          lineItemId: dto.lineItemId,
          adjustmentType: dto.adjustmentType,
          requestedAmount: String(reqAmount),
          approvedAmount: autoApprove ? String(reqAmount) : null,
          reason: dto.reason,
          status: autoApprove ? AdjustmentStatus.APPROVED : AdjustmentStatus.PENDING_APPROVAL,
          requestedById: userId,
          requestedAt: new Date(),
          reviewedById: autoApprove ? userId : null,
          reviewedAt: autoApprove ? new Date() : null,
          reviewNotes: autoApprove ? 'Auto-approved within cashier threshold limit' : null,
        })
        .returning();

      if (!adj) {
        throw new BadRequestException('Failed to create adjustment record');
      }

      if (autoApprove) {
        // Apply adjustment directly
        const newDiscount = roundCurrency(Number(invoice.discountAmount) + reqAmount);
        const newPatientPortion = roundCurrency(Math.max(0, Number(invoice.patientPortionAmount) - reqAmount));
        const newBalance = roundCurrency(Math.max(0, Number(invoice.balanceDue) - reqAmount));

        await tx
          .update(invoices)
          .set({
            discountAmount: String(newDiscount),
            patientPortionAmount: String(newPatientPortion),
            balanceDue: String(newBalance),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, invoiceId));

        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.INVOICE_ADJUSTMENT_APPROVED,
          resource: 'invoice_adjustments',
          resourceId: adj.id,
          details: { invoiceId, requestedAmount: reqAmount, autoApproved: true },
        });
      } else {
        await this.auditService.recordEvent({
          tenantId,
          userId,
          action: AuditEventType.INVOICE_ADJUSTMENT_REQUESTED,
          resource: 'invoice_adjustments',
          resourceId: adj.id,
          details: { invoiceId, requestedAmount: reqAmount, reason: dto.reason },
        });
      }

      return adj;
    });
  }

  async reviewAdjustment(tenantId: string, adjustmentId: string, dto: ReviewAdjustmentDto, reviewerId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [adj] = await tx
        .select()
        .from(invoiceAdjustments)
        .where(and(eq(invoiceAdjustments.tenantId, tenantId), eq(invoiceAdjustments.id, adjustmentId)))
        .limit(1);

      if (!adj) {
        throw new NotFoundException(`Adjustment ${adjustmentId} not found.`);
      }

      if (adj.status !== AdjustmentStatus.PENDING_APPROVAL) {
        throw new BadRequestException(`Adjustment ${adjustmentId} is already decided (${adj.status}).`);
      }

      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, adj.invoiceId)))
        .limit(1);

      if (!invoice) {
        throw new NotFoundException(`Invoice ${adj.invoiceId} not found.`);
      }

      if (dto.status === AdjustmentStatus.APPROVED) {
        const adjAmount = Number(adj.requestedAmount);
        const newDiscount = roundCurrency(Number(invoice.discountAmount) + adjAmount);
        const newPatientPortion = roundCurrency(Math.max(0, Number(invoice.patientPortionAmount) - adjAmount));
        const newBalance = roundCurrency(Math.max(0, Number(invoice.balanceDue) - adjAmount));

        await tx
          .update(invoices)
          .set({
            discountAmount: String(newDiscount),
            patientPortionAmount: String(newPatientPortion),
            balanceDue: String(newBalance),
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, adj.invoiceId));
      }

      const [updated] = await tx
        .update(invoiceAdjustments)
        .set({
          status: dto.status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewNotes: dto.reviewNotes,
          updatedAt: new Date(),
        })
        .where(eq(invoiceAdjustments.id, adjustmentId))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId: reviewerId,
        action:
          dto.status === AdjustmentStatus.APPROVED
            ? AuditEventType.INVOICE_ADJUSTMENT_APPROVED
            : AuditEventType.INVOICE_ADJUSTMENT_REJECTED,
        resource: 'invoice_adjustments',
        resourceId: adjustmentId,
        details: { status: dto.status, reviewNotes: dto.reviewNotes },
      });

      return updated;
    });
  }

  // ==========================================
  // 5. PAYMENTS, ALLOCATIONS & IDEMPOTENCY
  // ==========================================

  async processPayment(tenantId: string, facilityId: string, dto: ProcessPaymentDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Idempotency Check
      if (dto.idempotencyKey) {
        const [existingPayment] = await tx
          .select()
          .from(payments)
          .where(and(eq(payments.tenantId, tenantId), eq(payments.idempotencyKey, dto.idempotencyKey)))
          .limit(1);

        if (existingPayment) {
          // Return existing payment idempotently
          const allocs = await tx
            .select()
            .from(paymentAllocations)
            .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.paymentId, existingPayment.id)));

          return {
            ...existingPayment,
            allocations: allocs,
            isDuplicateReplay: true,
          };
        }
      }

      const totalPaymentAmount = roundCurrency(dto.amount);
      const allocatedSum = roundCurrency(
        dto.allocations.reduce((acc, curr) => acc + Number(curr.amountAllocated), 0),
      );

      if (allocatedSum !== totalPaymentAmount) {
        throw new BadRequestException(
          `Allocated sum (KES ${allocatedSum}) does not equal total payment amount (KES ${totalPaymentAmount}).`,
        );
      }

      // 2. Concurrency Lock & Validation on each invoice
      const invoiceUpdates = [];
      for (const alloc of dto.allocations) {
        // Acquire row lock FOR UPDATE
        const [inv] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, alloc.invoiceId)))
          .for('update');

        if (!inv) {
          throw new NotFoundException(`Invoice ${alloc.invoiceId} not found.`);
        }

        if (inv.status === InvoiceStatus.DRAFT) {
          throw new BadRequestException(`Cannot process payment for invoice ${inv.invoiceNumber} in DRAFT status. Finalize invoice first.`);
        }

        if (inv.status === InvoiceStatus.CANCELLED) {
          throw new BadRequestException(`Cannot pay cancelled invoice ${inv.invoiceNumber}.`);
        }

        const allocAmount = roundCurrency(alloc.amountAllocated);
        const currentBalance = roundCurrency(Number(inv.balanceDue));

        if (allocAmount > currentBalance) {
          throw new BadRequestException(
            `Allocated payment KES ${allocAmount} exceeds outstanding balance KES ${currentBalance} on invoice ${inv.invoiceNumber}.`,
          );
        }

        const newPaid = roundCurrency(Number(inv.paidAmount) + allocAmount);
        const newBalance = roundCurrency(Math.max(0, currentBalance - allocAmount));
        const newStatus = newBalance === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;

        invoiceUpdates.push({
          invoiceId: inv.id,
          newPaid,
          newBalance,
          newStatus,
          invoiceNumber: inv.invoiceNumber,
        });
      }

      // 3. M-Pesa Adapter Handling
      let isSimulated = dto.isSimulated ?? false;
      let paymentReference = dto.paymentReference || null;

      if (dto.paymentMethod === PaymentMethod.MPESA && !paymentReference) {
        paymentReference = `QAA${Math.floor(1000000 + Math.random() * 9000000)}`;
        isSimulated = true;
      }

      const paymentNumber = this.generateSequenceNumber('PAY');
      const receiptNumber = this.generateSequenceNumber('RCT');

      // 4. Insert Payment record
      const [payment] = await tx
        .insert(payments)
        .values({
          tenantId,
          facilityId,
          patientId: dto.patientId,
          paymentNumber,
          receiptNumber,
          paymentMethod: dto.paymentMethod,
          amount: String(totalPaymentAmount),
          currency: 'KES',
          status: PaymentStatus.COMPLETED,
          paymentReference: paymentReference || undefined,
          idempotencyKey: dto.idempotencyKey || `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          isSimulated,
          receivedById: userId,
          receivedAt: new Date(),
          notes: dto.notes || null,
        })
        .returning();

      if (!payment) {
        throw new BadRequestException('Failed to record payment');
      }

      // 5. Insert allocations and update invoices
      const insertedAllocations = [];
      for (const alloc of dto.allocations) {
        const [insertedAlloc] = await tx
          .insert(paymentAllocations)
          .values({
            tenantId,
            paymentId: payment.id,
            invoiceId: alloc.invoiceId,
            amountAllocated: String(roundCurrency(alloc.amountAllocated)),
          })
          .returning();
        if (insertedAlloc) {
          insertedAllocations.push(insertedAlloc);
        }
      }

      for (const upd of invoiceUpdates) {
        await tx
          .update(invoices)
          .set({
            paidAmount: String(upd.newPaid),
            balanceDue: String(upd.newBalance),
            status: upd.newStatus,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, upd.invoiceId));
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.PAYMENT_RECEIVED,
        resource: 'payments',
        resourceId: payment.id,
        details: {
          paymentNumber,
          receiptNumber,
          amount: totalPaymentAmount,
          paymentMethod: dto.paymentMethod,
          isSimulated,
          allocatedInvoices: invoiceUpdates.map((u) => u.invoiceNumber),
        },
      });

      return {
        ...payment,
        allocations: insertedAllocations,
        isDuplicateReplay: false,
      };
    });
  }

  async getPayments(tenantId: string, filter?: QueryPaymentFilterDto) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(payments.tenantId, tenantId)];

      if (filter?.patientId) {
        conditions.push(eq(payments.patientId, filter.patientId));
      }
      if (filter?.paymentMethod) {
        conditions.push(eq(payments.paymentMethod, filter.paymentMethod));
      }
      if (filter?.status) {
        conditions.push(eq(payments.status, filter.status));
      }

      return await tx
        .select()
        .from(payments)
        .where(and(...conditions))
        .orderBy(desc(payments.createdAt));
    });
  }

  async initiateMpesaStkPush(_tenantId: string, facilityId: string, dto: InitiateMpesaStkPushDto) {
    const res = await this.integrationClients.mpesa.initiateStkPush(
      {
        phoneNumber: dto.phoneNumber,
        amount: dto.amount,
        accountReference: dto.accountReference,
        transactionDesc: dto.transactionDesc || 'Afya Poa Medical Bill Payment',
      },
      facilityId,
    );

    if (res.isFailure()) {
      throw new BadRequestException(res.getError().message);
    }

    return res.getValue();
  }

  // ==========================================
  // 6. REFUNDS & REVERSALS (IMMUTABLE HISTORY)
  // ==========================================

  async reversePayment(tenantId: string, facilityId: string, paymentId: string, dto: ReversePaymentDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [payment] = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.id, paymentId)))
        .limit(1);

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found.`);
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new BadRequestException(`Payment ${payment.paymentNumber} cannot be reversed (current status: ${payment.status}).`);
      }

      const refundAmount = roundCurrency(dto.amount);
      const originalAmount = Number(payment.amount);

      if (refundAmount > originalAmount) {
        throw new BadRequestException(`Refund amount KES ${refundAmount} cannot exceed original payment KES ${originalAmount}.`);
      }

      // Find allocations for this payment
      const allocs = await tx
        .select()
        .from(paymentAllocations)
        .where(and(eq(paymentAllocations.tenantId, tenantId), eq(paymentAllocations.paymentId, paymentId)));

      const reversalNumber = this.generateSequenceNumber('REV');

      // Restore balance due on allocated invoice(s)
      for (const al of allocs) {
        const [inv] = await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, al.invoiceId)))
          .for('update');

        if (inv) {
          const restoredPaid = roundCurrency(Math.max(0, Number(inv.paidAmount) - refundAmount));
          const restoredBalance = roundCurrency(Number(inv.balanceDue) + refundAmount);
          const restoredStatus = restoredPaid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.FINALIZED;

          await tx
            .update(invoices)
            .set({
              paidAmount: String(restoredPaid),
              balanceDue: String(restoredBalance),
              status: restoredStatus,
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, inv.id));
        }
      }

      // Update payment status (immutable: we update status to REVERSED rather than deleting)
      const newStatus = refundAmount === originalAmount ? PaymentStatus.REVERSED : PaymentStatus.REFUNDED;

      await tx
        .update(payments)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      const [reversal] = await tx
        .insert(paymentReversals)
        .values({
          tenantId,
          facilityId,
          paymentId,
          reversalNumber,
          reversalType: dto.reversalType,
          amount: String(refundAmount),
          reason: dto.reason,
          status: 'APPROVED',
          requestedById: userId,
          authorizedById: userId,
          authorizedAt: new Date(),
          refundMethod: dto.refundMethod || 'CASH',
          refundReference: dto.refundReference,
        })
        .returning();

      if (!reversal) {
        throw new BadRequestException('Failed to create payment reversal');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.PAYMENT_REVERSED,
        resource: 'payment_reversals',
        resourceId: reversal.id,
        details: {
          reversalNumber,
          paymentNumber: payment.paymentNumber,
          amount: refundAmount,
          reason: dto.reason,
        },
      });

      return reversal;
    });
  }

  // ==========================================
  // 7. PATIENT STATEMENTS & OUTSTANDING BALANCES
  // ==========================================

  async getPatientStatement(tenantId: string, patientId: string, _query?: PatientStatementQueryDto) {
    return await withTenantContext(tenantId, async (tx) => {
      const [patient] = await tx
        .select({ id: patients.id, mrn: patients.mrn, firstName: patients.firstName, lastName: patients.lastName })
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient ${patientId} not found.`);
      }

      const invList = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.patientId, patientId)))
        .orderBy(asc(invoices.createdAt));

      const payList = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId), eq(payments.patientId, patientId)))
        .orderBy(asc(payments.receivedAt));

      let totalInvoiced = 0;
      let totalPatientPayable = 0;
      let totalShaCovered = 0;
      let totalPaid = 0;
      let totalDiscount = 0;

      for (const inv of invList) {
        if (inv.status !== InvoiceStatus.CANCELLED) {
          totalInvoiced += Number(inv.totalAmount);
          totalPatientPayable += Number(inv.patientPortionAmount);
          totalShaCovered += Number(inv.shaPortionAmount);
          totalDiscount += Number(inv.discountAmount);
        }
      }

      for (const pay of payList) {
        if (pay.status === PaymentStatus.COMPLETED) {
          totalPaid += Number(pay.amount);
        }
      }

      const netOutstandingBalance = roundCurrency(Math.max(0, totalPatientPayable - totalPaid));

      // Build chronological statement entries
      const entries: Array<{
        date: Date;
        type: 'INVOICE' | 'PAYMENT' | 'ADJUSTMENT';
        reference: string;
        description: string;
        debit: number;
        credit: number;
        balance: number;
        runningBalance: number;
      }> = [];

      let running = 0;

      for (const inv of invList) {
        if (inv.status !== InvoiceStatus.CANCELLED) {
          const debit = Number(inv.patientPortionAmount);
          running = roundCurrency(running + debit);
          entries.push({
            date: inv.createdAt,
            type: 'INVOICE',
            reference: inv.invoiceNumber,
            description: `Invoice ${inv.invoiceNumber} (${inv.payerType})`,
            debit,
            credit: 0,
            balance: running,
            runningBalance: running,
          });
        }
      }

      for (const pay of payList) {
        if (pay.status === PaymentStatus.COMPLETED) {
          const credit = Number(pay.amount);
          running = roundCurrency(running - credit);
          entries.push({
            date: pay.receivedAt,
            type: 'PAYMENT',
            reference: pay.receiptNumber,
            description: `Payment ${pay.receiptNumber} (${pay.paymentMethod})`,
            debit: 0,
            credit,
            balance: running,
            runningBalance: running,
          });
        }
      }

      entries.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          fullName: `${patient.firstName} ${patient.lastName}`,
        },
        summary: {
          totalInvoiced: roundCurrency(totalInvoiced),
          totalShaCovered: roundCurrency(totalShaCovered),
          totalDiscounts: roundCurrency(totalDiscount),
          totalPatientLiability: roundCurrency(totalPatientPayable),
          totalPaid: roundCurrency(totalPaid),
          netOutstandingBalance,
        },
        statementLedger: entries,
      };
    });
  }

  // ==========================================
  // 8. DAILY SHIFT RECONCILIATION & REPORTS
  // ==========================================

  async openShift(tenantId: string, facilityId: string, cashierId: string, dto: OpenShiftDto) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // Check if cashier already has an open shift
      const [existing] = await tx
        .select()
        .from(dailyReconciliations)
        .where(
          and(
            eq(dailyReconciliations.tenantId, tenantId),
            eq(dailyReconciliations.cashierId, cashierId),
            eq(dailyReconciliations.status, 'OPEN'),
          ),
        )
        .limit(1);

      if (existing) {
        return existing;
      }

      const shiftNumber = this.generateSequenceNumber('REC');
      const shiftDate = new Date().toISOString().slice(0, 10);

      const [shift] = await tx
        .insert(dailyReconciliations)
        .values({
          tenantId,
          facilityId,
          cashierId,
          shiftNumber,
          shiftDate,
          openedAt: new Date(),
          openingFloat: String(roundCurrency(dto.openingFloat)),
          status: 'OPEN',
        })
        .returning();

      if (!shift) {
        throw new BadRequestException('Failed to open shift');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: cashierId,
        action: AuditEventType.DAILY_RECONCILIATION_OPENED,
        resource: 'daily_reconciliations',
        resourceId: shift.id,
        details: { shiftNumber, openingFloat: dto.openingFloat },
      });

      return shift;
    });
  }

  async closeShift(tenantId: string, shiftId: string, dto: CloseShiftDto, cashierId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [shift] = await tx
        .select()
        .from(dailyReconciliations)
        .where(and(eq(dailyReconciliations.tenantId, tenantId), eq(dailyReconciliations.id, shiftId)))
        .limit(1);

      if (!shift) {
        throw new NotFoundException(`Shift reconciliation ${shiftId} not found.`);
      }

      if (shift.status !== 'OPEN') {
        throw new BadRequestException(`Shift ${shift.shiftNumber} is already closed (${shift.status}).`);
      }

      // Query completed payments received by this cashier since shift opened
      const cashierPayments = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.tenantId, tenantId),
            eq(payments.receivedById, cashierId),
            gte(payments.receivedAt, shift.openedAt),
            eq(payments.status, PaymentStatus.COMPLETED),
          ),
        );

      let totalCash = 0;
      let totalMpesa = 0;
      let totalCard = 0;
      let totalBank = 0;
      let totalOther = 0;

      for (const p of cashierPayments) {
        const amt = Number(p.amount);
        if (p.paymentMethod === PaymentMethod.CASH) totalCash += amt;
        else if (p.paymentMethod === PaymentMethod.MPESA) totalMpesa += amt;
        else if (p.paymentMethod === PaymentMethod.DEBIT_CARD || p.paymentMethod === PaymentMethod.CREDIT_CARD)
          totalCard += amt;
        else if (p.paymentMethod === PaymentMethod.BANK_TRANSFER) totalBank += amt;
        else totalOther += amt;
      }

      const totalCollections = totalCash + totalMpesa + totalCard + totalBank + totalOther;
      const openingFloat = Number(shift.openingFloat);
      const expectedCash = roundCurrency(openingFloat + totalCash);
      const countedCash = roundCurrency(dto.countedCash);
      const cashDiscrepancy = roundCurrency(countedCash - expectedCash);

      const status = cashDiscrepancy === 0 ? 'RECONCILED' : 'DISCREPANCY_FLAGGED';

      const [closed] = await tx
        .update(dailyReconciliations)
        .set({
          closedAt: new Date(),
          expectedCash: String(expectedCash),
          countedCash: String(countedCash),
          cashDiscrepancy: String(cashDiscrepancy),
          totalMpesa: String(roundCurrency(totalMpesa)),
          totalCard: String(roundCurrency(totalCard)),
          totalBank: String(roundCurrency(totalBank)),
          totalOther: String(roundCurrency(totalOther)),
          totalCollections: String(roundCurrency(totalCollections)),
          netCollections: String(roundCurrency(totalCollections)),
          status,
          cashierNotes: dto.cashierNotes,
          updatedAt: new Date(),
        })
        .where(eq(dailyReconciliations.id, shiftId))
        .returning();

      if (!closed) {
        throw new BadRequestException('Failed to close shift');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: cashierId,
        action: AuditEventType.DAILY_RECONCILIATION_CLOSED,
        resource: 'daily_reconciliations',
        resourceId: shiftId,
        details: {
          shiftNumber: closed.shiftNumber,
          expectedCash,
          countedCash,
          cashDiscrepancy,
          status,
        },
      });

      return closed;
    });
  }

  async supervisorSignoff(tenantId: string, shiftId: string, dto: SupervisorSignoffDto, supervisorId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const [shift] = await tx
        .select()
        .from(dailyReconciliations)
        .where(and(eq(dailyReconciliations.tenantId, tenantId), eq(dailyReconciliations.id, shiftId)))
        .limit(1);

      if (!shift) {
        throw new NotFoundException(`Shift reconciliation ${shiftId} not found.`);
      }

      const [signed] = await tx
        .update(dailyReconciliations)
        .set({
          status: 'RECONCILED',
          supervisorId,
          supervisorNotes: dto.supervisorNotes,
          updatedAt: new Date(),
        })
        .where(eq(dailyReconciliations.id, shiftId))
        .returning();

      if (!signed) {
        throw new BadRequestException('Failed to sign off shift');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: supervisorId,
        action: AuditEventType.DAILY_RECONCILIATION_SUPERVISOR_SIGNOFF,
        resource: 'daily_reconciliations',
        resourceId: shiftId,
        details: { shiftNumber: signed.shiftNumber, supervisorNotes: dto.supervisorNotes },
      });

      return signed;
    });
  }

  async getDailyReconciliations(tenantId: string, facilityId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(dailyReconciliations.tenantId, tenantId)];
      if (facilityId) conditions.push(eq(dailyReconciliations.facilityId, facilityId));

      return await tx
        .select()
        .from(dailyReconciliations)
        .where(and(...conditions))
        .orderBy(desc(dailyReconciliations.openedAt));
    });
  }

  async getFinancialReports(tenantId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const allInvoices = await tx
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId)));

      const allPayments = await tx
        .select()
        .from(payments)
        .where(and(eq(payments.tenantId, tenantId)));

      // Departmental revenue
      const lines = await tx
        .select({
          category: invoiceLineItems.category,
          netAmount: invoiceLineItems.netAmount,
        })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.tenantId, tenantId));

      const departmentRevenue: Record<string, number> = {};
      for (const l of lines) {
        departmentRevenue[l.category] = roundCurrency((departmentRevenue[l.category] || 0) + Number(l.netAmount));
      }

      // Collections by payment method
      const collectionsByMethod: Record<string, number> = {};
      for (const p of allPayments) {
        if (p.status === PaymentStatus.COMPLETED) {
          collectionsByMethod[p.paymentMethod] = roundCurrency(
            (collectionsByMethod[p.paymentMethod] || 0) + Number(p.amount),
          );
        }
      }

      // eTIMS compliance statistics
      let etimsSigned = 0;
      let etimsBuffered = 0;
      let etimsPending = 0;

      for (const inv of allInvoices) {
        if (inv.etimsStatus === EtimsStatus.SIGNED) etimsSigned++;
        else if (inv.etimsStatus === EtimsStatus.BUFFERED) etimsBuffered++;
        else etimsPending++;
      }

      // Debtor aging analysis
      const now = Date.now();
      let agingCurrent = 0;
      let aging30Days = 0;
      let aging60Days = 0;
      let aging90PlusDays = 0;

      for (const inv of allInvoices) {
        const bal = Number(inv.balanceDue);
        if (bal > 0 && inv.status !== InvoiceStatus.CANCELLED) {
          const ageDays = Math.floor((now - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          if (ageDays <= 30) agingCurrent += bal;
          else if (ageDays <= 60) aging30Days += bal;
          else if (ageDays <= 90) aging60Days += bal;
          else aging90PlusDays += bal;
        }
      }

      return {
        revenueByCategory: departmentRevenue,
        collectionsByMethod,
        debtorAging: {
          current_0_30_days: roundCurrency(agingCurrent),
          days_31_60: roundCurrency(aging30Days),
          days_61_90: roundCurrency(aging60Days),
          days_90_plus: roundCurrency(aging90PlusDays),
          totalOutstandingDebtors: roundCurrency(agingCurrent + aging30Days + aging60Days + aging90PlusDays),
        },
        etimsCompliance: {
          totalInvoices: allInvoices.length,
          etimsSigned,
          etimsBuffered,
          etimsPending,
        },
      };
    });
  }
}
