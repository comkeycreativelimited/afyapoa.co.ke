import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EncounterType,
  EncounterStatus,
  TriagePriority,
  ServiceDepartment,
  AvpuLevel,
  ClinicalNoteType,
  AllergenType,
  AllergySeverity,
  AllergyClinicalStatus,
  AllergyVerificationStatus,
} from '@afyapoa/domain-core';

export class CreateEncounterDto {
  @ApiProperty({ description: 'Target patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Healthcare delivery facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiPropertyOptional({ description: 'Assigned practitioner UUID' })
  @IsUUID()
  @IsOptional()
  practitionerId?: string;

  @ApiProperty({ enum: EncounterType, description: 'Modality (WALK_IN, APPOINTMENT, EMERGENCY, REFERRAL)' })
  @IsEnum(EncounterType)
  @IsNotEmpty()
  encounterType!: EncounterType;

  @ApiPropertyOptional({
    enum: ServiceDepartment,
    default: ServiceDepartment.OUTPATIENT,
    description: 'Service department or clinic',
  })
  @IsEnum(ServiceDepartment)
  @IsOptional()
  serviceDepartment?: ServiceDepartment;

  @ApiPropertyOptional({
    enum: TriagePriority,
    default: TriagePriority.SEMI_URGENT,
    description: 'Initial triage priority',
  })
  @IsEnum(TriagePriority)
  @IsOptional()
  priority?: TriagePriority;

  @ApiPropertyOptional({ description: 'Presenting complaint or reason for visit' })
  @IsString()
  @IsOptional()
  reasonForVisit?: string;
}

export class UpdateEncounterStatusDto {
  @ApiProperty({ enum: EncounterStatus, description: 'Target lifecycle status' })
  @IsEnum(EncounterStatus)
  @IsNotEmpty()
  status!: EncounterStatus;

  @ApiPropertyOptional({ description: 'Operational reason for status transition' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CloseEncounterDto {
  @ApiPropertyOptional({ description: 'Clinical discharge/closure summary' })
  @IsString()
  @IsOptional()
  clinicalSummary?: string;

  @ApiPropertyOptional({ description: 'Closure summary alias' })
  @IsString()
  @IsOptional()
  closureSummary?: string;

  @ApiPropertyOptional({ description: 'Patient disposition (e.g. DISCHARGED_HOME, ADMITTED, REFERRED)' })
  @IsString()
  @IsOptional()
  disposition?: string;
}

export class ReopenEncounterDto {
  @ApiPropertyOptional({ description: 'Mandatory clinical or administrative justification for reopening closed encounter' })
  @IsString()
  @IsOptional()
  reopeningReason?: string;

  @ApiPropertyOptional({ description: 'Alias for reopening reason' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class RecordTriageVitalsDto {
  @ApiPropertyOptional({ description: 'Systolic blood pressure in mmHg (e.g. 120)', minimum: 40, maximum: 300 })
  @IsNumber()
  @Min(40)
  @Max(300)
  @IsOptional()
  systolicBp?: number;

  @ApiPropertyOptional({ description: 'Diastolic blood pressure in mmHg (e.g. 80)', minimum: 20, maximum: 200 })
  @IsNumber()
  @Min(20)
  @Max(200)
  @IsOptional()
  diastolicBp?: number;

  @ApiPropertyOptional({ description: 'Heart rate in beats per minute (e.g. 72)', minimum: 20, maximum: 300 })
  @IsNumber()
  @Min(20)
  @Max(300)
  @IsOptional()
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate in breaths per minute (e.g. 18)', minimum: 4, maximum: 80 })
  @IsNumber()
  @Min(4)
  @Max(80)
  @IsOptional()
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'Body temperature in degrees Celsius (e.g. 36.8)', minimum: 25.0, maximum: 45.0 })
  @IsNumber()
  @Min(25.0)
  @Max(45.0)
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: 'Oxygen saturation percentage SpO2 (e.g. 98)', minimum: 30, maximum: 100 })
  @IsNumber()
  @Min(30)
  @Max(100)
  @IsOptional()
  oxygenSaturation?: number;

  @ApiPropertyOptional({ description: 'Weight in kilograms (e.g. 70.5)', minimum: 0.5, maximum: 500 })
  @IsNumber()
  @Min(0.5)
  @Max(500)
  @IsOptional()
  weightKg?: number;

  @ApiPropertyOptional({ description: 'Height in centimeters (e.g. 175.0)', minimum: 20, maximum: 260 })
  @IsNumber()
  @Min(20)
  @Max(260)
  @IsOptional()
  heightCm?: number;

  @ApiPropertyOptional({ description: 'Pre-computed BMI in kg/m^2 (will be auto-calculated if omitted)' })
  @IsNumber()
  @IsOptional()
  bmi?: number;

  @ApiPropertyOptional({ description: 'Random blood glucose in mmol/L (e.g. 5.6)', minimum: 0.5, maximum: 50 })
  @IsNumber()
  @Min(0.5)
  @Max(50)
  @IsOptional()
  bloodGlucose?: number;

  @ApiPropertyOptional({ enum: AvpuLevel, default: AvpuLevel.ALERT, description: 'AVPU consciousness scale' })
  @IsEnum(AvpuLevel)
  @IsOptional()
  avpuLevel?: AvpuLevel;

  @ApiPropertyOptional({
    enum: TriagePriority,
    default: TriagePriority.SEMI_URGENT,
    description: 'Clinical priority assessed during triage',
  })
  @IsEnum(TriagePriority)
  @IsOptional()
  triagePriority?: TriagePriority;

  @ApiPropertyOptional({ description: 'Nurse triage observations, clinical remarks, or presentation details' })
  @IsString()
  @IsOptional()
  triageNotes?: string;
}

export class CreateClinicalNoteDto {
  @ApiPropertyOptional({
    enum: ClinicalNoteType,
    default: ClinicalNoteType.CONSULTATION_NOTE,
    description: 'Clinical note category',
  })
  @IsEnum(ClinicalNoteType)
  @IsOptional()
  noteType?: ClinicalNoteType;

  @ApiProperty({ description: 'Patient chief presenting complaint' })
  @IsString()
  @IsNotEmpty()
  chiefComplaint!: string;

  @ApiPropertyOptional({ description: 'History of present illness (HPI)' })
  @IsString()
  @IsOptional()
  historyOfPresentIllness?: string;

  @ApiPropertyOptional({ description: 'Past medical, surgical, and chronic illness history' })
  @IsString()
  @IsOptional()
  pastMedicalHistory?: string;

  @ApiPropertyOptional({ description: 'Review of systems (ROS)' })
  @IsString()
  @IsOptional()
  reviewOfSystems?: string;

  @ApiPropertyOptional({ description: 'Physical examination findings' })
  @IsString()
  @IsOptional()
  physicalExamination?: string;

  @ApiProperty({ description: 'Clinical assessment, differential impression, or clinical summary' })
  @IsString()
  @IsNotEmpty()
  assessment!: string;

  @ApiProperty({ description: 'Management plan, diagnostic orders, instructions, and follow-up' })
  @IsString()
  @IsNotEmpty()
  plan!: string;

  @ApiPropertyOptional({ description: 'Effective clinical observation timestamp (ISO)' })
  @IsString()
  @IsOptional()
  effectiveTime?: string;
}

export class UpdateClinicalNoteDto {
  @ApiPropertyOptional({ description: 'Chief complaint' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'History of present illness' })
  @IsString()
  @IsOptional()
  historyOfPresentIllness?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsString()
  @IsOptional()
  pastMedicalHistory?: string;

  @ApiPropertyOptional({ description: 'Review of systems' })
  @IsString()
  @IsOptional()
  reviewOfSystems?: string;

  @ApiPropertyOptional({ description: 'Physical examination' })
  @IsString()
  @IsOptional()
  physicalExamination?: string;

  @ApiPropertyOptional({ description: 'Clinical assessment' })
  @IsString()
  @IsOptional()
  assessment?: string;

  @ApiPropertyOptional({ description: 'Management plan' })
  @IsString()
  @IsOptional()
  plan?: string;
}

export class FinalizeClinicalNoteDto {
  @ApiProperty({ description: 'Explicit practitioner confirmation to sign and finalize record' })
  @IsBoolean()
  @IsNotEmpty()
  signatureConfirmation!: boolean;

  @ApiPropertyOptional({ description: 'Practitioner digital signature token' })
  @IsString()
  @IsOptional()
  digitalSignature?: string;
}

export class AmendClinicalNoteDto {
  @ApiProperty({ description: 'Mandatory clinical justification for amending finalized record' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Amendment justification must be at least 10 characters long' })
  reason!: string;

  @ApiProperty({ description: 'Addendum or amendment clinical content' })
  @IsString()
  @IsNotEmpty()
  amendmentText!: string;
}

export class RecordAllergyDto {
  @ApiPropertyOptional({ description: 'Associated encounter UUID' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiProperty({ description: 'Allergen name (e.g. Penicillin, Peanuts, Latex, Sulfa)' })
  @IsString()
  @IsNotEmpty()
  allergen!: string;

  @ApiPropertyOptional({ enum: AllergenType, default: AllergenType.MEDICATION, description: 'Allergen classification' })
  @IsEnum(AllergenType)
  @IsOptional()
  allergenType?: AllergenType;

  @ApiPropertyOptional({ enum: AllergySeverity, default: AllergySeverity.MODERATE, description: 'Clinical severity' })
  @IsEnum(AllergySeverity)
  @IsOptional()
  severity?: AllergySeverity;

  @ApiPropertyOptional({ description: 'Manifested adverse reaction (e.g. Anaphylaxis, Rash, Angioedema)' })
  @IsString()
  @IsOptional()
  reaction?: string;

  @ApiPropertyOptional({ enum: AllergyClinicalStatus, default: AllergyClinicalStatus.ACTIVE, description: 'Status' })
  @IsEnum(AllergyClinicalStatus)
  @IsOptional()
  clinicalStatus?: AllergyClinicalStatus;

  @ApiPropertyOptional({
    enum: AllergyVerificationStatus,
    default: AllergyVerificationStatus.CONFIRMED,
    description: 'Verification',
  })
  @IsEnum(AllergyVerificationStatus)
  @IsOptional()
  verificationStatus?: AllergyVerificationStatus;

  @ApiPropertyOptional({ description: 'Approximate age of onset in years' })
  @IsNumber()
  @IsOptional()
  onsetAgeYears?: number;

  @ApiPropertyOptional({ description: 'Clinical notes or comments regarding allergy' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAllergyDto {
  @ApiPropertyOptional({ enum: AllergyClinicalStatus, description: 'Updated clinical status' })
  @IsEnum(AllergyClinicalStatus)
  @IsOptional()
  clinicalStatus?: AllergyClinicalStatus;

  @ApiPropertyOptional({ enum: AllergySeverity, description: 'Updated severity' })
  @IsEnum(AllergySeverity)
  @IsOptional()
  severity?: AllergySeverity;

  @ApiPropertyOptional({ description: 'Updated reaction manifestation' })
  @IsString()
  @IsOptional()
  reaction?: string;

  @ApiPropertyOptional({ description: 'Updated clinical notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class EncounterSearchQueryDto {
  @ApiPropertyOptional({ description: 'Filter by healthcare facility UUID' })
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @ApiPropertyOptional({ description: 'Filter by patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Filter by assigned practitioner UUID' })
  @IsUUID()
  @IsOptional()
  practitionerId?: string;

  @ApiPropertyOptional({ enum: EncounterStatus, description: 'Filter by status' })
  @IsEnum(EncounterStatus)
  @IsOptional()
  status?: EncounterStatus;

  @ApiPropertyOptional({ enum: ServiceDepartment, description: 'Filter by department' })
  @IsEnum(ServiceDepartment)
  @IsOptional()
  serviceDepartment?: ServiceDepartment;

  @ApiPropertyOptional({ enum: TriagePriority, description: 'Filter by priority' })
  @IsEnum(TriagePriority)
  @IsOptional()
  priority?: TriagePriority;

  @ApiPropertyOptional({ description: 'Search term against encounter number or patient name' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Page index (1-based)', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: 'Page size limit (max 100)', default: 20 })
  @IsOptional()
  limit?: number;
}
