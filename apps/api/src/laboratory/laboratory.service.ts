import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import {
  withTenantContext,
  withTenantTransaction,
  labTestCatalog,
  labReferenceRanges,
  labSpecimens,
  labResults,
  diagnosticReports,
  labConsumables,
  labConsumableDeductions,
  clinicalOrders,
} from '@afyapoa/database';
import {
  eq,
  and,
  or,
  desc,
  asc,
  gte,
  lte,
  inArray,
} from 'drizzle-orm';
import {
  LabDepartment,
  SpecimenStatus,
  LabResultStatus,
  DiagnosticReportStatus,
  DeductionReason,
  Permission,
  canTransitionSpecimenStatus,
  canTransitionReportStatus,
  evaluateAbnormalFlag,
} from '@afyapoa/domain-core';
import {
  toFHIRSpecimen,
  toFHIRLaboratoryObservation,
  toFHIRDiagnosticReport,
} from '@afyapoa/fhir-models';
import { AuditService } from '../audit/audit.service.js';
import {
  KENYA_MOH_LAB_TESTS,
  KENYA_MOH_LAB_CONSUMABLES,
} from './seed-data.js';
import {
  CollectSpecimenDto,
  ReceiveSpecimenDto,
  RejectSpecimenDto,
  EnterLabResultDto,
  VerifyLabResultDto,
  CorrectLabResultDto,
  CreateDiagnosticReportDto,
  AuthorizeDiagnosticReportDto,
  AmendDiagnosticReportDto,
  DeductConsumableDto,
} from './dto/laboratory.dto.js';

