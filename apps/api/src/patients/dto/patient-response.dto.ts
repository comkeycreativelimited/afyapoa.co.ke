import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PatientGender,
  PatientIdentityStatus,
  PatientStatus,
  PatientIdentifierType,
  ConsentType,
  ConsentStatus,
  ConsentChannel,
  EmergencyContactInfo,
} from '@afyapoa/domain-core';

export class PatientIdentifierResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PatientIdentifierType })
  system!: PatientIdentifierType;

  @ApiProperty({ description: 'Masked identifier value for privacy protection' })
  valueMasked!: string;

  @ApiPropertyOptional()
  issuingAuthority?: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty()
  verificationStatus!: string;

  @ApiPropertyOptional()
  verificationMethod?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt!: string;
}

export class PatientConsentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ConsentType })
  consentType!: ConsentType;

  @ApiProperty()
  policyVersion!: string;

  @ApiProperty({ enum: ConsentStatus })
  status!: ConsentStatus;

  @ApiProperty()
  grantedAt!: string;

  @ApiPropertyOptional()
  revokedAt?: string | null;

  @ApiProperty({ enum: ConsentChannel })
  channel!: ConsentChannel;

  @ApiPropertyOptional()
  witnessName?: string | null;
}

export class PatientResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tenantId!: string;

  @ApiProperty({ description: 'Facility unique Medical Record Number' })
  mrn!: string;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional()
  middleName?: string | null;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  dateOfBirth!: string;

  @ApiProperty()
  isDobEstimated!: boolean;

  @ApiProperty({ enum: PatientGender })
  gender!: PatientGender;

  @ApiPropertyOptional()
  bloodGroup?: string | null;

  @ApiPropertyOptional({ description: 'Masked phone number (e.g. +2547****5678)' })
  phoneMasked?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  physicalAddress?: string | null;

  @ApiPropertyOptional()
  county?: string | null;

  @ApiPropertyOptional()
  subCounty?: string | null;

  @ApiPropertyOptional()
  ward?: string | null;

  @ApiPropertyOptional()
  village?: string | null;

  @ApiPropertyOptional()
  postalCode?: string | null;

  @ApiProperty()
  nationality!: string;

  @ApiPropertyOptional()
  maritalStatus?: string | null;

  @ApiPropertyOptional()
  emergencyContact?: EmergencyContactInfo | null;

  @ApiProperty({ enum: PatientStatus })
  status!: PatientStatus;

  @ApiProperty({ enum: PatientIdentityStatus })
  identityStatus!: PatientIdentityStatus;

  @ApiProperty({ description: 'True if identity is verified against DHA Client Registry' })
  isExternallyVerified!: boolean;

  @ApiPropertyOptional({ description: 'Unique Personal Identifier from DHA' })
  upi?: string | null;

  @ApiPropertyOptional({ description: 'DHA Client Registry ID' })
  dhaCrid?: string | null;

  @ApiPropertyOptional({ description: 'Target patient ID if this record was merged' })
  reconciledIntoPatientId?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PatientDetailResponseDto extends PatientResponseDto {
  @ApiProperty({ type: [PatientIdentifierResponseDto] })
  identifiers!: PatientIdentifierResponseDto[];

  @ApiProperty({ type: [PatientConsentResponseDto] })
  consents!: PatientConsentResponseDto[];
}

export class DuplicateCandidateResponseDto {
  @ApiProperty({ type: PatientResponseDto })
  patient!: PatientResponseDto;

  @ApiProperty({ description: 'Confidence score from 0.00 to 1.00' })
  confidenceScore!: number;

  @ApiProperty({ type: [String], description: 'List of matching reason codes' })
  matchReasons!: string[];
}
