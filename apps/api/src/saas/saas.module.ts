import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { SaasService } from './saas.service.js';
import { SaasBillingService } from './saas-billing.service.js';
import { SaasSupportService } from './saas-support.service.js';
import { SaasOffboardingService } from './saas-offboarding.service.js';
import { SaasMonitoringService } from './saas-monitoring.service.js';
import { SaasAdminController } from './saas-admin.controller.js';
import { SaasTenantController } from './saas-tenant.controller.js';

@Module({
  imports: [TenancyModule, AuditModule],
  controllers: [SaasAdminController, SaasTenantController],
  providers: [
    SaasService,
    SaasBillingService,
    SaasSupportService,
    SaasOffboardingService,
    SaasMonitoringService,
  ],
  exports: [
    SaasService,
    SaasBillingService,
    SaasSupportService,
    SaasOffboardingService,
    SaasMonitoringService,
  ],
})
export class SaasModule {}
