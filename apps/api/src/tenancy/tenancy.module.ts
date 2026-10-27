import { Module, Global } from '@nestjs/common';
import { TenancyService } from './tenancy.service.js';
import { TenancyMiddleware } from './tenancy.middleware.js';

@Global()
@Module({
  providers: [TenancyService, TenancyMiddleware],
  exports: [TenancyService, TenancyMiddleware],
})
export class TenancyModule {}
