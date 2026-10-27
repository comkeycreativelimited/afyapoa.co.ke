import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  AppointmentServiceType,
} from '@afyapoa/domain-core';

export class CreateAppointmentDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Practitioner User UUID' })
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiPropertyOptional({ description: 'Hospital Department / Specialty Clinic' })
  @IsString()
  @IsOptional()
  department?: string;

  @ApiPropertyOptional({ enum: AppointmentServiceType, default: AppointmentServiceType.GENERAL_CONSULTATION })
  @IsEnum(AppointmentServiceType)
  @IsOptional()
  serviceType?: AppointmentServiceType;

  @ApiProperty({ description: 'Appointment start timestamp (ISO-8601)' })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({ description: 'Appointment end timestamp (ISO-8601)' })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiPropertyOptional({ description: 'Appointment duration in minutes', default: 30 })
  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ description: 'Clinical reason or purpose of appointment' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class UpdateAppointmentStatusDto {
  @ApiProperty({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsNotEmpty()
  status!: AppointmentStatus;
}

export class CancelAppointmentDto {
  @ApiProperty({ description: 'Cancellation reason' })
  @IsString()
  @IsNotEmpty()
  cancellationReason!: string;
}
