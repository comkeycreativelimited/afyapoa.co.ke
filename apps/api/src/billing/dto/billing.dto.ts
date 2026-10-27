import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsUUID,
  Min,
  MinLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingCategory,
  InvoiceStatus,
  PayerType,
  PaymentMethod,
  PaymentStatus,
  AdjustmentType,
  AdjustmentStatus,
  ReversalType,
  TaxCode,
} from '@afyapoa/domain-core';

export class CreateBillingServiceDto {
  @ApiProperty({ description: 'Unique service tariff code (e.g. SRV-CONS-001)' })
  @IsString()
  @IsNotEmpty()
  serviceCode!: string;

  @ApiProperty({ description: 'Service or procedure display name' })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiProperty({ enum: BillingCategory, description: 'Service department category' })
  @IsEnum(BillingCategory)
  category!: BillingCategory;

  @ApiProperty({ description: 'Hospital department (e.g. OPD, LABORATORY, PHARMACY)' })
  @IsString()
  @IsNotEmpty()
  department!: string;

  @ApiProperty({ description: 'Base retail price in KES', minimum: 0 })
  @IsNumber()
  @Min(0)
  basePrice!: number;

  @ApiPropertyOptional({ description: 'Tax rate (0.00 for exempt, 0.16 for standard)', default: 0.0 })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ enum: TaxCode, description: 'KRA Tax code (E=Exempt, A=Standard, B=Zero)', default: TaxCode.E })
  @IsOptional()
  @IsEnum(TaxCode)
  taxCode?: TaxCode;

  @ApiPropertyOptional({ description: 'Clinical code e.g. LOINC, KEML, ICD-11' })
  @IsOptional()
  @IsString()
  clinicalCode?: string;

  @ApiPropertyOptional({ description: 'Coding system (e.g. LOINC, KENYA_EML)' })
  @IsOptional()
  @IsString()
  clinicalCodingSystem?: string;

  @ApiPropertyOptional({ description: 'Whether tariff is covered under SHA funds', default: false })
  @IsOptional()
  @IsBoolean()
  shaCovered?: boolean;

  @ApiPropertyOptional({ description: 'Reimbursement rate from SHA tariff in KES', default: 0 })
  @IsOptional()
  @IsNumber()
  shaStandardTariff?: number;

  @ApiPropertyOptional({ description: 'Whether service requires SHA pre-authorization', default: false })
  @IsOptional()
  @IsBoolean()
  preauthorizationRequired?: boolean;
}

