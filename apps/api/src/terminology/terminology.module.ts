import { Module } from '@nestjs/common';
import { TerminologyController } from './terminology.controller.js';
import { TerminologyService } from './terminology.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [TerminologyController],
  providers: [TerminologyService],
  exports: [TerminologyService],
})
export class TerminologyModule {}
