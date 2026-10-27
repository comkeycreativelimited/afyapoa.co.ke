import { Module } from '@nestjs/common';
import { LaboratoryController } from './laboratory.controller.js';
import { LaboratoryService } from './laboratory.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
