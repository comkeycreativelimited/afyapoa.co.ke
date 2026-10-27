import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PatientIdentifierType } from '@afyapoa/domain-core';

export class AddIdentifierDto {
  @ApiProperty({ enum: PatientIdentifierType, description: 'Identifier system (e.g. NATIONAL_ID, SHA_NUMBER, ALIEN_ID, PASSPORT)' })
  @IsEnum(PatientIdentifierType)
  system!: PatientIdentifierType;

  @ApiProperty({ description: 'Plaintext identifier value to be encrypted and indexed' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ description: 'Issuing authority (e.g. NRB, DHA, SHA, IMMIGRATION)' })
  @IsString()
  @IsOptional()
  issuingAuthority?: string;

  @ApiPropertyOptional({ description: 'Mark as primary document', default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @ApiPropertyOptional({ description: 'Clinical or provenance notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
