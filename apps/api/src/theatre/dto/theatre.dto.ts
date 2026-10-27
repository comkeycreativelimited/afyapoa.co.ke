import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TheatreType,
  TheatreBookingStatus,
  TheatreUrgency,
} from '@afyapoa/domain-core';

export class CreateTheatreDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Operating theatre name', example: 'Main OT Suite 1' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: TheatreType, default: TheatreType.MAJOR })
  @IsEnum(TheatreType)
  @IsOptional()
  theatreType?: TheatreType;

  @ApiPropertyOptional()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isHepaFiltered?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  hasLaminarFlow?: boolean;
}

export class CreateTheatreBookingDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Operating theatre UUID' })
  @IsUUID()
  @IsNotEmpty()
  theatreId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiPropertyOptional({ description: 'Inpatient Admission UUID if admitted' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty({ description: 'Lead surgeon User UUID' })
  @IsUUID()
  @IsNotEmpty()
  leadSurgeonId!: string;

  @ApiPropertyOptional({ description: 'Anesthetist User UUID' })
  @IsUUID()
  @IsOptional()
  anesthetistId?: string;

  @ApiPropertyOptional({ description: 'Procedure Code (ICD-11 / CPT)', example: 'PROC-APP-01' })
  @IsString()
  @IsOptional()
  procedureCode?: string;

  @ApiProperty({ description: 'Procedure Title', example: 'Laparoscopic Appendectomy' })
  @IsString()
  @IsNotEmpty()
  procedureName!: string;

  @ApiPropertyOptional({ enum: TheatreUrgency, default: TheatreUrgency.ELECTIVE })
  @IsEnum(TheatreUrgency)
  @IsOptional()
  urgency?: TheatreUrgency;

  @ApiPropertyOptional()
  @IsOptional()
  anesthesiaType?: string;

  @ApiProperty({ description: 'Scheduled start timestamp (ISO-8601)' })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime!: string;

  @ApiProperty({ description: 'Scheduled end timestamp (ISO-8601)' })
  @IsDateString()
  @IsNotEmpty()
  scheduledEndTime!: string;
}

export class UpdateTheatreBookingStatusDto {
  @ApiProperty({ enum: TheatreBookingStatus })
  @IsEnum(TheatreBookingStatus)
  @IsNotEmpty()
  status!: TheatreBookingStatus;

  @ApiPropertyOptional({ description: 'Actual start time if transitioning to IN_PROCEDURE' })
  @IsDateString()
  @IsOptional()
  actualStartTime?: string;

  @ApiPropertyOptional({ description: 'Actual end time if transitioning to COMPLETED' })
  @IsDateString()
  @IsOptional()
  actualEndTime?: string;

  @ApiPropertyOptional({ description: 'Anesthesia notes' })
  @IsString()
  @IsOptional()
  anesthesiaNotes?: string;

  @ApiPropertyOptional({ description: 'Operative procedure notes' })
  @IsString()
  @IsOptional()
  operativeNotes?: string;

  @ApiPropertyOptional({ description: 'Surgical notes alias' })
  @IsString()
  @IsOptional()
  surgicalNotes?: string;
}

export class SignWhoChecklistDto {
  @ApiProperty({ description: 'Phase: SIGN_IN, TIME_OUT, or SIGN_OUT' })
  @IsString()
  @IsNotEmpty()
  phase!: 'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT';

  @ApiPropertyOptional({ description: 'Checklist checklist data/responses' })
  @IsOptional()
  checklistData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  confirmedIdentity?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  confirmedSiteMarking?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  confirmedConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  anesthesiaChecklistComplete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  pulseOximeterFunctioning?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  allergyCheckCompleted?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  airwayAspirationRiskAssessed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  bloodLossRiskAssessed?: boolean;
}

export class CancelTheatreBookingDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  cancellationReason!: string;
}
