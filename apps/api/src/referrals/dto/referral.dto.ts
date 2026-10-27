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
  ReferralDirection,
  ReferralPriority,
  ReferralStatus,
  TransportType,
} from '@afyapoa/domain-core';

export class CreateReferralDto {
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

  @ApiPropertyOptional({ enum: ReferralDirection, default: ReferralDirection.OUTBOUND })
  @IsEnum(ReferralDirection)
  @IsOptional()
  referralDirection?: ReferralDirection;

  @ApiPropertyOptional({ description: 'Referring facility KMFL code', example: '12885' })
  @IsString()
  @IsOptional()
  referringFacilityKmfl?: string;

  @ApiPropertyOptional({ description: 'Referring facility name', example: 'Nairobi Metropolis Health Centre' })
  @IsString()
  @IsOptional()
  referringFacilityName?: string;

  @ApiProperty({ description: 'Receiving facility KMFL code', example: '13023' })
  @IsString()
  @IsNotEmpty()
  receivingFacilityKmfl!: string;

  @ApiProperty({ description: 'Receiving facility name', example: 'Kenyatta National Hospital' })
  @IsString()
  @IsNotEmpty()
  receivingFacilityName!: string;

  @ApiPropertyOptional({ description: 'Referring practitioner User UUID' })
  @IsUUID()
  @IsOptional()
  referringPractitionerId?: string;

  @ApiPropertyOptional({ description: 'Referring practitioner full name', example: 'Dr. Otieno' })
  @IsString()
  @IsOptional()
  referringPractitionerName?: string;

  @ApiProperty({ description: 'Specialty requested', example: 'Cardiology' })
  @IsString()
  @IsNotEmpty()
  specialtyRequested!: string;

  @ApiProperty({ description: 'Clinical case summary' })
  @IsString()
  @IsNotEmpty()
  clinicalSummary!: string;

  @ApiProperty({ description: 'Primary reason for referral' })
  @IsString()
  @IsNotEmpty()
  reasonForReferral!: string;

  @ApiPropertyOptional({ enum: ReferralPriority, default: ReferralPriority.ROUTINE })
  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @ApiPropertyOptional({ enum: TransportType, default: TransportType.AMBULANCE })
  @IsEnum(TransportType)
  @IsOptional()
  transportType?: TransportType;

  @ApiPropertyOptional()
  @IsOptional()
  ambulanceRequired?: boolean;

  @ApiPropertyOptional({ description: 'Ambulance registration, paramedic contact, etc.' })
  @IsOptional()
  ambulanceDetails?: any;
}

export class UpdateReferralStatusDto {
  @ApiProperty({ enum: ReferralStatus })
  @IsEnum(ReferralStatus)
  @IsNotEmpty()
  status!: ReferralStatus;
}

export class SubmitCounterReferralDto {
  @ApiProperty({ description: 'Counter-referral clinical report notes and recommendations' })
  @IsString()
  @IsNotEmpty()
  counterReferralNotes!: string;

  @ApiPropertyOptional({ description: 'Counter-referring specialist name', example: 'Dr. Wanjiku (KNH Cardiology)' })
  @IsString()
  @IsOptional()
  counterReferralPractitionerName?: string;

  @ApiPropertyOptional({ description: 'Counter referral timestamp (ISO-8601)' })
  @IsDateString()
  @IsOptional()
  counterReferralDate?: string;
}
