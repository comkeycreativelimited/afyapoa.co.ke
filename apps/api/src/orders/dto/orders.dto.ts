import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  MinLength,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CodingSystem,
  DiagnosisType,
  DiagnosisClinicalStatus,
  DiagnosisVerificationStatus,
  DiagnosisCertainty,
  ClinicalOrderType,
  ClinicalOrderStatus,
  ClinicalOrderPriority,
  ClinicalOrderIntent,
  MedicationRoute,
  MedicationFrequency,
  MedicationDurationUnit,
  MedicationQuantityUnit,
  ServiceCategory,
  SpecimenType,
} from '@afyapoa/domain-core';

// ==========================================
// DIAGNOSIS DTOs
// ==========================================

export class RecordDiagnosisDto {
  @ApiProperty({ description: 'Standardized diagnosis code (e.g. 1F40.0 for Falciparum malaria in ICD-11)', example: '1F40.0' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({
    description: 'Coding authority system (default: ICD_11_MMS as mandated by Kenya MOH)',
    enum: CodingSystem,
    default: CodingSystem.ICD_11_MMS,
  })
  @IsOptional()
  @IsEnum(CodingSystem)
  codingSystem?: CodingSystem = CodingSystem.ICD_11_MMS;

  @ApiProperty({ description: 'Standard display title', example: 'Plasmodium falciparum malaria' })
  @IsString()
  @IsNotEmpty()
  display!: string;

  @ApiPropertyOptional({ enum: DiagnosisType, default: DiagnosisType.WORKING })
  @IsOptional()
  @IsEnum(DiagnosisType)
  diagnosisType?: DiagnosisType = DiagnosisType.WORKING;

  @ApiPropertyOptional({ enum: DiagnosisClinicalStatus, default: DiagnosisClinicalStatus.ACTIVE })
  @IsOptional()
  @IsEnum(DiagnosisClinicalStatus)
  clinicalStatus?: DiagnosisClinicalStatus = DiagnosisClinicalStatus.ACTIVE;

  @ApiPropertyOptional({ enum: DiagnosisVerificationStatus, default: DiagnosisVerificationStatus.PROVISIONAL })
  @IsOptional()
  @IsEnum(DiagnosisVerificationStatus)
  verificationStatus?: DiagnosisVerificationStatus = DiagnosisVerificationStatus.PROVISIONAL;

  @ApiPropertyOptional({ enum: DiagnosisCertainty, default: DiagnosisCertainty.SUSPECTED })
  @IsOptional()
  @IsEnum(DiagnosisCertainty)
  certainty?: DiagnosisCertainty;

  @ApiPropertyOptional({ description: 'Whether this is the primary encounter diagnosis', default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean = false;

  @ApiPropertyOptional({ description: 'Estimated onset timestamp (ISO 8601)' })
  @IsOptional()
  @IsString()
  onsetDate?: string;

  @ApiPropertyOptional({ description: 'Clinical diagnostic rationale or notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDiagnosisDto {
  @ApiPropertyOptional({ enum: DiagnosisType })
  @IsOptional()
  @IsEnum(DiagnosisType)
  diagnosisType?: DiagnosisType;

  @ApiPropertyOptional({ enum: DiagnosisClinicalStatus })
  @IsOptional()
  @IsEnum(DiagnosisClinicalStatus)
  clinicalStatus?: DiagnosisClinicalStatus;

  @ApiPropertyOptional({ enum: DiagnosisVerificationStatus })
  @IsOptional()
  @IsEnum(DiagnosisVerificationStatus)
  verificationStatus?: DiagnosisVerificationStatus;

  @ApiPropertyOptional({ enum: DiagnosisCertainty })
  @IsOptional()
  @IsEnum(DiagnosisCertainty)
  certainty?: DiagnosisCertainty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ==========================================
// CLINICAL ORDER DTOs
// ==========================================

export class CreateMedicationItemDto {
  @ApiProperty({ description: 'Standard KEML/ATC medication code', example: 'P01BF01' })
  @IsString()
  @IsNotEmpty()
  medicationCode!: string;

  @ApiProperty({ description: 'Medication display name', example: 'Artemether + lumefantrine 20mg/120mg tablet' })
  @IsString()
  @IsNotEmpty()
  medicationName!: string;

  @ApiPropertyOptional({ enum: CodingSystem, default: CodingSystem.KENYA_EML })
  @IsOptional()
  @IsEnum(CodingSystem)
  codingSystem?: CodingSystem = CodingSystem.KENYA_EML;

  @ApiProperty({ description: 'Dosage value per administration', example: '1' })
  @IsString()
  @IsNotEmpty()
  dosage!: string;

  @ApiProperty({ description: 'Dosage unit', example: 'tablet' })
  @IsString()
  @IsNotEmpty()
  dosageUnit!: string;

  @ApiPropertyOptional({ enum: MedicationRoute, default: MedicationRoute.ORAL })
  @IsOptional()
  @IsEnum(MedicationRoute)
  route?: MedicationRoute = MedicationRoute.ORAL;

  @ApiPropertyOptional({ enum: MedicationFrequency, default: MedicationFrequency.BID })
  @IsOptional()
  @IsEnum(MedicationFrequency)
  frequency?: MedicationFrequency = MedicationFrequency.BID;

  @ApiPropertyOptional({ description: 'Duration quantity', default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationValue?: number = 3;

  @ApiPropertyOptional({ enum: MedicationDurationUnit, default: MedicationDurationUnit.DAYS })
  @IsOptional()
  @IsEnum(MedicationDurationUnit)
  durationUnit?: MedicationDurationUnit = MedicationDurationUnit.DAYS;

  @ApiProperty({ description: 'Total quantity to dispense', example: 24 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalQuantity!: number;

  @ApiPropertyOptional({ enum: MedicationQuantityUnit, default: MedicationQuantityUnit.TABLETS })
  @IsOptional()
  @IsEnum(MedicationQuantityUnit)
  quantityUnit?: MedicationQuantityUnit = MedicationQuantityUnit.TABLETS;

  @ApiPropertyOptional({ description: 'Patient-facing consumption instructions', example: 'Take 4 tablets initially, then 4 tablets after 8 hours, then 4 tablets BID for 2 days.' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ description: 'Number of authorized refills', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  refillsAllowed?: number = 0;

  @ApiPropertyOptional({ description: 'Pro Re Nata (as needed) flag', default: false })
  @IsOptional()
  @IsBoolean()
  isPrn?: boolean = false;

  @ApiPropertyOptional({ description: 'Condition for PRN administration', example: 'For fever > 38.5C' })
  @IsOptional()
  @IsString()
  prnReason?: string;

  @ApiPropertyOptional({ description: 'Whether generic substitution is permissible', default: true })
  @IsOptional()
  @IsBoolean()
  substitutionAllowed?: boolean = true;
}

export class CreateServiceItemDto {
  @ApiPropertyOptional({ enum: ServiceCategory, default: ServiceCategory.LABORATORY })
  @IsOptional()
  @IsEnum(ServiceCategory)
  serviceCategory?: ServiceCategory = ServiceCategory.LABORATORY;

  @ApiProperty({ description: 'Standard LOINC test code', example: '58453-2' })
  @IsString()
  @IsNotEmpty()
  serviceCode!: string;

  @ApiProperty({ description: 'Test or service display name', example: 'Malaria smear in Blood' })
  @IsString()
  @IsNotEmpty()
  serviceName!: string;

  @ApiPropertyOptional({ enum: CodingSystem, default: CodingSystem.LOINC })
  @IsOptional()
  @IsEnum(CodingSystem)
  codingSystem?: CodingSystem = CodingSystem.LOINC;

  @ApiPropertyOptional({ enum: SpecimenType, default: SpecimenType.WHOLE_BLOOD })
  @IsOptional()
  @IsEnum(SpecimenType)
  specimenType?: SpecimenType;

  @ApiPropertyOptional({ description: 'Target body site if applicable' })
  @IsOptional()
  @IsString()
  bodySite?: string;

  @ApiPropertyOptional({ description: 'Clinical context or specimen collection notes' })
  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @ApiPropertyOptional({ enum: ClinicalOrderPriority, default: ClinicalOrderPriority.ROUTINE })
  @IsOptional()
  @IsEnum(ClinicalOrderPriority)
  urgency?: ClinicalOrderPriority = ClinicalOrderPriority.ROUTINE;
}

export class CreateClinicalOrderDto {
  @ApiProperty({ description: 'Target patient UUID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ enum: ClinicalOrderType, example: ClinicalOrderType.MEDICATION_REQUEST })
  @IsEnum(ClinicalOrderType)
  @IsNotEmpty()
  orderType!: ClinicalOrderType;

  @ApiPropertyOptional({ enum: ClinicalOrderPriority, default: ClinicalOrderPriority.ROUTINE })
  @IsOptional()
  @IsEnum(ClinicalOrderPriority)
  priority?: ClinicalOrderPriority = ClinicalOrderPriority.ROUTINE;

  @ApiPropertyOptional({ enum: ClinicalOrderIntent, default: ClinicalOrderIntent.ORDER })
  @IsOptional()
  @IsEnum(ClinicalOrderIntent)
  intent?: ClinicalOrderIntent = ClinicalOrderIntent.ORDER;

  @ApiPropertyOptional({ description: 'Clinical diagnostic indication for the order', example: 'Uncomplicated P. falciparum malaria with acute pyrexia' })
  @IsOptional()
  @IsString()
  clinicalIndication?: string;

  @ApiPropertyOptional({ description: 'Additional clinical notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Ordering practitioner ID (defaults to authenticated clinician)' })
  @IsOptional()
  @IsUUID()
  orderingPractitionerId?: string;

  @ApiPropertyOptional({ type: CreateMedicationItemDto, description: 'Required when orderType is MEDICATION_REQUEST' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMedicationItemDto)
  medication?: CreateMedicationItemDto;

  @ApiPropertyOptional({ type: CreateServiceItemDto, description: 'Required when orderType is LAB_SERVICE_REQUEST, RADIOLOGY_SERVICE_REQUEST, or PROCEDURE_REQUEST' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateServiceItemDto)
  service?: CreateServiceItemDto;

  @ApiPropertyOptional({
    description: 'Explicit clinician override if a duplicate order warning was flagged',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overrideDuplicateWarning?: boolean = false;

  @ApiPropertyOptional({
    description: 'Mandatory clinical justification when overriding a duplicate order warning',
    example: 'Previous dose vomited; repeated course clinically necessary.',
  })
  @IsOptional()
  @IsString()
  duplicateOverrideReason?: string;
}

export class AuthorizeOrderDto {
  @ApiPropertyOptional({ description: 'Authorization review notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelOrderDto {
  @ApiProperty({
    description: 'Mandatory clinical or operational reason for order cancellation (minimum 10 characters)',
    example: 'Patient demonstrated allergic rash to penicillin derivative.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Cancellation reason must be at least 10 characters long to ensure auditability.' })
  reason!: string;
}

export class AmendOrderDto {
  @ApiProperty({
    description: 'Mandatory clinical justification for amending the order (minimum 10 characters)',
    example: 'Adjusting dosage from 500mg TID to 250mg BID following eGFR decline.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Amendment reason must be at least 10 characters long.' })
  amendmentReason!: string;

  @ApiProperty({ type: CreateClinicalOrderDto, description: 'New superseding order specifications' })
  @ValidateNested()
  @Type(() => CreateClinicalOrderDto)
  @IsNotEmpty()
  newOrder!: CreateClinicalOrderDto;
}

export class ClinicalOrderSearchQueryDto {
  @ApiPropertyOptional({ description: 'Filter orders by encounter UUID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Filter orders by patient UUID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ enum: ClinicalOrderType })
  @IsOptional()
  @IsEnum(ClinicalOrderType)
  orderType?: ClinicalOrderType;

  @ApiPropertyOptional({ enum: ClinicalOrderStatus })
  @IsOptional()
  @IsEnum(ClinicalOrderStatus)
  status?: ClinicalOrderStatus;

  @ApiPropertyOptional({ enum: ClinicalOrderPriority })
  @IsOptional()
  @IsEnum(ClinicalOrderPriority)
  priority?: ClinicalOrderPriority;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
