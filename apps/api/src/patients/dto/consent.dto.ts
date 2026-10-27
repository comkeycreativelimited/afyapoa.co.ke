import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentType, ConsentChannel, PatientAccessPurpose } from '@afyapoa/domain-core';

export class GrantConsentDto {
  @ApiProperty({ enum: ConsentType, description: 'Statutory or clinical consent type' })
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @ApiPropertyOptional({ description: 'Statutory policy version', default: 'KE-DPA-2019-V1' })
  @IsString()
  @IsOptional()
  policyVersion?: string;

  @ApiPropertyOptional({ enum: ConsentChannel, default: ConsentChannel.WRITTEN_FORM })
  @IsEnum(ConsentChannel)
  @IsOptional()
  channel?: ConsentChannel;

  @ApiPropertyOptional({ description: 'Witness or verifying officer name' })
  @IsString()
  @IsOptional()
  witnessName?: string;
}

export class RevokeConsentDto {
  @ApiProperty({ description: 'Legal or patient-requested reason for consent revocation' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class LogRecordAccessDto {
  @ApiProperty({ enum: PatientAccessPurpose, description: 'Clinical or operational reason for viewing the record' })
  @IsEnum(PatientAccessPurpose)
  purpose!: PatientAccessPurpose;

  @ApiPropertyOptional({ description: 'Justification / clinical note' })
  @IsString()
  @IsOptional()
  justification?: string;
}
