import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BillingCycle,
  PlanFeatureEntitlements,
} from '@afyapoa/domain-core';

export class OnboardTenantDto {
  @ApiProperty({ example: 'tenant-mombasa-general', description: 'Unique tenant organizational code' })
  code!: string;

  @ApiProperty({ example: 'Mombasa General Hospital Group', description: 'Hospital organization name' })
  name!: string;

  @ApiPropertyOptional({ example: 'COMMERCIAL', description: 'Licensing tier: PILOT, BASIC, STANDARD, ENTERPRISE' })
  tier?: string;

  @ApiProperty({ example: 'FID-01-000301-4', description: 'Primary hospital KMFL Code' })
  facilityKmflCode!: string;

  @ApiProperty({ example: 'Mombasa General Hospital', description: 'Primary health facility name' })
  facilityName!: string;

  @ApiProperty({ example: 'LEVEL_5', description: 'Facility level: LEVEL_2 to LEVEL_6' })
  facilityLevel!: string;

  @ApiProperty({ example: 'Mombasa', description: 'County name' })
  county!: string;

  @ApiProperty({ example: 'Mvita', description: 'Sub-county name' })
  subCounty!: string;

  @ApiProperty({ example: 'Nyerere Avenue, Mombasa', description: 'Physical street address' })
  physicalAddress!: string;

  @ApiProperty({ example: '+254711000111', description: 'Hospital contact phone number' })
  contactPhone!: string;

  @ApiProperty({ example: 'admin@mombasageneral.demo.afyapoa.co.ke', description: 'Hospital contact email' })
  contactEmail!: string;

  @ApiPropertyOptional({ example: 'P051000999X', description: 'KRA PIN' })
  kraPin?: string;

  @ApiPropertyOptional({ example: 'SHA-CTR-00301', description: 'SHA Contract Code' })
  shaContractCode?: string;

  @ApiProperty({ example: 'mombasa_admin', description: 'Initial Hospital Administrator username' })
  adminUsername!: string;

  @ApiProperty({ example: 'admin@mombasageneral.demo.afyapoa.co.ke', description: 'Admin email' })
  adminEmail!: string;

  @ApiProperty({ example: 'Dr. Fatuma Ali', description: 'Admin full name' })
  adminFullName!: string;

  @ApiProperty({ example: 'AdminPass123!Secure', description: 'Initial admin temporary password' })
  adminPassword!: string;

  @ApiPropertyOptional({ example: 'PLAN_LEVEL5_REFERRAL', description: 'Initial subscription plan code' })
  initialPlanCode?: string;
}

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'PLAN_LEVEL4_HOSPITAL', description: 'Unique code for subscription tier' })
  code!: string;

  @ApiProperty({ example: 'Level 4 County Sub-County Hospital Tier', description: 'Plan display name' })
  name!: string;

  @ApiProperty({ example: 'LEVEL_4', description: 'Target facility level' })
  facilityLevel!: string;

  @ApiProperty({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  billingCycle!: BillingCycle;

  @ApiProperty({ example: 45000, description: 'Base subscription price in KES' })
  basePriceKes!: number;

  @ApiProperty({ example: 50, description: 'Maximum active users allowed' })
  maxUsers!: number;

  @ApiProperty({ example: 2500, description: 'Maximum billable patient encounters per month' })
  maxMonthlyEncounters!: number;

  @ApiProperty({ example: 50, description: 'Storage quota in GB' })
  maxStorageGb!: number;

  @ApiProperty({
    example: {
      inpatient: true,
      theatre: true,
      maternity: true,
      radiology: true,
      procurement: true,
      privateInsurance: true,
      dhaShr: true,
      kraEtims: true,
    },
    description: 'Feature entitlements enabled for this tier',
  })
  features!: PlanFeatureEntitlements;
}

export class UpdateSubscriptionPlanDto {
  @ApiPropertyOptional({ example: 'Updated Tier Name' })
  name?: string;

  @ApiPropertyOptional({ example: 55000 })
  basePriceKes?: number;

  @ApiPropertyOptional({ example: 75 })
  maxUsers?: number;

  @ApiPropertyOptional({ example: 3500 })
  maxMonthlyEncounters?: number;

  @ApiPropertyOptional({ example: 100 })
  maxStorageGb?: number;

  @ApiPropertyOptional()
  features?: PlanFeatureEntitlements;

  @ApiPropertyOptional({ example: true })
  active?: boolean;
}

export class IssuePlatformInvoiceDto {
  @ApiProperty({ example: '083d4497-0a73-4d1c-b55f-8a618cbffc3d', description: 'Tenant UUID' })
  tenantId!: string;

  @ApiPropertyOptional({ description: 'Tenant Subscription UUID' })
  subscriptionId?: string;

  @ApiProperty({ example: '2026-11-30T23:59:59Z', description: 'Due date' })
  dueDate!: string;

  @ApiProperty({ example: 'IDEMP-INV-202611-001', description: 'Financial idempotency key' })
  idempotencyKey!: string;

  @ApiProperty({
    example: [
      { description: 'Level 4 Hospital Monthly Subscription', quantity: 1, unitPriceKes: 45000 },
      { description: 'Additional Encounter Pack (500 encounters)', quantity: 1, unitPriceKes: 5000 },
    ],
  })
  items!: Array<{
    description: string;
    quantity: number;
    unitPriceKes: number;
  }>;
}

export class SuspendSubscriptionDto {
  @ApiProperty({ example: 'Commercial payment failed after dunning grace period' })
  reason!: string;
}

export class CancelSubscriptionDto {
  @ApiProperty({ example: 'Facility transitioning off platform at end of contract period' })
  reason!: string;
}
