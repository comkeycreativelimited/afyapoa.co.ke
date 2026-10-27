import { Module } from '@nestjs/common';
import { PharmacyController } from './pharmacy.controller.js';
import { PharmacyService } from './pharmacy.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [PharmacyController],
  providers: [PharmacyService],
  exports: [PharmacyService],
})
export class PharmacyModule {}
