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
  PrivateInsurancePayer,
} from '@afyapoa/domain-core';

export class RegisterInsurancePolicyDto {
  @ApiProperty({ enum: PrivateInsurancePayer, example: PrivateInsurancePayer.JUBILEE })
  @IsEnum(PrivateInsurancePayer)
  @IsNotEmpty()
  payerCode!: PrivateInsurancePayer;

  @ApiProperty({ description: 'Insurance company display name', example: 'Jubilee Health Insurance' })
  @IsString()
  @IsNotEmpty()
  payerName!: string;

  @ApiProperty({ description: 'Patient UUID' })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({ description: 'Insurance policy number', example: 'POL-JUB-9841' })
  @IsString()
  @IsNotEmpty()
  policyNumber!: string;

  @ApiProperty({ description: 'Member card number', example: 'MEM-0029314' })
  @IsString()
  @IsNotEmpty()
  memberNumber!: string;

  @ApiProperty({ description: 'Principal member name', example: 'John Kamau' })
  @IsString()
  @IsNotEmpty()
  principalMemberName!: string;

  @ApiPropertyOptional({ description: 'Relationship to principal: SELF, SPOUSE, CHILD, DEPENDENT', default: 'SELF' })
  @IsString()
  @IsOptional()
  relationshipToPrincipal?: string;

  @ApiPropertyOptional({ description: 'Benefit scheme / plan tier', example: 'Executive Comprehensive Inpatient/Outpatient' })
  @IsString()
  @IsOptional()
  benefitScheme?: string;

  @ApiPropertyOptional({ description: 'Benefit scheme alias' })
  @IsString()
  @IsOptional()
  schemeType?: string;

  @ApiPropertyOptional({ description: 'Total annual benefit limit in KES', example: '2000000.00' })
  @IsString()
  @IsOptional()
  annualLimit?: string;

  @ApiPropertyOptional({ description: 'Inpatient benefit limit alias' })
  @IsString()
  @IsOptional()
  benefitLimitInpatient?: string;

  @ApiPropertyOptional({ description: 'Current available balance in KES', example: '1850000.00' })
  @IsString()
  @IsOptional()
  balanceAvailable?: string;

  @ApiPropertyOptional({ description: 'Fixed copay amount in KES', default: '0.00' })
  @IsString()
  @IsOptional()
  copayAmount?: string;

  @ApiPropertyOptional({ description: 'Copay percentage (0-100)', default: '0.00' })
  @IsString()
  @IsOptional()
  copayPercentage?: string;

  @ApiProperty({ description: 'Policy start date (ISO-8601)' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Policy expiry date (ISO-8601)' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Policy end date alias' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class RequestPreauthorizationDto {
  @ApiPropertyOptional({ description: 'Facility UUID' })
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @ApiProperty({ description: 'Insurance Policy UUID' })
  @IsUUID()
  @IsNotEmpty()
  policyId!: string;

  @ApiPropertyOptional({ description: 'Patient UUID' })
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Encounter UUID if outpatient' })
  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @ApiPropertyOptional({ description: 'Inpatient Admission UUID if inpatient' })
  @IsUUID()
  @IsOptional()
  admissionId?: string;

  @ApiProperty({ description: 'Requested claim amount in KES', example: '150000.00' })
  @IsOptional()
  requestedAmount!: string | number;

  @ApiPropertyOptional({ description: 'Requested medical services and procedures summary' })
  @IsString()
  @IsOptional()
  requestedServices?: string;

  @ApiPropertyOptional({ description: 'Service category alias' })
  @IsString()
  @IsOptional()
  serviceCategory?: string;

  @ApiPropertyOptional({ description: 'Clinical justification' })
  @IsString()
  @IsOptional()
  clinicalJustification?: string;

  @ApiPropertyOptional({ description: 'ICD-11 / ICD-10 diagnosis code' })
  @IsString()
  @IsOptional()
  diagnosisCode?: string;

  @ApiPropertyOptional({ description: 'Procedure code' })
  @IsString()
  @IsOptional()
  procedureCode?: string;
}
