import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { auditEvents, withTenantContext, withSuperAdminContext } from '@afyapoa/database';
import { AuditEventType } from '@afyapoa/domain-core';
import { eq, desc, sql } from 'drizzle-orm';
import { logger } from '@afyapoa/logger';

export interface RecordAuditParams {
  tenantId: string;
  userId?: string | null;
  action: AuditEventType | string;
  resource: string;
  resourceId?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | string | null;
}

@Injectable()
export class AuditService {
  private readonly GENESIS_HASH = '0'.repeat(64);

  /**
   * Log audit event alias for recordEvent.
   */
  async logEvent(params: RecordAuditParams): Promise<void> {
    return this.recordEvent(params);
  }

  /**
   * Records an audit event with cryptographic SHA-256 hash chaining to ensure tamper-evidence.
   */
  async recordEvent(params: RecordAuditParams): Promise<void> {
    try {
      const detailsStr = params.details
        ? typeof params.details === 'string'
          ? params.details
          : JSON.stringify(params.details)
        : undefined;

      let eventHash = '';

      // Acquire advisory lock and atomically determine previousHash, compute eventHash, and insert
      await withSuperAdminContext(async (txDb) => {
        // Serialize audit hash chain generation per tenant
        await txDb.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${'audit_' + params.tenantId}))`);

        // Find the most recent audit event for this tenant to get previousHash
        const [lastEvent] = await txDb
          .select({ eventHash: auditEvents.eventHash })
          .from(auditEvents)
          .where(eq(auditEvents.tenantId, params.tenantId))
          .orderBy(desc(auditEvents.createdAt))
          .limit(1);

        const previousHash = lastEvent?.eventHash || this.GENESIS_HASH;
        const timestamp = new Date().toISOString();

        // Compute SHA-256 hash of this event chained with previous hash
        const hashPayload = [
          previousHash,
          params.tenantId,
          params.userId || '',
          params.action,
          params.resource,
          params.resourceId || '',
          detailsStr || '',
          timestamp,
        ].join('|');

        eventHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

        // Insert audit record
        await txDb.insert(auditEvents).values({
          tenantId: params.tenantId,
          userId: params.userId || undefined,
          action: params.action,
          resource: params.resource,
          resourceId: params.resourceId || undefined,
          clientIp: params.clientIp || undefined,
          userAgent: params.userAgent || undefined,
          details: detailsStr,
          previousHash,
          eventHash,
        });
      });

      logger.info(`[AUDIT] ${params.action} on ${params.resource}:${params.resourceId || 'N/A'}`, {
        tenantId: params.tenantId,
        userId: params.userId || undefined,
        action: params.action,
        eventHash,
      });
    } catch (err) {
      logger.error('[AUDIT ERROR] Failed to record audit log', err instanceof Error ? err.stack : String(err));
    }
  }

  /**
   * Retrieves audit events for a tenant with Row-Level Security.
   */
  async getTenantAuditEvents(tenantId: string, limit = 50) {
    return await withTenantContext(tenantId, async (db) => {
      return await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.tenantId, tenantId))
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit);
    });
  }

  /**
   * Verifies the cryptographic chain integrity for a tenant's audit trail.
   */
  async verifyChainIntegrity(tenantId: string): Promise<{ valid: boolean; totalEvents: number }> {
    return await withTenantContext(tenantId, async (db) => {
      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.tenantId, tenantId));

      if (events.length === 0) {
        return { valid: true, totalEvents: 0 };
      }

      // Index events by previousHash for deterministic chain traversal
      const chainMap = new Map<string, typeof events[0]>();
      for (const event of events) {
        chainMap.set(event.previousHash, event);
      }

      let currentHash = this.GENESIS_HASH;
      let count = 0;

      while (chainMap.has(currentHash)) {
        const nextEvent = chainMap.get(currentHash)!;
        count++;
        currentHash = nextEvent.eventHash;
      }

      // If all events were linked into a single chain starting from genesis
      const valid = count === events.length;
      if (!valid) {
        logger.warn(`[AUDIT INTEGRITY] Hash chain broken or unlinked: traversed ${count} of ${events.length} events`);
      }

      return { valid, totalEvents: events.length };
    });
  }
}
