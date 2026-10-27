import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/auth.decorators.js';
import { Permission, AuditEventType } from '@afyapoa/domain-core';
import { AuditService } from '../../audit/audit.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
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

    const userPermissions: Permission[] = user.permissions || [];
    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      const missing = requiredPermissions.filter((p) => !userPermissions.includes(p));

      await this.auditService.recordEvent({
        tenantId: user.tenantId,
        userId: user.userId,
        action: AuditEventType.AUTHZ_FORBIDDEN_ACCESS,
        resource: context.getClass().name,
        resourceId: context.getHandler().name,
        clientIp: request.ip,
        userAgent: request.headers['user-agent'],
        details: {
          missingPermissions: missing,
          requiredPermissions,
          role: user.userRole,
          url: request.url,
          method: request.method,
        },
      });

      throw new ForbiddenException(
        `Insufficient privileges. Missing permission: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
