import { Module } from '@nestjs/common';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';

@Module({
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
