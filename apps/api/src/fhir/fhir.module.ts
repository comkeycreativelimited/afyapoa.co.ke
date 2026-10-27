import { Module } from '@nestjs/common';
import { FhirController } from './fhir.controller.js';
import { FhirService } from './fhir.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
