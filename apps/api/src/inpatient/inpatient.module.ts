import { Module } from '@nestjs/common';
import { InpatientController } from './inpatient.controller.js';
import { InpatientService } from './inpatient.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [InpatientController],
  providers: [InpatientService],
  exports: [InpatientService],
})
export class InpatientModule {}
