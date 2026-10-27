import { Module } from '@nestjs/common';
import { EncountersController } from './encounters.controller.js';
import { EncountersService } from './encounters.service.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TenancyModule, AuditModule],
  controllers: [EncountersController],
  providers: [EncountersService],
  exports: [EncountersService],
})
export class EncountersModule {}
