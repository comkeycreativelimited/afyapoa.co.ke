import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PatientGender,
  PatientIdentifierType,
  ConsentType,
  ConsentChannel,
} from '@afyapoa/domain-core';

export class EmergencyContactDto {
  @ApiProperty({ description: 'Full name of emergency contact' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Relationship to patient (e.g. SPOUSE, PARENT, CHILD, SIBLING, NEXT_OF_KIN)' })
  @IsString()
  @IsNotEmpty()
  relationship!: string;

  @ApiProperty({ description: 'Primary phone number' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ description: 'Alternative phone number' })
  @IsString()
  @IsOptional()
  alternativePhone?: string;
}

export class InitialIdentifierDto {
  @ApiProperty({ enum: PatientIdentifierType, description: 'Statutory or clinical identifier system' })
  @IsEnum(PatientIdentifierType)
  system!: PatientIdentifierType;

  @ApiProperty({ description: 'Plaintext identifier value (will be encrypted and blind-indexed)' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ description: 'Issuing authority (e.g. NRB, DHA, SHA, IMMIGRATION)' })
  @IsString()
  @IsOptional()
  issuingAuthority?: string;

  @ApiPropertyOptional({ description: 'Indicates if this is the primary identity document' })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class InitialConsentDto {
  @ApiProperty({ enum: ConsentType, description: 'Type of consent requested' })
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @ApiPropertyOptional({ description: 'Privacy policy version', default: 'KE-DPA-2019-V1' })
  @IsString()
  @IsOptional()
  policyVersion?: string;

  @ApiPropertyOptional({ enum: ConsentChannel, default: ConsentChannel.WRITTEN_FORM })
  @IsEnum(ConsentChannel)
  @IsOptional()
  channel?: ConsentChannel;

  @ApiPropertyOptional({ description: 'Witness name if verbal consent' })
  @IsString()
  @IsOptional()
  witnessName?: string;
}

export class CreatePatientDto {
  @ApiProperty({ description: 'First name of the patient' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiPropertyOptional({ description: 'Middle name of the patient' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiProperty({ description: 'Last name / family name of the patient' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Date of birth (ISO YYYY-MM-DD)' })
  @IsString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @ApiPropertyOptional({ description: 'Flag if the date of birth is an estimate', default: false })
  @IsBoolean()
  @IsOptional()
  isDobEstimated?: boolean;

  @ApiProperty({ enum: PatientGender, description: 'Gender of the patient' })
  @IsEnum(PatientGender)
  gender!: PatientGender;

  @ApiPropertyOptional({ description: 'Blood group (e.g. A+, O-, B+)' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Primary phone number (Kenyan mobile)' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Physical street address / landmarks' })
  @IsString()
  @IsOptional()
  physicalAddress?: string;

  @ApiPropertyOptional({ description: 'County of residence (e.g. Nairobi, Kisumu, Mombasa)' })
  @IsString()
  @IsOptional()
  county?: string;

  @ApiPropertyOptional({ description: 'Sub-county of residence' })
  @IsString()
  @IsOptional()
  subCounty?: string;

  @ApiPropertyOptional({ description: 'Ward of residence' })
  @IsString()
  @IsOptional()
  ward?: string;

  @ApiPropertyOptional({ description: 'Village or estate' })
  @IsString()
  @IsOptional()
  village?: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  @IsString()
  @IsOptional()
  postalCode?: string;

  @ApiPropertyOptional({ description: 'Nationality', default: 'KENYAN' })
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional({ description: 'Marital status (SINGLE, MARRIED, DIVORCED, WIDOWED)' })
  @IsString()
  @IsOptional()
  maritalStatus?: string;

  @ApiPropertyOptional({ type: EmergencyContactDto, description: 'Next of kin emergency contact' })
  @IsObject()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;

  @ApiPropertyOptional({ type: [InitialIdentifierDto], description: 'National IDs, SHA numbers, or other identifiers' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialIdentifierDto)
  @IsOptional()
  identifiers?: InitialIdentifierDto[];

  @ApiPropertyOptional({ type: [InitialConsentDto], description: 'Initial statutory consents collected at registration' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InitialConsentDto)
  @IsOptional()
  consents?: InitialConsentDto[];

  @ApiPropertyOptional({ description: 'Bypasses duplicate detection rejection if registrar verifies this is a new individual', default: false })
  @IsBoolean()
  @IsOptional()
  forceDuplicateOverride?: boolean;
}

export class EmergencyIntakeDto {
  @ApiProperty({ enum: PatientGender, description: 'Observed gender of unidentified patient' })
  @IsEnum(PatientGender)
  gender!: PatientGender;

  @ApiPropertyOptional({ description: 'Estimated age in years', default: 30 })
  @IsOptional()
  estimatedAge?: number;

  @ApiPropertyOptional({ description: 'Urgent triage notes or injury presentation' })
  @IsString()
  @IsOptional()
  triageNotes?: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional({ description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Middle name' })
  @IsString()
  @IsOptional()
  middleName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth' })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: PatientGender })
  @IsEnum(PatientGender)
  @IsOptional()
  gender?: PatientGender;

  @ApiPropertyOptional({ description: 'Blood group' })
  @IsString()
  @IsOptional()
  bloodGroup?: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Physical address' })
  @IsString()
  @IsOptional()
  physicalAddress?: string;

  @ApiPropertyOptional({ description: 'County' })
  @IsString()
  @IsOptional()
  county?: string;

  @ApiPropertyOptional({ description: 'Sub-county' })
  @IsString()
  @IsOptional()
  subCounty?: string;

  @ApiPropertyOptional({ type: EmergencyContactDto })
  @IsObject()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  @IsOptional()
  emergencyContact?: EmergencyContactDto;
}
