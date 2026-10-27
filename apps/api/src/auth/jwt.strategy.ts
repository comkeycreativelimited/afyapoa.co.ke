import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { config } from '@afyapoa/config';
import { userSessions, users, withSuperAdminContext } from '@afyapoa/database';
import { TenantContext, UserRole, ROLE_PERMISSIONS } from '@afyapoa/domain-core';
import { eq, and } from 'drizzle-orm';
import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  facilityId?: string;
  facilityCode?: string;
  role: UserRole;
  isSuperAdmin: boolean;
  sessionId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<TenantContext> {
    // Verify session in database is not revoked and not expired (using super-admin context to bypass RLS during auth validation)
    const [session] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.id, payload.sessionId),
            eq(userSessions.isRevoked, false),
          ),
        );
    });

    if (!session || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Session expired or revoked');
    }

    // Verify user is active
    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select({
          status: users.status,
          role: users.role,
          isSuperAdmin: users.isSuperAdmin,
        })
        .from(users)
        .where(eq(users.id, payload.sub));
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account inactive or locked');
    }

    // Tenant context determination:
    // If super admin and x-tenant-id header provided, allow administrative cross-tenant operation
    let activeTenantId = payload.tenantId;
    const requestedTenantHeader = req.headers['x-tenant-id'] as string;

    if (payload.isSuperAdmin && requestedTenantHeader) {
      activeTenantId = requestedTenantHeader;
    }

    const permissions = ROLE_PERMISSIONS[payload.role] || [];

    const tenantContext: TenantContext = {
      tenantId: activeTenantId,
      facilityId: payload.facilityId,
      facilityCode: payload.facilityCode,
      userId: payload.sub,
      sessionId: payload.sessionId,
      userRole: payload.role,
      permissions,
      isSuperAdmin: payload.isSuperAdmin,
    };

    // Attach to request
    (req as any).tenantContext = tenantContext;
    (req as any).user = tenantContext;

    return tenantContext;
  }
}
