/**
 * COMKEY AFYA POA — Commercial SaaS Administration Integration Test Suite
 *
 * Verifies all 12 commercial administration capabilities:
 * 1. Tenant onboarding and facility configuration
 * 2. Subscription plan definitions & catalog
 * 3. Feature entitlements and configurable limits
 * 4. Subscription lifecycle: activate, upgrade, downgrade, suspend, cancel
 * 5. Usage metering with tenant-level attribution and 80%/100% threshold alerts
 * 6. Platform invoices and idempotent payment records (separate from patient billing)
 * 7. Failed-payment handling, 5-stage dunning progression, and patient safety clinical safeguards
 * 8. Subscription reporting (MRR/ARR) and financial reconciliation
 * 9. Platform health and integration monitoring (DHA HIE, SHA Claims, eTIMS, M-Pesa)
 * 10. Administrative support cases and conversation threads
 * 11. Controlled, auditable support access with time-bound cryptographic grants
 * 12. Tenant offboarding and statutory 10-year medical records retention workflows
 *
 * Plus:
 * 13. Tenant isolation (Tenant A vs Tenant B) and Role-Based Access Control
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import {
  withSuperAdminContext,
  tenants,
  facilities,
  users,
  subscriptionPlans,
  tenantSubscriptions,
  subscriptionHistory,
  tenantEntitlements,
  tenantUsageMeters,
  platformInvoices,
  platformInvoiceItems,
  platformPayments,
  platformDunningEvents,
  supportCases,
  supportCaseMessages,
  supportAccessGrants,
  tenantOffboardingRequests,
} from '@afyapoa/database';
import {
  UserRole,
  SubscriptionStatus,
  SubscriptionTier,
  BillingCycle,
  PlatformInvoiceStatus,
  PlatformPaymentMethod,
  PlatformPaymentStatus,
  DunningStage,
  SupportCaseCategory,
  SupportCasePriority,
  SupportCaseStatus,
  SupportAccessScope,
  OffboardingStatus,
  MeteredMetricType,
} from '@afyapoa/domain-core';

describe('Commercial SaaS Administration Capabilities (COMKEY AFYA POA)', () => {
  let app: INestApplication;
  let baseUrl: string;

  // Tenant fixtures
  let tenantAId: string;
  let tenantBId: string;
  let facilityA1Id: string;
  let facilityB1Id: string;

  // Authentication tokens
  let superAdminToken: string;
  let adminAToken: string;
  let adminBToken: string;
  let financeAToken: string;
  let clinicianAToken: string;

  let superAdminUserId: string;
  let adminAUserId: string;
  let financeAUserId: string;

  // Shared test entity IDs
  let standardPlanId: string;
  let enterprisePlanId: string;
  let testInvoiceId: string;
  let testCaseId: string;
  let testGrantId: string;
  let testGrantToken: string;
  let testOffboardingId: string;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn'],
    });

    app.setGlobalPrefix('api/v1', {
      exclude: ['health', 'health/liveness', 'health/readiness'],
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());

    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;

    // 1. Fetch seed tenants and facilities
    await withSuperAdminContext(async (db) => {
      // Clean existing SaaS tables for pristine test execution
      await db.delete(supportCaseMessages);
      await db.delete(supportCases);
      await db.delete(supportAccessGrants);
      await db.delete(tenantOffboardingRequests);
      await db.delete(platformDunningEvents);
      await db.delete(platformPayments);
      await db.delete(platformInvoiceItems);
      await db.delete(platformInvoices);
      await db.delete(tenantUsageMeters);
      await db.delete(tenantEntitlements);
      await db.delete(subscriptionHistory);
      await db.delete(tenantSubscriptions);
      await db.delete(subscriptionPlans);

      // Seed base Level 4 plan so tenant onboarding can automatically provision default subscription
      const [seedPlan] = await db
        .insert(subscriptionPlans)
        .values({
          code: 'PLAN_LEVEL4_DEFAULT',
          name: 'Level 4 County Sub-County Hospital Tier',
          facilityLevel: 'LEVEL_4',
          billingCycle: BillingCycle.MONTHLY,
          basePriceKes: '45000.00',
          currency: 'KES',
          maxUsers: 50,
          maxMonthlyEncounters: 2500,
          maxStorageGb: 50,
          features: {
            inpatient: true,
            theatre: true,
            maternity: true,
            radiology: true,
            procurement: true,
            privateInsurance: true,
            dhaShr: true,
            kraEtims: true,
            advancedRosters: true,
          },
          active: true,
        })
        .returning();
      standardPlanId = seedPlan.id;

      // Clean test-created users and test organizations
      await db.delete(users).where(sql`username IN ('finance.nmhg', 'admin.nakuru', 'admin.dup', 'admin.another')`);
      await db.delete(facilities).where(sql`kmfl_code IN ('FID-04-000404-4', 'FID-04-000999-9')`);
      await db.delete(tenants).where(sql`code IN ('tenant-nakuru-west', 'tenant-distinct-code')`);

      const allTenants = await db.select().from(tenants);
      const tA = allTenants.find((t) => t.code === 'tenant-nmhg');
      const tB = allTenants.find((t) => t.code === 'tenant-kibera-net');
      if (!tA || !tB) throw new Error('Seeded tenants missing');

      tenantAId = tA.id;
      tenantBId = tB.id;

      const facs = await db.select().from(facilities);
      const fA = facs.find((f) => f.tenantId === tenantAId);
      const fB = facs.find((f) => f.tenantId === tenantBId);
      if (!fA || !fB) throw new Error('Seeded facilities missing');

      facilityA1Id = fA.id;
      facilityB1Id = fB.id;

      // Ensure Tenant A and Tenant B status are ACTIVE
      await db.update(tenants).set({ status: 'ACTIVE' }).where(sql`id IN (${tenantAId}, ${tenantBId})`);

      // Reset test accounts password, status, failed login attempts, and lockout
      const passwordHash = await bcrypt.hash('Password123!', 10);
      await db.update(users).set({
        passwordHash,
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      }).where(sql`username IN ('superadmin', 'admin.nmhg', 'admin.kibera', 'dr.otieno')`);

      // Seed dedicated Finance User for Tenant A
      const [financeUser] = await db
        .insert(users)
        .values({
          tenantId: tenantAId,
          primaryFacilityId: facilityA1Id,
          username: 'finance.nmhg',
          email: 'finance@nmhg.demo.afyapoa.co.ke',
          fullName: 'Grace Mutiso (Finance Officer)',
          role: UserRole.FINANCE_USER,
          passwordHash,
          mfaEnabled: false,
          isSuperAdmin: false,
          status: 'ACTIVE',
        })
        .returning();
      financeAUserId = financeUser.id;
    });

    // 2. Login Super Admin with MFA
    const saLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'superadmin', password: 'Password123!' }),
    });
    const saLoginData = await saLoginRes.json();
    const saMfaToken = saLoginData.mfaToken || saLoginData.data?.mfaToken;

    const saMfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: saMfaToken, code: '123456' }),
    });
    const saMfaData = await saMfaRes.json();
    superAdminToken = saMfaData.accessToken || saMfaData.data?.accessToken;
    superAdminUserId = saMfaData.user?.id || saMfaData.data?.user?.id;
    expect(superAdminToken, `Superadmin token missing`).toBeDefined();

    // 3. Login Hospital Admin A (NMHG)
    const adminALoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin.nmhg', password: 'Password123!' }),
    });
    const adminALoginData = await adminALoginRes.json();
    const adminAMfaToken = adminALoginData.mfaToken || adminALoginData.data?.mfaToken;

    const adminAMfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: adminAMfaToken, code: '123456' }),
    });
    const adminAMfaData = await adminAMfaRes.json();
    adminAToken = adminAMfaData.accessToken || adminAMfaData.data?.accessToken;
    adminAUserId = adminAMfaData.user?.id || adminAMfaData.data?.user?.id;
    expect(adminAToken, `Admin A token missing`).toBeDefined();

    // 4. Login Hospital Admin B (Kibera Net)
    const adminBLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin.kibera', password: 'Password123!' }),
    });
    const adminBLoginData = await adminBLoginRes.json();
    expect(adminBLoginRes.status, `Admin B login status: ${JSON.stringify(adminBLoginData)}`).toBe(200);
    const adminBMfaToken = adminBLoginData.mfaToken || adminBLoginData.data?.mfaToken;

    const adminBMfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfaToken: adminBMfaToken, code: '123456' }),
    });
    const adminBMfaData = await adminBMfaRes.json();
    expect(adminBMfaRes.status, `Admin B MFA status: ${JSON.stringify(adminBMfaData)}`).toBe(200);
    adminBToken = adminBMfaData.accessToken || adminBMfaData.data?.accessToken;
    expect(adminBToken, `Admin B token missing`).toBeDefined();

    // 5. Login Finance User A
    const finLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'finance.nmhg', password: 'Password123!' }),
    });
    const finData = await finLoginRes.json();
    financeAToken = finData.accessToken || finData.data?.accessToken;
    expect(financeAToken, `Finance A token missing`).toBeDefined();

    // 6. Login Clinician A (Dr Otieno)
    const clinLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dr.otieno', password: 'Password123!' }),
    });
    const clinData = await clinLoginRes.json();
    clinicianAToken = clinData.accessToken || clinData.data?.accessToken;
    expect(clinicianAToken, `Clinician A token missing`).toBeDefined();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // =========================================================================
  // 1. TENANT ONBOARDING & FACILITY CONFIGURATION
  // =========================================================================
  describe('1. Tenant Onboarding and Facility Configuration', () => {
    it('super admin can onboard a new hospital tenant with primary KMFL facility and admin user', async () => {
      const onboardPayload = {
        code: 'tenant-nakuru-west',
        name: 'Nakuru West Sub-County Hospital',
        tier: SubscriptionTier.STANDARD,
        billingCycle: BillingCycle.MONTHLY,
        facilityKmflCode: 'FID-04-000404-4',
        facilityName: 'Nakuru West Referral Hospital',
        facilityLevel: 'LEVEL_4',
        county: 'Nakuru',
        subCounty: 'Nakuru West',
        physicalAddress: 'Nakuru-Eldoret Highway, Nakuru',
        contactPhone: '+254711000404',
        contactEmail: 'admin@nakuruwest.demo.afyapoa.co.ke',
        shaContractCode: 'SHA-CTR-00404',
        dhaHieEndpoint: 'https://dha-mock.afyapoa.co.ke/hie/nakuru',
        kraPin: 'P054000404N',
        adminUsername: 'admin.nakuru',
        adminEmail: 'admin@nakuruwest.demo.afyapoa.co.ke',
        adminFullName: 'Dr. Kevin Kiprop',
        adminPassword: 'Password123!',
      };

      const res = await fetch(`${baseUrl}/platform/tenants/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(onboardPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const body = data.data || data;

      expect(body.tenant).toBeDefined();
      expect(body.tenant.code).toBe('tenant-nakuru-west');
      expect(body.facility).toBeDefined();
      expect(body.facility.kmflCode).toBe('FID-04-000404-4');
      expect(body.adminUser).toBeDefined();
      expect(body.adminUser.username).toBe('admin.nakuru');
      expect(body.subscriptionId).toBeDefined();
    });

    it('rejects onboarding with duplicate tenant code', async () => {
      const duplicatePayload = {
        code: 'tenant-nakuru-west', // Already created
        name: 'Duplicate Hospital',
        facilityKmflCode: 'FID-04-000999-9',
        facilityName: 'Duplicate Facility',
        county: 'Nakuru',
        subCounty: 'Nakuru West',
        contactPhone: '+254711000999',
        contactEmail: 'dup@demo.afyapoa.co.ke',
        adminUsername: 'admin.dup',
        adminEmail: 'dup@demo.afyapoa.co.ke',
        adminFullName: 'Duplicate Admin',
        adminPassword: 'Password123!',
      };

      const res = await fetch(`${baseUrl}/platform/tenants/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(duplicatePayload),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('already exists');
    });

    it('rejects onboarding with duplicate KMFL facility code', async () => {
      const duplicateKmflPayload = {
        code: 'tenant-distinct-code',
        name: 'Another Hospital',
        facilityKmflCode: 'FID-04-000404-4', // Duplicate KMFL
        facilityName: 'Another Facility',
        county: 'Nakuru',
        subCounty: 'Nakuru West',
        contactPhone: '+254711000998',
        contactEmail: 'another@demo.afyapoa.co.ke',
        adminUsername: 'admin.another',
        adminEmail: 'another@demo.afyapoa.co.ke',
        adminFullName: 'Another Admin',
        adminPassword: 'Password123!',
      };

      const res = await fetch(`${baseUrl}/platform/tenants/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(duplicateKmflPayload),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('KMFL code');
    });
  });

  // =========================================================================
  // 2. SUBSCRIPTION PLAN DEFINITIONS
  // =========================================================================
  describe('2. Subscription Plan Definitions & Catalog', () => {
    it('super admin can define tiered subscription plans with entitlements and limits', async () => {
      // 1. Create Standard Plan
      const standardPayload = {
        code: 'PLAN-STANDARD-KES',
        name: 'Hospital Standard Tier',
        facilityLevel: 'LEVEL_4',
        billingCycle: BillingCycle.MONTHLY,
        basePriceKes: 35000,
        maxUsers: 25,
        maxMonthlyEncounters: 2000,
        maxStorageGb: 100,
        features: {
          inpatient: true,
          theatre: true,
          maternity: true,
          radiology: true,
          procurement: true,
          privateInsurance: false,
          dhaShr: true,
          kraEtims: true,
          advancedRosters: false,
        },
      };

      const stdRes = await fetch(`${baseUrl}/platform/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(standardPayload),
      });

      expect(stdRes.status).toBe(201);
      const stdData = await stdRes.json();
      const stdBody = stdData.data || stdData;
      expect(stdBody.id).toBeDefined();
      expect(stdBody.code).toBe('PLAN-STANDARD-KES');
      standardPlanId = stdBody.id;

      // 2. Create Enterprise Plan
      const enterprisePayload = {
        code: 'PLAN-ENTERPRISE-KES',
        name: 'Hospital Enterprise Comprehensive Tier',
        facilityLevel: 'LEVEL_5',
        billingCycle: BillingCycle.ANNUAL,
        basePriceKes: 95000,
        maxUsers: 150,
        maxMonthlyEncounters: 15000,
        maxStorageGb: 1000,
        features: {
          inpatient: true,
          theatre: true,
          maternity: true,
          radiology: true,
          procurement: true,
          privateInsurance: true,
          dhaShr: true,
          kraEtims: true,
          advancedRosters: true,
        },
      };

      const entRes = await fetch(`${baseUrl}/platform/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(enterprisePayload),
      });

      expect(entRes.status).toBe(201);
      const entData = await entRes.json();
      const entBody = entData.data || entData;
      expect(entBody.id).toBeDefined();
      enterprisePlanId = entBody.id;
    });

    it('hospital administrators can list available subscription plans', async () => {
      const res = await fetch(`${baseUrl}/saas/plans`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const plans = data.data || data;
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThanOrEqual(2);
      expect(plans.some((p: any) => p.code === 'PLAN-STANDARD-KES')).toBe(true);
      expect(plans.some((p: any) => p.code === 'PLAN-ENTERPRISE-KES')).toBe(true);
    });

    it('super admin can update subscription plan limits and pricing', async () => {
      const updatePayload = {
        basePriceKes: 38000,
        maxMonthlyEncounters: 2500,
      };

      const res = await fetch(`${baseUrl}/platform/plans/${standardPlanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const updated = data.data || data;
      expect(Number(updated.basePriceKes)).toBe(38000);
      expect(updated.maxMonthlyEncounters).toBe(2500);
    });
  });

  // =========================================================================
  // 3. FEATURE ENTITLEMENTS & CONFIGURABLE LIMITS ENFORCEMENT
  // =========================================================================
  describe('3. Feature Entitlements and Configurable Limits', () => {
    it('sets initial subscription and entitlements for Tenant A', async () => {
      // Direct setup of Tenant A subscription to STANDARD plan
      await withSuperAdminContext(async (db) => {
        await db
          .insert(tenantSubscriptions)
          .values({
            tenantId: tenantAId,
            planId: standardPlanId,
            status: SubscriptionStatus.ACTIVE,
            billingCycle: BillingCycle.MONTHLY,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });

        await db.insert(tenantEntitlements).values({
          tenantId: tenantAId,
          planId: standardPlanId,
          maxUsers: 50,
          maxMonthlyEncounters: 2500,
          maxStorageGb: 50,
          features: {
            inpatient: true,
            theatre: true,
            maternity: true,
            radiology: true,
            procurement: true,
            privateInsurance: false,
            dhaShr: true,
            kraEtims: true,
            advancedRosters: true,
          },
        });
      });

      const res = await fetch(`${baseUrl}/saas/subscription`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const body = data.data || data;
      expect(body.subscription).toBeDefined();
      expect(body.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(body.entitlements).toBeDefined();
      expect(body.entitlements.features.privateInsurance).toBe(false);
      expect(body.entitlements.features.inpatient).toBe(true);
    });
  });

  // =========================================================================
  // 4. SUBSCRIPTION LIFECYCLE: UPGRADE, DOWNGRADE, SUSPEND, CANCEL
  // =========================================================================
  describe('4. Subscription Activation, Upgrade, Downgrade, Suspension, Cancellation', () => {
    it('hospital administrator can upgrade subscription plan tier', async () => {
      const upgradePayload = {
        newPlanId: enterprisePlanId,
        reason: 'Hospital expanded to Level 5 comprehensive care',
      };

      const res = await fetch(`${baseUrl}/saas/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(upgradePayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const body = data.data || data;

      expect(body.subscription.planId).toBe(enterprisePlanId);
      expect(body.subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(body.newPlan).toBeDefined();
      expect(body.newPlan.id).toBe(enterprisePlanId);
    });

    it('enforces capacity guard on plan downgrade (blocks downgrade if active resources exceed new limits)', async () => {
      // Create a restrictive basic plan with max 1 practitioner
      let tinyPlanId: string;
      await withSuperAdminContext(async (db) => {
        const [tiny] = await db
          .insert(subscriptionPlans)
          .values({
            code: 'PLAN-TINY-KES',
            name: 'Tiny Clinic Tier',
            facilityLevel: 'LEVEL_2',
            billingCycle: BillingCycle.MONTHLY,
            basePriceKes: '5000.00',
            currency: 'KES',
            maxUsers: 1, // Tenant A already has >= 3 users
            maxMonthlyEncounters: 50,
            maxStorageGb: 1,
            features: {
              inpatient: false,
              theatre: false,
              maternity: false,
              radiology: false,
              procurement: false,
              privateInsurance: false,
              dhaShr: false,
              kraEtims: false,
              advancedRosters: false,
            },
            active: true,
          })
          .returning();
        tinyPlanId = tiny.id;
      });

      const downgradePayload = {
        newPlanId: tinyPlanId!,
        reason: 'Downsizing staff footprint',
      };

      const res = await fetch(`${baseUrl}/saas/subscription/downgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(downgradePayload),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('Cannot downgrade');
    });

    it('super admin can suspend tenant subscription with reason', async () => {
      const subRes = await fetch(`${baseUrl}/saas/subscription`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const subData = await subRes.json();
      const subId = (subData.data || subData).subscription.id;

      const suspendPayload = {
        reason: 'Commercial invoice overdue past 30 days',
      };

      const res = await fetch(`${baseUrl}/platform/subscriptions/${subId}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(suspendPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const sub = data.data || data;
      expect(sub.status).toBe(SubscriptionStatus.SUSPENDED);
    });

    it('super admin can cancel tenant subscription', async () => {
      const subRes = await fetch(`${baseUrl}/saas/subscription`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const subData = await subRes.json();
      const subId = (subData.data || subData).subscription.id;

      const cancelPayload = {
        reason: 'Tenant requested termination of service',
      };

      const res = await fetch(`${baseUrl}/platform/subscriptions/${subId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(cancelPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const sub = data.data || data;
      expect(sub.status).toBe(SubscriptionStatus.CANCELLED);

      // Re-activate subscription for remaining test scenarios
      await withSuperAdminContext(async (db) => {
        await db
          .update(tenantSubscriptions)
          .set({ status: SubscriptionStatus.ACTIVE })
          .where(sql`id = ${subId}`);
      });
    });
  });

  // =========================================================================
  // 5. USAGE METERING WITH TENANT-LEVEL ATTRIBUTION
  // =========================================================================
  describe('5. Usage Metering with Tenant-Level Attribution', () => {
    it('records metered metrics for tenant with automatic aggregation', async () => {
      const encPayload = {
        metricType: MeteredMetricType.ENCOUNTERS,
        quantity: 10000,
      };

      const res = await fetch(`${baseUrl}/saas/usage/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(encPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const meter = data.data || data;
      expect(meter.metricType).toBe(MeteredMetricType.ENCOUNTERS);
      expect(meter.quantity).toBe(10000);
    });

    it('provides usage summary with 80% warning and 100% threshold alert notifications', async () => {
      // Record another batch of encounters pushing quantity over 80% of 15000 limit
      // (10000 + 2500 = 12500 = 83%)
      await fetch(`${baseUrl}/saas/usage/record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          metricType: MeteredMetricType.ENCOUNTERS,
          quantity: 2500,
        }),
      });

      const res = await fetch(`${baseUrl}/saas/usage`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const summary = data.data || data;

      expect(summary.encounters).toBeDefined();
      expect(summary.encounters.used).toBe(12500);
      expect(summary.encounters.limit).toBe(15000);
      expect(summary.encounters.utilizationPercent).toBeGreaterThanOrEqual(80);
      expect(summary.encounters.warning80).toBe(true);
    });
  });

  // =========================================================================
  // 6. PLATFORM INVOICES & IDEMPOTENT PAYMENT RECORDS
  // =========================================================================
  describe('6. Platform Invoices and Payment Records (Separate from Patient Billing)', () => {
    it('super admin can issue platform invoice with 16% VAT and itemized lines', async () => {
      const subRes = await fetch(`${baseUrl}/saas/subscription`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const subData = await subRes.json();
      const subId = (subData.data || subData).subscription.id;

      const invoicePayload = {
        tenantId: tenantAId,
        subscriptionId: subId,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        idempotencyKey: `INV-IDEM-${Date.now()}-A`,
        items: [
          {
            description: 'COMKEY AFYA POA Enterprise SaaS Monthly Subscription',
            unitPriceKes: 95000,
            quantity: 1,
          },
          {
            description: 'Dedicated Medical Integration Gateway SLA & Support',
            unitPriceKes: 15000,
            quantity: 1,
          },
        ],
      };

      const res = await fetch(`${baseUrl}/platform/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(invoicePayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const inv = data.data || data;

      expect(inv.id).toBeDefined();
      testInvoiceId = inv.id;
      expect(inv.invoiceNumber).toMatch(/^INV-SAAS-\d{6}-\d{5}$/);
      expect(Number(inv.subtotalKes)).toBe(110000); // 95000 + 15000
      expect(Number(inv.taxKes)).toBe(17600); // 16% of 110000
      expect(Number(inv.totalKes)).toBe(127600);
      expect(inv.status).toBe(PlatformInvoiceStatus.ISSUED);
    });

    it('hospital finance user can view platform invoices for their organization', async () => {
      const res = await fetch(`${baseUrl}/saas/invoices`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${financeAToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const invoices = data.data || data;
      expect(Array.isArray(invoices)).toBe(true);
      expect(invoices.some((i: any) => i.id === testInvoiceId)).toBe(true);
    });

    it('hospital finance user can pay platform invoice via M-Pesa adapter with idempotency key', async () => {
      const idempotencyKey = `PAY-IDEM-${Date.now()}-A`;

      const payPayload = {
        amountKes: 127600,
        paymentMethod: PlatformPaymentMethod.MPESA,
        phoneNumber: '+254700000001',
        idempotencyKey,
      };

      const res = await fetch(`${baseUrl}/saas/invoices/${testInvoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${financeAToken}`,
        },
        body: JSON.stringify(payPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const paymentResult = data.data || data;

      expect(paymentResult.payment).toBeDefined();
      expect(paymentResult.payment.status).toBe(PlatformPaymentStatus.COMPLETED);
      expect(paymentResult.payment.paymentMethod).toBe(PlatformPaymentMethod.MPESA);
      expect(paymentResult.invoiceStatus).toBe(PlatformInvoiceStatus.PAID);
    });

    it('idempotency guard prevents duplicate payment for already paid invoice', async () => {
      const duplicatePayPayload = {
        amountKes: 127600,
        paymentMethod: PlatformPaymentMethod.MPESA,
        phoneNumber: '+254700000001',
        idempotencyKey: `NEW-KEY-${Date.now()}`,
      };

      const res = await fetch(`${baseUrl}/saas/invoices/${testInvoiceId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${financeAToken}`,
        },
        body: JSON.stringify(duplicatePayPayload),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('already PAID');
    });
  });

  // =========================================================================
  // 7. FAILED-PAYMENT HANDLING, 5-STAGE DUNNING & PATIENT SAFETY SAFEGUARD
  // =========================================================================
  describe('7. Failed-Payment Handling, Dunning Progression, and Patient Safety Safeguards', () => {
    let overdueInvoiceId: string;

    beforeAll(async () => {
      // Issue a second invoice for dunning testing
      const subRes = await fetch(`${baseUrl}/saas/subscription`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      const subData = await subRes.json();
      const subId = (subData.data || subData).subscription.id;

      const invoicePayload = {
        tenantId: tenantAId,
        subscriptionId: subId,
        dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days overdue
        idempotencyKey: `INV-OVERDUE-${Date.now()}`,
        items: [
          {
            description: 'Overdue Subscription Cycle',
            unitPriceKes: 95000,
            quantity: 1,
          },
        ],
      };

      const res = await fetch(`${baseUrl}/platform/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(invoicePayload),
      });

      const data = await res.json();
      overdueInvoiceId = (data.data || data).id;
    });

    it('executes dunning stage progression on failed renewal/payment', async () => {
      // 1. First failure -> INITIAL_FAILURE
      const res1 = await fetch(`${baseUrl}/platform/invoices/${overdueInvoiceId}/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ reason: 'M-Pesa STK timeout from customer phone' }),
      });

      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      const event1 = data1.data || data1;
      expect(event1.dunningStage).toBe(DunningStage.INITIAL_FAILURE);
      expect(event1.invoiceStatus).toBe(PlatformInvoiceStatus.PAST_DUE);

      // 2. Second failure -> GRACE_DAY_3
      const res2 = await fetch(`${baseUrl}/platform/invoices/${overdueInvoiceId}/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Bank settlement rejected: Insufficient funds' }),
      });
      const data2 = await res2.json();
      const event2 = data2.data || data2;
      expect(event2.dunningStage).toBe(DunningStage.GRACE_DAY_3);

      // 3. Third failure -> WARNING_DAY_7
      const res3 = await fetch(`${baseUrl}/platform/invoices/${overdueInvoiceId}/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Payment gateway timeout' }),
      });
      const data3 = await res3.json();
      const event3 = data3.data || data3;
      expect(event3.dunningStage).toBe(DunningStage.WARNING_DAY_7);

      // 4. Fourth failure -> RESTRICTED_DAY_14
      const res4 = await fetch(`${baseUrl}/platform/invoices/${overdueInvoiceId}/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Direct debit mandate rejected' }),
      });
      const data4 = await res4.json();
      const event4 = data4.data || data4;
      expect(event4.dunningStage).toBe(DunningStage.RESTRICTED_DAY_14);

      // 5. Fifth failure -> SUSPENDED_DAY_30
      const res5 = await fetch(`${baseUrl}/platform/invoices/${overdueInvoiceId}/simulate-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({ reason: 'Account overdue exceeding statutory 30-day notice' }),
      });
      const data5 = await res5.json();
      const event5 = data5.data || data5;
      expect(event5.dunningStage).toBe(DunningStage.SUSPENDED_DAY_30);
    });

    it('PATIENT SAFETY SAFEGUARD: Commercial payment failure NEVER blocks emergency or clinical record access', async () => {
      // In accordance with Section 7, Kenya Health Act 2017 & Data Protection Act 2019:
      // Even under subscription suspension / payment failure, emergency clinical records read access MUST remain available.
      const clinicalRecordsRes = await fetch(`${baseUrl}/records`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${clinicianAToken}`,
        },
      });

      // Clinician access to clinical patient records MUST succeed (200 OK)
      expect(clinicalRecordsRes.status).toBe(200);
      const recordsData = await clinicalRecordsRes.json();
      expect(recordsData).toBeDefined();

      // However, commercial administrative actions (e.g. upgrading plans) remain restricted
      const adminActionRes = await fetch(`${baseUrl}/saas/subscription/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({
          newPlanId: standardPlanId,
        }),
      });

      // Commercial modification is blocked due to suspended status
      expect(adminActionRes.status).toBe(400);
    });
  });

  // =========================================================================
  // 8. SUBSCRIPTION REPORTING & RECONCILIATION
  // =========================================================================
  describe('8. Subscription Reporting and Financial Reconciliation', () => {
    it('super admin can query subscription MRR, ARR, and subscriber metrics', async () => {
      const res = await fetch(`${baseUrl}/platform/reports/subscriptions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const report = data.data || data;

      expect(report.metrics).toBeDefined();
      expect(report.metrics.totalTenants).toBeGreaterThanOrEqual(1);
      expect(report.metrics.mrrKes).toBeDefined();
      expect(report.metrics.arrKes).toBeDefined();
      expect(report.financials).toBeDefined();
    });

    it('super admin can execute financial reconciliation against platform payments and invoices', async () => {
      const res = await fetch(`${baseUrl}/platform/reconciliation/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const recon = data.data || data;

      expect(recon.totalPaymentsAudited).toBeGreaterThanOrEqual(1);
      expect(recon.matchedCount).toBeGreaterThanOrEqual(1);
      expect(recon.reconciliationStatus).toBe('BALANCED');
    });
  });

  // =========================================================================
  // 9. PLATFORM HEALTH & INTEGRATION MONITORING
  // =========================================================================
  describe('9. Platform Health and Integration Monitoring', () => {
    it('super admin can view aggregate platform component health', async () => {
      const res = await fetch(`${baseUrl}/platform/health/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const health = data.data || data;

      expect(health.status).toBe('HEALTHY');
      expect(health.components).toBeDefined();
      expect(health.components.database.status).toBe('HEALTHY');
      expect(health.components.database.latencyMs).toBeDefined();
      expect(health.integrations).toBeDefined();
      expect(health.integrations).toHaveLength(4);
    });

    it('super admin can view national gateway metrics and reliability statistics', async () => {
      const res = await fetch(`${baseUrl}/platform/metrics/integrations`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const metrics = data.data || data;

      expect(metrics.gateways).toBeDefined();
      expect(Array.isArray(metrics.gateways)).toBe(true);
      expect(metrics.gateways.length).toBe(4); // DHA, SHA, KRA, MPESA
      expect(metrics.gateways.some((m: any) => m.gateway.includes('DHA'))).toBe(true);
      expect(metrics.gateways.some((m: any) => m.gateway.includes('SHA'))).toBe(true);
      expect(metrics.gateways.some((m: any) => m.gateway.includes('eTIMS') || m.gateway.includes('KRA'))).toBe(true);
      expect(metrics.gateways.some((m: any) => m.gateway.toLowerCase().includes('mpesa') || m.gateway.toLowerCase().includes('m-pesa'))).toBe(true);
    });
  });

  // =========================================================================
  // 10. ADMINISTRATIVE SUPPORT CASES
  // =========================================================================
  describe('10. Administrative Support Cases', () => {
    it('hospital administrator can log administrative support case', async () => {
      const casePayload = {
        subject: 'DHA Health Worker Registry reconciliation sync latency',
        category: SupportCaseCategory.INTEGRATION_ISSUE,
        priority: SupportCasePriority.HIGH,
        facilityId: facilityA1Id,
        description: 'New clinical officers PUID validation taking longer than 60 seconds.',
      };

      const res = await fetch(`${baseUrl}/saas/support/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(casePayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const supportCase = data.data || data;

      expect(supportCase.id).toBeDefined();
      testCaseId = supportCase.id;
      expect(supportCase.caseNumber).toMatch(/^CASE-\d{4}-\d+$/);
      expect(supportCase.status).toBe(SupportCaseStatus.OPEN);
      expect(supportCase.priority).toBe(SupportCasePriority.HIGH);
    });

    it('hospital administrator and platform super admin can communicate via conversation thread', async () => {
      // 1. Hospital adds follow-up message
      const hospitalMsgPayload = {
        message: 'Affected clinicians are Dr. Otieno and Dr. Wanjiku.',
      };

      const res1 = await fetch(`${baseUrl}/saas/support/cases/${testCaseId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(hospitalMsgPayload),
      });

      expect(res1.status).toBe(201);

      // 2. Platform super admin updates status to INVESTIGATING and assigns engineer
      const statusPayload = {
        status: SupportCaseStatus.INVESTIGATING,
        assignedToUserId: superAdminUserId,
        internalNotes: 'Investigating DHA gateway token refresh cycle.',
      };

      const res2 = await fetch(`${baseUrl}/platform/support/cases/${testCaseId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify(statusPayload),
      });

      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      const updatedCase = data2.data || data2;
      expect(updatedCase.status).toBe(SupportCaseStatus.INVESTIGATING);

      // 3. Hospital views case and conversation thread
      const res3 = await fetch(`${baseUrl}/saas/support/cases/${testCaseId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      const thread = data3.data || data3;
      expect(thread.messages).toBeDefined();
      expect(thread.messages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 11. CONTROLLED, AUDITABLE SUPPORT ACCESS
  // =========================================================================
  describe('11. Controlled, Auditable Support Access Grants', () => {
    it('hospital administrator can grant time-bound (max 24h), auditable support access to COMKEY platform engineer', async () => {
      const grantPayload = {
        supportUserId: superAdminUserId,
        facilityId: facilityA1Id,
        scope: SupportAccessScope.READ_ONLY,
        durationHours: 4,
        reason: 'Temporary troubleshooting of DHA Health Worker Registry sync discrepancy',
      };

      const res = await fetch(`${baseUrl}/saas/support/access-grants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(grantPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const result = data.data || data;

      expect(result.grant).toBeDefined();
      testGrantId = result.grant.id;
      expect(result.accessToken).toBeDefined();
      testGrantToken = result.accessToken;
      expect(result.grant.scope).toBe(SupportAccessScope.READ_ONLY);
      expect(result.grant.isActive).toBe(true);
    });

    it('support engineer can verify support access token and authenticate temporary session', async () => {
      const verifyPayload = {
        accessToken: testGrantToken,
      };

      const res = await fetch(`${baseUrl}/saas/support/access-grants/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(verifyPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const verified = data.data || data;

      expect(verified.authorized).toBe(true);
      expect(verified.grantId).toBe(testGrantId);
    });

    it('rejects invalid or forged support access token', async () => {
      const fakePayload = {
        accessToken: 'forged-access-token-xyz-12345',
      };

      const res = await fetch(`${baseUrl}/saas/support/access-grants/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(fakePayload),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(JSON.stringify(data)).toContain('Invalid');
    });

    it('hospital administrator can immediately revoke active support access grant', async () => {
      const res = await fetch(`${baseUrl}/saas/support/access-grants/${testGrantId}/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const revoked = data.data || data;
      expect(revoked.isActive).toBe(false);

      // Verify revoked token is now rejected
      const verifyRes = await fetch(`${baseUrl}/saas/support/access-grants/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify({ accessToken: testGrantToken }),
      });

      expect(verifyRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 12. TENANT OFFBOARDING & DATA-RETENTION WORKFLOWS
  // =========================================================================
  describe('12. Tenant Offboarding and Data-Retention Workflows', () => {
    it('hospital administrator can submit offboarding request with statutory 10-year medical record retention', async () => {
      const offboardPayload = {
        reason: 'Hospital group acquired and transitioning to county administrative system',
      };

      const res = await fetch(`${baseUrl}/saas/offboarding/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminAToken}`,
        },
        body: JSON.stringify(offboardPayload),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      const req = data.data || data;

      expect(req.id).toBeDefined();
      testOffboardingId = req.id;
      expect(req.status).toBe(OffboardingStatus.REQUESTED);

      // Statutory requirement: retention must be scheduled for 10 years (Health Act 2017)
      const retentionDate = new Date(req.clinicalDataRetentionUntil);
      const now = new Date();
      const yearDiff = retentionDate.getFullYear() - now.getFullYear();
      expect(yearDiff).toBe(10);
    });

    it('super admin can generate sealed data export package with SHA-256 checksum', async () => {
      const res = await fetch(
        `${baseUrl}/platform/offboarding/requests/${testOffboardingId}/export`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      const exported = data.data || data;

      expect(exported.status).toBe(OffboardingStatus.DATA_EXPORT_GENERATED);
      expect(exported.exportBundleUrl).toBeDefined();
      expect(exported.exportChecksumSha256).toBeDefined();
      expect(exported.exportChecksumSha256).toHaveLength(64); // SHA-256 hex string
    });

    it('super admin can complete offboarding and archive tenant organization', async () => {
      const res = await fetch(
        `${baseUrl}/platform/offboarding/requests/${testOffboardingId}/complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${superAdminToken}`,
          },
        },
      );

      expect(res.status).toBe(201);
      const data = await res.json();
      const result = data.data || data;

      expect(result.status).toBe(OffboardingStatus.COMPLETED);

      // Re-activate Tenant A for remaining isolation tests
      await withSuperAdminContext(async (db) => {
        await db.update(tenants).set({ status: 'ACTIVE' }).where(sql`id = ${tenantAId}`);
      });
    });
  });

  // =========================================================================
  // 13. TENANT ISOLATION & ROLE SEPARATION
  // =========================================================================
  describe('13. Multi-Tenant Isolation and Role-Based Permissions', () => {
    it('Tenant B administrator cannot view or access Tenant A support cases', async () => {
      const res = await fetch(`${baseUrl}/saas/support/cases/${testCaseId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
        },
      });

      // Cross-tenant access is blocked with 403 Forbidden
      expect(res.status).toBe(403);
    });

    it('Tenant B administrator cannot view Tenant A platform invoices', async () => {
      const res = await fetch(`${baseUrl}/saas/invoices`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminBToken}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      const invoices = data.data || data;
      // Invoices list for Tenant B MUST NOT contain Tenant A's invoice
      expect(invoices.some((i: any) => i.id === testInvoiceId)).toBe(false);
    });

    it('regular clinician cannot access platform super-admin endpoints (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/platform/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${clinicianAToken}`,
        },
        body: JSON.stringify({
          code: 'ILLEGAL-PLAN',
          name: 'Illegal Plan',
        }),
      });

      expect(res.status).toBe(403);
    });

    it('hospital administrator cannot access super-admin-only platform endpoints (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/platform/reports/subscriptions`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(res.status).toBe(403);
    });
  });
});
