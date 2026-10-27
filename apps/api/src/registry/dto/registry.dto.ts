import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistryType } from '@afyapoa/domain-core';

export class SyncClientRegistryDto {
  @ApiPropertyOptional({ description: 'Internal patient UUID if syncing an existing patient' })
  @IsOptional()
  @IsString()
  patientId?: string;

  @ApiProperty({ description: 'Kenyan National Identity Card number', example: '12345678' })
  @IsString()
  nationalId!: string;

  @ApiPropertyOptional({ description: 'Facility KMFL code', example: 'FID-01-000101-1' })
  @IsOptional()
  @IsString()
  facilityCode?: string;

  @ApiPropertyOptional({ description: 'Bypass cache and force remote query', default: false })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class SyncFacilityRegistryDto {
  @ApiProperty({ description: 'Kenya Master Health Facility List (KMFL) code', example: 'FID-01-000101-1' })
  @IsString()
  kmflCode!: string;

  @ApiPropertyOptional({ description: 'Bypass cache and force remote query', default: false })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class SyncHealthWorkerRegistryDto {
  @ApiProperty({ description: 'Practitioner Primary Universal Identifier (PUID)', example: 'PUID-KMPDC-A0001' })
  @IsString()
  puid!: string;

  @ApiPropertyOptional({ description: 'Bypass cache and force remote query', default: false })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class SyncTerminologyDto {
  @ApiProperty({ description: 'Terminology system URI or code (e.g. WHO_ICD_11, LOINC, KEML)', example: 'WHO_ICD_11' })
  @IsString()
  system!: string;

  @ApiProperty({ description: 'Concept code to validate and sync', example: 'BA00' })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: 'Bypass cache and force remote query', default: false })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class ReconcileRegistryDto {
  @ApiProperty({ enum: RegistryType, description: 'Target registry for reconciliation' })
  @IsEnum(RegistryType)
  registryType!: RegistryType;

  @ApiPropertyOptional({ description: 'Simulate reconciliation without applying updates', default: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class InvalidateCacheDto {
  @ApiProperty({ enum: RegistryType, description: 'Registry type to invalidate' })
  @IsEnum(RegistryType)
  registryType!: RegistryType;

  @ApiProperty({ description: 'Target record key (e.g. nationalId, kmflCode, puid, or * for all)' })
  @IsString()
  recordKey!: string;
}