export class UpdateBillingServiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(TaxCode)
  taxCode?: TaxCode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shaCovered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  shaStandardTariff?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class InvoiceLineItemInputDto {
  @ApiPropertyOptional({ description: 'Service catalogue ID' })
  @IsOptional()
  @IsUUID()
  billingServiceId?: string;

  @ApiProperty({ description: 'Item tariff code' })
  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  itemDescription!: string;

  @ApiProperty({ enum: BillingCategory })
  @IsEnum(BillingCategory)
  category!: BillingCategory;

  @ApiProperty({ description: 'Source type (MANUAL, LABORATORY, PHARMACY, PROCEDURE)', default: 'MANUAL' })
  @IsString()
  @IsNotEmpty()
  sourceType: string = 'MANUAL';

  @ApiPropertyOptional({ description: 'Reference ID linking to clinical order or dispense' })
  @IsOptional()
  @IsUUID()
  sourceReferenceId?: string;

  @ApiProperty({ description: 'Quantity of items', minimum: 0.1, default: 1 })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ description: 'Unit price in KES', minimum: 0 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ description: 'Discount applied to line in KES', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ enum: TaxCode, default: TaxCode.E })
  @IsOptional()
  @IsEnum(TaxCode)
  taxCode?: TaxCode;

  @ApiPropertyOptional({ description: 'Tax rate', default: 0 })
  @IsOptional()
  @IsNumber()
  taxRate?: number;

  @ApiPropertyOptional({ description: 'Portion covered by SHA in KES', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shaCoverageAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Encounter UUID if billed during an active consultation' })
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional({ enum: PayerType, default: PayerType.OUT_OF_POCKET })
  @IsOptional()
  @IsEnum(PayerType)
  payerType?: PayerType = PayerType.OUT_OF_POCKET;

  @ApiPropertyOptional({ description: 'SHA Fund type (PHC, SHIF, ECCIF)' })
  @IsOptional()
  @IsString()
  shaFundType?: string;

  @ApiPropertyOptional({ description: 'SHA Claim tracking reference' })
  @IsOptional()
  @IsString()
  shaClaimReference?: string;

  @ApiPropertyOptional({ description: 'Flag indicating simulated or test invoice', default: false })
  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;

  @ApiPropertyOptional({ description: 'General invoice notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [InvoiceLineItemInputDto], description: 'Line items on invoice' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemInputDto)
  lineItems!: InvoiceLineItemInputDto[];
}

export class CreateInvoiceFromEncounterDto {
  @ApiProperty({ description: 'Encounter UUID' })
  @IsUUID()
  encounterId!: string;

  @ApiPropertyOptional({ enum: PayerType, default: PayerType.OUT_OF_POCKET })
  @IsOptional()
  @IsEnum(PayerType)
  payerType?: PayerType = PayerType.OUT_OF_POCKET;

  @ApiPropertyOptional({ description: 'Flag indicating simulated or test invoice', default: false })
  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddInvoiceLineItemDto extends InvoiceLineItemInputDto {}

export class CancelInvoiceDto {
  @ApiProperty({ description: 'Statutory cancellation justification (minimum 10 characters)' })
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class RequestAdjustmentDto {
  @ApiPropertyOptional({ description: 'Specific line item ID if discount applies to single line' })
  @IsOptional()
  @IsUUID()
  lineItemId?: string;

  @ApiProperty({ enum: AdjustmentType, description: 'Type of adjustment' })
  @IsEnum(AdjustmentType)
  adjustmentType!: AdjustmentType;

  @ApiProperty({ description: 'Adjustment amount in KES', minimum: 1 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Clinical or administrative justification (minimum 10 characters)' })
  @IsString()
  @MinLength(10)
  reason!: string;
}

export class ReviewAdjustmentDto {
  @ApiProperty({ enum: AdjustmentStatus, description: 'APPROVED or REJECTED' })
  @IsEnum(AdjustmentStatus)
  status!: AdjustmentStatus;

  @ApiPropertyOptional({ description: 'Reviewer notes or reason for rejection' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}

export class InvoiceAllocationItemDto {
  @ApiProperty({ description: 'Invoice UUID' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ description: 'Amount allocated to this invoice in KES', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amountAllocated!: number;
}

export class ProcessPaymentDto {
  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  patientId!: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method' })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: 'Total payment amount received in KES', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ description: 'External transaction reference (M-Pesa code, Bank slip, Card auth)' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiProperty({ description: 'Unique idempotency key to prevent double charge' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiPropertyOptional({ description: 'Flag indicating simulated or test payment', default: false })
  @IsOptional()
  @IsBoolean()
  isSimulated?: boolean;

  @ApiProperty({ type: [InvoiceAllocationItemDto], description: 'Invoice allocations' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceAllocationItemDto)
  allocations!: InvoiceAllocationItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReversePaymentDto {
  @ApiProperty({ enum: ReversalType, description: 'FULL_REVERSAL, PARTIAL_REFUND, etc.' })
  @IsEnum(ReversalType)
  reversalType!: ReversalType;

  @ApiProperty({ description: 'Amount to refund/reverse in KES', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiProperty({ description: 'Audit rationale for reversal (minimum 10 characters)' })
  @IsString()
  @MinLength(10)
  reason!: string;

  @ApiPropertyOptional({ description: 'Refund method (CASH, MPESA, etc.)', default: 'CASH' })
  @IsOptional()
  @IsString()
  refundMethod?: string = 'CASH';

  @ApiPropertyOptional({ description: 'Refund reference code' })
  @IsOptional()
  @IsString()
  refundReference?: string;
}

export class OpenShiftDto {
  @ApiProperty({ description: 'Cash drawer opening float in KES', default: 0 })
  @IsNumber()
  @Min(0)
  openingFloat: number = 0;
}

export class CloseShiftDto {
  @ApiProperty({ description: 'Counted physical cash in drawer in KES', minimum: 0 })
  @IsNumber()
  @Min(0)
  countedCash!: number;

  @ApiPropertyOptional({ description: 'Cashier notes regarding shift variance or discrepancies' })
  @IsOptional()
  @IsString()
  cashierNotes?: string;
}

export class SupervisorSignoffDto {
  @ApiProperty({ description: 'Supervisor review justification and approval notes (minimum 10 characters)' })
  @IsString()
  @MinLength(10)
  supervisorNotes!: string;
}

export class QueryInvoiceFilterDto {
  @ApiPropertyOptional({ description: 'Filter by Patient UUID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by Encounter UUID' })
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Search invoice number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number = 0;
}

export class QueryPaymentFilterDto {
  @ApiPropertyOptional({ description: 'Filter by Patient UUID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 50;
}

export class PatientStatementQueryDto {
  @ApiPropertyOptional({ description: 'Start date ISO string' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date ISO string' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

export class InitiateMpesaStkPushDto {
  @ApiProperty({ description: 'Kenyan Phone Number (+2547XXXXXXXX or 07XXXXXXXX)' })
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiProperty({ description: 'Amount in KES', minimum: 1 })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Invoice Number or Patient MRN' })
  @IsString()
  @IsNotEmpty()
  accountReference!: string;

  @ApiPropertyOptional({ description: 'Description of payment', default: 'Hospital Bill Payment' })
  @IsOptional()
  @IsString()
  transactionDesc?: string = 'Hospital Bill Payment';
}
