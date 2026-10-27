import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InpatientAdmissionType,
  InpatientDischargeDisposition,
  BedStatus,
  BedType,
  WardSpecialty,
  WardGenderRestriction,
} from '@afyapoa/domain-core';

export class CreateWardDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Unique ward code within facility', example: 'WARD-M1' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Ward name', example: 'Male Medical Ward 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: WardGenderRestriction, default: WardGenderRestriction.NONE })
  @IsEnum(WardGenderRestriction)
  @IsOptional()
  genderRestriction?: WardGenderRestriction;

  @ApiPropertyOptional({ enum: WardSpecialty, default: WardSpecialty.GENERAL })
  @IsEnum(WardSpecialty)
  @IsOptional()
  specialty?: WardSpecialty;

  @ApiPropertyOptional({ description: 'Floor / Wing location' })
  @IsString()
  @IsOptional()
  floorLocation?: string;

  @ApiPropertyOptional({ description: 'Total beds capacity', default: 0 })
  @IsNumber()
  @IsOptional()
  totalBeds?: number;
}

export class CreateBedDto {
  @ApiPropertyOptional({ description: 'Facility UUID' })
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @ApiProperty({ description: 'Ward UUID' })
  @IsUUID()
  @IsNotEmpty()
  wardId!: string;

  @ApiProperty({ description: 'Bed number within ward', example: 'BED-01' })
  @IsString()
  @IsNotEmpty()
  bedNumber!: string;

  @ApiPropertyOptional({ description: 'Room number / cubicle' })
  @IsString()
  @IsOptional()
  roomNumber?: string;

  @ApiPropertyOptional({ enum: BedType, default: BedType.STANDARD })
  @IsEnum(BedType)
  @IsOptional()
  bedType?: BedType;

  @ApiPropertyOptional({ description: 'Daily rate in KES', default: '0.00' })
  @IsString()
  @IsOptional()
  dailyRate?: string;
}

export class UpdateBedStatusDto {
  @ApiProperty({ enum: BedStatus })
  @IsEnum(BedStatus)
  @IsNotEmpty()
  status!: BedStatus;
}

export class CreateInpatientAdmissionDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Encounter UUID if admitted from OP/Casualty' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Admitting practitioner User UUID' })
  @IsUUID()
  @IsOptional()
  admittingPractitionerId?: string;

  @ApiPropertyOptional({ description: 'Attending consultant User UUID' })
  @IsUUID()
  @IsOptional()
  attendingPractitionerId?: string;

  @ApiPropertyOptional({ enum: InpatientAdmissionType, default: InpatientAdmissionType.EMERGENCY })
  @IsEnum(InpatientAdmissionType)
  @IsOptional()
  admissionType?: InpatientAdmissionType;

  @ApiPropertyOptional({ description: 'Provisional / Admission ICD-11 code', example: 'CA40.0' })
  @IsString()
  @IsOptional()
  admissionDiagnosisIcd11?: string;

  @ApiPropertyOptional({ description: 'Diagnosis title', example: 'Pneumonia due to Streptococcus pneumoniae' })
  @IsString()
  @IsOptional()
  admissionDiagnosisTitle?: string;

  @ApiPropertyOptional({ description: 'Provisional clinical diagnosis' })
  @IsString()
  @IsOptional()
  provisionalDiagnosis?: string;

  @ApiProperty({ description: 'Target Ward UUID' })
  @IsUUID()
  @IsNotEmpty()
  wardId!: string;

  @ApiProperty({ description: 'Target Bed UUID' })
  @IsUUID()
  @IsNotEmpty()
  bedId!: string;

  @ApiPropertyOptional({ description: 'Insurance Pre-authorization Code' })
  @IsString()
  @IsOptional()
  preauthorizationNumber?: string;
}

export class TransferBedDto {
  @ApiProperty({ description: 'Target Ward UUID' })
  @IsUUID()
  @IsNotEmpty()
  toWardId!: string;

  @ApiProperty({ description: 'Target Bed UUID' })
  @IsUUID()
  @IsNotEmpty()
  toBedId!: string;

  @ApiProperty({ description: 'Clinical / Administrative transfer rationale' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Authorizing practitioner User UUID' })
  @IsUUID()
  @IsOptional()
  authorizedByPractitionerId?: string;
}

export class DischargePatientDto {
  @ApiPropertyOptional({ enum: InpatientDischargeDisposition })
  @IsOptional()
  dischargeDisposition?: InpatientDischargeDisposition;

  @ApiPropertyOptional({ description: 'Disposition alias' })
  @IsOptional()
  disposition?: string;

  @ApiPropertyOptional({ description: 'Discharging practitioner User UUID' })
  @IsUUID()
  @IsOptional()
  dischargedByPractitionerId?: string;

  @ApiPropertyOptional({ description: 'Final ICD-11 Diagnosis Code' })
  @IsString()
  @IsOptional()
  finalDiagnosisIcd11?: string;

  @ApiPropertyOptional({ description: 'Final ICD-11 Diagnosis Title' })
  @IsString()
  @IsOptional()
  finalDiagnosisTitle?: string;

  @ApiPropertyOptional({ description: 'Final diagnosis alias' })
  @IsString()
  @IsOptional()
  finalDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Comprehensive discharge summary notes' })
  @IsString()
  @IsOptional()
  dischargeSummaryNotes?: string;

  @ApiPropertyOptional({ description: 'Discharge summary alias' })
  @IsString()
  @IsOptional()
  dischargeSummary?: string;

  @ApiPropertyOptional({ description: 'Follow-up instructions' })
  @IsString()
  @IsOptional()
  followUpInstructions?: string;
}

export class CancelAdmissionDto {
  @ApiProperty({ description: 'Reason for cancellation' })
  @IsString()
  @IsNotEmpty()
  cancellationReason!: string;
}
