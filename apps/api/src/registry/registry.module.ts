import { Module } from '@nestjs/common';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { SharedInfrastructureModule } from '../common/shared-infrastructure.module.js';
import { RegistryController } from './registry.controller.js';
import { RegistrySyncService } from './registry-sync.service.js';
import { ResilienceService } from './resilience.service.js';

@Module({
  imports: [TenancyModule, AuditModule, SharedInfrastructureModule],
  controllers: [RegistryController],
  providers: [RegistrySyncService, ResilienceService],
  exports: [RegistrySyncService, ResilienceService],
})
export class RegistryModule {}
