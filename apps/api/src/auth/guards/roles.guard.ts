import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/auth.decorators.js';
import { UserRole, AuditEventType } from '@afyapoa/domain-core';
import { AuditService } from '../../audit/audit.service.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.tenantContext || request.user;

    if (!user) {
      throw new ForbiddenException('User context missing');
    }

    if (user.isSuperAdmin) {
      return true;
    }

    const hasRole = requiredRoles.includes(user.userRole);

    if (!hasRole) {
      await this.auditService.recordEvent({
        tenantId: user.tenantId,
        userId: user.userId,
        action: AuditEventType.AUTHZ_FORBIDDEN_ACCESS,
        resource: context.getClass().name,
        resourceId: context.getHandler().name,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
        details: {
          requiredRoles,
          actualRole: user.userRole,
          url: request.url,
          method: request.method,
        },
      });

      throw new ForbiddenException(`Access denied. Role ${user.userRole} is not authorized.`);
    }

    return true;
  }
}
