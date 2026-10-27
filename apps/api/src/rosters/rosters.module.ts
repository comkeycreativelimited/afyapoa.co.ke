import { Module } from '@nestjs/common';
import { RostersController } from './rosters.controller.js';
import { RostersService } from './rosters.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [RostersController],
  providers: [RostersService],
  exports: [RostersService],
})
export class RostersModule {}
