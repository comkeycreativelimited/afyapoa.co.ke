import { Module } from '@nestjs/common';
import { MaternityController } from './maternity.controller.js';
import { MaternityService } from './maternity.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [MaternityController],
  providers: [MaternityService],
  exports: [MaternityService],
})
export class MaternityModule {}
