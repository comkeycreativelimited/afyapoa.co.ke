import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logger } from '@afyapoa/logger';

export interface TenancyRequest extends Request {
  requestedTenantId?: string;
  requestedFacilityId?: string;
}

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  use(req: TenancyRequest, _res: Response, next: NextFunction) {
    const tenantIdHeader = req.headers['x-tenant-id'] as string;
    const facilityCodeHeader = req.headers['x-facility-id'] as string;

    if (tenantIdHeader) {
      req.requestedTenantId = tenantIdHeader;
    }
    if (facilityCodeHeader) {
      req.requestedFacilityId = facilityCodeHeader;
    }

    logger.debug(`[HTTP] Incoming request ${req.method} ${req.url}`, {
      requestedTenantId: req.requestedTenantId,
      requestedFacilityId: req.requestedFacilityId,
      ip: req.ip,
    });

    next();
  }
}
