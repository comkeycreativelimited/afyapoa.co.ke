import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DeliveryMode,
  DeliveryOutcome,
  PerinealTear,
} from '@afyapoa/domain-core';

export class RecordMaternityDeliveryDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Mother Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  motherPatientId!: string;

  @ApiPropertyOptional({ description: 'Inpatient admission UUID if admitted' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiPropertyOptional({ description: 'Gravida', default: 1 })
  @IsNumber()
  @IsOptional()
  gravida?: number;

  @ApiPropertyOptional({ description: 'Parity', default: 0 })
  @IsNumber()
  @IsOptional()
  parity?: number;

  @ApiPropertyOptional({ description: 'Gestational age in weeks', example: '39.4' })
  @IsString()
  @IsOptional()
  gestationalAgeWeeks?: string;

  @ApiPropertyOptional({ description: 'Delivery timestamp (ISO-8601)' })
  @IsDateString()
  @IsOptional()
  deliveryDate?: string;

  @ApiProperty({ enum: DeliveryMode, default: DeliveryMode.SPONTANEOUS_VAGINAL })
  @IsEnum(DeliveryMode)
  @IsNotEmpty()
  deliveryMode!: DeliveryMode;

  @ApiProperty({ enum: DeliveryOutcome, default: DeliveryOutcome.LIVE_BIRTH })
  @IsEnum(DeliveryOutcome)
  @IsNotEmpty()
  deliveryOutcome!: DeliveryOutcome;

  @ApiPropertyOptional({ enum: PerinealTear, default: PerinealTear.NONE })
  @IsEnum(PerinealTear)
  @IsOptional()
  perinealTear?: PerinealTear;

  @ApiPropertyOptional({ description: 'Estimated blood loss (mL)', example: 250 })
  @IsNumber()
  @IsOptional()
  estimatedBloodLossMl?: number;

  @ApiPropertyOptional({ description: 'Delivering clinician / midwife User UUID' })
  @IsUUID()
  @IsOptional()
  deliveringClinicianId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  deliveredByUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  deliveryDateTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  para?: number;

  @ApiPropertyOptional()
  @IsOptional()
  outcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  placentaComplete?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  partographData?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  clinicalSummary?: string;

  @ApiPropertyOptional({ description: 'Partograph structured data (dilation, contractions, FHR)' })
  @IsObject()
  @IsOptional()
  partographSummary?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Maternal or fetal complications' })
  @IsString()
  @IsOptional()
  complications?: string;
}

export class RegisterNewbornDto {
  @ApiProperty({ description: 'Facility UUID' })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({ description: 'Maternity Delivery UUID' })
  @IsUUID()
  @IsNotEmpty()
  deliveryId!: string;

  @ApiProperty({ description: 'Mother Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  motherPatientId!: string;

  @ApiPropertyOptional({ description: 'Birth timestamp (ISO-8601)' })
  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Birth order (1 for singleton, 1/2 for twins)', default: 1 })
  @IsNumber()
  @IsOptional()
  birthOrder?: number;

  @ApiProperty({ description: 'Gender: MALE, FEMALE, INDETERMINATE', example: 'FEMALE' })
  @IsString()
  @IsNotEmpty()
  gender!: string;

  @ApiProperty({ description: 'Birth weight in grams', example: 3200 })
  @IsNumber()
  @Min(300)
  @Max(8000)
  @IsNotEmpty()
  birthWeightGrams!: number;

  @ApiPropertyOptional({ description: 'Birth length in cm', example: '49.5' })
  @IsOptional()
  birthLengthCm?: string | number;

  @ApiPropertyOptional({ description: 'Head circumference in cm', example: '34.0' })
  @IsOptional()
  headCircumferenceCm?: string | number;

  @ApiProperty({ description: 'APGAR score at 1 minute (0-10)', example: 8 })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsNotEmpty()
  apgarScore1Min!: number;

  @ApiProperty({ description: 'APGAR score at 5 minutes (0-10)', example: 9 })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsNotEmpty()
  apgarScore5Min!: number;

  @ApiPropertyOptional({ description: 'APGAR score at 10 minutes (0-10)', example: 10 })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  apgarScore10Min?: number;

  @ApiPropertyOptional({ description: 'Whether neonatal resuscitation was required', default: false })
  @IsBoolean()
  @IsOptional()
  resuscitationRequired?: boolean;

  @ApiPropertyOptional({ description: 'MOH Birth Notification Number (Civil Registration linking)', example: 'BN-2026-99214' })
  @IsString()
  @IsOptional()
  birthNotificationNumber?: string;

  @ApiPropertyOptional({ description: 'Create corresponding patient record in registry', default: true })
  @IsBoolean()
  @IsOptional()
  createPatientRecord?: boolean;
}
