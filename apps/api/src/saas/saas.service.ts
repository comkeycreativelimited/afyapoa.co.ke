import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { desc, eq, and, sql } from 'drizzle-orm';
import {
  tenants,
  facilities,
  users,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionHistory,
  tenantEntitlements,
  tenantUsageMeters,
} from '@afyapoa/database';
import {
  AuditEventType,
  BillingCycle,
  MeteredMetricType,
  PlanFeatureEntitlements,
  SubscriptionStatus,
  UserRole,
} from '@afyapoa/domain-core';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  OnboardTenantDto,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  UpgradePlanDto,
  DowngradePlanDto,
  RecordUsageDto,
} from './dto/index.js';

@Injectable()
export class SaasService {
  constructor(
    @Inject(TenancyService) private tenancyService: TenancyService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. TENANT ONBOARDING & FACILITY CONFIGURATION
  // =========================================================================

  async onboardTenant(dto: OnboardTenantDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      // 1. Check uniqueness of tenant code and facility KMFL code
      const existingTenant = await db.select().from(tenants).where(eq(tenants.code, dto.code));
      if (existingTenant.length > 0) {
        throw new BadRequestException(`Tenant organization with code '${dto.code}' already exists.`);
      }

      const existingFacility = await db
        .select()
        .from(facilities)
        .where(eq(facilities.kmflCode, dto.facilityKmflCode));
      if (existingFacility.length > 0) {
        throw new BadRequestException(
          `Health facility with KMFL code '${dto.facilityKmflCode}' already exists.`,
        );
      }

      // 2. Resolve default subscription plan
      let plan = null;
      if (dto.initialPlanCode) {
        const [p] = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.code, dto.initialPlanCode));
        plan = p;
      }
      if (!plan) {
        const [p] = await db
          .select()
          .from(subscriptionPlans)
          .where(eq(subscriptionPlans.facilityLevel, dto.facilityLevel));
        plan = p;
      }
      if (!plan) {
        // Fallback to first active plan
        const [p] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.active, true));
        plan = p;
      }

      // 3. Create Tenant
      const [tenant] = await db
        .insert(tenants)
        .values({
          code: dto.code,
          name: dto.name,
          tier: dto.tier || 'COMMERCIAL',
          status: 'ACTIVE',
        })
        .returning();

      // 4. Create Primary Health Facility
      const [facility] = await db
        .insert(facilities)
        .values({
          tenantId: tenant!.id,
          kmflCode: dto.facilityKmflCode,
          name: dto.facilityName,
          level: dto.facilityLevel,
          county: dto.county,
          subCounty: dto.subCounty,
          physicalAddress: dto.physicalAddress,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          kraPin: dto.kraPin,
          shaContractCode: dto.shaContractCode,
          active: true,
        })
        .returning();

      // 5. Create Hospital Administrator user
      const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
      const [adminUser] = await db
        .insert(users)
        .values({
          tenantId: tenant!.id,
          primaryFacilityId: facility!.id,
          username: dto.adminUsername,
          email: dto.adminEmail,
          fullName: dto.adminFullName,
          role: UserRole.FACILITY_ADMIN,
          passwordHash,
          status: 'ACTIVE',
        })
        .returning();

      // 6. Setup Initial Subscription & Entitlements
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days trial/initial
      const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days trial

      let subId = null;
      if (plan) {
        const [subscription] = await db
          .insert(tenantSubscriptions)
          .values({
            tenantId: tenant!.id,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            billingCycle: plan.billingCycle as BillingCycle,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            trialEndsAt,
            autoRenew: true,
          })
          .returning();
        subId = subscription!.id;

        // Entitlements
        await db.insert(tenantEntitlements).values({
          tenantId: tenant!.id,
          planId: plan.id,
          maxUsers: plan.maxUsers,
          maxMonthlyEncounters: plan.maxMonthlyEncounters,
          maxStorageGb: plan.maxStorageGb,
          features: plan.features,
          enforceHardLimits: true,
        });

        // Subscription History
        await db.insert(subscriptionHistory).values({
          subscriptionId: subscription!.id,
          tenantId: tenant!.id,
          action: 'ACTIVATED',
          newPlanId: plan.id,
          newStatus: SubscriptionStatus.ACTIVE,
          changedByUserId: adminUser!.id,
          reason: 'Initial tenant onboarding subscription activation',
        });
      }

      // 7. Audit Logging
      await this.auditService.recordEvent({
        tenantId: tenant!.id,
        action: AuditEventType.TENANT_ONBOARDED,
        resource: 'Tenant',
        resourceId: tenant!.id,
        details: {
          code: tenant!.code,
          name: tenant!.name,
          facilityKmfl: facility!.kmflCode,
          planId: plan?.id,
        },
      });

      return {
        tenant: {
          id: tenant!.id,
          code: tenant!.code,
          name: tenant!.name,
          tier: tenant!.tier,
          status: tenant!.status,
        },
        facility: {
          id: facility!.id,
          kmflCode: facility!.kmflCode,
          name: facility!.name,
          level: facility!.level,
        },
        adminUser: {
          id: adminUser!.id,
          username: adminUser!.username,
          email: adminUser!.email,
          role: adminUser!.role,
        },
        subscriptionId: subId,
      };
    });
  }

  // =========================================================================
  // 2. SUBSCRIPTION PLAN DEFINITIONS
  // =========================================================================

  async createPlan(dto: CreateSubscriptionPlanDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [existing] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.code, dto.code));
      if (existing) {
        throw new BadRequestException(`Subscription plan code '${dto.code}' already exists.`);
      }

      const [plan] = await db
        .insert(subscriptionPlans)
        .values({
          code: dto.code,
          name: dto.name,
          facilityLevel: dto.facilityLevel,
          billingCycle: dto.billingCycle,
          basePriceKes: dto.basePriceKes.toString(),
          currency: 'KES',
          maxUsers: dto.maxUsers,
          maxMonthlyEncounters: dto.maxMonthlyEncounters,
          maxStorageGb: dto.maxStorageGb,
          features: dto.features,
          active: true,
        })
        .returning();

      return plan;
    });
  }

  async listPlans() {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      return await db.select().from(subscriptionPlans).orderBy(subscriptionPlans.basePriceKes);
    });
  }

  async getPlanById(id: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
      if (!plan) {
        throw new NotFoundException(`Subscription plan with ID '${id}' not found.`);
      }
      return plan;
    });
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (dto.name !== undefined) updates.name = dto.name;
      if (dto.basePriceKes !== undefined) updates.basePriceKes = dto.basePriceKes.toString();
      if (dto.maxUsers !== undefined) updates.maxUsers = dto.maxUsers;
      if (dto.maxMonthlyEncounters !== undefined) updates.maxMonthlyEncounters = dto.maxMonthlyEncounters;
      if (dto.maxStorageGb !== undefined) updates.maxStorageGb = dto.maxStorageGb;
      if (dto.features !== undefined) updates.features = dto.features;
      if (dto.active !== undefined) updates.active = dto.active;

      const [updated] = await db
        .update(subscriptionPlans)
        .set(updates)
        .where(eq(subscriptionPlans.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundException(`Subscription plan with ID '${id}' not found.`);
      }
      return updated;
    });
  }

  // =========================================================================
  // 3. SERVER-SIDE FEATURE ENTITLEMENTS & QUOTA ENFORCEMENT
  // =========================================================================

  async getTenantEntitlements(tenantId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [entitlement] = await db
        .select()
        .from(tenantEntitlements)
        .where(eq(tenantEntitlements.tenantId, tenantId));
      return entitlement || null;
    });
  }

  /**
   * Server-side entitlement security check. A hidden UI element is not a security control.
   */
  async assertFeatureEntitled(tenantId: string, featureKey: string): Promise<void> {
    const entitlement = await this.getTenantEntitlements(tenantId);
    if (!entitlement) {
      throw new ForbiddenException(`Tenant does not have an active feature entitlement profile.`);
    }

    const features = entitlement.features as PlanFeatureEntitlements;
    const isEntitled = Boolean(features && features[featureKey]);

    if (!isEntitled) {
      throw new ForbiddenException(
        `Feature '${featureKey}' is not enabled for your subscription plan tier. Please upgrade your commercial plan.`,
      );
    }
  }

  /**
   * Server-side quota check preventing tenants from exceeding plan limits.
   */
  async assertQuotaNotExceeded(tenantId: string, metricType: MeteredMetricType): Promise<void> {
    const entitlement = await this.getTenantEntitlements(tenantId);
    if (!entitlement || !entitlement.enforceHardLimits) {
      return;
    }

    const usage = await this.getCurrentUsage(tenantId, metricType);
    let limit = 0;

    if (metricType === MeteredMetricType.ENCOUNTERS) {
      limit = entitlement.maxMonthlyEncounters;
    } else if (metricType === MeteredMetricType.ACTIVE_USERS) {
      limit = entitlement.maxUsers;
    } else if (metricType === MeteredMetricType.STORAGE_MB) {
      limit = entitlement.maxStorageGb * 1024;
    }

    if (limit > 0 && usage >= limit) {
      throw new ForbiddenException(
        `Monthly quota for ${metricType} (${limit}) has been reached or exceeded (${usage}). Please upgrade plan to continue.`,
      );
    }
  }

  // =========================================================================
  // 4. SUBSCRIPTION LIFECYCLE (ACTIVATE, RENEW, UPGRADE, DOWNGRADE, SUSPEND, CANCEL)
  // =========================================================================

  async getSubscription(tenantId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [sub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .orderBy(desc(tenantSubscriptions.createdAt));
      if (!sub) {
        throw new NotFoundException(`No active subscription found for tenant '${tenantId}'.`);
      }

      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, sub.planId));

      const [entitlement] = await db
        .select()
        .from(tenantEntitlements)
        .where(eq(tenantEntitlements.tenantId, tenantId));

      return {
        subscription: sub,
        plan,
        entitlements: entitlement,
      };
    });
  }

  async upgradeSubscription(
    tenantId: string,
    dto: UpgradePlanDto,
    changedByUserId?: string,
  ) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [sub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .orderBy(desc(tenantSubscriptions.createdAt));
      if (!sub) {
        throw new NotFoundException(`No subscription found for tenant '${tenantId}'.`);
      }

      if (sub.status === SubscriptionStatus.SUSPENDED || sub.status === SubscriptionStatus.CANCELLED) {
        throw new BadRequestException(
          `Cannot upgrade subscription in '${sub.status}' state. Outstanding arrears or active suspension must be resolved first.`,
        );
      }

      const [newPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, dto.newPlanId));
      if (!newPlan) {
        throw new NotFoundException(`Target subscription plan '${dto.newPlanId}' not found.`);
      }

      const previousPlanId = sub.planId;
      const previousStatus = sub.status;

      // Update Subscription
      const [updatedSub] = await db
        .update(tenantSubscriptions)
        .set({
          planId: newPlan.id,
          status: SubscriptionStatus.ACTIVE,
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.id, sub.id))
        .returning();

      // Synchronize Entitlements
      await db
        .update(tenantEntitlements)
        .set({
          planId: newPlan.id,
          maxUsers: newPlan.maxUsers,
          maxMonthlyEncounters: newPlan.maxMonthlyEncounters,
          maxStorageGb: newPlan.maxStorageGb,
          features: newPlan.features,
          updatedAt: new Date(),
        })
        .where(eq(tenantEntitlements.tenantId, tenantId));

      // Audit History
      await db.insert(subscriptionHistory).values({
        subscriptionId: sub.id,
        tenantId,
        action: 'UPGRADED',
        previousPlanId,
        newPlanId: newPlan.id,
        previousStatus,
        newStatus: SubscriptionStatus.ACTIVE,
        changedByUserId,
        reason: dto.reason || 'SaaS subscription upgraded to higher tier',
      });

      await this.auditService.recordEvent({
        tenantId,
        userId: changedByUserId,
        action: AuditEventType.SUBSCRIPTION_UPGRADED,
        resource: 'TenantSubscription',
        resourceId: sub.id,
        details: { previousPlanId, newPlanId: newPlan.id, planName: newPlan.name },
      });

      return {
        subscription: updatedSub,
        newPlan,
      };
    });
  }

  async downgradeSubscription(
    tenantId: string,
    dto: DowngradePlanDto,
    changedByUserId?: string,
  ) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [sub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.tenantId, tenantId))
        .orderBy(desc(tenantSubscriptions.createdAt));
      if (!sub) {
        throw new NotFoundException(`No subscription found for tenant '${tenantId}'.`);
      }

      if (sub.status === SubscriptionStatus.SUSPENDED || sub.status === SubscriptionStatus.CANCELLED) {
        throw new BadRequestException(
          `Cannot downgrade subscription in '${sub.status}' state. Outstanding arrears or active suspension must be resolved first.`,
        );
      }

      const [newPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, dto.newPlanId));
      if (!newPlan) {
        throw new NotFoundException(`Target plan '${dto.newPlanId}' not found.`);
      }

      // Concurrency check: Ensure current resource usage doesn't exceed new lower plan limits
      const activeUserCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.status, 'ACTIVE')));

      const currentUsers = Number(activeUserCount[0]?.count || 0);
      if (currentUsers > newPlan.maxUsers) {
        throw new BadRequestException(
          `Cannot downgrade: current active staff user count (${currentUsers}) exceeds target plan limit (${newPlan.maxUsers}). Deactivate staff accounts before downgrading.`,
        );
      }

      const previousPlanId = sub.planId;
      const previousStatus = sub.status;

      // Update Subscription
      const [updatedSub] = await db
        .update(tenantSubscriptions)
        .set({
          planId: newPlan.id,
          updatedAt: new Date(),
        })
        .where(eq(tenantSubscriptions.id, sub.id))
        .returning();

      // Synchronize Entitlements
      await db
        .update(tenantEntitlements)
        .set({
          planId: newPlan.id,
          maxUsers: newPlan.maxUsers,
          maxMonthlyEncounters: newPlan.maxMonthlyEncounters,
          maxStorageGb: newPlan.maxStorageGb,
          features: newPlan.features,
          updatedAt: new Date(),
        })
        .where(eq(tenantEntitlements.tenantId, tenantId));

      // Record History
      await db.insert(subscriptionHistory).values({
        subscriptionId: sub.id,
        tenantId,
        action: 'DOWNGRADED',
        previousPlanId,
        newPlanId: newPlan.id,
        previousStatus,
        newStatus: sub.status,
        changedByUserId,
        reason: dto.reason || 'SaaS subscription downgraded to lower tier',
      });

      await this.auditService.recordEvent({
        tenantId,
        userId: changedByUserId,
        action: AuditEventType.SUBSCRIPTION_DOWNGRADED,
        resource: 'TenantSubscription',
        resourceId: sub.id,
        details: { previousPlanId, newPlanId: newPlan.id, planName: newPlan.name },
      });

      return {
        subscription: updatedSub,
        newPlan,
      };
    });
  }

  async suspendSubscription(subscriptionId: string, reason: string, changedByUserId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [sub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.id, subscriptionId));
      if (!sub) {
        throw new NotFoundException(`Subscription '${subscriptionId}' not found.`);
      }

      const previousStatus = sub.status;
      const now = new Date();

      const [updated] = await db
        .update(tenantSubscriptions)
        .set({
          status: SubscriptionStatus.SUSPENDED,
          suspendedAt: now,
          suspensionReason: reason,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptions.id, subscriptionId))
        .returning();

      await db.insert(subscriptionHistory).values({
        subscriptionId,
        tenantId: sub.tenantId,
        action: 'SUSPENDED',
        previousStatus,
        newStatus: SubscriptionStatus.SUSPENDED,
        changedByUserId,
        reason,
      });

      await this.auditService.recordEvent({
        tenantId: sub.tenantId,
        userId: changedByUserId,
        action: AuditEventType.SUBSCRIPTION_SUSPENDED,
        resource: 'TenantSubscription',
        resourceId: subscriptionId,
        details: { reason },
      });

      return updated;
    });
  }

  async cancelSubscription(subscriptionId: string, reason: string, changedByUserId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [sub] = await db
        .select()
        .from(tenantSubscriptions)
        .where(eq(tenantSubscriptions.id, subscriptionId));
      if (!sub) {
        throw new NotFoundException(`Subscription '${subscriptionId}' not found.`);
      }

      const previousStatus = sub.status;
      const now = new Date();

      const [updated] = await db
        .update(tenantSubscriptions)
        .set({
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
          cancellationReason: reason,
          autoRenew: false,
          updatedAt: now,
        })
        .where(eq(tenantSubscriptions.id, subscriptionId))
        .returning();

      await db.insert(subscriptionHistory).values({
        subscriptionId,
        tenantId: sub.tenantId,
        action: 'CANCELLED',
        previousStatus,
        newStatus: SubscriptionStatus.CANCELLED,
        changedByUserId,
        reason,
      });

      await this.auditService.recordEvent({
        tenantId: sub.tenantId,
        userId: changedByUserId,
        action: AuditEventType.SUBSCRIPTION_CANCELLED,
        resource: 'TenantSubscription',
        resourceId: subscriptionId,
        details: { reason },
      });

      return updated;
    });
  }

  // =========================================================================
  // 5. USAGE METERING WITH TENANT-LEVEL ATTRIBUTION
  // =========================================================================

  async recordUsage(tenantId: string, dto: RecordUsageDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const now = new Date();
      // Define month boundary
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

      const [existing] = await db
        .select()
        .from(tenantUsageMeters)
        .where(
          and(
            eq(tenantUsageMeters.tenantId, tenantId),
            eq(tenantUsageMeters.metricType, dto.metricType),
            eq(tenantUsageMeters.periodStart, periodStart),
          ),
        );

      let record;
      if (existing) {
        const [updated] = await db
          .update(tenantUsageMeters)
          .set({
            quantity: existing.quantity + dto.quantity,
            lastRecordedAt: now,
            updatedAt: now,
            details: dto.details ? { ...((existing.details as object) || {}), ...dto.details } : existing.details,
          })
          .where(eq(tenantUsageMeters.id, existing.id))
          .returning();
        record = updated;
      } else {
        const [created] = await db
          .insert(tenantUsageMeters)
          .values({
            tenantId,
            metricType: dto.metricType,
            periodStart,
            periodEnd,
            quantity: dto.quantity,
            details: dto.details || {},
          })
          .returning();
        record = created;
      }

      await this.auditService.recordEvent({
        tenantId,
        action: AuditEventType.USAGE_METERED,
        resource: 'TenantUsageMeter',
        resourceId: record!.id,
        details: { metricType: dto.metricType, quantity: dto.quantity, total: record!.quantity },
      });

      return record;
    });
  }

  async getCurrentUsage(tenantId: string, metricType: MeteredMetricType): Promise<number> {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const [meter] = await db
        .select()
        .from(tenantUsageMeters)
        .where(
          and(
            eq(tenantUsageMeters.tenantId, tenantId),
            eq(tenantUsageMeters.metricType, metricType),
            eq(tenantUsageMeters.periodStart, periodStart),
          ),
        );

      return meter ? meter.quantity : 0;
    });
  }

  async getUsageSummary(tenantId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const meters = await db
        .select()
        .from(tenantUsageMeters)
        .where(
          and(
            eq(tenantUsageMeters.tenantId, tenantId),
            eq(tenantUsageMeters.periodStart, periodStart),
          ),
        );

      const [entitlement] = await db
        .select()
        .from(tenantEntitlements)
        .where(eq(tenantEntitlements.tenantId, tenantId));

      const maxEncounters = entitlement?.maxMonthlyEncounters || 1000;
      const maxUsers = entitlement?.maxUsers || 10;
      const maxStorage = entitlement?.maxStorageGb || 10;

      const encounterMeter = meters.find((m) => m.metricType === MeteredMetricType.ENCOUNTERS);
      const userMeter = meters.find((m) => m.metricType === MeteredMetricType.ACTIVE_USERS);
      const storageMeter = meters.find((m) => m.metricType === MeteredMetricType.STORAGE_MB);

      const encountersUsed = encounterMeter ? encounterMeter.quantity : 0;
      const usersUsed = userMeter ? userMeter.quantity : 0;
      const storageMbUsed = storageMeter ? storageMeter.quantity : 0;

      const encounterPercent = Math.min(100, Math.round((encountersUsed / maxEncounters) * 100));

      return {
        billingPeriod: {
          periodStart,
          periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)),
        },
        encounters: {
          used: encountersUsed,
          limit: maxEncounters,
          utilizationPercent: encounterPercent,
          warning80: encounterPercent >= 80,
          exceeded100: encounterPercent >= 100,
        },
        users: {
          used: usersUsed,
          limit: maxUsers,
        },
        storage: {
          usedMb: storageMbUsed,
          limitGb: maxStorage,
        },
        meters,
      };
    });
  }
}
