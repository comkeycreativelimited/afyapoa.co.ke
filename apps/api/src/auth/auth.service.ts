import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { verifySync } from 'otplib';
import { config } from '@afyapoa/config';
import {
  users,
  facilities,
  userSessions,
  passwordResets,
  withSuperAdminContext,
} from '@afyapoa/database';
import { UserRole, AuditEventType, ROLE_PERMISSIONS } from '@afyapoa/domain-core';
import { eq, and, or } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { JwtPayload } from './jwt.strategy.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(JwtService) private jwtService: JwtService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  /**
   * Primary authentication endpoint.
   * If MFA is enabled on the account, returns an MFA challenge token.
   */
  async login(username: string, password: string, clientIp?: string, userAgent?: string) {
    // Query user by username or email
    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, username)));
    });

    if (!user) {
      // Dummy bcrypt compare to avoid timing attacks
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new UnauthorizedException('Account temporarily locked due to excessive failed attempts');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await withSuperAdminContext(async (txDb) => {
        await txDb
          .update(users)
          .set({
            failedLoginAttempts: failedAttempts,
            lockedUntil: lockUntil,
          })
          .where(eq(users.id, user.id));
      });

      await this.auditService.recordEvent({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditEventType.AUTH_LOGIN_FAILED,
        resource: 'User',
        resourceId: user.id,
        clientIp,
        userAgent,
        details: { reason: 'Password mismatch', failedAttempts },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed login attempts upon valid password
    await withSuperAdminContext(async (txDb) => {
      await txDb
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    });

    // Check if MFA is required
    const requiresMfa =
      user.mfaEnabled ||
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.FACILITY_ADMIN;

    if (requiresMfa) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, tenantId: user.tenantId, mfaPending: true },
        { expiresIn: '5m' },
      );

      await this.auditService.recordEvent({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditEventType.AUTH_MFA_CHALLENGE,
        resource: 'User',
        resourceId: user.id,
        clientIp,
        userAgent,
        details: { role: user.role },
      });

      return {
        mfaRequired: true,
        mfaToken,
        message: 'Multi-Factor Authentication required. Provide 6-digit TOTP code.',
      };
    }

    // MFA not required: issue full session
    return await this.createSessionAndIssueTokens(user, clientIp, userAgent);
  }

  /**
   * Verifies TOTP code and finishes MFA login flow.
   */
  async verifyMfa(mfaToken: string, code: string, clientIp?: string, userAgent?: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException('MFA session expired or invalid. Please log in again.');
    }

    if (!payload.mfaPending || !payload.sub) {
      throw new UnauthorizedException('Invalid MFA token state');
    }

    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb.select().from(users).where(eq(users.id, payload.sub));
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify TOTP code with user secret (or demo fallback secret)
    const secret = user.mfaSecret || 'JBSWY3DPEHPK3PXP';
    let isTotpValid = false;
    try {
      const result = verifySync({ token: code, secret });
      isTotpValid = result.valid;
    } catch {
      isTotpValid = false;
    }

    // Allow testing bypass with known fallback code ONLY in non-production test/development
    if (!isTotpValid && config.NODE_ENV !== 'production' && code === '123456') {
      isTotpValid = true;
    }

    if (!isTotpValid) {
      await this.auditService.recordEvent({
        tenantId: user.tenantId,
        userId: user.id,
        action: AuditEventType.AUTH_LOGIN_FAILED,
        resource: 'User',
        resourceId: user.id,
        clientIp,
        userAgent,
        details: { reason: 'MFA TOTP code invalid' },
      });

      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.auditService.recordEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditEventType.AUTH_MFA_VERIFIED,
      resource: 'User',
      resourceId: user.id,
      clientIp,
      userAgent,
      details: { role: user.role },
    });

    return await this.createSessionAndIssueTokens(user, clientIp, userAgent);
  }

  /**
   * Creates an active user session in database and generates JWT access + refresh tokens.
   */
  private async createSessionAndIssueTokens(user: any, clientIp?: string, userAgent?: string) {
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create session record
    const [session] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .insert(userSessions)
        .values({
          tenantId: user.tenantId,
          userId: user.id,
          refreshTokenHash,
          userAgent: userAgent || null,
          ipAddress: clientIp || null,
          isRevoked: false,
          expiresAt,
        })
        .returning();
    });

    // Lookup primary facility code if any
    let facilityCode: string | undefined;
    if (user.primaryFacilityId) {
      const [fac] = await withSuperAdminContext(async (txDb) => {
        return await txDb
          .select({ kmflCode: facilities.kmflCode })
          .from(facilities)
          .where(eq(facilities.id, user.primaryFacilityId));
      });
      facilityCode = fac?.kmflCode;
    }

    const jwtPayload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      facilityId: user.primaryFacilityId || undefined,
      facilityCode,
      role: user.role as UserRole,
      isSuperAdmin: user.isSuperAdmin,
      sessionId: session!.id,
    };

    const accessToken = this.jwtService.sign(jwtPayload, { expiresIn: config.JWT_EXPIRATION });

    await this.auditService.recordEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditEventType.AUTH_LOGIN_SUCCESS,
      resource: 'UserSession',
      resourceId: session!.id,
      clientIp,
      userAgent,
      details: {
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        facilityId: user.primaryFacilityId,
      },
    });

    return {
      mfaRequired: false,
      accessToken,
      refreshToken: `${session!.id}.${rawRefreshToken}`,
      expiresIn: config.JWT_EXPIRATION,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        facilityId: user.primaryFacilityId,
        facilityCode,
        isSuperAdmin: user.isSuperAdmin,
        permissions: ROLE_PERMISSIONS[user.role as UserRole] || [],
      },
    };
  }

  /**
   * Refreshes access token using session refresh token.
   */
  async refreshSession(refreshTokenStr: string, _clientIp?: string, _userAgent?: string) {
    const parts = refreshTokenStr.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token format');
    }
    const [sessionId, rawToken] = parts;
    const incomingHash = crypto.createHash('sha256').update(rawToken!).digest('hex');

    const [session] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(userSessions)
        .where(and(eq(userSessions.id, sessionId!), eq(userSessions.isRevoked, false)));
    });

    if (!session || session.refreshTokenHash !== incomingHash || new Date() > session.expiresAt) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb.select().from(users).where(eq(users.id, session.userId));
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account inactive');
    }

    const jwtPayload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      facilityId: user.primaryFacilityId || undefined,
      role: user.role as UserRole,
      isSuperAdmin: user.isSuperAdmin,
      sessionId: session.id,
    };

    const newAccessToken = this.jwtService.sign(jwtPayload, { expiresIn: config.JWT_EXPIRATION });

    return {
      accessToken: newAccessToken,
      expiresIn: config.JWT_EXPIRATION,
    };
  }

  /**
   * Terminates active session and records audit trail.
   */
  async logout(sessionId: string, userId: string, tenantId: string, clientIp?: string, userAgent?: string) {
    await withSuperAdminContext(async (txDb) => {
      await txDb
        .update(userSessions)
        .set({ isRevoked: true })
        .where(eq(userSessions.id, sessionId));
    });

    await this.auditService.recordEvent({
      tenantId,
      userId,
      action: AuditEventType.AUTH_LOGOUT,
      resource: 'UserSession',
      resourceId: sessionId,
      clientIp,
      userAgent,
    });

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Requests a password reset token for account recovery.
   */
  async requestPasswordReset(email: string, clientIp?: string, userAgent?: string) {
    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb.select().from(users).where(eq(users.email, email));
    });

    // Return generic response regardless to prevent account enumeration
    if (!user) {
      return { success: true, message: 'If the email exists, a password reset link has been dispatched.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await withSuperAdminContext(async (txDb) => {
      await txDb.insert(passwordResets).values({
        tenantId: user.tenantId,
        userId: user.id,
        tokenHash,
        isUsed: false,
        expiresAt,
      });
    });

    await this.auditService.recordEvent({
      tenantId: user.tenantId,
      userId: user.id,
      action: AuditEventType.AUTH_PASSWORD_RESET_REQUESTED,
      resource: 'User',
      resourceId: user.id,
      clientIp,
      userAgent,
    });

    return {
      success: true,
      message: 'If the email exists, a password reset link has been dispatched.',
      resetToken: config.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  /**
   * Confirms password reset and updates password hash.
   */
  async resetPassword(token: string, newPassword: string, clientIp?: string, userAgent?: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [resetRecord] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(passwordResets)
        .where(and(eq(passwordResets.tokenHash, tokenHash), eq(passwordResets.isUsed, false)));
    });

    if (!resetRecord || new Date() > resetRecord.expiresAt) {
      throw new BadRequestException('Password reset token is invalid or has expired');
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await withSuperAdminContext(async (txDb) => {
      // Update password
      await txDb
        .update(users)
        .set({ passwordHash: newHash, failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, resetRecord.userId));

      // Mark token used
      await txDb
        .update(passwordResets)
        .set({ isUsed: true })
        .where(eq(passwordResets.id, resetRecord.id));

      // Revoke all existing sessions for this user
      await txDb
        .update(userSessions)
        .set({ isRevoked: true })
        .where(eq(userSessions.userId, resetRecord.userId));
    });

    await this.auditService.recordEvent({
      tenantId: resetRecord.tenantId,
      userId: resetRecord.userId,
      action: AuditEventType.AUTH_PASSWORD_RESET_COMPLETED,
      resource: 'User',
      resourceId: resetRecord.userId,
      clientIp,
      userAgent,
      details: { reason: 'Self-service account recovery completed' },
    });

    return { success: true, message: 'Password has been successfully updated. Please log in with your new password.' };
  }

  /**
   * Switches active facility under the same hospital tenant.
   */
  async switchFacility(userId: string, tenantId: string, facilityKmflCode: string) {
    // Verify facility exists and belongs to this tenant
    const [facility] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .select()
        .from(facilities)
        .where(and(eq(facilities.kmflCode, facilityKmflCode), eq(facilities.tenantId, tenantId)));
    });

    if (!facility) {
      throw new BadRequestException('Facility not found or does not belong to your organization');
    }

    const [user] = await withSuperAdminContext(async (txDb) => {
      return await txDb.select().from(users).where(eq(users.id, userId));
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [session] = await withSuperAdminContext(async (txDb) => {
      return await txDb
        .insert(userSessions)
        .values({
          tenantId,
          userId: user.id,
          refreshTokenHash,
          isRevoked: false,
          expiresAt,
        })
        .returning();
    });

    const jwtPayload: JwtPayload = {
      sub: user.id,
      tenantId,
      facilityId: facility.id,
      facilityCode: facility.kmflCode,
      role: user.role as UserRole,
      isSuperAdmin: user.isSuperAdmin,
      sessionId: session!.id,
    };

    const accessToken = this.jwtService.sign(jwtPayload, { expiresIn: config.JWT_EXPIRATION });

    return {
      accessToken,
      facilityId: facility.id,
      facilityCode: facility.kmflCode,
      facilityName: facility.name,
    };
  }
}
