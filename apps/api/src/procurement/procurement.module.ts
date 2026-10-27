import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller.js';
import { ProcurementService } from './procurement.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
