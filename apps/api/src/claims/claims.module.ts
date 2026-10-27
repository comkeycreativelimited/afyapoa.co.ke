import { Module } from '@nestjs/common';
import { ClaimsController } from './claims.controller.js';
import { ClaimsService } from './claims.service.js';
import { TenancyModule } from '../tenancy/tenancy.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [TenancyModule, AuditModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
