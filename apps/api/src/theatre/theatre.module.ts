import { Module } from '@nestjs/common';
import { TheatreController } from './theatre.controller.js';
import { TheatreService } from './theatre.service.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [TheatreController],
  providers: [TheatreService],
  exports: [TheatreService],
})
export class TheatreModule {}
