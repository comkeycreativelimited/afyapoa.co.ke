import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { PatientGender, PatientIdentityStatus, PatientStatus } from '@afyapoa/domain-core';

export class PatientSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Exact search by Kenyan National ID (will be blind-indexed)' })
  @IsString()
  @IsOptional()
  nationalId?: string;

  @ApiPropertyOptional({ description: 'Exact search by phone number (will be blind-indexed)' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Exact search by SHA number (will be blind-indexed)' })
  @IsString()
  @IsOptional()
  shaNumber?: string;

  @ApiPropertyOptional({ description: 'Exact search by Unique Personal Identifier (UPI)' })
  @IsString()
  @IsOptional()
  upi?: string;

  @ApiPropertyOptional({ description: 'Exact search by DHA Client Registry ID (CRID)' })
  @IsString()
  @IsOptional()
  dhaCrid?: string;

  @ApiPropertyOptional({ description: 'Partial name search (matches first, middle, or last name)' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Exact or partial Medical Record Number' })
  @IsString()
  @IsOptional()
  mrn?: string;

  @ApiPropertyOptional({ enum: PatientGender, description: 'Filter by gender' })
  @IsEnum(PatientGender)
  @IsOptional()
  gender?: PatientGender;

  @ApiPropertyOptional({ enum: PatientIdentityStatus, description: 'Filter by identity verification status' })
  @IsEnum(PatientIdentityStatus)
  @IsOptional()
  identityStatus?: PatientIdentityStatus;

  @ApiPropertyOptional({ enum: PatientStatus, description: 'Filter by patient status (ACTIVE, MERGED, etc.)' })
  @IsEnum(PatientStatus)
  @IsOptional()
  status?: PatientStatus;
}

export class DuplicateCheckDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth (ISO YYYY-MM-DD)' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Gender' })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'National ID number' })
  @IsString()
  @IsOptional()
  nationalId?: string;
}
