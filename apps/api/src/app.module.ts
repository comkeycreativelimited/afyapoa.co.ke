import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module.js';
import { TenancyModule } from './tenancy/tenancy.module.js';
import { TenancyMiddleware } from './tenancy/tenancy.middleware.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RecordsModule } from './records/records.module.js';
import { PlatformModule } from './platform/platform.module.js';
import { SharedInfrastructureModule } from './common/shared-infrastructure.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { EncountersModule } from './encounters/encounters.module.js';
import { TerminologyModule } from './terminology/terminology.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { LaboratoryModule } from './laboratory/laboratory.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ClaimsModule } from './claims/claims.module.js';
import { FhirModule } from './fhir/fhir.module.js';
import { RegistryModule } from './registry/registry.module.js';
import { InpatientModule } from './inpatient/inpatient.module.js';
import { TheatreModule } from './theatre/theatre.module.js';
import { MaternityModule } from './maternity/maternity.module.js';
import { RadiologyModule } from './radiology/radiology.module.js';
import { ReferralsModule } from './referrals/referrals.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { ProcurementModule } from './procurement/procurement.module.js';
import { PrivateInsuranceModule } from './insurance/private/private-insurance.module.js';
import { RostersModule } from './rosters/rosters.module.js';
import { SaasModule } from './saas/saas.module.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute window
        limit: 120, // 120 requests per minute
      },
    ]),
    HealthModule,
    AuditModule,
    TenancyModule,
    AuthModule,
    RecordsModule,
    PlatformModule,
    IntegrationsModule,
    SharedInfrastructureModule,
    PatientsModule,
    EncountersModule,
    TerminologyModule,
    OrdersModule,
    LaboratoryModule,
    PharmacyModule,
    BillingModule,
    ClaimsModule,
    FhirModule,
    RegistryModule,
    InpatientModule,
    TheatreModule,
    MaternityModule,
    RadiologyModule,
    ReferralsModule,
    AppointmentsModule,
    ProcurementModule,
    PrivateInsuranceModule,
    RostersModule,
    SaasModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
