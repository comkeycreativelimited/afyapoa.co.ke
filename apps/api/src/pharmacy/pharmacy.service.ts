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
  pharmacyProducts,
  pharmacySuppliers,
  pharmacyBatches,
  pharmacyStockMovements,
  medicationDispenses,
  medicationDispenseItems,
  medicationAdministrations,
  clinicalOrders,
  medicationRequests,
  patients,
  encounters,
  users,
  facilities,
} from '@afyapoa/database';
import {
  eq,
  and,
  or,
  inArray,
  lte,
  desc,
  asc,
  sql as dSql,
} from 'drizzle-orm';
import {
  BatchStatus,
  StockMovementType,
  StockMovementReferenceType,
  MedicationDispenseStatus,
  DispenseType,
  MedicationAdministrationStatus,
  allocateBatchesFEFO,
  calculateExpiryRisk,
} from '@afyapoa/domain-core';
import {
  toFHIRMedication,
  toFHIRMedicationDispense,
  toFHIRMedicationAdministration,
} from '@afyapoa/fhir-models';
import { AuditService } from '../audit/audit.service.js';
import {
  KENYA_EML_PRODUCTS,
  KENYA_PHARMACY_SUPPLIERS,
} from './seed-data.js';
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

@Injectable()
export class PharmacyService {
  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

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
  // 1. CATALOGUE MANAGEMENT & SEEDING
  // ==========================================

  async seedDefaultCatalogue(tenantId: string, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      let seededProducts = 0;
      let seededSuppliers = 0;

      // Seed approved suppliers
      for (const sup of KENYA_PHARMACY_SUPPLIERS) {
        const existing = await tx
          .select({ id: pharmacySuppliers.id })
          .from(pharmacySuppliers)
          .where(
            and(
              eq(pharmacySuppliers.tenantId, tenantId),
              eq(pharmacySuppliers.supplierCode, sup.supplierCode),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(pharmacySuppliers).values({
            tenantId,
            supplierCode: sup.supplierCode,
            name: sup.name,
            ppbLicenseNumber: sup.ppbLicenseNumber,
            kraPin: sup.kraPin,
            contactPerson: sup.contactPerson,
            email: sup.email,
            phone: sup.phone,
            physicalAddress: sup.physicalAddress,
            leadTimeDays: sup.leadTimeDays,
            isActive: true,
          });
          seededSuppliers++;
        }
      }

      // Seed approved KEML products
      for (const prod of KENYA_EML_PRODUCTS) {
        const existing = await tx
          .select({ id: pharmacyProducts.id })
          .from(pharmacyProducts)
          .where(
            or(
              eq(pharmacyProducts.itemCode, prod.itemCode),
              and(
                eq(pharmacyProducts.tenantId, tenantId),
                eq(pharmacyProducts.itemCode, prod.itemCode),
              ),
            ),
          )
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(pharmacyProducts).values({
            tenantId,
            itemCode: prod.itemCode,
            genericName: prod.genericName,
            brandName: prod.brandName,
            atcCode: prod.atcCode,
            kemlCategory: prod.kemlCategory,
            drugSchedule: prod.drugSchedule,
            category: prod.category,
            form: prod.form,
            strength: prod.strength,
            strengthUnit: prod.strengthUnit,
            dispensingUnit: prod.dispensingUnit,
            packagingUnit: prod.packagingUnit,
            packagingSize: prod.packagingSize,
            storageCondition: prod.storageCondition,
            unitPrice: prod.unitPrice,
            reorderLevel: prod.reorderLevel,
            maxStockLevel: prod.maxStockLevel,
            prescriptionRequired: prod.prescriptionRequired,
            controlledSubstance: prod.controlledSubstance,
            isActive: true,
          });
          seededProducts++;
        }
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_CATALOGUE_SEEDED',
        resource: 'PHARMACY_CATALOGUE',
        resourceId: tenantId,
        details: { seededProducts, seededSuppliers },
      });

      const [totalCount] = await tx
        .select({ count: dSql<number>`count(*)` })
        .from(pharmacyProducts)
        .where(eq(pharmacyProducts.tenantId, tenantId));

