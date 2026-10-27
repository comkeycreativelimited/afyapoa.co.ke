import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { desc, eq, and } from 'drizzle-orm';
import {
  supportCases,
  supportCaseMessages,
  supportAccessGrants,
  users,
} from '@afyapoa/database';
import {
  AuditEventType,
  SupportAccessScope,
  SupportCasePriority,
  SupportCaseStatus,
} from '@afyapoa/domain-core';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreateSupportCaseDto,
  AddCaseMessageDto,
  UpdateCaseStatusDto,
  GrantSupportAccessDto,
} from './dto/index.js';

@Injectable()
export class SaasSupportService {
  constructor(
    @Inject(TenancyService) private tenancyService: TenancyService,
    @Inject(AuditService) private auditService: AuditService,
  ) {}

  // =========================================================================
  // 1. ADMINISTRATIVE SUPPORT CASES
  // =========================================================================

  async createCase(tenantId: string, userId: string, dto: CreateSupportCaseDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const now = new Date();
      const year = now.getUTCFullYear();
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const caseNumber = `CASE-${year}-${randomSeq}`;

      const [supportCase] = await db
        .insert(supportCases)
        .values({
          tenantId,
          facilityId: dto.facilityId,
          createdByUserId: userId,
          caseNumber,
          subject: dto.subject,
          description: dto.description,
          category: dto.category,
          priority: dto.priority || SupportCasePriority.MEDIUM,
          status: SupportCaseStatus.OPEN,
        })
        .returning();

      // Add initial description as first message
      await db.insert(supportCaseMessages).values({
        tenantId,
        caseId: supportCase!.id,
        senderUserId: userId,
        isStaff: false,
        message: dto.description,
      });

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.SUPPORT_CASE_CREATED,
        resource: 'SupportCase',
        resourceId: supportCase!.id,
        details: { caseNumber, subject: dto.subject, priority: dto.priority },
      });

      return supportCase;
    });
  }

  async getCases(tenantId?: string, status?: SupportCaseStatus) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      let q = db.select().from(supportCases).orderBy(desc(supportCases.createdAt));
      if (tenantId && status) {
        return await q.where(and(eq(supportCases.tenantId, tenantId), eq(supportCases.status, status)));
      }
      if (tenantId) {
        return await q.where(eq(supportCases.tenantId, tenantId));
      }
      if (status) {
        return await q.where(eq(supportCases.status, status));
      }
      return await q;
    });
  }

  async getCaseById(caseId: string, tenantId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [supportCase] = await db
        .select()
        .from(supportCases)
        .where(eq(supportCases.id, caseId));
      if (!supportCase) {
        throw new NotFoundException(`Support case '${caseId}' not found.`);
      }

      if (tenantId && supportCase.tenantId !== tenantId) {
        throw new ForbiddenException('Access denied to support case of another tenant.');
      }

      const messages = await db
        .select()
        .from(supportCaseMessages)
        .where(eq(supportCaseMessages.caseId, caseId))
        .orderBy(supportCaseMessages.createdAt);

      return {
        ...supportCase,
        messages,
      };
    });
  }

  async addMessage(caseId: string, userId: string, isStaff: boolean, dto: AddCaseMessageDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [supportCase] = await db
        .select()
        .from(supportCases)
        .where(eq(supportCases.id, caseId));
      if (!supportCase) {
        throw new NotFoundException(`Support case '${caseId}' not found.`);
      }

      const [msg] = await db
        .insert(supportCaseMessages)
        .values({
          tenantId: supportCase.tenantId,
          caseId,
          senderUserId: userId,
          isStaff,
          message: dto.message,
        })
        .returning();

      // Update case status if staff replied
      if (isStaff && supportCase.status === SupportCaseStatus.OPEN) {
        await db
          .update(supportCases)
          .set({ status: SupportCaseStatus.INVESTIGATING, updatedAt: new Date() })
          .where(eq(supportCases.id, caseId));
      }

      return msg;
    });
  }

  async updateCaseStatus(caseId: string, userId: string, dto: UpdateCaseStatusDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [supportCase] = await db
        .select()
        .from(supportCases)
        .where(eq(supportCases.id, caseId));
      if (!supportCase) {
        throw new NotFoundException(`Support case '${caseId}' not found.`);
      }

      const isResolved =
        dto.status === SupportCaseStatus.RESOLVED || dto.status === SupportCaseStatus.CLOSED;

      const [updated] = await db
        .update(supportCases)
        .set({
          status: dto.status,
          assignedToUserId: dto.assignedToUserId || supportCase.assignedToUserId,
          resolvedAt: isResolved ? new Date() : supportCase.resolvedAt,
          updatedAt: new Date(),
        })
        .where(eq(supportCases.id, caseId))
        .returning();

      await this.auditService.recordEvent({
        tenantId: supportCase.tenantId,
        userId,
        action: AuditEventType.SUPPORT_CASE_UPDATED,
        resource: 'SupportCase',
        resourceId: caseId,
        details: { status: dto.status },
      });

      return updated;
    });
  }

  // =========================================================================
  // 2. CONTROLLED, AUDITABLE SUPPORT ACCESS
  // =========================================================================

  /**
   * Hospital Administrator grants temporary, time-bound support access to a support engineer.
   */
  async grantSupportAccess(tenantId: string, grantedByUserId: string, dto: GrantSupportAccessDto) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      // Validate support user exists
      const [supportUser] = await db.select().from(users).where(eq(users.id, dto.supportUserId));
      if (!supportUser) {
        throw new NotFoundException(`Support user '${dto.supportUserId}' not found.`);
      }

      // Generate random crypto token and SHA-256 hash
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const now = new Date();
      const durationHours = Math.min(24, Math.max(1, dto.durationHours || 4)); // clamp between 1 and 24h
      const validUntil = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

      const [grant] = await db
        .insert(supportAccessGrants)
        .values({
          tenantId,
          facilityId: dto.facilityId,
          grantedByUserId,
          supportUserId: dto.supportUserId,
          reason: dto.reason,
          scope: dto.scope || SupportAccessScope.READ_ONLY,
          validFrom: now,
          validUntil,
          isActive: true,
          tokenHash,
        })
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId: grantedByUserId,
        action: AuditEventType.SUPPORT_ACCESS_GRANTED,
        resource: 'SupportAccessGrant',
        resourceId: grant!.id,
        details: {
          supportUserId: dto.supportUserId,
          scope: grant!.scope,
          durationHours,
          validUntil,
        },
      });

      return {
        grant,
        accessToken: rawToken, // Returned only once at creation for the support session
      };
    });
  }

  /**
   * Verifies and authorizes a support access token.
   */
  async verifySupportAccess(rawToken: string, tenantId: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const [grant] = await db
        .select()
        .from(supportAccessGrants)
        .where(
          and(
            eq(supportAccessGrants.tokenHash, tokenHash),
            eq(supportAccessGrants.tenantId, tenantId),
          ),
        );

      if (!grant) {
        throw new ForbiddenException('Invalid support access token.');
      }

      if (!grant.isActive || grant.revokedAt) {
        throw new ForbiddenException('Support access grant has been revoked.');
      }

      const now = new Date();
      if (now > grant.validUntil) {
        throw new ForbiddenException('Support access grant window has expired.');
      }

      // Record utilization in audit log
      await this.auditService.recordEvent({
        tenantId,
        userId: grant.supportUserId,
        action: AuditEventType.SUPPORT_ACCESS_UTILIZED,
        resource: 'SupportAccessGrant',
        resourceId: grant.id,
        details: { scope: grant.scope },
      });

      return {
        authorized: true,
        grantId: grant.id,
        scope: grant.scope,
        validUntil: grant.validUntil,
      };
    });
  }

  /**
   * Revokes an active support access grant immediately.
   */
  async revokeSupportAccess(grantId: string, userId: string, tenantId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const [grant] = await db
        .select()
        .from(supportAccessGrants)
        .where(eq(supportAccessGrants.id, grantId));
      if (!grant) {
        throw new NotFoundException(`Support access grant '${grantId}' not found.`);
      }

      if (tenantId && grant.tenantId !== tenantId) {
        throw new ForbiddenException('Cannot revoke grant belonging to another tenant.');
      }

      const [updated] = await db
        .update(supportAccessGrants)
        .set({
          isActive: false,
          revokedAt: new Date(),
        })
        .where(eq(supportAccessGrants.id, grantId))
        .returning();

      await this.auditService.recordEvent({
        tenantId: grant.tenantId,
        userId,
        action: AuditEventType.SUPPORT_ACCESS_REVOKED,
        resource: 'SupportAccessGrant',
        resourceId: grantId,
        details: { reason: 'Revoked by tenant administrator' },
      });

      return updated;
    });
  }

  async getActiveGrants(tenantId?: string) {
    return await this.tenancyService.runInSuperAdminContext(async (db) => {
      const q = db.select().from(supportAccessGrants).orderBy(desc(supportAccessGrants.createdAt));
      if (tenantId) {
        return await q.where(eq(supportAccessGrants.tenantId, tenantId));
      }
      return await q;
    });
  }
}
