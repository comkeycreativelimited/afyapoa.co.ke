import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { TerminologyModule } from '../terminology/terminology.module.js';

@Module({
  imports: [AuditModule, TerminologyModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
