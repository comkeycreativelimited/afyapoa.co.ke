import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  radiologyOrders,
  radiologyReports,
  patients,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  Permission,
  RadiologyOrderStatus,
  RadiologyReportStatus,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateRadiologyOrderDto,
  CreateRadiologyReportDto,
  AddendumReportDto,
} from './dto/radiology.dto.js';

@Injectable()
export class RadiologyService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `RAD-${yearMonth}-${randomSuffix}`;
  }

  private generateReportNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `REP-${yearMonth}-${randomSuffix}`;
  }

  // ==========================================
  // RADIOLOGY ORDERS & SPECIALIST PROTECTION
  // ==========================================

  async createOrder(dto: CreateRadiologyOrderDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} not found.`);
      }

      const orderNumber = this.generateOrderNumber();

      const [order] = await tx
        .insert(radiologyOrders)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          orderNumber,
          patientId: dto.patientId,
          encounterId: dto.encounterId || null,
          orderingPractitionerId: dto.orderingPractitionerId || context.userId,
          modality: dto.modality,
          procedureCode: dto.procedureCode || 'LOINC-RAD-GEN',
          procedureName: dto.procedureName,
          bodySite: dto.bodySite || 'GENERAL',
          clinicalIndication: dto.clinicalIndication,
          isConfidentialSpecialist: dto.isConfidentialSpecialist || false,
          urgency: dto.urgency || 'ROUTINE',
          status: RadiologyOrderStatus.REQUESTED,
        })
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.RADIOLOGY_ORDER_CREATED,
        resource: 'radiology_orders',
        resourceId: order!.id,
        details: {
          orderNumber: order!.orderNumber,
          modality: order!.modality,
          isConfidentialSpecialist: order!.isConfidentialSpecialist,
        },
      });

      return order!;
    });
  }

  async listOrders(
    facilityId: string,
    context: TenantContext,
    patientId?: string,
    status?: RadiologyOrderStatus,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [
        eq(radiologyOrders.tenantId, context.tenantId),
        eq(radiologyOrders.facilityId, facilityId),
      ];
      if (patientId) {
        conditions.push(eq(radiologyOrders.patientId, patientId));
      }
      if (status) {
        conditions.push(eq(radiologyOrders.status, status));
      }

      const allOrders = await tx
        .select()
        .from(radiologyOrders)
        .where(and(...conditions))
        .orderBy(desc(radiologyOrders.createdAt));

      // Filter out confidential specialist orders if caller lacks permission and is not ordering doctor
      const hasSpecialistPerm = context.permissions.includes(Permission.RADIOLOGY_SPECIALIST_READ);

      return allOrders.filter((ord) => {
        if (!ord.isConfidentialSpecialist) return true;
        if (hasSpecialistPerm || ord.orderingPractitionerId === context.userId) {
          return true;
        }
        return false;
      });
    });
  }

  async getOrderById(id: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(radiologyOrders)
        .where(and(eq(radiologyOrders.tenantId, context.tenantId), eq(radiologyOrders.id, id)))
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Radiology order with ID ${id} not found.`);
      }

      // Specialist authorization guard
      if (order.isConfidentialSpecialist) {
        const hasSpecialistPerm = context.permissions.includes(Permission.RADIOLOGY_SPECIALIST_READ);
        if (!hasSpecialistPerm && order.orderingPractitionerId !== context.userId) {
          throw new ForbiddenException(
            'Specialist confidential imaging requires elevated authorization (RADIOLOGY_SPECIALIST_READ).',
          );
        }

        await this.auditService.logEvent({
          tenantId: context.tenantId,
          userId: context.userId,
          action: AuditEventType.SPECIALIST_IMAGING_ACCESSED,
          resource: 'radiology_orders',
          resourceId: order.id,
          details: { orderNumber: order.orderNumber, confidential: true },
        });
      }

      const reports = await tx
        .select()
        .from(radiologyReports)
        .where(
          and(
            eq(radiologyReports.tenantId, context.tenantId),
            eq(radiologyReports.orderId, order.id),
          ),
        );

      return {
        ...order,
        reports,
      };
    });
  }

  // ==========================================
  // RADIOLOGY REPORTS & DICOM/PACS INTEGRATION
  // ==========================================

  async createReport(dto: CreateRadiologyReportDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [order] = await tx
        .select()
        .from(radiologyOrders)
        .where(
          and(
            eq(radiologyOrders.tenantId, context.tenantId),
            eq(radiologyOrders.id, dto.orderId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Radiology order with ID ${dto.orderId} not found.`);
      }

      const reportNumber = this.generateReportNumber();

      const [report] = await tx
        .insert(radiologyReports)
        .values({
          tenantId: context.tenantId,
          facilityId: order.facilityId,
          orderId: dto.orderId,
          reportNumber,
          radiologistId: dto.radiologistId || context.userId,
          findings: dto.findings,
          impression: dto.impression,
          recommendations: dto.recommendations || null,
          criticalResult: dto.criticalResult || false,
          criticalResultNotifiedTo: dto.criticalResultNotifiedTo || null,
          criticalResultNotifiedAt: dto.criticalResult ? new Date() : null,
          pacsStudyUid: dto.pacsStudyUid || null,
          pacsAccessionNumber: dto.pacsAccessionNumber || null,
          pacsViewerUrl: dto.pacsViewerUrl || null,
          status: dto.status || RadiologyReportStatus.FINAL,
        })
        .returning();

      // Update order status to COMPLETED
      await tx
        .update(radiologyOrders)
        .set({
          status: RadiologyOrderStatus.COMPLETED,
          updatedAt: new Date(),
        })
        .where(eq(radiologyOrders.id, dto.orderId));

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.RADIOLOGY_REPORT_SIGNED,
        resource: 'radiology_reports',
        resourceId: report!.id,
        details: {
          reportNumber: report!.reportNumber,
          orderNumber: order.orderNumber,
          criticalResult: report!.criticalResult,
          pacsStudyUid: report!.pacsStudyUid,
        },
      });

      return report!;
    });
  }

  async addAddendum(reportId: string, dto: AddendumReportDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [report] = await tx
        .select()
        .from(radiologyReports)
        .where(
          and(
            eq(radiologyReports.tenantId, context.tenantId),
            eq(radiologyReports.id, reportId),
          ),
        )
        .limit(1);

      if (!report) {
        throw new NotFoundException(`Radiology report with ID ${reportId} not found.`);
      }

      const noteText = dto.addendumNotes || (dto as any).addendumText || '';
      const newAddendumNotes = report.addendumNotes
        ? `${report.addendumNotes}\n[${new Date().toISOString()}]: ${noteText}`
        : `[${new Date().toISOString()}]: ${noteText}`;

      const updatedFindings = `${report.findings}\n${noteText}`;

      const [updated] = await tx
        .update(radiologyReports)
        .set({
          addendumNotes: newAddendumNotes,
          findings: updatedFindings,
          status: RadiologyReportStatus.AMENDED,
          updatedAt: new Date(),
        })
        .where(eq(radiologyReports.id, reportId))
        .returning();

      await this.auditService.logEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.RADIOLOGY_REPORT_AMENDED,
        resource: 'radiology_reports',
        resourceId: reportId,
        details: { reportNumber: report.reportNumber },
      });

      return updated;
    });
  }
}
