import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CodingSystem } from '@afyapoa/domain-core';

export class TerminologySearchQueryDto {
  @ApiPropertyOptional({
    description: 'Terminology coding system to filter concepts by',
    enum: CodingSystem,
    example: CodingSystem.ICD_11_MMS,
  })
  @IsOptional()
  @IsEnum(CodingSystem)
  system?: CodingSystem;

  @ApiPropertyOptional({
    description: 'Search string to match concept code, display name, or clinical synonyms',
    example: 'malaria',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'Optional clinical category (e.g. Infectious diseases, Hematology, Antibacterials)',
    example: 'Infectious diseases',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return (1-100)',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ValidateTerminologyDto {
  @ApiProperty({
    description: 'Standard coding system authority',
    enum: CodingSystem,
    example: CodingSystem.ICD_11_MMS,
  })
  @IsEnum(CodingSystem)
  @IsNotEmpty()
  system!: CodingSystem;

  @ApiProperty({
    description: 'Concept code to validate',
    example: '1F40.0',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class TerminologyConceptImportItemDto {
  @ApiProperty({ description: 'Concept code', example: '1F40.0' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Standard clinical display name', example: 'Plasmodium falciparum malaria' })
  @IsString()
  @IsNotEmpty()
  display!: string;

  @ApiPropertyOptional({ description: 'Official definition or clinical note' })
  @IsOptional()
  @IsString()
  definition?: string;

  @ApiPropertyOptional({ description: 'Synonyms or search terms', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  synonyms?: string[];

  @ApiPropertyOptional({ description: 'Parent concept code in the hierarchy' })
  @IsOptional()
  @IsString()
  parentCode?: string;

  @ApiPropertyOptional({ description: 'Clinical domain category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Effective start date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsOptional()
  @IsString()
  effectiveStartDate?: string;

  @ApiPropertyOptional({ description: 'Effective end date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  effectiveEndDate?: string;
}

export class ImportCatalogueDto {
  @ApiProperty({ description: 'Standard coding system', enum: CodingSystem })
  @IsEnum(CodingSystem)
  @IsNotEmpty()
  system!: CodingSystem;

  @ApiProperty({ description: 'Version or release tag', example: '2024-01' })
  @IsString()
  @IsNotEmpty()
  version!: string;

  @ApiProperty({ description: 'Human-readable catalogue name', example: 'WHO ICD-11 MMS Kenya Release' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Governing authority', example: 'Ministry of Health Kenya' })
  @IsString()
  @IsNotEmpty()
  authority!: string;

  @ApiPropertyOptional({ description: 'Official release date (YYYY-MM-DD)', example: '2024-01-01' })
  @IsOptional()
  @IsString()
  releaseDate?: string;

  @ApiProperty({ description: 'List of concepts to import', type: [TerminologyConceptImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TerminologyConceptImportItemDto)
  concepts!: TerminologyConceptImportItemDto[];
}
