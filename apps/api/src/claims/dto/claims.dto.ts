import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsUUID,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ShaFundType,
  ShaIntegrationScenario,
  ShaPaymentMechanism,
  ShaAccessPoint,
  ShaPreauthType,
  ShaDocumentType,
} from '@afyapoa/domain-core';

// =============================================================================
// 1. ELIGIBILITY & BENEFIT CHECK DTOS
// =============================================================================

export class CheckEligibilityDto {
  @ApiProperty({ description: 'Beneficiary national identification or SHA number', example: '12345678' })
  @IsString()
  @IsNotEmpty()
  identificationNumber!: string;

  @ApiPropertyOptional({ description: 'Identification taxonomy type', default: 'KENYA_NATIONAL_ID' })
  @IsString()
  @IsOptional()
  identificationType: string = 'KENYA_NATIONAL_ID';

  @ApiPropertyOptional({ description: 'Originating facility KMFL code', example: 'FID-01-000001-1' })
  @IsString()
  @IsOptional()
  facilityCode?: string;
}

// =============================================================================
// 2. PREAUTHORIZATION DTOS
// =============================================================================

export class CreatePreauthDto {
  @ApiProperty({ description: 'Local Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'DHA Client Registry CR ID', example: 'CRID-KE-DHA-12345678' })
  @IsString()
  @IsNotEmpty()
  patientCrId!: string;

  @ApiProperty({ enum: ShaPreauthType, default: ShaPreauthType.NORMAL })
  @IsEnum(ShaPreauthType)
  preauthType!: ShaPreauthType;

  @ApiProperty({ enum: ShaFundType, default: ShaFundType.SHIF })
  @IsEnum(ShaFundType)
  fund!: ShaFundType;

  @ApiProperty({ description: 'Sub-benefit code (from SHA benefits catalog)', example: 'SB-SURG-MAJ' })
  @IsString()
  @IsNotEmpty()
  subBenefitCode!: string;

  @ApiProperty({ description: 'Intervention code', example: 'INT-IP-SURG-APP' })
  @IsString()
  @IsNotEmpty()
  interventionCode!: string;

  @ApiProperty({ description: 'Requested intervention cost in KES', example: 65000 })
  @IsNumber()
  @IsPositive()
  requestedAmountKES!: number;

  @ApiProperty({ description: 'Clinical narrative explaining medical necessity' })
  @IsString()
  @IsNotEmpty()
  clinicalSummary!: string;

  @ApiProperty({ description: 'Practitioner Unique Identifier (PUID) of attending clinician', example: 'PUID-KMPDC-A0001' })
  @IsString()
  @IsNotEmpty()
  practitionerPuid!: string;

  @ApiPropertyOptional({ description: 'Optional estimated stay in days for inpatient admissions' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  estimatedStayDays?: number;

  @ApiPropertyOptional({ description: 'Supporting document URLs (operative notes, biopsy, imaging)', type: [String] })
  @IsArray()
  @IsOptional()
  supportingDocumentUrls?: string[];
}

export class CancelPreauthDto {
  @ApiProperty({ description: 'Reason for revoking the preauthorization' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

// =============================================================================
// 3. CLAIM CREATION & PREPARATION DTOS
// =============================================================================

export class ClaimItemInputDto {
  @ApiProperty({ description: 'Type of billable line', example: 'INTERVENTION' })
  @IsString()
  @IsNotEmpty()
  lineType!: string;

  @ApiProperty({ description: 'Procedure, tariff, ICD, or LOINC code', example: 'INT-IP-SURG-APP' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Item description' })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ description: 'Quantity', example: 1 })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ description: 'Unit price in KES', example: 65000 })
  @IsNumber()
  @IsPositive()
  unitPriceKES!: number;

  @ApiProperty({ description: 'Service delivery date (ISO 8601)' })
  @IsDateString()
  serviceDate!: string;

  @ApiPropertyOptional({ description: 'Clinician PUID who performed the service' })
  @IsString()
  @IsOptional()
  practitionerPuid?: string;
}

export class CreateClaimDto {
  @ApiProperty({ description: 'Local Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Local Encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Local Invoice UUID' })
  @IsUUID()
  @IsOptional()
  invoiceId?: string;

  @ApiPropertyOptional({ description: 'Linked Approved Preauthorization UUID' })
  @IsUUID()
  @IsOptional()
  preauthId?: string;

  @ApiProperty({ enum: ShaFundType, example: ShaFundType.SHIF })
  @IsEnum(ShaFundType)
  fund!: ShaFundType;

  @ApiProperty({ enum: ShaIntegrationScenario, example: ShaIntegrationScenario.SC_02_SHIF_IP_FFS_NORMAL_PREAUTH })
  @IsEnum(ShaIntegrationScenario)
  scenario!: ShaIntegrationScenario;

  @ApiProperty({ enum: ShaAccessPoint, example: ShaAccessPoint.IP })
  @IsEnum(ShaAccessPoint)
  accessPoint!: ShaAccessPoint;

  @ApiProperty({ enum: ShaPaymentMechanism, example: ShaPaymentMechanism.FEE_FOR_SERVICE })
  @IsEnum(ShaPaymentMechanism)
  paymentMechanism!: ShaPaymentMechanism;

  @ApiProperty({ description: 'Service start date (ISO 8601)' })
  @IsDateString()
  serviceStartDate!: string;

  @ApiPropertyOptional({ description: 'Service end date (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  serviceEndDate?: string;

  @ApiProperty({ description: 'Attending practitioner PUID', example: 'PUID-KMPDC-A0001' })
  @IsString()
  @IsNotEmpty()
  practitionerPuid!: string;

  @ApiProperty({ description: 'Primary WHO ICD-11 diagnosis code', example: 'BA00' })
  @IsString()
  @IsNotEmpty()
  primaryDiagnosisIcd11!: string;

  @ApiPropertyOptional({ description: 'Secondary diagnosis codes', type: [String] })
  @IsArray()
  @IsOptional()
  secondaryDiagnoses?: string[];

  @ApiProperty({ description: 'Claim items and interventions', type: [ClaimItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClaimItemInputDto)
  items!: ClaimItemInputDto[];
}

// =============================================================================
// 4. INPATIENT DISCHARGE & CLAIM DISPATCH DTOS
// =============================================================================

export class InpatientDischargeDto {
  @ApiProperty({ description: 'Discharge date & time (ISO 8601)' })
  @IsDateString()
  dischargeDate!: string;

  @ApiProperty({ description: 'Discharge disposition', example: 'HOME' })
  @IsString()
  @IsNotEmpty()
  dischargeDisposition!: 'HOME' | 'TRANSFERRED' | 'DECEASED';

  @ApiProperty({ description: 'Discharge clinical summary notes' })
  @IsString()
  @IsNotEmpty()
  summaryNotes!: string;

  @ApiProperty({ description: 'Final verified WHO ICD-11 discharge diagnosis' })
  @IsString()
  @IsNotEmpty()
  finalDiagnosisIcd11!: string;

  @ApiProperty({ description: 'Attending Practitioner PUID discharging patient' })
  @IsString()
  @IsNotEmpty()
  attendingPractitionerPuid!: string;
}

export class DispensingInfoDto {
  @ApiProperty({ description: 'Prescription UUID' })
  @IsUUID()
  @IsNotEmpty()
  prescriptionId!: string;

  @ApiProperty({ description: 'Dispensed items summary' })
  @IsArray()
  items!: Array<{ medicationCode: string; quantity: number; unitPriceKES: number }>;

  @ApiProperty({ description: 'Dispensed date & time (ISO 8601)' })
  @IsDateString()
  dispensedAt!: string;

  @ApiProperty({ description: 'Pharmacist PUID' })
  @IsString()
  @IsNotEmpty()
  pharmacistPuid!: string;
}

// =============================================================================
// 5. CORRECTED RESUBMISSION DTO
// =============================================================================

export class CorrectClaimDto {
  @ApiProperty({ description: 'Detailed explanation for the corrected claim resubmission' })
  @IsString()
  @IsNotEmpty()
  correctionReason!: string;

  @ApiPropertyOptional({ description: 'Updated items list if items were adjusted', type: [ClaimItemInputDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ClaimItemInputDto)
  updatedItems?: ClaimItemInputDto[];

  @ApiPropertyOptional({ description: 'Updated primary diagnosis ICD-11' })
  @IsString()
  @IsOptional()
  updatedDiagnosisIcd11?: string;
}

// =============================================================================
// 6. ATTACHMENT & CALLBACK DTOS
// =============================================================================

export class AttachDocumentDto {
  @ApiProperty({ enum: ShaDocumentType, example: ShaDocumentType.OPERATIVE_NOTES })
  @IsEnum(ShaDocumentType)
  documentType!: ShaDocumentType;

  @ApiProperty({ description: 'Document title' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ description: 'MIME type', example: 'application/pdf' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ description: 'Secure storage URL' })
  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @ApiPropertyOptional({ description: 'File size in bytes' })
  @IsNumber()
  @IsOptional()
  fileSizeBytes?: number;
}

export class ShaCallbackPayloadDto {
  @ApiProperty({ description: 'Event identifier from SHA', example: 'CLAIM_PROCESSED' })
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiPropertyOptional({ description: 'Claim tracking number or ID' })
  @IsString()
  @IsOptional()
  claimNumber?: string;

  @ApiPropertyOptional({ description: 'Preauth number' })
  @IsString()
  @IsOptional()
  preauthNumber?: string;

  @ApiPropertyOptional({ description: 'Determined claim status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Approved claim amount in KES' })
  @IsNumber()
  @IsOptional()
  approvedAmountKES?: number;

  @ApiPropertyOptional({ description: 'Patient copay amount in KES' })
  @IsNumber()
  @IsOptional()
  patientCopayKES?: number;

  @ApiPropertyOptional({ description: 'Deductions or disallowed amount in KES' })
  @IsNumber()
  @IsOptional()
  deductionAmountKES?: number;

  @ApiPropertyOptional({ description: 'Rejection reason if claim or preauth was rejected' })
  @IsString()
  @IsOptional()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Raw event metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ReconcileClaimsQueryDto {
  @ApiPropertyOptional({ description: 'Start date window (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End date window (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Filter by claim status' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by specific claim number' })
  @IsString()
  @IsOptional()
  claimNumber?: string;
}
