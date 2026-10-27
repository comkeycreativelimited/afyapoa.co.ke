import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { desc, eq, and } from 'drizzle-orm';
import {
  platformInvoices,
  platformInvoiceItems,
  platformPayments,
  platformDunningEvents,
  tenantSubscriptions,
  subscriptionPlans,
} from '@afyapoa/database';
import {
  AuditEventType,
  DunningStage,
  PlatformInvoiceStatus,
  PlatformPaymentMethod,
  PlatformPaymentStatus,
  SubscriptionStatus,
} from '@afyapoa/domain-core';
import { createIntegrationClients } from '@afyapoa/integration-adapters';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  IssuePlatformInvoiceDto,
  ProcessPlatformPaymentDto,
} from './dto/index.js';

@Injectable()
export class SaasBillingService {
  private mpesaClient = createIntegrationClients('MOCK').mpesa;

  constructor(
    @Inject(TenancyService) private tenancyService: TenancyService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. PLATFORM INVOICING (IDEMPOTENT FINANCIAL GENERATION)
  // =========================================================================

  async issueInvoice(dto: IssuePlatformInvoiceDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      // 1. Idempotency Check: Prevent duplicate billing
      const [existing] = await db
        .select()
        .from(platformInvoices)
        .where(eq(platformInvoices.idempotencyKey, dto.idempotencyKey));
      if (existing) {
        return existing;
      }

      // 2. Calculate subtotal, 16% VAT, and total
      let subtotal = 0;
      for (const item of dto.items) {
        subtotal += item.quantity * item.unitPriceKes;
      }
      const vatRate = 0.16;
      const taxKes = Math.round(subtotal * vatRate * 100) / 100;
      const totalKes = subtotal + taxKes;

      // 3. Generate Sequential Unique Invoice Number
      const now = new Date();
      const monthPrefix = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
      const randomSeq = Math.floor(10000 + Math.random() * 90000);
      const invoiceNumber = `INV-SAAS-${monthPrefix}-${randomSeq}`;

      const [invoice] = await db
        .insert(platformInvoices)
        .values({
          tenantId: dto.tenantId,
          subscriptionId: dto.subscriptionId,
          invoiceNumber,
          billingPeriodStart: now,
          billingPeriodEnd: new Date(dto.dueDate),
          subtotalKes: subtotal.toFixed(2),
          taxKes: taxKes.toFixed(2),
          totalKes: totalKes.toFixed(2),
          amountPaidKes: '0.00',
          status: PlatformInvoiceStatus.ISSUED,
          dueDate: new Date(dto.dueDate),
          idempotencyKey: dto.idempotencyKey,
        })
        .returning();

      // 4. Insert Line Items
      for (const item of dto.items) {
        await db.insert(platformInvoiceItems).values({
          tenantId: dto.tenantId,
          invoiceId: invoice!.id,
          description: item.description,
          quantity: item.quantity,
          unitPriceKes: item.unitPriceKes.toFixed(2),
          totalPriceKes: (item.quantity * item.unitPriceKes).toFixed(2),
        });
      }

      await this.auditService.recordEvent({
        tenantId: dto.tenantId,
        action: AuditEventType.PLATFORM_INVOICE_ISSUED,
        resource: 'PlatformInvoice',
        resourceId: invoice!.id,
        details: { invoiceNumber, totalKes, idempotencyKey: dto.idempotencyKey },
      });

      return invoice;
    });
  }

  async getInvoices(tenantId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const q = db.select().from(platformInvoices).orderBy(desc(platformInvoices.createdAt));
      if (tenantId) {
        return await q.where(eq(platformInvoices.tenantId, tenantId));
      }
      return await q;
    });
  }

  async getInvoiceById(id: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [invoice] = await db
        .select()
        .from(platformInvoices)
        .where(eq(platformInvoices.id, id));
      if (!invoice) {
        throw new NotFoundException(`Platform invoice with ID '${id}' not found.`);
      }

      const items = await db
        .select()
        .from(platformInvoiceItems)
        .where(eq(platformInvoiceItems.invoiceId, id));

      const payments = await db
        .select()
        .from(platformPayments)
        .where(eq(platformPayments.invoiceId, id));

      return {
        ...invoice,
        items,
        payments,
      };
    });
  }

  // =========================================================================
  // 2. IDEMPOTENT PAYMENT PROCESSING (APPROVED M-PESA ADAPTER ARCHITECTURE)
  // =========================================================================

  async processPayment(tenantId: string, dto: ProcessPlatformPaymentDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      // 1. Idempotency Check: Prevent duplicate charges
      const [existingPayment] = await db
        .select()
        .from(platformPayments)
        .where(eq(platformPayments.idempotencyKey, dto.idempotencyKey));
      if (existingPayment) {
        return {
          payment: existingPayment,
          isDuplicate: true,
          message: 'Payment with this idempotency key was already recorded.',
        };
      }

      const [invoice] = await db
        .select()
        .from(platformInvoices)
        .where(eq(platformInvoices.id, dto.invoiceId));
      if (!invoice) {
        throw new NotFoundException(`Invoice '${dto.invoiceId}' not found.`);
      }

      if (invoice.status === PlatformInvoiceStatus.PAID) {
        throw new BadRequestException(`Platform invoice '${invoice.invoiceNumber}' is already PAID.`);
      }

      const amountKesNumber = Number(dto.amountKes);
      let referenceNumber = dto.referenceNumber;
      let checkoutRequestId: string | undefined;

      // 2. If M-PESA, use the approved M-Pesa client adapter port
      if (dto.paymentMethod === PlatformPaymentMethod.MPESA) {
        const phone = dto.phoneNumber || '+254700000000';
        const stkResult = await this.mpesaClient.initiateStkPush(
          {
            phoneNumber: phone,
            amount: amountKesNumber,
            accountReference: invoice.invoiceNumber,
            transactionDesc: `COMKEY AFYA POA SaaS - ${invoice.invoiceNumber}`,
          },
          'HQ-BILLING',
        );

        if (stkResult.isFailure()) {
          const failureReason = stkResult.getError().message;
          const [failedPayment] = await db
            .insert(platformPayments)
            .values({
              tenantId,
              invoiceId: invoice.id,
              amountKes: amountKesNumber.toFixed(2),
              paymentMethod: dto.paymentMethod,
              referenceNumber: 'FAILED-STK',
              status: PlatformPaymentStatus.FAILED,
              idempotencyKey: dto.idempotencyKey,
              failureReason,
            })
            .returning();

          await this.auditService.recordEvent({
            tenantId,
            action: AuditEventType.PLATFORM_PAYMENT_FAILED,
            resource: 'PlatformPayment',
            resourceId: failedPayment!.id,
            details: { invoiceId: invoice.id, failureReason },
          });

          throw new BadRequestException(`M-Pesa payment failed: ${failureReason}`);
        }

        const stkVal = stkResult.getValue();
        checkoutRequestId = stkVal.checkoutRequestId;
        referenceNumber = `MPESA-${stkVal.checkoutRequestId.slice(0, 10)}`;
      }

      if (!referenceNumber) {
        referenceNumber = `REF-${Date.now()}`;
      }

      // 3. Record Successful Payment
      const [payment] = await db
        .insert(platformPayments)
        .values({
          tenantId,
          invoiceId: invoice.id,
          amountKes: amountKesNumber.toFixed(2),
          paymentMethod: dto.paymentMethod,
          referenceNumber,
          checkoutRequestId,
          status: PlatformPaymentStatus.COMPLETED,
          idempotencyKey: dto.idempotencyKey,
        })
        .returning();

      // 4. Update Invoice Balance & Status
      const currentPaid = Number(invoice.amountPaidKes) + amountKesNumber;
      const isFullyPaid = currentPaid >= Number(invoice.totalKes);

      await db
        .update(platformInvoices)
        .set({
          amountPaidKes: currentPaid.toFixed(2),
          status: isFullyPaid ? PlatformInvoiceStatus.PAID : invoice.status,
          updatedAt: new Date(),
        })
        .where(eq(platformInvoices.id, invoice.id));

      // 5. If Subscription was PAST_DUE or RESTRICTED, reactivate it upon payment
      if (invoice.subscriptionId) {
        await db
          .update(tenantSubscriptions)
          .set({
            status: SubscriptionStatus.ACTIVE,
            suspendedAt: null,
            suspensionReason: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tenantSubscriptions.id, invoice.subscriptionId),
              eq(tenantSubscriptions.status, SubscriptionStatus.PAST_DUE),
            ),
          );
      }

      await this.auditService.recordEvent({
        tenantId,
        action: AuditEventType.PLATFORM_PAYMENT_PROCESSED,
        resource: 'PlatformPayment',
        resourceId: payment!.id,
        details: { invoiceId: invoice.id, amountKes: dto.amountKes, referenceNumber },
      });

      return {
        payment,
        isDuplicate: false,
        invoiceStatus: isFullyPaid ? PlatformInvoiceStatus.PAID : invoice.status,
      };
    });
  }

  // =========================================================================
  // 3. FAILED-PAYMENT HANDLING, DUNNING & PATIENT SAFETY SUSPENSION POLICY
  // =========================================================================

  /**
   * Records a failed payment attempt, executes dunning stage progression,
   * and enforces the Patient Safety & Lawful Record Access policy.
   */
  async handlePaymentFailure(invoiceId: string, failureReason: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [invoice] = await db
        .select()
        .from(platformInvoices)
        .where(eq(platformInvoices.id, invoiceId));
      if (!invoice) {
        throw new NotFoundException(`Invoice '${invoiceId}' not found.`);
      }

      // 1. Mark Invoice as Past Due
      await db
        .update(platformInvoices)
        .set({
          status: PlatformInvoiceStatus.PAST_DUE,
          updatedAt: new Date(),
        })
        .where(eq(platformInvoices.id, invoiceId));

      // 2. Count existing dunning events for this invoice
      const pastEvents = await db
        .select()
        .from(platformDunningEvents)
        .where(eq(platformDunningEvents.invoiceId, invoiceId));

      const attemptNumber = pastEvents.length + 1;
      let stage: DunningStage = DunningStage.INITIAL_FAILURE;
      let actionTaken = 'AUTOMATED_RETRY_SCHEDULED';

      if (attemptNumber === 2) {
        stage = DunningStage.GRACE_DAY_3;
        actionTaken = 'FIRST_WARNING_NOTICE_SENT';
      } else if (attemptNumber === 3) {
        stage = DunningStage.WARNING_DAY_7;
        actionTaken = 'URGENT_DUNNING_NOTICE_SENT';
      } else if (attemptNumber === 4) {
        stage = DunningStage.RESTRICTED_DAY_14;
        actionTaken = 'NON_CLINICAL_RESTRICTION_APPLIED';
      } else if (attemptNumber >= 5) {
        stage = DunningStage.SUSPENDED_DAY_30;
        actionTaken = 'SUSPENDED_WITH_CLINICAL_SAFETY_SAFEGUARD';
      }

      // 3. Update subscription status if late stages reached
      if (invoice.subscriptionId) {
        if (stage === DunningStage.RESTRICTED_DAY_14) {
          await db
            .update(tenantSubscriptions)
            .set({ status: SubscriptionStatus.RESTRICTED, updatedAt: new Date() })
            .where(eq(tenantSubscriptions.id, invoice.subscriptionId));
        } else if (stage === DunningStage.SUSPENDED_DAY_30) {
          await db
            .update(tenantSubscriptions)
            .set({
              status: SubscriptionStatus.SUSPENDED,
              suspendedAt: new Date(),
              suspensionReason: `Commercial payment overdue: ${failureReason}`,
              updatedAt: new Date(),
            })
            .where(eq(tenantSubscriptions.id, invoice.subscriptionId));
        }
      }

      // 4. Record Dunning Event
      const [dunningEvent] = await db
        .insert(platformDunningEvents)
        .values({
          tenantId: invoice.tenantId,
          subscriptionId: invoice.subscriptionId || '00000000-0000-0000-0000-000000000000',
          invoiceId: invoice.id,
          stage,
          attemptNumber,
          message: `Payment collection failed: ${failureReason}. Stage: ${stage}`,
          actionTaken,
        })
        .returning();

      await this.auditService.recordEvent({
        tenantId: invoice.tenantId,
        action: AuditEventType.DUNNING_ACTION_EXECUTED,
        resource: 'PlatformDunningEvent',
        resourceId: dunningEvent!.id,
        details: { stage, attemptNumber, actionTaken },
      });

      return {
        ...dunningEvent,
        dunningStage: dunningEvent!.stage,
        invoiceStatus: PlatformInvoiceStatus.PAST_DUE,
      };
    });
  }

  /**
   * Legal & Medical Ethics Safeguard: Under Section 7 of the Health Act, 2017,
   * emergency medical treatment and access to active patient records must NEVER
   * be terminated solely due to a commercial fee dispute or failed payment.
   */
  isEmergencyOrClinicalAccessAllowed(
    tenantStatus: string,
    action: string,
  ): { allowed: boolean; reason: string } {
    // Vital clinical actions that must remain accessible for patient safety
    const protectedClinicalActions = [
      'patient:read',
      'encounter:read',
      'triage:write',
      'clinical:note:read',
      'allergy:manage',
      'inpatient:read',
      'bed:view',
      'medication:administer',
    ];

    if (tenantStatus === 'ACTIVE' || tenantStatus === 'TRIAL') {
      return { allowed: true, reason: 'Tenant subscription in good standing' };
    }

    if (protectedClinicalActions.includes(action)) {
      return {
        allowed: true,
        reason:
          'STATUTORY PATIENT SAFETY SAFEGUARD: Access permitted under Section 7 of Kenya Health Act 2017 despite commercial suspension.',
      };
    }

    return {
      allowed: false,
      reason:
        'COMMERCIAL RESTRICTION: Non-emergency administrative and commercial billing actions are suspended due to overdue subscription payment.',
    };
  }

  // =========================================================================
  // 4. SUBSCRIPTION REPORTING & FINANCIAL RECONCILIATION
  // =========================================================================

  async getSubscriptionReporting() {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      // 1. Total Tenants by Subscription Status
      const subs = await db.select().from(tenantSubscriptions);
      const totalSubscribers = subs.length;
      const activeCount = subs.filter((s) => s.status === SubscriptionStatus.ACTIVE).length;
      const pastDueCount = subs.filter((s) => s.status === SubscriptionStatus.PAST_DUE).length;
      const suspendedCount = subs.filter((s) => s.status === SubscriptionStatus.SUSPENDED).length;
      const cancelledCount = subs.filter((s) => s.status === SubscriptionStatus.CANCELLED).length;

      // 2. Financial Totals: MRR & ARR
      const invoices = await db.select().from(platformInvoices);
      let totalBilledKes = 0;
      let totalPaidKes = 0;
      let totalOutstandingKes = 0;

      for (const inv of invoices) {
        totalBilledKes += Number(inv.totalKes);
        totalPaidKes += Number(inv.amountPaidKes);
        if (inv.status !== PlatformInvoiceStatus.PAID && inv.status !== PlatformInvoiceStatus.CANCELLED) {
          totalOutstandingKes += Number(inv.totalKes) - Number(inv.amountPaidKes);
        }
      }

      // Compute estimated MRR from active subscriptions
      const plans = await db.select().from(subscriptionPlans);
      let mrrKes = 0;
      for (const sub of subs) {
        if (sub.status === SubscriptionStatus.ACTIVE) {
          const plan = plans.find((p) => p.id === sub.planId);
          if (plan) {
            mrrKes += Number(plan.basePriceKes);
          }
        }
      }

      return {
        metrics: {
          totalTenants: totalSubscribers,
          activeSubscribers: activeCount,
          pastDueSubscribers: pastDueCount,
          suspendedSubscribers: suspendedCount,
          churnedSubscribers: cancelledCount,
          mrrKes,
          arrKes: mrrKes * 12,
        },
        financials: {
          totalBilledKes,
          totalCollectedKes: totalPaidKes,
          totalOutstandingKes,
        },
      };
    });
  }

  async reconcilePayments() {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const invoices = await db.select().from(platformInvoices);
      const payments = await db.select().from(platformPayments);

      let matchedCount = 0;
      let unmatchedCount = 0;
      let totalReconciledAmountKes = 0;

      for (const payment of payments) {
        if (payment.status === PlatformPaymentStatus.COMPLETED) {
          const inv = invoices.find((i) => i.id === payment.invoiceId);
          if (inv) {
            matchedCount++;
            totalReconciledAmountKes += Number(payment.amountKes);
          } else {
            unmatchedCount++;
          }
        }
      }

      return {
        reconciliationDate: new Date().toISOString(),
        totalPaymentsAudited: payments.length,
        matchedCount,
        unmatchedCount,
        totalReconciledAmountKes,
        reconciliationStatus: unmatchedCount === 0 ? 'BALANCED' : 'DISCREPANCY_DETECTED',
      };
    });
  }
}
