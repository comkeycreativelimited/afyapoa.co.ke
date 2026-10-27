import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  MinLength,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PharmacyProductCategory,
  DrugSchedule,
  StorageCondition,
  DispensingUnit,
  PackagingUnit,
  StockMovementType,
  DispenseType,
  MedicationAdministrationStatus,
} from '@afyapoa/domain-core';

export class CreatePharmacyProductDto {
  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @IsString()
  @IsNotEmpty()
  genericName!: string;

  @IsString()
  @IsOptional()
  brandName?: string;

  @IsString()
  @IsOptional()
  atcCode?: string;

  @IsString()
  @IsOptional()
  kemlCategory?: string;

  @IsEnum(DrugSchedule)
  drugSchedule!: DrugSchedule;

  @IsEnum(PharmacyProductCategory)
  category!: PharmacyProductCategory;

  @IsString()
  @IsNotEmpty()
  form!: string;

  @IsString()
  @IsNotEmpty()
  strength!: string;

  @IsString()
  @IsNotEmpty()
  strengthUnit!: string;

  @IsEnum(DispensingUnit)
  dispensingUnit!: DispensingUnit;

  @IsEnum(PackagingUnit)
  packagingUnit!: PackagingUnit;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  packagingSize!: number;

  @IsEnum(StorageCondition)
  storageCondition!: StorageCondition;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderLevel!: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxStockLevel?: number;

  @IsBoolean()
  @IsOptional()
  prescriptionRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  controlledSubstance?: boolean;
}

export class UpdatePharmacyProductDto {
  @IsString()
  @IsOptional()
  genericName?: string;

  @IsString()
  @IsOptional()
  brandName?: string;

  @IsString()
  @IsOptional()
  atcCode?: string;

  @IsString()
  @IsOptional()
  kemlCategory?: string;

  @IsEnum(DrugSchedule)
  @IsOptional()
  drugSchedule?: DrugSchedule;

  @IsEnum(PharmacyProductCategory)
  @IsOptional()
  category?: PharmacyProductCategory;

  @IsString()
  @IsOptional()
  form?: string;

  @IsString()
  @IsOptional()
  strength?: string;

  @IsString()
  @IsOptional()
  strengthUnit?: string;

  @IsEnum(DispensingUnit)
  @IsOptional()
  dispensingUnit?: DispensingUnit;

  @IsEnum(PackagingUnit)
  @IsOptional()
  packagingUnit?: PackagingUnit;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  packagingSize?: number;

  @IsEnum(StorageCondition)
  @IsOptional()
  storageCondition?: StorageCondition;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  reorderLevel?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  maxStockLevel?: number;

  @IsBoolean()
  @IsOptional()
  prescriptionRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  controlledSubstance?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreatePharmacySupplierDto {
  @IsString()
  @IsNotEmpty()
  supplierCode!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  ppbLicenseNumber?: string;

  @IsString()
  @IsOptional()
  kraPin?: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  physicalAddress?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  leadTimeDays!: number;
}

export class UpdatePharmacySupplierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  ppbLicenseNumber?: string;

  @IsString()
  @IsOptional()
  kraPin?: string;

  @IsString()
  @IsOptional()
  contactPerson?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  physicalAddress?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  leadTimeDays?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class ReceiveStockDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  batchNumber!: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsDateString()
  @IsOptional()
  manufacturedDate?: string;

  @IsDateString()
  expiryDate!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantityReceived!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sellingPrice!: number;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  storageBin?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class StockTransferDto {
  @IsUUID()
  batchId!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsUUID()
  destinationFacilityId!: string;

  @IsString()
  @MinLength(5)
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class StockAdjustmentDto {
  @IsUUID()
  batchId!: string;

  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @IsNumber()
  @Type(() => Number)
  quantityDelta!: number;

  @IsString()
  @MinLength(10, { message: 'Audit justification reason must be at least 10 characters long' })
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DispenseMedicationDto {
  @IsUUID()
  medicationRequestId!: string;

  @IsUUID()
  orderId!: string;

  @IsUUID()
  patientId!: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantityToDispense!: number;

  @IsEnum(DispenseType)
  @IsOptional()
  dispenseType?: DispenseType;

  @IsUUID()
  @IsOptional()
  batchId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  daysSupply?: number;

  @IsString()
  @IsOptional()
  dosageInstructions?: string;

  @IsString()
  @IsOptional()
  substitutionReason?: string;

  @IsString()
  @IsOptional()
  patientCounselingNotes?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class ReturnDispensedMedicationDto {
  @IsUUID()
  dispenseId!: string;

  @IsString()
  @MinLength(10, { message: 'Return audit justification reason must be at least 10 characters long' })
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class AdministerMedicationDto {
  @IsUUID()
  medicationRequestId!: string;

  @IsUUID()
  encounterId!: string;

  @IsUUID()
  patientId!: string;

  @IsUUID()
  @IsOptional()
  dispenseId?: string;

  @IsEnum(MedicationAdministrationStatus)
  @IsOptional()
  status?: MedicationAdministrationStatus;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  doseQuantity!: number;

  @IsString()
  @IsNotEmpty()
  doseUnit!: string;

  @IsString()
  @IsOptional()
  route?: string;

  @IsString()
  @IsOptional()
  site?: string;

  @IsString()
  @IsOptional()
  reasonNotAdministered?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class QueryPharmacyFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  schedule?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
