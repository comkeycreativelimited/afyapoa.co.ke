import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RadiologyModality,
  RadiologyReportStatus,
  RadiologyUrgency,
} from '@afyapoa/domain-core';

export class CreateRadiologyOrderDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Encounter UUID if tied to an encounter' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Ordering practitioner User UUID' })
  @IsUUID()
  @IsOptional()
  orderingPractitionerId?: string;

  @ApiProperty({ enum: RadiologyModality, default: RadiologyModality.XRAY })
  @IsEnum(RadiologyModality)
  @IsNotEmpty()
  modality!: RadiologyModality;

  @ApiPropertyOptional({ description: 'Radiology procedure code (LOINC / CPT)', example: 'LOINC-36643-5' })
  @IsString()
  @IsOptional()
  procedureCode?: string;

  @ApiProperty({ description: 'Procedure name', example: 'Chest X-Ray 2 Views AP and Lateral' })
  @IsString()
  @IsNotEmpty()
  procedureName!: string;

  @ApiPropertyOptional({ description: 'Anatomical body site', example: 'Chest' })
  @IsString()
  @IsOptional()
  bodySite?: string;

  @ApiProperty({ description: 'Clinical indication / reason for exam' })
  @IsString()
  @IsNotEmpty()
  clinicalIndication!: string;

  @ApiPropertyOptional({ description: 'Whether this imaging order is confidential specialist protected', default: false })
  @IsBoolean()
  @IsOptional()
  isConfidentialSpecialist?: boolean;

  @ApiPropertyOptional({ enum: RadiologyUrgency, default: RadiologyUrgency.ROUTINE })
  @IsEnum(RadiologyUrgency)
  @IsOptional()
  urgency?: RadiologyUrgency;
}

export class CreateRadiologyReportDto {
  @ApiProperty({ description: 'Radiology Order UUID' })
  @IsUUID()
  @IsNotEmpty()
  orderId!: string;

  @ApiPropertyOptional({ description: 'Radiologist User UUID' })
  @IsUUID()
  @IsOptional()
  radiologistId?: string;

  @ApiProperty({ description: 'Radiological findings' })
  @IsString()
  @IsNotEmpty()
  findings!: string;

  @ApiProperty({ description: 'Diagnostic impression / conclusion' })
  @IsString()
  @IsNotEmpty()
  impression!: string;

  @ApiPropertyOptional({ description: 'Clinical recommendations / follow-up' })
  @IsString()
  @IsOptional()
  recommendations?: string;

  @ApiPropertyOptional({ description: 'Flag for critical or life-threatening finding', default: false })
  @IsBoolean()
  @IsOptional()
  criticalResult?: boolean;

  @ApiPropertyOptional({ description: 'Clinician notified of critical finding' })
  @IsString()
  @IsOptional()
  criticalResultNotifiedTo?: string;

  @ApiPropertyOptional({ description: 'DICOM PACS Study Instance UID' })
  @IsString()
  @IsOptional()
  pacsStudyUid?: string;

  @ApiPropertyOptional({ description: 'DICOM PACS Accession Number' })
  @IsString()
  @IsOptional()
  pacsAccessionNumber?: string;

  @ApiPropertyOptional({ description: 'Authorized DICOM Web Viewer URL' })
  @IsString()
  @IsOptional()
  pacsViewerUrl?: string;

  @ApiPropertyOptional({ enum: RadiologyReportStatus, default: RadiologyReportStatus.FINAL })
  @IsEnum(RadiologyReportStatus)
  @IsOptional()
  status?: RadiologyReportStatus;

  @ApiPropertyOptional()
  @IsOptional()
  facilityId?: string;
}

export class AddendumReportDto {
  @ApiPropertyOptional({ description: 'Addendum notes / correction from radiologist' })
  @IsString()
  @IsOptional()
  addendumNotes?: string;

  @ApiPropertyOptional({ description: 'Addendum text alias' })
  @IsString()
  @IsOptional()
  addendumText?: string;
}
