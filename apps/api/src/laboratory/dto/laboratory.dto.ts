import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  LabDepartment,
  SpecimenType,
  ContainerType,
  SpecimenStatus,
  SpecimenRejectionReason,
  LabResultStatus,
  DiagnosticReportStatus,
  DeductionReason,
} from '@afyapoa/domain-core';

export class CollectSpecimenDto {
  @ApiProperty({ description: 'Master Clinical Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ enum: SpecimenType, example: SpecimenType.WHOLE_BLOOD })
  @IsEnum(SpecimenType)
  @IsNotEmpty()
  specimenType!: SpecimenType;

  @ApiProperty({ enum: ContainerType, example: ContainerType.EDTA_TUBE_LAVENDER })
  @IsEnum(ContainerType)
  @IsNotEmpty()
  containerType!: ContainerType;

  @ApiPropertyOptional({ description: 'Collected volume in mL', example: 4.0 })
  @IsNumber()
  @IsOptional()
  volumeMl?: number;

  @ApiPropertyOptional({ description: 'Anatomical collection site', example: 'Left antecubital fossa' })
  @IsString()
  @IsOptional()
  collectionSite?: string;

  @ApiPropertyOptional({ description: 'Phlebotomist or collection notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Consumable item code to deduct from inventory', example: 'VAC-EDTA-LAV' })
  @IsString()
  @IsOptional()
  deductConsumableItemCode?: string;

  @ApiPropertyOptional({ description: 'Quantity of consumable deducted', default: 1 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  deductQuantity?: number;
}

export class ReceiveSpecimenDto {
  @ApiPropertyOptional({ description: 'Receipt / bench notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class RejectSpecimenDto {
  @ApiProperty({ enum: SpecimenRejectionReason, example: SpecimenRejectionReason.HEMOLYZED })
  @IsEnum(SpecimenRejectionReason)
  @IsNotEmpty()
  rejectionReason!: SpecimenRejectionReason;

  @ApiPropertyOptional({ description: 'Detailed rejection notes' })
  @IsString()
  @IsOptional()
  rejectionNotes?: string;

  @ApiProperty({ description: 'Whether a recollection order should be spawned', default: true })
  @IsBoolean()
  @IsOptional()
  recollectionRequired?: boolean;
}

export class EnterLabResultDto {
  @ApiProperty({ description: 'Accessioned Specimen UUID' })
  @IsUUID()
  @IsNotEmpty()
  specimenId!: string;

  @ApiProperty({ description: 'Master Clinical Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ description: 'Lab Test Catalog UUID' })
  @IsUUID()
  @IsNotEmpty()
  testCatalogId!: string;

  @ApiPropertyOptional({ description: 'Numeric analytic result', example: 14.2 })
  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @ApiPropertyOptional({ description: 'Textual or qualitative result', example: 'Negative' })
  @IsString()
  @IsOptional()
  textValue?: string;

  @ApiPropertyOptional({ description: 'Result measurement unit', example: 'g/dL' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ description: 'Bench technologist notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class VerifyLabResultDto {
  @ApiProperty({ enum: LabResultStatus, example: LabResultStatus.VERIFIED })
  @IsEnum(LabResultStatus)
  @IsNotEmpty()
  status!: LabResultStatus;

  @ApiPropertyOptional({ description: 'Verifier professional role', example: 'SENIOR_LAB_TECHNOLOGIST' })
  @IsString()
  @IsOptional()
  verifierRole?: string;

  @ApiProperty({ description: 'Cryptographic digital signature or authorization token' })
  @IsString()
  @IsNotEmpty()
  verificationSignature!: string;

  @ApiPropertyOptional({ description: 'Verification notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CorrectLabResultDto {
  @ApiPropertyOptional({ description: 'Corrected numeric value' })
  @IsNumber()
  @IsOptional()
  numericValue?: number;

  @ApiPropertyOptional({ description: 'Corrected text value' })
  @IsString()
  @IsOptional()
  textValue?: string;

  @ApiProperty({
    description: 'Mandatory clinical justification for result correction/amendment (min 10 chars)',
    example: 'Sample dilution factor recalculated per bench calibration protocol',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  correctionReason!: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateDiagnosticReportDto {
  @ApiProperty({ description: 'Master Clinical Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @ApiProperty({ description: 'Encounter UUID' })
  @IsUUID()
  @IsNotEmpty()
  encounterId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Report Title', example: 'Complete Blood Count & Malaria Evaluation' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ description: 'Clinical conclusion or interpretation' })
  @IsString()
  @IsOptional()
  conclusion?: string;

  @ApiPropertyOptional({ description: 'Array of result UUIDs included in this report', type: [String] })
  @IsOptional()
  resultIds?: string[];
}

export class AuthorizeDiagnosticReportDto {
  @ApiProperty({ description: 'Digital authorization signature' })
  @IsString()
  @IsNotEmpty()
  authorizationSignature!: string;

  @ApiPropertyOptional({ description: 'Final clinical conclusion / remarks' })
  @IsString()
  @IsOptional()
  conclusion?: string;
}

export class AmendDiagnosticReportDto {
  @ApiProperty({
    description: 'Mandatory clinical justification for report amendment (min 10 chars)',
    example: 'Pathology consult review added to peripheral film interpretation',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  amendmentReason!: string;

  @ApiPropertyOptional({ description: 'Updated conclusion' })
  @IsString()
  @IsOptional()
  conclusion?: string;

  @ApiPropertyOptional({ description: 'Updated result IDs' })
  @IsOptional()
  resultIds?: string[];
}

export class DeductConsumableDto {
  @ApiProperty({ description: 'Consumable UUID' })
  @IsUUID()
  @IsNotEmpty()
  consumableId!: string;

  @ApiProperty({ description: 'Quantity to deduct', example: 2 })
  @IsNumber()
  @Min(1)
  quantityDeducted!: number;

  @ApiProperty({ enum: DeductionReason, example: DeductionReason.SPECIMEN_COLLECTION })
  @IsEnum(DeductionReason)
  @IsNotEmpty()
  reason!: DeductionReason;

  @ApiPropertyOptional({ description: 'Associated Specimen UUID' })
  @IsUUID()
  @IsOptional()
  specimenId?: string;

  @ApiPropertyOptional({ description: 'Associated Order UUID' })
  @IsUUID()
  @IsOptional()
  orderId?: string;
}

export class LabSearchQueryDto {
  @ApiPropertyOptional({ enum: LabDepartment })
  @IsEnum(LabDepartment)
  @IsOptional()
  department?: LabDepartment;

  @ApiPropertyOptional({ enum: SpecimenStatus })
  @IsEnum(SpecimenStatus)
  @IsOptional()
  specimenStatus?: SpecimenStatus;

  @ApiPropertyOptional({ enum: DiagnosticReportStatus })
  @IsEnum(DiagnosticReportStatus)
  @IsOptional()
  reportStatus?: DiagnosticReportStatus;

  @ApiPropertyOptional({ description: 'Patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Order UUID' })
  @IsUUID()
  @IsOptional()
  orderId?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO string)' })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO string)' })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  limit?: number;
}