      return {
        message: 'Pharmacy catalogue initialized successfully',
        seededProducts: seededProducts > 0 ? seededProducts : Number(totalCount?.count || 0),
        seededSuppliers: seededSuppliers > 0 ? seededSuppliers : KENYA_PHARMACY_SUPPLIERS.length,
      };
    });
  }

  async getProducts(tenantId: string, filter?: QueryPharmacyFilterDto) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [];

      if (filter?.search) {
        const s = `%${filter.search.toLowerCase()}%`;
        conditions.push(
          or(
            dSql`LOWER(${pharmacyProducts.genericName}) LIKE ${s}`,
            dSql`LOWER(${pharmacyProducts.itemCode}) LIKE ${s}`,
            dSql`LOWER(${pharmacyProducts.brandName}) LIKE ${s}`,
            dSql`LOWER(${pharmacyProducts.atcCode}) LIKE ${s}`,
          ),
        );
      }

      if (filter?.category) {
        conditions.push(eq(pharmacyProducts.category, filter.category));
      }

      if (filter?.schedule) {
        conditions.push(eq(pharmacyProducts.drugSchedule, filter.schedule));
      }

      const query = tx
        .select()
        .from(pharmacyProducts)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(pharmacyProducts.genericName));

      return await query;
    });
  }

  async getProductById(tenantId: string, productId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [product] = await tx
        .select()
        .from(pharmacyProducts)
        .where(eq(pharmacyProducts.id, productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }
      return product;
    });
  }

  async createProduct(tenantId: string, dto: CreatePharmacyProductDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const existing = await tx
        .select({ id: pharmacyProducts.id })
        .from(pharmacyProducts)
        .where(
          and(
            eq(pharmacyProducts.tenantId, tenantId),
            eq(pharmacyProducts.itemCode, dto.itemCode),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException(`Product with code ${dto.itemCode} already exists.`);
      }

      const [product] = await tx
        .insert(pharmacyProducts)
        .values({
          tenantId,
          itemCode: dto.itemCode,
          genericName: dto.genericName,
          brandName: dto.brandName ?? null,
          atcCode: dto.atcCode ?? null,
          kemlCategory: dto.kemlCategory ?? null,
          drugSchedule: dto.drugSchedule,
          category: dto.category,
          form: dto.form,
          strength: dto.strength ?? null,
          strengthUnit: dto.strengthUnit ?? null,
          dispensingUnit: dto.dispensingUnit,
          packagingUnit: dto.packagingUnit,
          packagingSize: dto.packagingSize ?? null,
          storageCondition: dto.storageCondition ?? 'ROOM_TEMPERATURE',
          unitPrice: dto.unitPrice !== undefined ? dto.unitPrice.toFixed(2) : '0.00',
          reorderLevel: dto.reorderLevel ?? 50,
          maxStockLevel: dto.maxStockLevel ?? null,
          prescriptionRequired: dto.prescriptionRequired ?? true,
          controlledSubstance: dto.controlledSubstance ?? false,
          isActive: true,
        })
        .returning();

      if (!product) {
        throw new BadRequestException('Failed to create pharmacy product.');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_PRODUCT_CREATED',
        resource: 'PHARMACY_PRODUCT',
        resourceId: product.id,
        details: { itemCode: product.itemCode, genericName: product.genericName },
      });

      return product;
    });
  }

  async updateProduct(tenantId: string, productId: string, dto: UpdatePharmacyProductDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      await this.getProductById(tenantId, productId);

      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (dto.genericName) updateValues.genericName = dto.genericName;
      if (dto.brandName !== undefined) updateValues.brandName = dto.brandName;
      if (dto.atcCode !== undefined) updateValues.atcCode = dto.atcCode;
      if (dto.kemlCategory !== undefined) updateValues.kemlCategory = dto.kemlCategory;
      if (dto.drugSchedule) updateValues.drugSchedule = dto.drugSchedule;
      if (dto.category) updateValues.category = dto.category;
      if (dto.form) updateValues.form = dto.form;
      if (dto.strength) updateValues.strength = dto.strength;
      if (dto.strengthUnit) updateValues.strengthUnit = dto.strengthUnit;
      if (dto.dispensingUnit) updateValues.dispensingUnit = dto.dispensingUnit;
      if (dto.packagingUnit) updateValues.packagingUnit = dto.packagingUnit;
      if (dto.packagingSize) updateValues.packagingSize = dto.packagingSize;
      if (dto.storageCondition) updateValues.storageCondition = dto.storageCondition;
      if (dto.unitPrice !== undefined) updateValues.unitPrice = dto.unitPrice.toFixed(2);
      if (dto.reorderLevel !== undefined) updateValues.reorderLevel = dto.reorderLevel;
      if (dto.maxStockLevel !== undefined) updateValues.maxStockLevel = dto.maxStockLevel;
      if (dto.prescriptionRequired !== undefined) updateValues.prescriptionRequired = dto.prescriptionRequired;
      if (dto.controlledSubstance !== undefined) updateValues.controlledSubstance = dto.controlledSubstance;
      if (dto.isActive !== undefined) updateValues.isActive = dto.isActive;

      const [updated] = await tx
        .update(pharmacyProducts)
        .set(updateValues)
        .where(eq(pharmacyProducts.id, productId))
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update pharmacy product.');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_PRODUCT_UPDATED',
        resource: 'PHARMACY_PRODUCT',
        resourceId: productId,
        details: { itemCode: updated.itemCode, changes: dto },
      });

      return updated;
    });
  }

  // ==========================================
  // 2. SUPPLIERS MANAGEMENT
  // ==========================================

  async getSuppliers(tenantId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      return await tx
        .select()
        .from(pharmacySuppliers)
        .where(eq(pharmacySuppliers.tenantId, tenantId))
        .orderBy(asc(pharmacySuppliers.name));
    });
  }

  async getSupplierById(tenantId: string, supplierId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [supplier] = await tx
        .select()
        .from(pharmacySuppliers)
        .where(
          and(
            eq(pharmacySuppliers.tenantId, tenantId),
            eq(pharmacySuppliers.id, supplierId),
          ),
        )
        .limit(1);

      if (!supplier) {
        throw new NotFoundException(`Supplier with ID ${supplierId} not found`);
      }
      return supplier;
    });
  }

  async createSupplier(tenantId: string, dto: CreatePharmacySupplierDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      const existing = await tx
        .select({ id: pharmacySuppliers.id })
        .from(pharmacySuppliers)
        .where(
          and(
            eq(pharmacySuppliers.tenantId, tenantId),
            eq(pharmacySuppliers.supplierCode, dto.supplierCode),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ConflictException(`Supplier with code ${dto.supplierCode} already exists.`);
      }

      const [supplier] = await tx
        .insert(pharmacySuppliers)
        .values({
          tenantId,
          supplierCode: dto.supplierCode,
          name: dto.name,
          ppbLicenseNumber: dto.ppbLicenseNumber ?? null,
          kraPin: dto.kraPin ?? null,
          contactPerson: dto.contactPerson ?? null,
          email: dto.email ?? null,
          phone: dto.phone ?? null,
          physicalAddress: dto.physicalAddress ?? null,
          leadTimeDays: dto.leadTimeDays ?? 7,
          isActive: true,
        })
        .returning();

      if (!supplier) {
        throw new BadRequestException('Failed to create pharmacy supplier.');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_SUPPLIER_CREATED',
        resource: 'PHARMACY_SUPPLIER',
        resourceId: supplier.id,
        details: { supplierCode: supplier.supplierCode, name: supplier.name },
      });

      return supplier;
    });
  }

  async updateSupplier(tenantId: string, supplierId: string, dto: UpdatePharmacySupplierDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      await this.getSupplierById(tenantId, supplierId);

      const updateValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (dto.name) updateValues.name = dto.name;
      if (dto.ppbLicenseNumber !== undefined) updateValues.ppbLicenseNumber = dto.ppbLicenseNumber;
      if (dto.kraPin !== undefined) updateValues.kraPin = dto.kraPin;
      if (dto.contactPerson !== undefined) updateValues.contactPerson = dto.contactPerson;
      if (dto.email !== undefined) updateValues.email = dto.email;
      if (dto.phone !== undefined) updateValues.phone = dto.phone;
      if (dto.physicalAddress !== undefined) updateValues.physicalAddress = dto.physicalAddress;
      if (dto.leadTimeDays !== undefined) updateValues.leadTimeDays = dto.leadTimeDays;
      if (dto.isActive !== undefined) updateValues.isActive = dto.isActive;

      const [updated] = await tx
        .update(pharmacySuppliers)
        .set(updateValues)
        .where(
          and(
            eq(pharmacySuppliers.tenantId, tenantId),
            eq(pharmacySuppliers.id, supplierId),
          ),
        )
        .returning();

      if (!updated) {
        throw new BadRequestException('Failed to update pharmacy supplier.');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_SUPPLIER_UPDATED',
        resource: 'PHARMACY_SUPPLIER',
        resourceId: supplierId,
        details: { changes: dto },
      });

      return updated;
    });
  }

  // ==========================================
  // 3. INVENTORY & BATCH MANAGEMENT
  // ==========================================

  async getBatches(tenantId: string, facilityId: string, productId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [
        eq(pharmacyBatches.tenantId, tenantId),
        eq(pharmacyBatches.facilityId, facilityId),
      ];
      if (productId) {
        conditions.push(eq(pharmacyBatches.productId, productId));
      }

      return await tx
        .select({
          batch: pharmacyBatches,
          product: pharmacyProducts,
        })
        .from(pharmacyBatches)
        .innerJoin(pharmacyProducts, eq(pharmacyBatches.productId, pharmacyProducts.id))
        .where(and(...conditions))
        .orderBy(asc(pharmacyBatches.expiryDate));
    });
  }

  async getBatchById(tenantId: string, batchId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [batch] = await tx
        .select()
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.id, batchId),
          ),
        )
        .limit(1);

      if (!batch) {
        throw new NotFoundException(`Batch with ID ${batchId} not found`);
      }
      return batch;
    });
  }

  /**
   * Receives incoming stock from supplier, creating/updating batch and recording explicit movement ledger.
   * Concurrency protected within ACID database transaction.
   */
  async receiveStock(tenantId: string, facilityId: string, dto: ReceiveStockDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Verify product exists
      const [product] = await tx
        .select()
        .from(pharmacyProducts)
        .where(eq(pharmacyProducts.id, dto.productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${dto.productId} not found.`);
      }

      // 2. Lock or create batch
      const [existingBatch] = await tx
        .select()
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, facilityId),
            eq(pharmacyBatches.productId, dto.productId),
            eq(pharmacyBatches.batchNumber, dto.batchNumber),
          ),
        )
        .limit(1);

      let batchId: string;
      let quantityBefore = 0;
      let quantityAfter = dto.quantityReceived;

      if (existingBatch) {
        // Lock row for concurrency
        await tx.execute(
          dSql`SELECT id FROM pharmacy_batches WHERE id = ${existingBatch.id} FOR UPDATE`,
        );

        quantityBefore = existingBatch.quantityOnHand;
        quantityAfter = quantityBefore + dto.quantityReceived;

        await tx
          .update(pharmacyBatches)
          .set({
            quantityReceived: existingBatch.quantityReceived + dto.quantityReceived,
            quantityOnHand: quantityAfter,
            unitCost: dto.unitCost.toFixed(2),
            sellingPrice: dto.sellingPrice.toFixed(2),
            expiryDate: new Date(dto.expiryDate),
            status: BatchStatus.ACTIVE,
            storageBin: dto.storageBin || existingBatch.storageBin || null,
            updatedAt: new Date(),
          })
          .where(eq(pharmacyBatches.id, existingBatch.id));

        batchId = existingBatch.id;
      } else {
        const [newBatch] = await tx
          .insert(pharmacyBatches)
          .values({
            tenantId,
            facilityId,
            productId: dto.productId,
            batchNumber: dto.batchNumber,
            manufacturer: dto.manufacturer ?? null,
            manufacturedDate: dto.manufacturedDate ? new Date(dto.manufacturedDate) : null,
            expiryDate: new Date(dto.expiryDate),
            quantityReceived: dto.quantityReceived,
            quantityOnHand: dto.quantityReceived,
            quantityReserved: 0,
            unitCost: dto.unitCost.toFixed(2),
            sellingPrice: dto.sellingPrice.toFixed(2),
            status: BatchStatus.ACTIVE,
            storageBin: dto.storageBin ?? null,
          })
          .returning();

        if (!newBatch) {
          throw new BadRequestException('Failed to create inventory batch.');
        }

        batchId = newBatch.id;
      }

      // 3. Record explicit stock-movement entry (NEVER silently overwrite quantity)
      const [movement] = await tx
        .insert(pharmacyStockMovements)
        .values({
          tenantId,
          facilityId,
          productId: dto.productId,
          batchId,
          movementType: StockMovementType.RECEIPT,
          quantity: dto.quantityReceived,
          quantityBefore,
          quantityAfter,
          unitCost: dto.unitCost.toFixed(2),
          referenceType: StockMovementReferenceType.PURCHASE_ORDER,
          referenceId: null,
          supplierId: dto.supplierId ?? null,
          destinationFacilityId: null,
          reason: null,
          notes: dto.notes ?? null,
          performedById: userId,
          movementDate: new Date(),
        })
        .returning();

      if (!movement) {
        throw new BadRequestException('Failed to record stock movement.');
      }

      // 4. Audit trail
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_STOCK_RECEIVED',
        resource: 'PHARMACY_STOCK_MOVEMENT',
        resourceId: movement.id,
        details: {
          productCode: product.itemCode,
          batchNumber: dto.batchNumber,
          quantityReceived: dto.quantityReceived,
          quantityBefore,
          quantityAfter,
        },
      });

      return {
        batchId,
        movementId: movement.id,
        productCode: product.itemCode,
        batchNumber: dto.batchNumber,
        quantityReceived: dto.quantityReceived,
        quantityOnHand: quantityAfter,
      };
    });
  }

  /**
   * Transfers stock from one facility/sub-store to another.
   * Concurrency protected: locks source batch row, validates non-negative stock, adds to destination.
   */
  async transferStock(tenantId: string, sourceFacilityId: string, dto: StockTransferDto, userId: string) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Lock source batch
      const [sourceBatch] = await tx
        .select()
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, sourceFacilityId),
            eq(pharmacyBatches.id, dto.batchId),
          ),
        )
        .limit(1);

      if (!sourceBatch) {
        throw new NotFoundException(`Source batch ${dto.batchId} not found at facility ${sourceFacilityId}.`);
      }

      await tx.execute(
        dSql`SELECT id, quantity_on_hand FROM pharmacy_batches WHERE id = ${sourceBatch.id} FOR UPDATE`,
      );

      const available = sourceBatch.quantityOnHand - sourceBatch.quantityReserved;
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Insufficient stock for transfer. Available: ${available}, Requested: ${dto.quantity}`,
        );
      }

      // 2. Decrement source batch
      const sourceQtyBefore = sourceBatch.quantityOnHand;
      const sourceQtyAfter = sourceQtyBefore - dto.quantity;

      await tx
        .update(pharmacyBatches)
        .set({
          quantityOnHand: sourceQtyAfter,
          status: sourceQtyAfter === 0 ? BatchStatus.DEPLETED : sourceBatch.status,
          updatedAt: new Date(),
        })
        .where(eq(pharmacyBatches.id, sourceBatch.id));

      // 3. Record TRANSFER_OUT movement
      const [outMovement] = await tx
        .insert(pharmacyStockMovements)
        .values({
          tenantId,
          facilityId: sourceFacilityId,
          productId: sourceBatch.productId,
          batchId: sourceBatch.id,
          movementType: StockMovementType.TRANSFER_OUT,
          quantity: -dto.quantity,
          quantityBefore: sourceQtyBefore,
          quantityAfter: sourceQtyAfter,
          unitCost: sourceBatch.unitCost,
          referenceType: StockMovementReferenceType.TRANSFER,
          referenceId: null,
          supplierId: null,
          destinationFacilityId: dto.destinationFacilityId ?? null,
          reason: dto.reason ?? null,
          notes: dto.notes ?? null,
          performedById: userId,
          movementDate: new Date(),
        })
        .returning();

      if (!outMovement) {
        throw new BadRequestException('Failed to record stock transfer movement.');
      }

      // 4. Find or create destination batch
      const [destBatch] = await tx
        .select()
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, dto.destinationFacilityId),
            eq(pharmacyBatches.productId, sourceBatch.productId),
            eq(pharmacyBatches.batchNumber, sourceBatch.batchNumber),
          ),
        )
        .limit(1);

      let destBatchId: string;
      let destQtyBefore = 0;
      let destQtyAfter = dto.quantity;

      if (destBatch) {
        await tx.execute(
          dSql`SELECT id FROM pharmacy_batches WHERE id = ${destBatch.id} FOR UPDATE`,
        );
        destQtyBefore = destBatch.quantityOnHand;
        destQtyAfter = destQtyBefore + dto.quantity;

        await tx
          .update(pharmacyBatches)
          .set({
            quantityReceived: destBatch.quantityReceived + dto.quantity,
            quantityOnHand: destQtyAfter,
            status: BatchStatus.ACTIVE,
            updatedAt: new Date(),
          })
          .where(eq(pharmacyBatches.id, destBatch.id));

        destBatchId = destBatch.id;
      } else {
        const [newDestBatch] = await tx
          .insert(pharmacyBatches)
          .values({
            tenantId,
            facilityId: dto.destinationFacilityId,
            productId: sourceBatch.productId,
            batchNumber: sourceBatch.batchNumber,
            manufacturer: sourceBatch.manufacturer ?? null,
            manufacturedDate: sourceBatch.manufacturedDate ?? null,
            expiryDate: sourceBatch.expiryDate,
            quantityReceived: dto.quantity,
            quantityOnHand: dto.quantity,
            quantityReserved: 0,
            unitCost: sourceBatch.unitCost,
            sellingPrice: sourceBatch.sellingPrice,
            status: BatchStatus.ACTIVE,
            storageBin: sourceBatch.storageBin ?? null,
          })
          .returning();

        if (!newDestBatch) {
          throw new BadRequestException('Failed to create destination inventory batch.');
        }

        destBatchId = newDestBatch.id;
      }

      // 5. Record TRANSFER_IN movement
      await tx.insert(pharmacyStockMovements).values({
        tenantId,
        facilityId: dto.destinationFacilityId,
        productId: sourceBatch.productId,
        batchId: destBatchId,
        movementType: StockMovementType.TRANSFER_IN,
        quantity: dto.quantity,
        quantityBefore: destQtyBefore,
        quantityAfter: destQtyAfter,
        unitCost: sourceBatch.unitCost,
        referenceType: StockMovementReferenceType.TRANSFER,
        referenceId: null,
        supplierId: null,
        destinationFacilityId: null,
        reason: dto.reason ?? null,
        notes: dto.notes ?? null,
        performedById: userId,
        movementDate: new Date(),
      });

      // 6. Audit
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_STOCK_TRANSFERRED',
        resource: 'PHARMACY_STOCK_MOVEMENT',
        resourceId: outMovement.id,
        details: {
          batchNumber: sourceBatch.batchNumber,
          quantity: dto.quantity,
          fromFacility: sourceFacilityId,
          toFacility: dto.destinationFacilityId,
          reason: dto.reason,
        },
      });

      return {
        message: 'Stock transferred successfully',
        sourceBatchId: sourceBatch.id,
        destinationBatchId: destBatchId,
        transferredQuantity: dto.quantity,
        sourceQuantityRemaining: sourceQtyAfter,
        destinationQuantityTotal: destQtyAfter,
      };
    });
  }

  /**
   * Adjusts stock for damage, expired discard, or inventory cycle-count reconciliation.
   * Requires attributable justification (min 10 chars).
   * Concurrency protected.
   */
  async adjustStock(tenantId: string, facilityId: string, dto: StockAdjustmentDto, userId: string) {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('A clinical or inventory audit justification reason of at least 10 characters is required.');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Lock batch row
      const [batch] = await tx
        .select()
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, facilityId),
            eq(pharmacyBatches.id, dto.batchId),
          ),
        )
        .limit(1);

      if (!batch) {
        throw new NotFoundException(`Batch with ID ${dto.batchId} not found.`);
      }

      await tx.execute(
        dSql`SELECT id, quantity_on_hand FROM pharmacy_batches WHERE id = ${batch.id} FOR UPDATE`,
      );

      const quantityBefore = batch.quantityOnHand;
      const quantityAfter = quantityBefore + dto.quantityDelta;

      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Adjustment of ${dto.quantityDelta} would cause negative stock. Current on hand: ${quantityBefore}`,
        );
      }

      // 2. Update batch
      let newStatus = batch.status;
      if (quantityAfter === 0) {
        newStatus = BatchStatus.DEPLETED;
      } else if (batch.status === BatchStatus.DEPLETED && quantityAfter > 0) {
        newStatus = BatchStatus.ACTIVE;
      }

      await tx
        .update(pharmacyBatches)
        .set({
          quantityOnHand: quantityAfter,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(pharmacyBatches.id, batch.id));

      // 3. Record explicit stock-movement entry
      const [movement] = await tx
        .insert(pharmacyStockMovements)
        .values({
          tenantId,
          facilityId,
          productId: batch.productId,
          batchId: batch.id,
          movementType: dto.movementType,
          quantity: dto.quantityDelta,
          quantityBefore,
          quantityAfter,
          unitCost: batch.unitCost,
          referenceType: StockMovementReferenceType.RECONCILIATION,
          referenceId: null,
          supplierId: null,
          destinationFacilityId: null,
          reason: dto.reason ?? null,
          notes: dto.notes ?? null,
          performedById: userId,
          movementDate: new Date(),
        })
        .returning();

      if (!movement) {
        throw new BadRequestException('Failed to record stock adjustment movement.');
      }

      // 4. Audit trail
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'PHARMACY_STOCK_ADJUSTED',
        resource: 'PHARMACY_STOCK_MOVEMENT',
        resourceId: movement.id,
        details: {
          batchNumber: batch.batchNumber,
          movementType: dto.movementType,
          quantityDelta: dto.quantityDelta,
          quantityBefore,
          quantityAfter,
          reason: dto.reason,
        },
      });

      return {
        batchId: batch.id,
        movementId: movement.id,
        batchNumber: batch.batchNumber,
        movementType: dto.movementType,
        quantityDelta: dto.quantityDelta,
        quantityBefore,
        quantityAfter,
        reason: dto.reason,
      };
    });
  }

  // ==========================================
  // 4. PRESCRIPTION WORKLISTS
  // ==========================================

  async getPrescriptionWorklist(tenantId: string, facilityId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [
        eq(clinicalOrders.tenantId, tenantId),
        inArray(clinicalOrders.orderType, ['MEDICATION_REQUEST', 'MEDICATION']),
      ];

      if (facilityId) {
        conditions.push(eq(clinicalOrders.facilityId, facilityId));
      }

      const rows = await tx
        .select({
          order: clinicalOrders,
          request: medicationRequests,
          patient: patients,
          encounter: encounters,
          practitioner: users,
        })
        .from(clinicalOrders)
        .innerJoin(medicationRequests, eq(clinicalOrders.id, medicationRequests.orderId))
        .innerJoin(patients, eq(clinicalOrders.patientId, patients.id))
        .innerJoin(encounters, eq(clinicalOrders.encounterId, encounters.id))
        .leftJoin(users, eq(clinicalOrders.orderingPractitionerId, users.id))
        .where(and(...conditions))
        .orderBy(desc(clinicalOrders.orderedAt));

      // Calculate fulfilled quantities for each medication request
      const worklist = [];
      for (const row of rows) {
        const [dispenseSummary] = await tx
          .select({
            totalDispensed: dSql<number>`COALESCE(SUM(${medicationDispenses.quantityDispensed}), 0)`,
            lastDispensedAt: dSql<string>`MAX(${medicationDispenses.dispensedAt})`,
          })
          .from(medicationDispenses)
          .where(
            and(
              eq(medicationDispenses.tenantId, tenantId),
              eq(medicationDispenses.medicationRequestId, row.request.id),
              dSql`${medicationDispenses.status} != 'ENTERED_IN_ERROR'`,
            ),
          );

        const totalDispensed = Number(dispenseSummary?.totalDispensed || 0);
        const quantityRemaining = Math.max(0, row.request.totalQuantity - totalDispensed);

        let fulfillmentStatus = 'PENDING';
        if (totalDispensed >= row.request.totalQuantity) {
          fulfillmentStatus = 'FULLY_DISPENSED';
        } else if (totalDispensed > 0) {
          fulfillmentStatus = 'PARTIALLY_DISPENSED';
        }

        worklist.push({
          orderId: row.order.id,
          orderNumber: row.order.orderNumber,
          orderStatus: row.order.status,
          priority: row.order.priority,
          orderedAt: row.order.orderedAt,
          orderingPractitioner: row.practitioner ? row.practitioner.fullName : 'Authorized Prescriber',
          patientId: row.patient.id,
          patientName: `${row.patient.firstName} ${row.patient.lastName}`,
          patientMrn: row.patient.mrn,
          encounterId: row.encounter.id,
          encounterType: row.encounter.encounterType,
          medicationRequestId: row.request.id,
          medicationCode: row.request.medicationCode,
          medicationName: row.request.medicationName,
          dosage: row.request.dosage,
          dosageUnit: row.request.dosageUnit,
          route: row.request.route,
          frequency: row.request.frequency,
          durationValue: row.request.durationValue,
          durationUnit: row.request.durationUnit,
          instructions: row.request.instructions,
          quantityPrescribed: row.request.totalQuantity,
          quantityDispensed: totalDispensed,
          quantityRemaining,
          fulfillmentStatus,
          lastDispensedAt: dispenseSummary?.lastDispensedAt || null,
        });
      }

      return worklist;
    });
  }

  // ==========================================
  // 5. MEDICATION DISPENSING (WITH CONCURRENCY CONTROLS)
  // ==========================================

  /**
   * Dispenses medication against a prescription.
   * Concurrency and negative stock controls:
   * - Uses database row locks (`SELECT ... FOR UPDATE`)
   * - Automatic FEFO batch selection or user batch validation
   * - Prevents double-dispensing and negative inventory
   * - Creates immutable stock-movement records
   */
  async dispenseMedication(
    tenantId: string,
    facilityId: string,
    dto: DispenseMedicationDto,
    dispenserId: string,
  ) {
    if (dto.quantityToDispense <= 0) {
      throw new BadRequestException('Dispense quantity must be greater than zero.');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Verify clinical order and medication request
      const [order] = await tx
        .select()
        .from(clinicalOrders)
        .where(
          and(
            eq(clinicalOrders.tenantId, tenantId),
            eq(clinicalOrders.id, dto.orderId),
          ),
        )
        .limit(1);

      if (!order) {
        throw new NotFoundException(`Clinical order ${dto.orderId} not found.`);
      }

      if (order.status === 'CANCELLED') {
        throw new BadRequestException('Cannot dispense medication for a cancelled clinical order.');
      }

      const [medRequest] = await tx
        .select()
        .from(medicationRequests)
        .where(
          and(
            eq(medicationRequests.tenantId, tenantId),
            eq(medicationRequests.id, dto.medicationRequestId),
          ),
        )
        .limit(1);

      if (!medRequest) {
        throw new NotFoundException(`Medication request ${dto.medicationRequestId} not found.`);
      }

      // 2. Concurrency Lock: Lock existing dispenses for this request to calculate already dispensed quantity accurately
      const existingDispenses = await tx.execute(
        dSql`SELECT id, quantity_dispensed, status FROM medication_dispenses 
             WHERE tenant_id = ${tenantId} AND medication_request_id = ${dto.medicationRequestId} 
             FOR UPDATE`,
      );

      const alreadyDispensed = (existingDispenses as any[])
        .filter((d: any) => d.status !== 'ENTERED_IN_ERROR')
        .reduce((sum: number, d: any) => sum + Number(d.quantity_dispensed), 0);

      const remainingAllowed = medRequest.totalQuantity - alreadyDispensed;

      if (remainingAllowed <= 0) {
        throw new BadRequestException(
          `Medication request is already fully dispensed (${alreadyDispensed}/${medRequest.totalQuantity} units).`,
        );
      }

      if (dto.quantityToDispense > remainingAllowed) {
        throw new BadRequestException(
          `Requested dispense quantity (${dto.quantityToDispense}) exceeds remaining prescribed quantity (${remainingAllowed}).`,
        );
      }

      // 3. Locate matching pharmacy product
      const [product] = await tx
        .select()
        .from(pharmacyProducts)
        .where(
          and(
            eq(pharmacyProducts.tenantId, tenantId),
            or(
              eq(pharmacyProducts.itemCode, medRequest.medicationCode),
              eq(pharmacyProducts.atcCode, medRequest.medicationCode),
              dSql`LOWER(${pharmacyProducts.genericName}) = LOWER(${medRequest.medicationName})`,
              dSql`LOWER(${medRequest.medicationName}) LIKE '%' || LOWER(${pharmacyProducts.genericName}) || '%'`,
            ),
          ),
        )
        .limit(1);

      if (!product) {
        throw new NotFoundException(
          `No catalogue product found matching medication "${medRequest.medicationName}" (${medRequest.medicationCode}).`,
        );
      }

      // 4. Batch Selection with FOR UPDATE Locking
      let allocatedBatches: Array<{
        batchId: string;
        batchNumber: string;
        allocatedQuantity: number;
        unitCost: string;
        sellingPrice: string;
      }> = [];

      if (dto.batchId) {
        // Specific user-selected batch
        await tx.execute(
          dSql`SELECT id, quantity_on_hand, quantity_reserved, status, expiry_date 
               FROM pharmacy_batches 
               WHERE id = ${dto.batchId} AND facility_id = ${facilityId} AND tenant_id = ${tenantId} 
               FOR UPDATE`,
        );

        const [batch] = await tx
          .select()
          .from(pharmacyBatches)
          .where(
            and(
              eq(pharmacyBatches.tenantId, tenantId),
              eq(pharmacyBatches.facilityId, facilityId),
              eq(pharmacyBatches.id, dto.batchId),
            ),
          )
          .limit(1);

        if (!batch) {
          throw new NotFoundException(`Batch ${dto.batchId} not found at facility.`);
        }

        if (batch.status !== BatchStatus.ACTIVE) {
          throw new BadRequestException(`Batch ${batch.batchNumber} is not active (Status: ${batch.status}).`);
        }

        if (new Date(batch.expiryDate).getTime() <= Date.now()) {
          throw new BadRequestException(`Batch ${batch.batchNumber} expired on ${batch.expiryDate}. Dispensing prohibited.`);
        }

        const available = batch.quantityOnHand - batch.quantityReserved;
        if (available < dto.quantityToDispense) {
          throw new BadRequestException(
            `Insufficient stock in batch ${batch.batchNumber}. Available: ${available}, Requested: ${dto.quantityToDispense}`,
          );
        }

        allocatedBatches.push({
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          allocatedQuantity: dto.quantityToDispense,
          unitCost: batch.unitCost,
          sellingPrice: batch.sellingPrice,
        });
      } else {
        // Automatic First-Expiry, First-Out (FEFO) allocation with row locking
        await tx.execute(
          dSql`SELECT id, batch_number, expiry_date, quantity_on_hand, quantity_reserved, status 
               FROM pharmacy_batches 
               WHERE product_id = ${product.id} AND facility_id = ${facilityId} AND tenant_id = ${tenantId} 
               AND status = 'ACTIVE' AND expiry_date > NOW() 
               ORDER BY expiry_date ASC 
               FOR UPDATE`,
        );

        const availableBatches = await tx
          .select()
          .from(pharmacyBatches)
          .where(
            and(
              eq(pharmacyBatches.tenantId, tenantId),
              eq(pharmacyBatches.facilityId, facilityId),
              eq(pharmacyBatches.productId, product.id),
              eq(pharmacyBatches.status, BatchStatus.ACTIVE),
              dSql`${pharmacyBatches.expiryDate} > NOW()`,
            ),
          )
          .orderBy(asc(pharmacyBatches.expiryDate));

        const allocationPlan = allocateBatchesFEFO(
          availableBatches.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            quantityOnHand: b.quantityOnHand,
            quantityReserved: b.quantityReserved,
            unitCost: Number(b.unitCost),
            sellingPrice: Number(b.sellingPrice),
            status: b.status,
          })),
          dto.quantityToDispense,
        );

        if (!allocationPlan.isFullyAllocated) {
          throw new BadRequestException(
            `Insufficient inventory on hand across active batches for ${product.genericName}. Allocated: ${allocationPlan.allocatedTotal}, Shortfall: ${allocationPlan.shortfall}`,
          );
        }

        allocatedBatches = allocationPlan.allocations.map((a) => ({
          batchId: a.batchId,
          batchNumber: a.batchNumber,
          allocatedQuantity: a.allocatedQuantity,
          unitCost: a.unitCost.toFixed(2),
          sellingPrice: a.sellingPrice.toFixed(2),
        }));
      }

      // 5. Determine Dispense Type
      const newTotalDispensed = alreadyDispensed + dto.quantityToDispense;
      let calculatedDispenseType: DispenseType;
      if (newTotalDispensed === medRequest.totalQuantity) {
        calculatedDispenseType = alreadyDispensed > 0 ? DispenseType.BALANCE_COMPLETION : DispenseType.FULL;
      } else {
        calculatedDispenseType = DispenseType.PARTIAL;
      }

      const dispenseType = dto.dispenseType || calculatedDispenseType;
      const quantityRemaining = medRequest.totalQuantity - newTotalDispensed;

      // 6. Generate Dispense Number
      const dispenseNumber = `DISP-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

      // 7. Insert medication_dispenses record
      const [dispense] = await tx
        .insert(medicationDispenses)
        .values({
          tenantId,
          facilityId,
          orderId: dto.orderId,
          medicationRequestId: dto.medicationRequestId,
          patientId: dto.patientId,
          encounterId: dto.encounterId || order.encounterId,
          dispenseNumber,
          status: MedicationDispenseStatus.COMPLETED,
          dispenseType,
          quantityPrescribed: medRequest.totalQuantity,
          quantityDispensed: dto.quantityToDispense,
          quantityRemaining,
          daysSupply: dto.daysSupply || medRequest.durationValue || 1,
          dosageInstructions: dto.dosageInstructions || medRequest.instructions || 'As prescribed',
          dispenserId,
          dispensedAt: new Date(),
          authorizedById: dispenserId,
          substitutionReason: dto.substitutionReason ?? null,
          patientCounselingNotes: dto.patientCounselingNotes ?? null,
          notes: dto.notes ?? null,
        })
        .returning();

      if (!dispense) {
        throw new BadRequestException('Failed to create medication dispense record.');
      }

      // 8. Process allocated batches, decrement stock, and record explicit movement records
      const dispenseItems = [];
      for (const alloc of allocatedBatches) {
        const [batch] = await tx
          .select()
          .from(pharmacyBatches)
          .where(eq(pharmacyBatches.id, alloc.batchId))
          .limit(1);

        if (!batch) {
          throw new NotFoundException(`Allocated batch ${alloc.batchId} not found.`);
        }

        const qtyBefore = batch.quantityOnHand;
        const qtyAfter = qtyBefore - alloc.allocatedQuantity;

        if (qtyAfter < 0) {
          throw new BadRequestException(`Negative inventory detected on batch ${alloc.batchNumber}. Dispensing aborted.`);
        }

        // Update batch inventory
        await tx
          .update(pharmacyBatches)
          .set({
            quantityOnHand: qtyAfter,
            status: qtyAfter === 0 ? BatchStatus.DEPLETED : batch.status,
            updatedAt: new Date(),
          })
          .where(eq(pharmacyBatches.id, alloc.batchId));

        // Create dispense item breakdown
        const totalPrice = (Number(alloc.sellingPrice) * alloc.allocatedQuantity).toFixed(2);
        const [item] = await tx
          .insert(medicationDispenseItems)
          .values({
            tenantId,
            dispenseId: dispense.id,
            batchId: alloc.batchId,
            productId: product.id,
            quantityDispensed: alloc.allocatedQuantity,
            unitPrice: alloc.sellingPrice,
            totalPrice,
          })
          .returning();
        dispenseItems.push(item);

        // Record explicit stock movement in audit ledger
        await tx.insert(pharmacyStockMovements).values({
          tenantId,
          facilityId,
          productId: product.id,
          batchId: alloc.batchId,
          movementType:
            dispenseType === DispenseType.PARTIAL
              ? StockMovementType.PARTIAL_DISPENSATION
              : StockMovementType.DISPENSATION,
          quantity: -alloc.allocatedQuantity, // Negative deduction
          quantityBefore: qtyBefore,
          quantityAfter: qtyAfter,
          unitCost: alloc.unitCost,
          referenceType: StockMovementReferenceType.DISPENSE,
          referenceId: dispense.id,
          supplierId: null,
          destinationFacilityId: null,
          reason: null,
          notes: `Dispensed on ${dispenseNumber} to patient ${dto.patientId}`,
          performedById: dispenserId,
          movementDate: new Date(),
        });
      }

      // 9. Update order status if all medication requests are fulfilled
      if (quantityRemaining === 0) {
        await tx
          .update(clinicalOrders)
          .set({
            status: 'FULFILLED',
            updatedAt: new Date(),
          })
          .where(eq(clinicalOrders.id, dto.orderId));
      } else {
        await tx
          .update(clinicalOrders)
          .set({
            status: 'IN_PROGRESS',
            updatedAt: new Date(),
          })
          .where(eq(clinicalOrders.id, dto.orderId));
      }

      // 10. Attributable audit event
      await this.auditService.recordEvent({
        tenantId,
        userId: dispenserId,
        action: 'MEDICATION_DISPENSED',
        resource: 'MEDICATION_DISPENSE',
        resourceId: dispense.id,
        details: {
          dispenseNumber,
          dispenseType,
          productCode: product.itemCode,
          quantityDispensed: dto.quantityToDispense,
          quantityRemaining,
          allocatedBatches: allocatedBatches.map((b) => ({
            batchNumber: b.batchNumber,
            quantity: b.allocatedQuantity,
          })),
        },
      });

      return {
        dispense,
        items: dispenseItems,
        allocatedBatches,
        product,
      };
    });
  }

  // ==========================================
  // 6. CONTROLLED RETURNS & REVERSALS
  // ==========================================

  /**
   * Reverses a completed medication dispense and returns stock to batches.
   * Requires attributable reason of at least 10 characters.
   * Concurrency protected.
   */
  async returnDispense(
    tenantId: string,
    facilityId: string,
    dto: ReturnDispensedMedicationDto,
    userId: string,
  ) {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('A controlled return justification of at least 10 characters is mandatory.');
    }

    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Lock dispense record
      const [dispense] = await tx
        .select()
        .from(medicationDispenses)
        .where(
          and(
            eq(medicationDispenses.tenantId, tenantId),
            eq(medicationDispenses.id, dto.dispenseId),
          ),
        )
        .limit(1);

      if (!dispense) {
        throw new NotFoundException(`Dispense record ${dto.dispenseId} not found.`);
      }

      if (dispense.status === MedicationDispenseStatus.ENTERED_IN_ERROR) {
        throw new BadRequestException('This dispensation event has already been reversed.');
      }

      await tx.execute(
        dSql`SELECT id FROM medication_dispenses WHERE id = ${dispense.id} FOR UPDATE`,
      );

      // 2. Fetch allocated items for this dispense
      const items = await tx
        .select()
        .from(medicationDispenseItems)
        .where(
          and(
            eq(medicationDispenseItems.tenantId, tenantId),
            eq(medicationDispenseItems.dispenseId, dispense.id),
          ),
        );

      // 3. Reverse inventory deduction on each batch
      for (const item of items) {
        const [batch] = await tx
          .select()
          .from(pharmacyBatches)
          .where(eq(pharmacyBatches.id, item.batchId))
          .limit(1);

        if (batch) {
          await tx.execute(
            dSql`SELECT id FROM pharmacy_batches WHERE id = ${batch.id} FOR UPDATE`,
          );

          const qtyBefore = batch.quantityOnHand;
          const qtyAfter = qtyBefore + item.quantityDispensed;

          await tx
            .update(pharmacyBatches)
            .set({
              quantityOnHand: qtyAfter,
              status: batch.status === BatchStatus.DEPLETED ? BatchStatus.ACTIVE : batch.status,
              updatedAt: new Date(),
            })
            .where(eq(pharmacyBatches.id, batch.id));

          // Record explicit RETURN_TO_STOCK movement
          await tx.insert(pharmacyStockMovements).values({
            tenantId,
            facilityId,
            productId: item.productId,
            batchId: item.batchId,
            movementType: StockMovementType.RETURN_TO_STOCK,
            quantity: item.quantityDispensed, // Positive addition back to inventory
            quantityBefore: qtyBefore,
            quantityAfter: qtyAfter,
            unitCost: item.unitPrice,
            referenceType: StockMovementReferenceType.RETURN,
            referenceId: dispense.id,
            supplierId: null,
            destinationFacilityId: null,
            reason: dto.reason,
            notes: dto.notes ?? null,
            performedById: userId,
            movementDate: new Date(),
          });
        }
      }

      // 4. Update dispense status to ENTERED_IN_ERROR
      const [updatedDispense] = await tx
        .update(medicationDispenses)
        .set({
          status: MedicationDispenseStatus.ENTERED_IN_ERROR,
          notes: `[REVERSED] ${dto.reason}${dto.notes ? ' - ' + dto.notes : ''}`,
          updatedAt: new Date(),
        })
        .where(eq(medicationDispenses.id, dispense.id))
        .returning();

      // 5. Restore clinical order status to SUBMITTED if needed
      await tx
        .update(clinicalOrders)
        .set({
          status: 'SUBMITTED',
          updatedAt: new Date(),
        })
        .where(eq(clinicalOrders.id, dispense.orderId));

      // 6. Audit trail
      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: 'MEDICATION_DISPENSE_REVERSED',
        resource: 'MEDICATION_DISPENSE',
        resourceId: dispense.id,
        details: {
          dispenseNumber: dispense.dispenseNumber,
          returnedQuantity: dispense.quantityDispensed,
          reason: dto.reason,
        },
      });

      return {
        message: 'Medication dispense successfully reversed and stock returned to inventory.',
        dispense: updatedDispense,
        returnedItemsCount: items.length,
      };
    });
  }

  // ==========================================
  // 7. MEDICATION ADMINISTRATION (BEDSIDE / CLINIC)
  // ==========================================

  async administerMedication(
    tenantId: string,
    facilityId: string,
    dto: AdministerMedicationDto,
    administratorId: string,
  ) {
    return await withTenantTransaction(tenantId, async (tx) => {
      // 1. Verify medication request
      const [medRequest] = await tx
        .select()
        .from(medicationRequests)
        .where(
          and(
            eq(medicationRequests.tenantId, tenantId),
            eq(medicationRequests.id, dto.medicationRequestId),
          ),
        )
        .limit(1);

      if (!medRequest) {
        throw new NotFoundException(`Medication request ${dto.medicationRequestId} not found.`);
      }

      // 2. Insert administration record
      const [admin] = await tx
        .insert(medicationAdministrations)
        .values({
          tenantId,
          facilityId,
          dispenseId: dto.dispenseId ?? null,
          medicationRequestId: dto.medicationRequestId,
          encounterId: dto.encounterId,
          patientId: dto.patientId,
          administratorId,
          administeredAt: new Date(),
          status: dto.status || MedicationAdministrationStatus.COMPLETED,
          doseQuantity: dto.doseQuantity.toFixed(2),
          doseUnit: dto.doseUnit,
          route: dto.route || medRequest.route || 'ORAL',
          site: dto.site ?? null,
          reasonNotAdministered: dto.reasonNotAdministered ?? null,
          notes: dto.notes ?? null,
        })
        .returning();

      if (!admin) {
        throw new BadRequestException('Failed to record medication administration.');
      }

      // 3. Audit trail
      await this.auditService.recordEvent({
        tenantId,
        userId: administratorId,
        action: 'MEDICATION_ADMINISTERED',
        resource: 'MEDICATION_ADMINISTRATION',
        resourceId: admin.id,
        details: {
          medicationName: medRequest.medicationName,
          status: admin.status,
          doseQuantity: dto.doseQuantity,
          doseUnit: dto.doseUnit,
        },
      });

      return admin;
    });
  }

  async getAdministrations(tenantId: string, encounterId?: string, patientId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(medicationAdministrations.tenantId, tenantId)];
      if (encounterId) {
        conditions.push(eq(medicationAdministrations.encounterId, encounterId));
      }
      if (patientId) {
        conditions.push(eq(medicationAdministrations.patientId, patientId));
      }

      return await tx
        .select({
          admin: medicationAdministrations,
          request: medicationRequests,
          administrator: users,
        })
        .from(medicationAdministrations)
        .innerJoin(
          medicationRequests,
          eq(medicationAdministrations.medicationRequestId, medicationRequests.id),
        )
        .leftJoin(users, eq(medicationAdministrations.administratorId, users.id))
        .where(and(...conditions))
        .orderBy(desc(medicationAdministrations.administeredAt));
    });
  }

  // ==========================================
  // 8. STOCK MOVEMENTS LEDGER & AUDIT
  // ==========================================

  async getStockMovements(
    tenantId: string,
    facilityId?: string,
    productId?: string,
    batchId?: string,
    limit: number = 100,
  ) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [eq(pharmacyStockMovements.tenantId, tenantId)];
      if (facilityId) {
        conditions.push(eq(pharmacyStockMovements.facilityId, facilityId));
      }
      if (productId) {
        conditions.push(eq(pharmacyStockMovements.productId, productId));
      }
      if (batchId) {
        conditions.push(eq(pharmacyStockMovements.batchId, batchId));
      }

      return await tx
        .select({
          movement: pharmacyStockMovements,
          product: pharmacyProducts,
          batch: pharmacyBatches,
          performedBy: users,
        })
        .from(pharmacyStockMovements)
        .innerJoin(pharmacyProducts, eq(pharmacyStockMovements.productId, pharmacyProducts.id))
        .leftJoin(pharmacyBatches, eq(pharmacyStockMovements.batchId, pharmacyBatches.id))
        .leftJoin(users, eq(pharmacyStockMovements.performedById, users.id))
        .where(and(...conditions))
        .orderBy(desc(pharmacyStockMovements.movementDate))
        .limit(limit);
    });
  }

  // ==========================================
  // 9. ALERTS, VALUATION & REPORTING
  // ==========================================

  async getLowStockAlerts(tenantId: string, facilityId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      // Aggregate stock on hand per product
      const stockSummary = await tx
        .select({
          productId: pharmacyBatches.productId,
          totalOnHand: dSql<number>`COALESCE(SUM(${pharmacyBatches.quantityOnHand}), 0)`,
        })
        .from(pharmacyBatches)
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, facilityId),
            eq(pharmacyBatches.status, BatchStatus.ACTIVE),
          ),
        )
        .groupBy(pharmacyBatches.productId);

      const stockMap = new Map<string, number>();
      for (const row of stockSummary) {
        stockMap.set(row.productId, Number(row.totalOnHand));
      }

      const allProducts = await tx
        .select()
        .from(pharmacyProducts)
        .where(eq(pharmacyProducts.isActive, true));

      const alerts = [];
      for (const product of allProducts) {
        const onHand = stockMap.get(product.id) || 0;
        if (onHand <= product.reorderLevel) {
          alerts.push({
            productId: product.id,
            itemCode: product.itemCode,
            genericName: product.genericName,
            brandName: product.brandName,
            category: product.category,
            quantityOnHand: onHand,
            reorderLevel: product.reorderLevel,
            shortfall: Math.max(0, product.reorderLevel - onHand),
            isOutOfStock: onHand === 0,
            unitPrice: product.unitPrice,
          });
        }
      }

      return alerts.sort((a, b) => a.quantityOnHand - b.quantityOnHand);
    });
  }

  async getExpiryAlerts(tenantId: string, facilityId: string, daysThreshold: number = 90) {
    return await withTenantContext(tenantId, async (tx) => {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

      const rows = await tx
        .select({
          batch: pharmacyBatches,
          product: pharmacyProducts,
        })
        .from(pharmacyBatches)
        .innerJoin(pharmacyProducts, eq(pharmacyBatches.productId, pharmacyProducts.id))
        .where(
          and(
            eq(pharmacyBatches.tenantId, tenantId),
            eq(pharmacyBatches.facilityId, facilityId),
            lte(pharmacyBatches.expiryDate, thresholdDate),
            dSql`${pharmacyBatches.quantityOnHand} > 0`,
          ),
        )
        .orderBy(asc(pharmacyBatches.expiryDate));

      return rows.map((r) => {
        const riskLevel = calculateExpiryRisk(r.batch.expiryDate, now, 90, 30);
        const daysToExpiry = Math.ceil(
          (new Date(r.batch.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          batchId: r.batch.id,
          batchNumber: r.batch.batchNumber,
          productId: r.product.id,
          itemCode: r.product.itemCode,
          genericName: r.product.genericName,
          quantityOnHand: r.batch.quantityOnHand,
          expiryDate: r.batch.expiryDate,
          daysToExpiry,
          riskLevel,
          unitCost: r.batch.unitCost,
          totalAtRiskCost: (Number(r.batch.unitCost) * r.batch.quantityOnHand).toFixed(2),
        };
      });
    });
  }

  async getInventoryValuation(tenantId: string, facilityId?: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const conditions = [
        eq(pharmacyBatches.tenantId, tenantId),
        dSql`${pharmacyBatches.quantityOnHand} > 0`,
      ];
      if (facilityId) {
        conditions.push(eq(pharmacyBatches.facilityId, facilityId));
      }

      const rows = await tx
        .select({
          productId: pharmacyBatches.productId,
          itemCode: pharmacyProducts.itemCode,
          genericName: pharmacyProducts.genericName,
          category: pharmacyProducts.category,
          totalQuantityOnHand: dSql<number>`SUM(${pharmacyBatches.quantityOnHand})`,
          totalQuantityReserved: dSql<number>`SUM(${pharmacyBatches.quantityReserved})`,
          totalValuationCost: dSql<number>`SUM(${pharmacyBatches.quantityOnHand} * ${pharmacyBatches.unitCost})`,
          totalValuationRetail: dSql<number>`SUM(${pharmacyBatches.quantityOnHand} * ${pharmacyBatches.sellingPrice})`,
          activeBatchCount: dSql<number>`COUNT(${pharmacyBatches.id})`,
        })
        .from(pharmacyBatches)
        .innerJoin(pharmacyProducts, eq(pharmacyBatches.productId, pharmacyProducts.id))
        .where(and(...conditions))
        .groupBy(
          pharmacyBatches.productId,
          pharmacyProducts.itemCode,
          pharmacyProducts.genericName,
          pharmacyProducts.category,
        );

      let grandTotalCost = 0;
      let grandTotalRetail = 0;
      let grandTotalUnits = 0;

      const items = rows.map((r) => {
        const cost = Number(r.totalValuationCost || 0);
        const retail = Number(r.totalValuationRetail || 0);
        const units = Number(r.totalQuantityOnHand || 0);

        grandTotalCost += cost;
        grandTotalRetail += retail;
        grandTotalUnits += units;

        return {
          productId: r.productId,
          itemCode: r.itemCode,
          genericName: r.genericName,
          category: r.category,
          totalQuantityOnHand: units,
          totalQuantityReserved: Number(r.totalQuantityReserved || 0),
          totalValuationCost: Number(cost.toFixed(2)),
          totalValuationRetail: Number(retail.toFixed(2)),
          activeBatchCount: Number(r.activeBatchCount || 0),
        };
      });

      return {
        summary: {
          grandTotalCost: Number(grandTotalCost.toFixed(2)),
          grandTotalRetail: Number(grandTotalRetail.toFixed(2)),
          grandTotalUnits,
          productCount: items.length,
        },
        items,
      };
    });
  }

  // ==========================================
  // 10. FHIR R4 SERIALIZATIONS
  // ==========================================

  async exportFHIRMedication(tenantId: string, productId: string) {
    const product = await this.getProductById(tenantId, productId);
    return toFHIRMedication({
      id: product.id,
      itemCode: product.itemCode,
      genericName: product.genericName,
      brandName: product.brandName || undefined,
      atcCode: product.atcCode || undefined,
      form: product.form,
      strength: product.strength,
      strengthUnit: product.strengthUnit,
      isActive: product.isActive,
    });
  }

  async exportFHIRMedicationDispense(tenantId: string, dispenseId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .select({
          dispense: medicationDispenses,
          request: medicationRequests,
        })
        .from(medicationDispenses)
        .innerJoin(
          medicationRequests,
          eq(medicationDispenses.medicationRequestId, medicationRequests.id),
        )
        .where(
          and(
            eq(medicationDispenses.tenantId, tenantId),
            eq(medicationDispenses.id, dispenseId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new NotFoundException(`Dispense record ${dispenseId} not found.`);
      }

      return toFHIRMedicationDispense({
        id: row.dispense.id,
        dispenseNumber: row.dispense.dispenseNumber,
        status: row.dispense.status,
        dispenseType: row.dispense.dispenseType,
        patientId: row.dispense.patientId,
        encounterId: row.dispense.encounterId,
        orderId: row.dispense.orderId,
        medicationRequestId: row.dispense.medicationRequestId,
        medicationName: row.request.medicationName,
        medicationCode: row.request.medicationCode,
        quantityDispensed: row.dispense.quantityDispensed,
        daysSupply: row.dispense.daysSupply || undefined,
        dispenserId: row.dispense.dispenserId,
        dispensedAt: row.dispense.dispensedAt,
        dosageInstructions: row.dispense.dosageInstructions || undefined,
        substitutionReason: row.dispense.substitutionReason || undefined,
        patientCounselingNotes: row.dispense.patientCounselingNotes || undefined,
        notes: row.dispense.notes || undefined,
      });
    });
  }

  async exportFHIRMedicationAdministration(tenantId: string, administrationId: string) {
    return await withTenantContext(tenantId, async (tx) => {
      const [row] = await tx
        .select({
          admin: medicationAdministrations,
          request: medicationRequests,
        })
        .from(medicationAdministrations)
        .innerJoin(
          medicationRequests,
          eq(medicationAdministrations.medicationRequestId, medicationRequests.id),
        )
        .where(
          and(
            eq(medicationAdministrations.tenantId, tenantId),
            eq(medicationAdministrations.id, administrationId),
          ),
        )
        .limit(1);

      if (!row) {
        throw new NotFoundException(`Administration record ${administrationId} not found.`);
      }

      return toFHIRMedicationAdministration({
        id: row.admin.id,
        status: row.admin.status,
        patientId: row.admin.patientId,
        encounterId: row.admin.encounterId,
        medicationRequestId: row.admin.medicationRequestId,
        dispenseId: row.admin.dispenseId || undefined,
        medicationName: row.request.medicationName,
        doseQuantity: Number(row.admin.doseQuantity),
        doseUnit: row.admin.doseUnit,
        route: row.admin.route,
        site: row.admin.site || undefined,
        administratorId: row.admin.administratorId,
        administeredAt: row.admin.administeredAt,
        reasonNotAdministered: row.admin.reasonNotAdministered || undefined,
        notes: row.admin.notes || undefined,
      });
    });
  }
}
