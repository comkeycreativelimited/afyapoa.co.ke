import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import crypto from 'node:crypto';
import {
  encounters,
  patients,
  diagnoses,
  clinicalOrders,
  medicationRequests,
  serviceRequests,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  CodingSystem,
  ClinicalOrderType,
  ClinicalOrderStatus,
  canTransitionOrderStatus,
  buildPaginationMeta,
} from '@afyapoa/domain-core';
import {
  toFHIRCondition,
  toFHIRMedicationRequest,
  toFHIRServiceRequest,
} from '@afyapoa/fhir-models';
import { AuditService } from '../audit/audit.service.js';
import { TerminologyService } from '../terminology/terminology.service.js';
import {
  RecordDiagnosisDto,
  UpdateDiagnosisDto,
  CreateClinicalOrderDto,
  AuthorizeOrderDto,
  CancelOrderDto,
  AmendOrderDto,
  ClinicalOrderSearchQueryDto,
} from './dto/orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
    @Inject(TerminologyService)
    private readonly terminologyService: TerminologyService,
  ) {}

  /**
   * Generates a unique, human-readable Clinical Order Number: ORD-YYYYMM-XXXX
   */
  private generateOrderNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${yearMonth}-${randomSuffix}`;
  }

  /**
   * Computes duplicate hash for accidental duplicate order prevention
   */
  private computeDuplicateHash(patientId: string, orderType: string, itemCode: string): string {
    return crypto
      .createHash('sha256')
      .update(`${patientId}:${orderType}:${itemCode}`)
      .digest('hex');
  }

  // ==========================================
  // DIAGNOSIS ENTRY & MANAGEMENT
  // ==========================================

  /**
   * Record a diagnosis for a patient within an encounter.
   * Validates code against authentic Kenyan catalogues (WHO ICD-11 / ICD-10).
   * Strictly prohibits invented codes.
   */
  async recordDiagnosis(encounterId: string, dto: RecordDiagnosisDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify encounter exists
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      if (encounter.status === 'CLOSED') {
        throw new BadRequestException('Cannot record diagnoses on a closed encounter.');
      }

      // 2. Strict validation against Kenyan clinical terminology catalogue
      const system = dto.codingSystem || CodingSystem.ICD_11_MMS;
      const verifiedConcept = await this.terminologyService.validateConcept(system, dto.code);

      // 3. Prevent duplicate active diagnosis of identical code on same encounter
      const [existingDiagnosis] = await tx
        .select()
        .from(diagnoses)
        .where(
          and(
            eq(diagnoses.tenantId, context.tenantId),
            eq(diagnoses.encounterId, encounterId),
            eq(diagnoses.code, dto.code),
            eq(diagnoses.clinicalStatus, 'ACTIVE'),
          ),
        )
        .limit(1);

      if (existingDiagnosis) {
        throw new ConflictException(
          `Diagnosis code ${dto.code} (${verifiedConcept.display}) is already actively recorded on this encounter.`,
        );
      }

      // 4. Handle primary diagnosis logic
      if (dto.isPrimary) {
        await tx
          .update(diagnoses)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(diagnoses.tenantId, context.tenantId), eq(diagnoses.encounterId, encounterId)));
      }

      // 5. Insert diagnosis
      const [newDiagnosis] = await tx
        .insert(diagnoses)
        .values({
          tenantId: context.tenantId,
          facilityId: encounter.facilityId,
          encounterId,
          patientId: encounter.patientId,
          recordedById: context.userId,
          code: verifiedConcept.code,
          codingSystem: system,
          display: verifiedConcept.display,
          diagnosisType: dto.diagnosisType || 'WORKING',
          clinicalStatus: dto.clinicalStatus || 'ACTIVE',
          verificationStatus: dto.verificationStatus || 'PROVISIONAL',
          certainty: dto.certainty || 'SUSPECTED',
          isPrimary: dto.isPrimary ?? false,
          onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : undefined,
          notes: dto.notes,
        })
        .returning();

      if (!newDiagnosis) {
        throw new BadRequestException('Failed to record diagnosis.');
      }

      // 6. Audit Trail
      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.DIAGNOSIS_RECORDED,
        resource: 'Diagnosis',
        resourceId: newDiagnosis.id,
        details: {
          encounterId,
          patientId: encounter.patientId,
          code: newDiagnosis.code,
          system,
          display: newDiagnosis.display,
          isPrimary: newDiagnosis.isPrimary,
        },
      });

      return newDiagnosis;
    });
  }

  /**
   * List all diagnoses recorded for an encounter.
   */
  async getEncounterDiagnoses(encounterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(diagnoses)
        .where(and(eq(diagnoses.tenantId, context.tenantId), eq(diagnoses.encounterId, encounterId)))
        .orderBy(desc(diagnoses.isPrimary), desc(diagnoses.recordedAt));
    });
  }

  /**
   * Update clinical or verification status of an existing diagnosis.
   */
  async updateDiagnosis(diagnosisId: string, dto: UpdateDiagnosisDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(diagnoses)
        .where(and(eq(diagnoses.tenantId, context.tenantId), eq(diagnoses.id, diagnosisId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Diagnosis with ID ${diagnosisId} not found.`);
      }

      // Check encounter status
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, existing.encounterId)))
        .limit(1);

      if (encounter && encounter.status === 'CLOSED') {
        throw new BadRequestException('Cannot modify diagnoses on a closed encounter.');
      }

      if (dto.isPrimary) {
        await tx
          .update(diagnoses)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(
            and(
              eq(diagnoses.tenantId, context.tenantId),
              eq(diagnoses.encounterId, existing.encounterId),
            ),
          );
      }

      const [updated] = await tx
        .update(diagnoses)
        .set({
          diagnosisType: dto.diagnosisType || existing.diagnosisType,
          clinicalStatus: dto.clinicalStatus || existing.clinicalStatus,
          verificationStatus: dto.verificationStatus || existing.verificationStatus,
          certainty: dto.certainty || existing.certainty,
          isPrimary: dto.isPrimary !== undefined ? dto.isPrimary : existing.isPrimary,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(diagnoses.id, diagnosisId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update diagnosis.');
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.DIAGNOSIS_UPDATED,
        resource: 'Diagnosis',
        resourceId: diagnosisId,
        details: {
          previousStatus: existing.clinicalStatus,
          newStatus: updated.clinicalStatus,
          previousVerification: existing.verificationStatus,
          newVerification: updated.verificationStatus,
        },
      });

      return updated;
    });
  }

  /**
   * Remove or flag a diagnosis as entered in error.
   */
  async removeDiagnosis(diagnosisId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(diagnoses)
        .where(and(eq(diagnoses.tenantId, context.tenantId), eq(diagnoses.id, diagnosisId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Diagnosis with ID ${diagnosisId} not found.`);
      }

      await tx
        .update(diagnoses)
        .set({
          clinicalStatus: 'INACTIVE',
          verificationStatus: 'ENTERED_IN_ERROR',
          updatedAt: new Date(),
        })
        .where(eq(diagnoses.id, diagnosisId));

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.DIAGNOSIS_REMOVED,
        resource: 'Diagnosis',
        resourceId: diagnosisId,
        details: {
          code: existing.code,
          encounterId: existing.encounterId,
        },
      });

      return { success: true, message: 'Diagnosis marked as entered in error and deactivated.' };
    });
  }

  /**
   * Export diagnoses for an encounter in Kenya Core FHIR R4 Condition format.
   */
  async getEncounterFHIRConditions(encounterId: string, context: TenantContext) {
    const list = await this.getEncounterDiagnoses(encounterId, context);
    return list.map((d) =>
      toFHIRCondition({
        ...d,
        certainty: d.certainty ?? undefined,
        notes: d.notes ?? undefined,
        onsetDate: d.onsetDate ?? undefined,
      }),
    );
  }

  // ==========================================
  // CLINICAL ORDERS CREATION & TRACKING
  // ==========================================

  /**
   * Place a new clinical order (Medication, Laboratory, Radiology, or Procedure).
   * Validates coding systems, enforces accidental duplicate protections, and links to encounter and practitioner.
   */
  async createOrder(encounterId: string, dto: CreateClinicalOrderDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify encounter exists
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      if (encounter.status === 'CLOSED') {
        throw new BadRequestException('Cannot place orders on a closed encounter.');
      }

      // 2. Verify patient
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      // 3. Determine Item Code and Validate Terminology
      let itemCode = '';
      if (dto.orderType === ClinicalOrderType.MEDICATION_REQUEST) {
        if (!dto.medication) {
          throw new BadRequestException('Medication details are required for MEDICATION_REQUEST.');
        }
        itemCode = dto.medication.medicationCode;
        const system = dto.medication.codingSystem || CodingSystem.KENYA_EML;
        await this.terminologyService.validateConcept(system, itemCode);
      } else {
        if (!dto.service) {
          throw new BadRequestException(
            `Service details are required for order type ${dto.orderType}.`,
          );
        }
        itemCode = dto.service.serviceCode;
        const system = dto.service.codingSystem || CodingSystem.LOINC;
        await this.terminologyService.validateConcept(system, itemCode);
      }

      // 4. Accidental Duplicate Order Protection (Within 24 Hours)
      const duplicateHash = this.computeDuplicateHash(dto.patientId, dto.orderType, itemCode);
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [existingDuplicate] = await tx
        .select()
        .from(clinicalOrders)
        .where(
          and(
            eq(clinicalOrders.tenantId, context.tenantId),
            eq(clinicalOrders.patientId, dto.patientId),
            eq(clinicalOrders.duplicateHash, duplicateHash),
            gte(clinicalOrders.orderedAt, past24Hours),
            sql`${clinicalOrders.status} NOT IN ('CANCELLED', 'AMENDED')`,
          ),
        )
        .limit(1);

      if (existingDuplicate) {
        if (!dto.overrideDuplicateWarning) {
          throw new ConflictException({
            code: 'DUPLICATE_ORDER_DETECTED',
            message: `A duplicate active order (#${existingDuplicate.orderNumber}) for this item was ordered within the past 24 hours. If clinically indicated to repeat this order, submit with overrideDuplicateWarning: true and provide duplicateOverrideReason.`,
            existingOrderId: existingDuplicate.id,
            existingOrderNumber: existingDuplicate.orderNumber,
          });
        }

        if (!dto.duplicateOverrideReason || dto.duplicateOverrideReason.trim().length < 10) {
          throw new BadRequestException(
            'A detailed clinical justification (minimum 10 characters) is required when overriding a duplicate order warning.',
          );
        }

        await this.auditService.recordEvent({
          tenantId: context.tenantId,
          userId: context.userId,
          action: AuditEventType.DUPLICATE_ORDER_OVERRIDDEN,
          resource: 'ClinicalOrder',
          resourceId: existingDuplicate.id,
          details: {
            patientId: dto.patientId,
            itemCode,
            orderType: dto.orderType,
            justification: dto.duplicateOverrideReason,
          },
        });
      }

      // 5. Create Master Order
      const orderNumber = this.generateOrderNumber();
      const orderingPractitionerId = dto.orderingPractitionerId || context.userId;

      const [order] = await tx
        .insert(clinicalOrders)
        .values({
          tenantId: context.tenantId,
          facilityId: encounter.facilityId,
          encounterId,
          patientId: dto.patientId,
          orderingPractitionerId,
          orderNumber,
          orderType: dto.orderType,
          status: 'ACTIVE',
          priority: dto.priority || 'ROUTINE',
          intent: dto.intent || 'ORDER',
          clinicalIndication: dto.clinicalIndication,
          notes: dto.notes,
          duplicateHash,
          version: 1,
        })
        .returning();

      if (!order) {
        throw new BadRequestException('Failed to create clinical order.');
      }

      // 6. Insert Order Specification
      let detail: unknown;
      if (dto.orderType === ClinicalOrderType.MEDICATION_REQUEST && dto.medication) {
        const med = dto.medication;
        const [medReq] = await tx
          .insert(medicationRequests)
          .values({
            tenantId: context.tenantId,
            orderId: order.id,
            patientId: dto.patientId,
            medicationCode: med.medicationCode,
            medicationName: med.medicationName,
            codingSystem: med.codingSystem || CodingSystem.KENYA_EML,
            dosage: med.dosage,
            dosageUnit: med.dosageUnit,
            route: med.route || 'ORAL',
            frequency: med.frequency || 'TID',
            durationValue: med.durationValue ?? 5,
            durationUnit: med.durationUnit || 'DAYS',
            totalQuantity: med.totalQuantity,
            quantityUnit: med.quantityUnit || 'TABLETS',
            instructions: med.instructions,
            refillsAllowed: med.refillsAllowed ?? 0,
            isPrn: med.isPrn ?? false,
            prnReason: med.prnReason,
            substitutionAllowed: med.substitutionAllowed ?? true,
          })
          .returning();
        detail = medReq;
      } else if (dto.service) {
        const s = dto.service;
        const [servReq] = await tx
          .insert(serviceRequests)
          .values({
            tenantId: context.tenantId,
            orderId: order.id,
            patientId: dto.patientId,
            serviceCategory: s.serviceCategory || 'LABORATORY',
            serviceCode: s.serviceCode,
            serviceName: s.serviceName,
            codingSystem: s.codingSystem || CodingSystem.LOINC,
            specimenType: s.specimenType,
            bodySite: s.bodySite,
            clinicalNotes: s.clinicalNotes,
            urgency: s.urgency || dto.priority || 'ROUTINE',
          })
          .returning();
        detail = servReq;
      }

      // 7. Audit Logging
      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_ORDER_CREATED,
        resource: 'ClinicalOrder',
        resourceId: order.id,
        details: {
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          itemCode,
          encounterId,
          patientId: dto.patientId,
          orderingPractitionerId,
        },
      });

      return {
        ...order,
        detail,
      };
    });
  }

  /**
   * Search and list clinical orders with pagination and filtering.
   */
  async listOrders(query: ClinicalOrderSearchQueryDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [eq(clinicalOrders.tenantId, context.tenantId)];

      if (query.encounterId) {
        conditions.push(eq(clinicalOrders.encounterId, query.encounterId));
      }
      if (query.patientId) {
        conditions.push(eq(clinicalOrders.patientId, query.patientId));
      }
      if (query.orderType) {
        conditions.push(eq(clinicalOrders.orderType, query.orderType));
      }
      if (query.status) {
        conditions.push(eq(clinicalOrders.status, query.status));
      }
      if (query.priority) {
        conditions.push(eq(clinicalOrders.priority, query.priority));
      }

      const page = Math.max(1, query.page || 1);
      const limit = Math.max(1, Math.min(100, query.limit || 20));
      const offset = (page - 1) * limit;

      const [countResult] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(clinicalOrders)
        .where(and(...conditions));

      const total = Number(countResult?.count || 0);

      const items = await tx
        .select()
        .from(clinicalOrders)
        .where(and(...conditions))
        .orderBy(desc(clinicalOrders.orderedAt))
        .limit(limit)
        .offset(offset);

      // Hydrate items with their respective detail
      const hydratedItems = await Promise.all(
        items.map(async (order) => {
          if (order.orderType === ClinicalOrderType.MEDICATION_REQUEST) {
            const [med] = await tx
              .select()
              .from(medicationRequests)
              .where(
                and(
                  eq(medicationRequests.tenantId, context.tenantId),
                  eq(medicationRequests.orderId, order.id),
                ),
              )
              .limit(1);
            return { ...order, detail: med };
          } else {
            const [serv] = await tx
              .select()
              .from(serviceRequests)
              .where(
                and(
                  eq(serviceRequests.tenantId, context.tenantId),
                  eq(serviceRequests.orderId, order.id),
                ),
              )
              .limit(1);
            return { ...order, detail: serv };
          }
        }),
      );

      return {
        items: hydratedItems,
        meta: buildPaginationMeta(total, page, limit),
      };
    });
  }

  /**
   * Get clinical order by ID with details.
   */
  async getOrderById(orderId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(clinicalOrders)
        .where(and(eq(clinicalOrders.tenantId, context.tenantId), eq(clinicalOrders.id, orderId)))
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Clinical order with ID ${orderId} not found.`);
      }

      let detail: unknown;
      if (order.orderType === ClinicalOrderType.MEDICATION_REQUEST) {
        const [med] = await tx
          .select()
          .from(medicationRequests)
          .where(
            and(
              eq(medicationRequests.tenantId, context.tenantId),
              eq(medicationRequests.orderId, order.id),
            ),
          )
          .limit(1);
        detail = med;
      } else {
        const [serv] = await tx
          .select()
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.tenantId, context.tenantId),
              eq(serviceRequests.orderId, order.id),
            ),
          )
          .limit(1);
        detail = serv;
      }

      return {
        ...order,
        detail,
      };
    });
  }

  /**
   * Authorize a clinical order by a licensed practitioner.
   */
  async authorizeOrder(orderId: string, dto: AuthorizeOrderDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(clinicalOrders)
        .where(and(eq(clinicalOrders.tenantId, context.tenantId), eq(clinicalOrders.id, orderId)))
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Clinical order with ID ${orderId} not found.`);
      }

      if (
        !canTransitionOrderStatus(
          order.status as ClinicalOrderStatus,
          ClinicalOrderStatus.AUTHORIZED,
        )
      ) {
        throw new BadRequestException(
          `Cannot transition order from "${order.status}" to "AUTHORIZED".`,
        );
      }

      const [updated] = await tx
        .update(clinicalOrders)
        .set({
          status: ClinicalOrderStatus.AUTHORIZED,
          authorizedById: context.userId,
          authorizedAt: new Date(),
          notes: dto.notes ? `${order.notes || ''}\nAuthorization notes: ${dto.notes}`.trim() : order.notes,
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, orderId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to authorize order.');
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_ORDER_AUTHORIZED,
        resource: 'ClinicalOrder',
        resourceId: orderId,
        details: {
          orderNumber: order.orderNumber,
          authorizedBy: context.userId,
        },
      });

      return updated;
    });
  }

  /**
   * Cancel an order with a mandatory clinical cancellation justification (min 10 chars).
   */
  async cancelOrder(orderId: string, dto: CancelOrderDto, context: TenantContext) {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException(
        'Cancellation reason must be at least 10 characters long to ensure auditability.',
      );
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(clinicalOrders)
        .where(and(eq(clinicalOrders.tenantId, context.tenantId), eq(clinicalOrders.id, orderId)))
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Clinical order with ID ${orderId} not found.`);
      }

      if (order.status === ClinicalOrderStatus.COMPLETED) {
        throw new BadRequestException('Cannot cancel a completed clinical order.');
      }

      if (
        !canTransitionOrderStatus(
          order.status as ClinicalOrderStatus,
          ClinicalOrderStatus.CANCELLED,
        )
      ) {
        throw new BadRequestException(
          `Cannot transition order from status "${order.status}" to "CANCELLED".`,
        );
      }

      const [updated] = await tx
        .update(clinicalOrders)
        .set({
          status: ClinicalOrderStatus.CANCELLED,
          cancelledById: context.userId,
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, orderId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to cancel order.');
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_ORDER_CANCELLED,
        resource: 'ClinicalOrder',
        resourceId: orderId,
        details: {
          orderNumber: order.orderNumber,
          reason: dto.reason,
          cancelledBy: context.userId,
        },
      });

      return updated;
    });
  }

  /**
   * Amend an active order: supersedes original order with a new versioned order.
   */
  async amendOrder(orderId: string, dto: AmendOrderDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [originalOrder] = await tx
        .select()
        .from(clinicalOrders)
        .where(and(eq(clinicalOrders.tenantId, context.tenantId), eq(clinicalOrders.id, orderId)))
        .limit(1);

      if (!originalOrder) {
        throw new NotFoundException(`Clinical order with ID ${orderId} not found.`);
      }

      if (
        originalOrder.status === ClinicalOrderStatus.COMPLETED ||
        originalOrder.status === ClinicalOrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot amend order with status "${originalOrder.status}".`,
        );
      }

      // Mark original as AMENDED
      await tx
        .update(clinicalOrders)
        .set({
          status: ClinicalOrderStatus.AMENDED,
          amendedById: context.userId,
          amendedAt: new Date(),
          amendmentReason: dto.amendmentReason,
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, orderId));

      // Create new superseding order (with overrideDuplicateWarning enabled since this is intentional amendment)
      const newOrderPayload: CreateClinicalOrderDto = {
        ...dto.newOrder,
        overrideDuplicateWarning: true,
        duplicateOverrideReason: `Amending order #${originalOrder.orderNumber}: ${dto.amendmentReason}`,
      };

      const newOrder = await this.createOrder(originalOrder.encounterId, newOrderPayload, context);

      // Link superseding relationship
      if (newOrder && newOrder.id) {
        await tx
          .update(clinicalOrders)
          .set({ supersededOrderId: originalOrder.id })
          .where(eq(clinicalOrders.id, newOrder.id));
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_ORDER_AMENDED,
        resource: 'ClinicalOrder',
        resourceId: orderId,
        details: {
          originalOrderId: orderId,
          originalOrderNumber: originalOrder.orderNumber,
          newOrderId: newOrder.id,
          newOrderNumber: newOrder.orderNumber,
          amendmentReason: dto.amendmentReason,
        },
      });

      return {
        originalOrderId: orderId,
        supersedingOrder: newOrder,
        message: 'Original order marked as amended and superseding order created.',
      };
    });
  }

  /**
   * Export order to authentic FHIR R4 MedicationRequest or ServiceRequest.
   */
  async getOrderFHIR(orderId: string, context: TenantContext) {
    const orderData = await this.getOrderById(orderId, context);

    const sanitizedOrder = {
      ...orderData,
      clinicalIndication: orderData.clinicalIndication ?? undefined,
      notes: orderData.notes ?? undefined,
    };

    if (orderData.orderType === ClinicalOrderType.MEDICATION_REQUEST) {
      if (!orderData.detail) {
        throw new NotFoundException('Medication details missing for order.');
      }
      return toFHIRMedicationRequest(sanitizedOrder, orderData.detail as any);
    } else {
      if (!orderData.detail) {
        throw new NotFoundException('Service details missing for order.');
      }
      return toFHIRServiceRequest(sanitizedOrder, orderData.detail as any);
    }
  }
}
