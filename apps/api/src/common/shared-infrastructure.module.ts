import { Module } from '@nestjs/common';
import { StateMachineService } from './state-machine/state-machine.service.js';
import { JobsService } from './jobs/jobs.service.js';
import { StorageService } from './storage/storage.service.js';
import { IntegrationConfigService } from './integrations/integration-config.service.js';
import { ConfigFlagsService } from './config-flags/config-flags.service.js';
import { SharedInfrastructureController } from './shared-infrastructure.controller.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TenancyModule, AuditModule],
  controllers: [SharedInfrastructureController],
  providers: [
    StateMachineService,
    JobsService,
    StorageService,
    IntegrationConfigService,
    ConfigFlagsService,
  ],
  exports: [
    StateMachineService,
    JobsService,
    StorageService,
    IntegrationConfigService,
    ConfigFlagsService,
  ],
})
export class SharedInfrastructureModule {}
