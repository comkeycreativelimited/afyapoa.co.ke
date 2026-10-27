import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MeteredMetricType,
  PlatformPaymentMethod,
  SupportAccessScope,
  SupportCaseCategory,
  SupportCasePriority,
  SupportCaseStatus,
} from '@afyapoa/domain-core';

export class UpgradePlanDto {
  @ApiProperty({ description: 'New target Subscription Plan UUID' })
  newPlanId!: string;

  @ApiPropertyOptional({ example: 'Facility expanded with 2 new surgical theatres' })
  reason?: string;
}

export class DowngradePlanDto {
  @ApiProperty({ description: 'New target lower-tier Subscription Plan UUID' })
  newPlanId!: string;

  @ApiPropertyOptional({ example: 'Restructuring bed capacity' })
  reason?: string;
}

export class RecordUsageDto {
  @ApiProperty({ enum: MeteredMetricType, example: MeteredMetricType.ENCOUNTERS })
  metricType!: MeteredMetricType;

  @ApiProperty({ example: 1, description: 'Quantity to increment' })
  quantity!: number;

  @ApiPropertyOptional({ example: { encounterId: '550e8400-e29b-41d4-a716-446655440000' } })
  details?: Record<string, any>;
}

export class ProcessPlatformPaymentDto {
  @ApiProperty({ description: 'Platform Invoice UUID to pay' })
  invoiceId!: string;

  @ApiProperty({ example: 45000, description: 'Amount in KES to pay' })
  amountKes!: number;

  @ApiProperty({ enum: PlatformPaymentMethod, default: PlatformPaymentMethod.MPESA })
  paymentMethod!: PlatformPaymentMethod;

  @ApiPropertyOptional({ example: '+254712345678', description: 'Kenyan phone number for M-Pesa STK push' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'QAB1234567', description: 'Reference number if pre-settled via bank transfer' })
  referenceNumber?: string;

  @ApiProperty({ example: 'IDEMP-PAY-202611-0001', description: 'Idempotency key to guarantee once-and-only-once charge' })
  idempotencyKey!: string;
}

export class CreateSupportCaseDto {
  @ApiPropertyOptional({ description: 'Facility UUID if specific to a branch' })
  facilityId?: string;

  @ApiProperty({ example: 'eTIMS invoice signing timeout during night shift' })
  subject!: string;

  @ApiProperty({ example: 'Clinicians encountered HTTP 504 gateway timeout when generating eTIMS signatures between 02:00 and 03:00.' })
  description!: string;

  @ApiProperty({ enum: SupportCaseCategory, default: SupportCaseCategory.INTEGRATION_ISSUE })
  category!: SupportCaseCategory;

  @ApiProperty({ enum: SupportCasePriority, default: SupportCasePriority.HIGH })
  priority!: SupportCasePriority;
}

export class AddCaseMessageDto {
  @ApiProperty({ example: 'Network traces show Safaricom Daraja callback port was responding within 120ms.' })
  message!: string;
}

export class UpdateCaseStatusDto {
  @ApiProperty({ enum: SupportCaseStatus })
  status!: SupportCaseStatus;

  @ApiPropertyOptional({ description: 'User UUID of assigned support engineer' })
  assignedToUserId?: string;
}

export class GrantSupportAccessDto {
  @ApiPropertyOptional({ description: 'Facility UUID scope' })
  facilityId?: string;

  @ApiProperty({ description: 'User UUID of COMKEY platform support engineer' })
  supportUserId!: string;

  @ApiProperty({ example: 'Investigating laboratory analyzer HL7/FHIR interface failure' })
  reason!: string;

  @ApiProperty({ enum: SupportAccessScope, default: SupportAccessScope.READ_ONLY })
  scope!: SupportAccessScope;

  @ApiPropertyOptional({ example: 4, description: 'Access window duration in hours (max 24h)', default: 4 })
  durationHours?: number;
}

export class RequestOffboardingDto {
  @ApiProperty({ example: 'Facility acquired by county referral trust; transitioning records' })
  reason!: string;

  @ApiPropertyOptional({ example: 10, description: 'Statutory medical record archive retention years (default 10 as per Health Act 2017)', default: 10 })
  clinicalDataRetentionYears?: number;
}
