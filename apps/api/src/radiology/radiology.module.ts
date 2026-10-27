import { Module } from '@nestjs/common';
import { RadiologyController } from './radiology.controller.js';
import { RadiologyService } from './radiology.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
