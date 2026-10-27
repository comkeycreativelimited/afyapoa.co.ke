import { Module } from '@nestjs/common';
import { PrivateInsuranceController } from './private-insurance.controller.js';
import { PrivateInsuranceService } from './private-insurance.service.js';
import { AuditModule } from '../../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [PrivateInsuranceController],
  providers: [PrivateInsuranceService],
  exports: [PrivateInsuranceService],
})
export class PrivateInsuranceModule {}
