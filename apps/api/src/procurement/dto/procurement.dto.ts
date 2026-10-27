import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ProcurementItemType,
  GrnStatus,
  ProcurementOrderStatus,
} from '@afyapoa/domain-core';

export class CreateProcurementOrderItemDto {
  @ApiPropertyOptional({ enum: ProcurementItemType, default: ProcurementItemType.MEDICATION })
  @IsEnum(ProcurementItemType)
  @IsOptional()
  itemType?: ProcurementItemType;

  @ApiPropertyOptional({ description: 'Catalog Item UUID if catalog-linked' })
  @IsUUID()
  @IsOptional()
  itemId?: string;

  @ApiProperty({ description: 'Item name / description', example: 'Amoxicillin 500mg Capsules 100s' })
  @IsString()
  @IsNotEmpty()
  itemDescription!: string;

  @ApiPropertyOptional({ description: 'Quantity ordered', example: '50.00' })
  @IsOptional()
  quantityOrdered?: string;

  @ApiPropertyOptional({ description: 'Quantity ordered (numeric)' })
  @IsOptional()
  quantity?: number | string;

  @ApiPropertyOptional({ description: 'Item code' })
  @IsOptional()
  itemCode?: string;

  @ApiPropertyOptional({ description: 'Unit cost price in KES', example: '350.00' })
  @IsOptional()
  unitPrice?: string | number;
}

export class CreateProcurementOrderDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiPropertyOptional({ description: 'Supplier UUID if linked to pharmacy_suppliers' })
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @ApiProperty({ description: 'Supplier / Vendor business name', example: 'Medisell Kenya Ltd' })
  @IsString()
  @IsNotEmpty()
  supplierName!: string;

  @ApiPropertyOptional({ description: 'Expected delivery date (ISO-8601)' })
  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @ApiPropertyOptional({ description: 'Procurement order notes / instructions' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ enum: ProcurementOrderStatus })
  @IsEnum(ProcurementOrderStatus)
  @IsOptional()
  status?: ProcurementOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  currency?: string;

  @ApiProperty({ type: [CreateProcurementOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcurementOrderItemDto)
  items!: CreateProcurementOrderItemDto[];
}

export class CreateGrnDto {
  @ApiPropertyOptional({ description: 'Procurement Order UUID' })
  @IsUUID()
  @IsOptional()
  procurementOrderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Supplier invoice / delivery note number', example: 'INV-MS-2026-881' })
  @IsString()
  @IsOptional()
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  deliveryNoteNumber?: string;

  @ApiPropertyOptional({ description: 'Receiving staff User UUID' })
  @IsUUID()
  @IsOptional()
  receivedByUserId?: string;

  @ApiPropertyOptional({ description: 'QA Inspecting staff User UUID' })
  @IsUUID()
  @IsOptional()
  inspectedByUserId?: string;

  @ApiPropertyOptional({ description: 'Inspection status (Passed QA)', default: true })
  @IsBoolean()
  @IsOptional()
  inspectionPassed?: boolean;

  @ApiPropertyOptional({ description: 'Inspection report notes' })
  @IsString()
  @IsOptional()
  inspectionNotes?: string;

  @ApiPropertyOptional({ description: 'Warehouse / Pharmacy storage bin allocation', example: 'BIN-PHARM-A3' })
  @IsString()
  @IsOptional()
  storageBinLocation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  storageLocationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  itemsReceived?: any[];

  @ApiPropertyOptional({ enum: GrnStatus, default: GrnStatus.ACCEPTED })
  @IsEnum(GrnStatus)
  @IsOptional()
  status?: GrnStatus;
}
