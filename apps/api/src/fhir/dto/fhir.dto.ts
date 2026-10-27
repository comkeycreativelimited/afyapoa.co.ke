import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FhirValidationQueryDto {
  @ApiPropertyOptional({
    description: 'Target profile canonical URL to validate against',
    example: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-patient',
  })
  @IsOptional()
  @IsString()
  profile?: string;
}

export class FhirExportQueryDto {
  @ApiPropertyOptional({
    description: 'Export format MIME type (default: application/fhir+json)',
    example: 'application/fhir+json',
  })
  @IsOptional()
  @IsString()
  _format?: string;

  @ApiPropertyOptional({
    description: 'Encounter ID filter (optional, exports specific encounter episode)',
  })
  @IsOptional()
  @IsString()
  encounterId?: string;
}

export interface ShrExchangeHeaders {
  facilityId?: string;
  facilityIdType?: string;
  consentToken?: string;
  puid?: string;
}