@Injectable()
export class LaboratoryService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  // ==========================================
  // 1. CATALOGUE & CONSUMABLES SEEDING
  // ==========================================

  async seedCatalogAndConsumables(tenantId: string, facilityId: string, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Seed standard lab tests and reference ranges
      let testsInserted = 0;
      for (const t of KENYA_MOH_LAB_TESTS) {
        const existing = await tx.query.labTestCatalog.findFirst({
          where: eq(labTestCatalog.testCode, t.testCode),
        });

        let catalogId: string;
        if (!existing) {
          const [inserted] = await tx
            .insert(labTestCatalog)
            .values({
              tenantId,
              testCode: t.testCode,
              codingSystem: t.codingSystem,
              testName: t.testName,
              department: t.department,
              specimenType: t.specimenType,
              containerType: t.containerType,
              targetTatMinutes: t.targetTatMinutes,
              methodology: t.methodology,
              isActive: true,
            })
            .returning();
          if (!inserted) throw new BadRequestException('Failed to insert catalog item');
          catalogId = inserted.id;
          testsInserted++;

          // Insert configured reference ranges
          for (const rr of t.referenceRanges) {
            await tx.insert(labReferenceRanges).values({
              testCatalogId: catalogId,
              gender: rr.gender,
              ageMinDays: rr.ageMinDays,
              ageMaxDays: rr.ageMaxDays,
              lowNumeric: rr.lowNumeric !== undefined ? String(rr.lowNumeric) : null,
              highNumeric: rr.highNumeric !== undefined ? String(rr.highNumeric) : null,
              criticalLowNumeric: rr.criticalLowNumeric !== undefined ? String(rr.criticalLowNumeric) : null,
              criticalHighNumeric: rr.criticalHighNumeric !== undefined ? String(rr.criticalHighNumeric) : null,
              unit: rr.unit,
              textualRange: rr.textualRange || null,
              source: rr.source,
              sourceVersion: rr.sourceVersion,
              isActive: true,
            });
          }
        }
      }

      // 2. Seed standard consumables for the facility
      let consumablesInserted = 0;
      for (const c of KENYA_MOH_LAB_CONSUMABLES) {
        const existingConsumable = await tx.query.labConsumables.findFirst({
          where: and(
            eq(labConsumables.facilityId, facilityId),
            eq(labConsumables.itemCode, c.itemCode),
          ),
        });

        if (!existingConsumable) {
          await tx.insert(labConsumables).values({
            tenantId,
            facilityId,
            itemCode: c.itemCode,
            name: c.name,
            category: c.category,
            quantityOnHand: c.quantityOnHand,
            reorderLevel: c.reorderLevel,
            unitOfMeasure: c.unitOfMeasure,
            lotNumber: c.lotNumber,
          });
          consumablesInserted++;
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_CATALOG_SEEDED',
        resource: 'LAB_TEST_CATALOG',
        resourceId: facilityId,
        details: { testsInserted, consumablesInserted },
      });

      return {
        success: true,
        testsInserted,
        consumablesInserted,
      };
    });
  }

  async getTestCatalog(tenantId: string, department?: LabDepartment) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(labTestCatalog.isActive, true)];
      if (department) {
        conditions.push(eq(labTestCatalog.department, department));
      }

      return await tx.query.labTestCatalog.findMany({
        where: and(...conditions),
        with: {
          referenceRanges: true,
        },
        orderBy: [asc(labTestCatalog.department), asc(labTestCatalog.testName)],
      });
    });
  }

  // ==========================================
  // 2. INCOMING ORDERS & ACCESSIONING
  // ==========================================

  async getIncomingOrders(tenantId: string, facilityId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const orders = await tx.query.clinicalOrders.findMany({
        where: and(
          eq(clinicalOrders.orderType, 'LAB_SERVICE_REQUEST'),
          inArray(clinicalOrders.status, ['SUBMITTED', 'ACTIVE', 'IN_PROGRESS']),
          facilityId ? eq(clinicalOrders.facilityId, facilityId) : undefined,
        ),
        with: {
          serviceRequests: true,
          patient: true,
          orderingPractitioner: true,
          specimens: true,
        },
        orderBy: [desc(clinicalOrders.orderedAt)],
      });

      return orders;
    });
  }

  async collectSpecimen(
    tenantId: string,
    facilityId: string,
    userId: string,
    dto: CollectSpecimenDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Verify order exists and is valid
      const order = await tx.query.clinicalOrders.findFirst({
        where: and(
          eq(clinicalOrders.id, dto.orderId),
          eq(clinicalOrders.tenantId, tenantId),
        ),
      });

      if (!order) {
        throw new NotFoundException(`Clinical order with ID ${dto.orderId} not found`);
      }

      if (order.status === 'CANCELLED') {
        throw new BadRequestException('Cannot collect specimen for a cancelled clinical order');
      }

      // 2. Generate unique accession number and barcode
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', ''); // YYYYMM
      const randSuffix = Math.floor(10000 + Math.random() * 90000);
      const accessionNumber = `ACC-${dateStr}-${randSuffix}`;
      const barcode = `BC-${dateStr}-${randSuffix}`;

      // 3. Verify no duplicate accession or barcode exists
      const duplicate = await tx.query.labSpecimens.findFirst({
        where: and(
          eq(labSpecimens.tenantId, tenantId),
          or(
            eq(labSpecimens.accessionNumber, accessionNumber),
            eq(labSpecimens.barcode, barcode),
          ),
        ),
      });

      if (duplicate) {
        throw new ConflictException('Duplicate specimen accession number or barcode generated. Please retry.');
      }

      // 4. Create specimen record
      const [specimen] = await tx
        .insert(labSpecimens)
        .values({
          tenantId,
          facilityId,
          orderId: dto.orderId,
          patientId: dto.patientId,
          accessionNumber,
          barcode,
          specimenType: dto.specimenType,
          containerType: dto.containerType,
          status: SpecimenStatus.COLLECTED,
          collectedById: userId,
          collectedAt: new Date(),
          volumeMl: dto.volumeMl ? String(dto.volumeMl) : null,
          collectionSite: dto.collectionSite || null,
          notes: dto.notes || null,
        })
        .returning();

      if (!specimen) {
        throw new BadRequestException('Failed to create specimen record');
      }

      // 5. Update clinical order status to IN_PROGRESS
      await tx
        .update(clinicalOrders)
        .set({
          status: 'IN_PROGRESS',
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, dto.orderId));

      // 6. Deduct consumable from inventory if specified
      if (dto.deductConsumableItemCode) {
        const qty = dto.deductQuantity || 1;
        const consumable = await tx.query.labConsumables.findFirst({
          where: and(
            eq(labConsumables.facilityId, facilityId),
            eq(labConsumables.itemCode, dto.deductConsumableItemCode),
          ),
        });

        if (consumable) {
          const newQty = Math.max(0, consumable.quantityOnHand - qty);
          await tx
            .update(labConsumables)
            .set({ quantityOnHand: newQty, updatedAt: new Date() })
            .where(eq(labConsumables.id, consumable.id));

          await tx.insert(labConsumableDeductions).values({
            tenantId,
            facilityId,
            consumableId: consumable.id,
            specimenId: specimen.id,
            orderId: dto.orderId,
            quantityDeducted: qty,
            reason: DeductionReason.SPECIMEN_COLLECTION,
            deductedById: userId,
            deductedAt: new Date(),
          });
        }
      }

      // 7. Audit log
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_SPECIMEN_COLLECTED',
        resource: 'LAB_SPECIMEN',
        resourceId: specimen.id,
        details: {
          accessionNumber,
          barcode,
          orderId: dto.orderId,
          specimenType: dto.specimenType,
        },
      });

      return specimen;
    });
  }

  async receiveSpecimenInLab(
    tenantId: string,
    specimenId: string,
    userId: string,
    dto?: ReceiveSpecimenDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const specimen = await tx.query.labSpecimens.findFirst({
        where: and(
          eq(labSpecimens.id, specimenId),
          eq(labSpecimens.tenantId, tenantId),
        ),
      });

      if (!specimen) {
        throw new NotFoundException(`Specimen with ID ${specimenId} not found`);
      }

      if (!canTransitionSpecimenStatus(specimen.status as SpecimenStatus, SpecimenStatus.RECEIVED_IN_LAB)) {
        throw new BadRequestException(
          `Invalid specimen status transition from ${specimen.status} to ${SpecimenStatus.RECEIVED_IN_LAB}`,
        );
      }

      const [updated] = await tx
        .update(labSpecimens)
        .set({
          status: SpecimenStatus.RECEIVED_IN_LAB,
          receivedById: userId,
          receivedAt: new Date(),
          notes: dto?.notes ? `${specimen.notes || ''} [Receipt: ${dto.notes}]` : specimen.notes,
          updatedAt: new Date(),
        })
        .where(eq(labSpecimens.id, specimenId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update specimen status');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_SPECIMEN_RECEIVED',
        resource: 'LAB_SPECIMEN',
        resourceId: specimen.id,
        details: { accessionNumber: specimen.accessionNumber },
      });

      return updated;
    });
  }

  // ==========================================
  // 3. SPECIMEN REJECTION & RECOLLECTION WORKFLOW
  // ==========================================

  async rejectSpecimen(
    tenantId: string,
    specimenId: string,
    userId: string,
    dto: RejectSpecimenDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const specimen = await tx.query.labSpecimens.findFirst({
        where: and(
          eq(labSpecimens.id, specimenId),
          eq(labSpecimens.tenantId, tenantId),
        ),
      });

      if (!specimen) {
        throw new NotFoundException(`Specimen with ID ${specimenId} not found`);
      }

      if (!canTransitionSpecimenStatus(specimen.status as SpecimenStatus, SpecimenStatus.REJECTED)) {
        throw new BadRequestException(
          `Cannot reject specimen currently in status ${specimen.status}`,
        );
      }

      let recollectionSpecimen: any = null;

      // If recollection required, automatically create a new PENDING_COLLECTION specimen
      if (dto.recollectionRequired) {
        const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
        const randSuffix = Math.floor(10000 + Math.random() * 90000);
        const newAccession = `ACC-${dateStr}-${randSuffix}-R`;
        const newBarcode = `BC-${dateStr}-${randSuffix}-R`;

        const [createdRecollection] = await tx
          .insert(labSpecimens)
          .values({
            tenantId,
            facilityId: specimen.facilityId,
            orderId: specimen.orderId,
            patientId: specimen.patientId,
            accessionNumber: newAccession,
            barcode: newBarcode,
            specimenType: specimen.specimenType,
            containerType: specimen.containerType,
            status: SpecimenStatus.PENDING_COLLECTION,
            notes: `Recollection due to rejection of ${specimen.accessionNumber} (${dto.rejectionReason})`,
          })
          .returning();

        recollectionSpecimen = createdRecollection;
      }

      // Update rejected specimen
      const [updated] = await tx
        .update(labSpecimens)
        .set({
          status: SpecimenStatus.REJECTED,
          rejectionReason: dto.rejectionReason,
          rejectedById: userId,
          rejectedAt: new Date(),
          rejectionNotes: dto.rejectionNotes || null,
          recollectionRequired: Boolean(dto.recollectionRequired),
          recollectionSpecimenId: recollectionSpecimen?.id || null,
          updatedAt: new Date(),
        })
        .where(eq(labSpecimens.id, specimenId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update specimen rejection');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_SPECIMEN_REJECTED',
        resource: 'LAB_SPECIMEN',
        resourceId: specimen.id,
        details: {
          accessionNumber: specimen.accessionNumber,
          rejectionReason: dto.rejectionReason,
          recollectionSpecimenId: recollectionSpecimen?.id,
        },
      });

      return {
        rejectedSpecimen: updated,
        recollectionSpecimen,
      };
    });
  }

  // ==========================================
  // 4. DEPARTMENTAL WORKLISTS
  // ==========================================

  async getWorklist(
    tenantId: string,
    department?: LabDepartment,
    status?: SpecimenStatus,
  ) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(labSpecimens.tenantId, tenantId)];

      if (status) {
        conditions.push(eq(labSpecimens.status, status));
      } else {
        conditions.push(
          inArray(labSpecimens.status, [
            SpecimenStatus.COLLECTED,
            SpecimenStatus.RECEIVED_IN_LAB,
            SpecimenStatus.PROCESSING,
          ]),
        );
      }

      const specimens = await tx.query.labSpecimens.findMany({
        where: and(...conditions),
        with: {
          patient: true,
          order: {
            with: {
              serviceRequests: true,
              orderingPractitioner: true,
            },
          },
          results: true,
          collectedByUser: true,
          receivedByUser: true,
        },
        orderBy: [asc(labSpecimens.createdAt)],
      });

      // Filter by department if requested
      if (department) {
        return specimens.filter((s) => {
          return s.order?.serviceRequests?.some((_sr) => {
            return true;
          });
        });
      }

      return specimens;
    });
  }

  // ==========================================
  // 5. RESULT ENTRY & AUTO-FLAGGING
  // ==========================================

  async enterResult(
    tenantId: string,
    facilityId: string,
    userId: string,
    dto: EnterLabResultDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Verify specimen exists
      const specimen = await tx.query.labSpecimens.findFirst({
        where: and(
          eq(labSpecimens.id, dto.specimenId),
          eq(labSpecimens.tenantId, tenantId),
        ),
      });

      if (!specimen) {
        throw new NotFoundException(`Specimen with ID ${dto.specimenId} not found`);
      }

      if (specimen.status === SpecimenStatus.REJECTED) {
        throw new BadRequestException('Cannot enter results for a rejected specimen');
      }

      // 2. Fetch test catalog and configured reference range
      const catalog = await tx.query.labTestCatalog.findFirst({
        where: eq(labTestCatalog.id, dto.testCatalogId),
        with: {
          referenceRanges: true,
        },
      });

      if (!catalog) {
        throw new NotFoundException(`Lab test catalog ${dto.testCatalogId} not found`);
      }

      // Transition specimen to PROCESSING if currently RECEIVED_IN_LAB
      if (specimen.status === SpecimenStatus.RECEIVED_IN_LAB) {
        await tx
          .update(labSpecimens)
          .set({ status: SpecimenStatus.PROCESSING, updatedAt: new Date() })
          .where(eq(labSpecimens.id, specimen.id));
      }

      // 3. Match reference range based on patient demographics if available
      const refRange = catalog.referenceRanges?.[0];
      const low = refRange?.lowNumeric ? Number(refRange.lowNumeric) : undefined;
      const high = refRange?.highNumeric ? Number(refRange.highNumeric) : undefined;
      const critLow = refRange?.criticalLowNumeric ? Number(refRange.criticalLowNumeric) : undefined;
      const critHigh = refRange?.criticalHighNumeric ? Number(refRange.criticalHighNumeric) : undefined;
      const expectedText = refRange?.textualRange || undefined;

      // 4. Auto-evaluate abnormal flag without inventing thresholds
      const abnormalFlag = evaluateAbnormalFlag({
        numericValue: dto.numericValue,
        rangeLow: low,
        rangeHigh: high,
        criticalLow: critLow,
        criticalHigh: critHigh,
        textValue: dto.textValue,
        expectedText,
      });

      // 5. Insert result record
      const [result] = await tx
        .insert(labResults)
        .values({
          tenantId,
          facilityId,
          specimenId: dto.specimenId,
          orderId: dto.orderId,
          testCatalogId: dto.testCatalogId,
          testCode: catalog.testCode,
          testName: catalog.testName,
          department: catalog.department,
          numericValue: dto.numericValue !== undefined ? String(dto.numericValue) : null,
          textValue: dto.textValue || null,
          unit: dto.unit || refRange?.unit || null,
          referenceRangeLow: low !== undefined ? String(low) : null,
          referenceRangeHigh: high !== undefined ? String(high) : null,
          referenceRangeText: refRange?.textualRange || null,
          referenceSource: refRange?.source || null,
          referenceSourceVersion: refRange?.sourceVersion || null,
          abnormalFlag,
          technologistId: userId,
          enteredAt: new Date(),
          status: LabResultStatus.PRELIMINARY,
          notes: dto.notes || null,
        })
        .returning();

      if (!result) {
        throw new BadRequestException('Failed to create laboratory result record');
      }

      // 6. Audit log
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_RESULT_ENTERED',
        resource: 'LAB_RESULT',
        resourceId: result.id,
        details: {
          testCode: catalog.testCode,
          numericValue: dto.numericValue,
          textValue: dto.textValue,
          abnormalFlag,
        },
      });

      return result;
    });
  }

  // ==========================================
  // 6. RESULT VERIFICATION & CORRECTION
  // ==========================================

  async verifyResult(
    tenantId: string,
    resultId: string,
    userId: string,
    dto: VerifyLabResultDto,
    userPermissions: Permission[],
  ) {
    if (!userPermissions.includes(Permission.LAB_RESULT_AUTHORIZE)) {
      throw new ForbiddenException('User lacks permission to verify or authorize laboratory results');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      const result = await tx.query.labResults.findFirst({
        where: and(
          eq(labResults.id, resultId),
          eq(labResults.tenantId, tenantId),
        ),
      });

      if (!result) {
        throw new NotFoundException(`Lab result with ID ${resultId} not found`);
      }

      const [updated] = await tx
        .update(labResults)
        .set({
          status: dto.status,
          verifiedById: userId,
          verifiedAt: new Date(),
          verifierRole: dto.verifierRole || 'SENIOR_LAB_TECHNOLOGIST',
          verificationSignature: dto.verificationSignature,
          notes: dto.notes ? `${result.notes || ''} [Verification: ${dto.notes}]` : result.notes,
          updatedAt: new Date(),
        })
        .where(eq(labResults.id, resultId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update result verification');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_RESULT_VERIFIED',
        resource: 'LAB_RESULT',
        resourceId: result.id,
        details: { status: dto.status, testCode: result.testCode },
      });

      return updated;
    });
  }

  async correctResult(
    tenantId: string,
    resultId: string,
    userId: string,
    dto: CorrectLabResultDto,
  ) {
    if (!dto.correctionReason || dto.correctionReason.trim().length < 10) {
      throw new BadRequestException('A valid correction reason of at least 10 characters is required');
    }
    return await withTenantTransaction(tenantId, async (tx) => {
      const original = await tx.query.labResults.findFirst({
        where: and(
          eq(labResults.id, resultId),
          eq(labResults.tenantId, tenantId),
        ),
      });

      if (!original) {
        throw new NotFoundException(`Lab result with ID ${resultId} not found`);
      }

      // Mark original result as CORRECTED with mandatory justification
      await tx
        .update(labResults)
        .set({
          status: LabResultStatus.CORRECTED,
          correctionReason: dto.correctionReason,
          updatedAt: new Date(),
        })
        .where(eq(labResults.id, resultId));

      // Re-evaluate abnormal flag
      const low = original.referenceRangeLow ? Number(original.referenceRangeLow) : undefined;
      const high = original.referenceRangeHigh ? Number(original.referenceRangeHigh) : undefined;
      const abnormalFlag = evaluateAbnormalFlag({
        numericValue: dto.numericValue,
        rangeLow: low,
        rangeHigh: high,
        textValue: dto.textValue,
        expectedText: original.referenceRangeText || undefined,
      });

      // Insert new revised result record preserving full provenance
      const [revisedResult] = await tx
        .insert(labResults)
        .values({
          tenantId,
          facilityId: original.facilityId,
          specimenId: original.specimenId,
          orderId: original.orderId,
          testCatalogId: original.testCatalogId,
          testCode: original.testCode,
          testName: original.testName,
          department: original.department,
          numericValue: dto.numericValue !== undefined ? String(dto.numericValue) : original.numericValue,
          textValue: dto.textValue || original.textValue,
          unit: original.unit,
          referenceRangeLow: original.referenceRangeLow,
          referenceRangeHigh: original.referenceRangeHigh,
          referenceRangeText: original.referenceRangeText,
          referenceSource: original.referenceSource,
          referenceSourceVersion: original.referenceSourceVersion,
          abnormalFlag,
          technologistId: userId,
          enteredAt: new Date(),
          status: LabResultStatus.PRELIMINARY,
          correctedFromId: original.id,
          correctionReason: dto.correctionReason,
          notes: dto.notes || original.notes,
        })
        .returning();

      if (!revisedResult) {
        throw new BadRequestException('Failed to create corrected result record');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'LAB_RESULT_CORRECTED',
        resource: 'LAB_RESULT',
        resourceId: revisedResult.id,
        details: {
          originalResultId: original.id,
          correctionReason: dto.correctionReason,
        },
      });

      return revisedResult;
    });
  }

  // ==========================================
  // 7. DIAGNOSTIC REPORTS COMPILATION & DELIVERY
  // ==========================================

  async createDiagnosticReport(
    tenantId: string,
    facilityId: string,
    userId: string,
    dto: CreateDiagnosticReportDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const dateStr = new Date().toISOString().slice(0, 7).replace('-', '');
      const randSuffix = Math.floor(10000 + Math.random() * 90000);
      const reportNumber = `REP-${dateStr}-${randSuffix}`;

      // Assemble results summary if result IDs provided
      let summary = '';
      if (dto.resultIds && dto.resultIds.length > 0) {
        const results = await tx.query.labResults.findMany({
          where: and(
            eq(labResults.tenantId, tenantId),
            inArray(labResults.id, dto.resultIds),
          ),
        });
        summary = results
          .map((r) => `${r.testName}: ${r.numericValue || r.textValue} ${r.unit || ''} [${r.abnormalFlag}]`)
          .join('; ');
      }

      const [report] = await tx
        .insert(diagnosticReports)
        .values({
          tenantId,
          facilityId,
          orderId: dto.orderId,
          encounterId: dto.encounterId,
          patientId: dto.patientId,
          reportNumber,
          status: DiagnosticReportStatus.PRELIMINARY,
          title: dto.title,
          conclusion: dto.conclusion || null,
          issuedAt: new Date(),
          performerId: userId,
          resultsSummary: summary || null,
        })
        .returning();

      if (!report) {
        throw new BadRequestException('Failed to create diagnostic report');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'DIAGNOSTIC_REPORT_CREATED',
        resource: 'DIAGNOSTIC_REPORT',
        resourceId: report.id,
        details: { reportNumber, orderId: dto.orderId },
      });

      return report;
    });
  }

  async authorizeDiagnosticReport(
    tenantId: string,
    reportId: string,
    userId: string,
    dto: AuthorizeDiagnosticReportDto,
    userPermissions: Permission[],
  ) {
    if (!userPermissions.includes(Permission.LAB_RESULT_AUTHORIZE)) {
      throw new ForbiddenException('User lacks permission to authorize diagnostic reports');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      const report = await tx.query.diagnosticReports.findFirst({
        where: and(
          eq(diagnosticReports.id, reportId),
          eq(diagnosticReports.tenantId, tenantId),
        ),
      });

      if (!report) {
        throw new NotFoundException(`Diagnostic report ${reportId} not found`);
      }

      if (!canTransitionReportStatus(report.status as DiagnosticReportStatus, DiagnosticReportStatus.FINAL)) {
        throw new BadRequestException(
          `Cannot transition report status from ${report.status} to ${DiagnosticReportStatus.FINAL}`,
        );
      }

      const [authorizedReport] = await tx
        .update(diagnosticReports)
        .set({
          status: DiagnosticReportStatus.FINAL,
          authorizerId: userId,
          authorizedAt: new Date(),
          authorizationSignature: dto.authorizationSignature,
          conclusion: dto.conclusion || report.conclusion,
          updatedAt: new Date(),
        })
        .where(eq(diagnosticReports.id, reportId))
        .returning();

      if (!authorizedReport) {
        throw new BadRequestException('Failed to update report authorization');
      }

      // Mark the associated clinical order as COMPLETED
      await tx
        .update(clinicalOrders)
        .set({
          status: 'COMPLETED',
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, report.orderId));

      // Mark associated specimens as COMPLETED
      await tx
        .update(labSpecimens)
        .set({
          status: SpecimenStatus.COMPLETED,
          updatedAt: new Date(),
        })
        .where(and(
          eq(labSpecimens.orderId, report.orderId),
          eq(labSpecimens.status, SpecimenStatus.PROCESSING),
        ));

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'DIAGNOSTIC_REPORT_AUTHORIZED',
        resource: 'DIAGNOSTIC_REPORT',
        resourceId: report.id,
        details: { reportNumber: report.reportNumber },
      });

      return authorizedReport;
    });
  }

  async amendDiagnosticReport(
    tenantId: string,
    reportId: string,
    userId: string,
    dto: AmendDiagnosticReportDto,
    userPermissions: Permission[],
  ) {
    if (!userPermissions.includes(Permission.LAB_RESULT_AUTHORIZE)) {
      throw new ForbiddenException('User lacks permission to amend diagnostic reports');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      const original = await tx.query.diagnosticReports.findFirst({
        where: and(
          eq(diagnosticReports.id, reportId),
          eq(diagnosticReports.tenantId, tenantId),
        ),
      });

      if (!original) {
        throw new NotFoundException(`Diagnostic report ${reportId} not found`);
      }

      const [amended] = await tx
        .update(diagnosticReports)
        .set({
          status: DiagnosticReportStatus.AMENDED,
          amendedFromId: original.id,
          amendmentReason: dto.amendmentReason,
          conclusion: dto.conclusion || original.conclusion,
          updatedAt: new Date(),
        })
        .where(eq(diagnosticReports.id, reportId))
        .returning();

      if (!amended) {
        throw new BadRequestException('Failed to amend diagnostic report');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'DIAGNOSTIC_REPORT_AMENDED',
        resource: 'DIAGNOSTIC_REPORT',
        resourceId: amended.id,
        details: {
          originalReportNumber: original.reportNumber,
          amendmentReason: dto.amendmentReason,
        },
      });

      return amended;
    });
  }

  // ==========================================
  // 8. TURNAROUND TIME (TAT) & OPERATIONAL METRICS
  // ==========================================

  async getOperationalMetrics(
    tenantId: string,
    facilityId?: string,
    startDate?: string,
    endDate?: string,
  ) {
    return await withTenantContext(tenantId, async (tx) => {
      // 1. Fetch specimens with their orders and reports for TAT calculation
      const specimens = await tx.query.labSpecimens.findMany({
        where: and(
          eq(labSpecimens.tenantId, tenantId),
          facilityId ? eq(labSpecimens.facilityId, facilityId) : undefined,
          startDate ? gte(labSpecimens.createdAt, new Date(startDate)) : undefined,
          endDate ? lte(labSpecimens.createdAt, new Date(endDate)) : undefined,
        ),
        with: {
          order: true,
          results: true,
        },
      });

      const reports = await tx.query.diagnosticReports.findMany({
        where: and(
          eq(diagnosticReports.tenantId, tenantId),
          facilityId ? eq(diagnosticReports.facilityId, facilityId) : undefined,
        ),
      });

      // Calculate TAT breakdowns
      let totalOrderToCollectionMins = 0;
      let orderToCollectionCount = 0;
      let totalCollectionToReceiptMins = 0;
      let collectionToReceiptCount = 0;
      let totalReceiptToResultMins = 0;
      let receiptToResultCount = 0;
      let totalResultToAuthMins = 0;
      let resultToAuthCount = 0;

      for (const s of specimens) {
        const orderTime = s.order?.orderedAt;
        const collectTime = s.collectedAt;
        const receiveTime = s.receivedAt;
        const firstResultTime = s.results?.[0]?.enteredAt;
        const report = reports.find((r) => r.orderId === s.orderId);
        const authTime = report?.authorizedAt;

        if (orderTime && collectTime) {
          const diff = Math.round((new Date(collectTime).getTime() - new Date(orderTime).getTime()) / (1000 * 60));
          if (diff >= 0) {
            totalOrderToCollectionMins += diff;
            orderToCollectionCount++;
          }
        }

        if (collectTime && receiveTime) {
          const diff = Math.round((new Date(receiveTime).getTime() - new Date(collectTime).getTime()) / (1000 * 60));
          if (diff >= 0) {
            totalCollectionToReceiptMins += diff;
            collectionToReceiptCount++;
          }
        }

        if (receiveTime && firstResultTime) {
          const diff = Math.round((new Date(firstResultTime).getTime() - new Date(receiveTime).getTime()) / (1000 * 60));
          if (diff >= 0) {
            totalReceiptToResultMins += diff;
            receiptToResultCount++;
          }
        }

        if (firstResultTime && authTime) {
          const diff = Math.round((new Date(authTime).getTime() - new Date(firstResultTime).getTime()) / (1000 * 60));
          if (diff >= 0) {
            totalResultToAuthMins += diff;
            resultToAuthCount++;
          }
        }
      }

      // 2. Fetch inventory items and low stock alerts
      const consumables = await tx.query.labConsumables.findMany({
        where: and(
          eq(labConsumables.tenantId, tenantId),
          facilityId ? eq(labConsumables.facilityId, facilityId) : undefined,
        ),
      });

      const lowStockAlerts = consumables.filter(
        (c) => c.quantityOnHand <= c.reorderLevel,
      );

      // 3. Count results by abnormal flag
      const allResults = await tx.query.labResults.findMany({
        where: and(
          eq(labResults.tenantId, tenantId),
          facilityId ? eq(labResults.facilityId, facilityId) : undefined,
        ),
      });

      const abnormalCounts: Record<string, number> = {
        NORMAL: 0,
        ABNORMAL: 0,
        LOW: 0,
        HIGH: 0,
        CRITICAL_LOW: 0,
        CRITICAL_HIGH: 0,
      };

      for (const r of allResults) {
        const flag = r.abnormalFlag;
        abnormalCounts[flag] = (abnormalCounts[flag] ?? 0) + 1;
      }

      const avgOrderToCol = orderToCollectionCount > 0 ? Math.round(totalOrderToCollectionMins / orderToCollectionCount) : 0;
      const avgColToRec = collectionToReceiptCount > 0 ? Math.round(totalCollectionToReceiptMins / collectionToReceiptCount) : 0;
      const avgRecToRes = receiptToResultCount > 0 ? Math.round(totalReceiptToResultMins / receiptToResultCount) : 0;
      const avgResToAuth = resultToAuthCount > 0 ? Math.round(totalResultToAuthMins / resultToAuthCount) : 0;

      return {
        specimensTotal: specimens.length,
        specimensCompleted: specimens.filter((s) => s.status === SpecimenStatus.COMPLETED).length,
        specimensRejected: specimens.filter((s) => s.status === SpecimenStatus.REJECTED).length,
        reportsFinalized: reports.filter((r) => r.status === DiagnosticReportStatus.FINAL || r.status === DiagnosticReportStatus.AMENDED).length,
        tatAverages: {
          averageOrderToCollectionMinutes: avgOrderToCol,
          averageCollectionToReceiptMinutes: avgColToRec,
          averageReceiptToResultMinutes: avgRecToRes,
          averageResultToAuthorizationMinutes: avgResToAuth,
          averageTotalTatMinutes: avgOrderToCol + avgColToRec + avgRecToRes + avgResToAuth,
        },
        abnormalDistribution: abnormalCounts,
        inventory: {
          totalConsumables: consumables.length,
          lowStockCount: lowStockAlerts.length,
          lowStockAlerts: lowStockAlerts.map((c) => ({
            itemCode: c.itemCode,
            name: c.name,
            quantityOnHand: c.quantityOnHand,
            reorderLevel: c.reorderLevel,
            unitOfMeasure: c.unitOfMeasure,
          })),
        },
      };
    });
  }

  // ==========================================
  // 9. CONSUMABLES INVENTORY
  // ==========================================

  async listConsumables(tenantId: string, facilityId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      return await tx.query.labConsumables.findMany({
        where: and(
          eq(labConsumables.tenantId, tenantId),
          facilityId ? eq(labConsumables.facilityId, facilityId) : undefined,
        ),
        orderBy: [asc(labConsumables.category), asc(labConsumables.name)],
      });
    });
  }

  async deductConsumable(
    tenantId: string,
    facilityId: string,
    userId: string,
    dto: DeductConsumableDto,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const consumable = await tx.query.labConsumables.findFirst({
        where: and(
          eq(labConsumables.id, dto.consumableId),
          eq(labConsumables.tenantId, tenantId),
        ),
      });

      if (!consumable) {
        throw new NotFoundException(`Consumable item ${dto.consumableId} not found`);
      }

      const updatedQty = Math.max(0, consumable.quantityOnHand - dto.quantityDeducted);

      await tx
        .update(labConsumables)
        .set({
          quantityOnHand: updatedQty,
          updatedAt: new Date(),
        })
        .where(eq(labConsumables.id, dto.consumableId));

      const [deduction] = await tx
        .insert(labConsumableDeductions)
        .values({
          tenantId,
          facilityId,
          consumableId: dto.consumableId,
          specimenId: dto.specimenId || null,
          orderId: dto.orderId || null,
          quantityDeducted: dto.quantityDeducted,
          reason: dto.reason,
          deductedById: userId,
          deductedAt: new Date(),
        })
        .returning();

      return {
        deduction,
        newQuantityOnHand: updatedQty,
        isBelowReorderLevel: updatedQty <= consumable.reorderLevel,
      };
    });
  }

  // ==========================================
  // 10. FHIR R4 EXPORT SERVICES
  // ==========================================

  async getSpecimenFHIR(tenantId: string, specimenId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const specimen = await tx.query.labSpecimens.findFirst({
        where: and(
          eq(labSpecimens.id, specimenId),
          eq(labSpecimens.tenantId, tenantId),
        ),
      });

      if (!specimen) {
        throw new NotFoundException(`Specimen ${specimenId} not found`);
      }

      return toFHIRSpecimen({
        id: specimen.id,
        patientId: specimen.patientId,
        orderId: specimen.orderId,
        accessionNumber: specimen.accessionNumber,
        barcode: specimen.barcode,
        specimenType: specimen.specimenType,
        containerType: specimen.containerType,
        status: specimen.status,
        collectedById: specimen.collectedById || undefined,
        collectedAt: specimen.collectedAt || undefined,
        volumeMl: specimen.volumeMl ? Number(specimen.volumeMl) : undefined,
        collectionSite: specimen.collectionSite || undefined,
        rejectionReason: specimen.rejectionReason || undefined,
        rejectionNotes: specimen.rejectionNotes || undefined,
      });
    });
  }

  async getObservationFHIR(tenantId: string, resultId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const result = await tx.query.labResults.findFirst({
        where: and(
          eq(labResults.id, resultId),
          eq(labResults.tenantId, tenantId),
        ),
      });

      if (!result) {
        throw new NotFoundException(`Lab result ${resultId} not found`);
      }

      return toFHIRLaboratoryObservation({
        id: result.id,
        patientId: result.specimenId, // Can be mapped to patient through order/specimen
        orderId: result.orderId,
        specimenId: result.specimenId,
        testCode: result.testCode,
        testName: result.testName,
        department: result.department,
        numericValue: result.numericValue ? Number(result.numericValue) : undefined,
        textValue: result.textValue || undefined,
        unit: result.unit || undefined,
        referenceRangeLow: result.referenceRangeLow ? Number(result.referenceRangeLow) : undefined,
        referenceRangeHigh: result.referenceRangeHigh ? Number(result.referenceRangeHigh) : undefined,
        referenceRangeText: result.referenceRangeText || undefined,
        referenceSource: result.referenceSource || undefined,
        referenceSourceVersion: result.referenceSourceVersion || undefined,
        abnormalFlag: result.abnormalFlag,
        technologistId: result.technologistId,
        enteredAt: result.enteredAt,
        status: result.status,
        correctionReason: result.correctionReason || undefined,
        notes: result.notes || undefined,
      });
    });
  }

  async getDiagnosticReportFHIR(tenantId: string, reportId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const report = await tx.query.diagnosticReports.findFirst({
        where: and(
          eq(diagnosticReports.id, reportId),
          eq(diagnosticReports.tenantId, tenantId),
        ),
      });

      if (!report) {
        throw new NotFoundException(`Diagnostic report ${reportId} not found`);
      }

      // Fetch linked results
      const results = await tx.query.labResults.findMany({
        where: and(
          eq(labResults.orderId, report.orderId),
          eq(labResults.tenantId, tenantId),
        ),
      });

      return toFHIRDiagnosticReport({
        id: report.id,
        patientId: report.patientId,
        orderId: report.orderId,
        encounterId: report.encounterId,
        reportNumber: report.reportNumber,
        status: report.status,
        title: report.title,
        conclusion: report.conclusion || undefined,
        issuedAt: report.issuedAt,
        performerId: report.performerId,
        authorizerId: report.authorizerId || undefined,
        resultIds: results.map((r) => r.id),
      });
    });
  }
}
