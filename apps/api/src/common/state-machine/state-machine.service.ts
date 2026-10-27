import { Injectable, Inject } from '@nestjs/common';
import {
  WorkflowEntityType,
  WorkflowTrigger,
  WorkflowStateMachine,
  AuditEventType,
} from '@afyapoa/domain-core';
import { TenancyService } from '../../tenancy/tenancy.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { workflowStateTransitions } from '@afyapoa/database';
import { eq, and, desc } from 'drizzle-orm';

export interface ExecuteTransitionParams {
  tenantId: string;
  entityType: WorkflowEntityType;
  entityId: string;
  fromState: string;
  toState: string;
  trigger: WorkflowTrigger;
  actorUserId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StateMachineService {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validates and records a versioned workflow state transition under PostgreSQL RLS tenant context.
   */
  async executeTransition(params: ExecuteTransitionParams) {
    const {
      tenantId,
      entityType,
      entityId,
      fromState,
      toState,
      trigger,
      actorUserId,
      reason,
      metadata,
    } = params;

    // 1. Assert state transition is structurally valid
    try {
      WorkflowStateMachine.assertValidTransition(entityType, fromState, toState);
    } catch (err) {
      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.STATE_TRANSITION_REJECTED,
        resource: entityType,
        resourceId: entityId,
        details: JSON.stringify({
          fromState,
          toState,
          trigger,
          error: err instanceof Error ? err.message : 'Invalid transition',
        }),
      });
      throw err;
    }

    // 2. Fetch latest version and insert transition inside tenant transaction
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const existingTransitions = await db
        .select()
        .from(workflowStateTransitions)
        .where(
          and(
            eq(workflowStateTransitions.tenantId, tenantId),
            eq(workflowStateTransitions.entityType, entityType),
            eq(workflowStateTransitions.entityId, entityId),
          ),
        )
        .orderBy(desc(workflowStateTransitions.version))
        .limit(1);

      const latest = existingTransitions[0];
      const nextVersion = latest ? latest.version + 1 : 1;

      const [transition] = await db
        .insert(workflowStateTransitions)
        .values({
          tenantId,
          entityType,
          entityId,
          fromState,
          toState,
          version: nextVersion,
          trigger,
          actorUserId,
          reason,
          metadata: metadata ? JSON.stringify(metadata) : null,
        })
        .returning();

      // 3. Emit audit event
      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.STATE_TRANSITION_EXECUTED,
        resource: entityType,
        resourceId: entityId,
        details: JSON.stringify({
          fromState,
          toState,
          trigger,
          version: nextVersion,
        }),
      });

      return transition;
    });
  }

  /**
   * Retrieves the immutable versioned history of state transitions for an entity.
   */
  async getTransitionHistory(
    tenantId: string,
    entityType: WorkflowEntityType,
    entityId: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      return await db
        .select()
        .from(workflowStateTransitions)
        .where(
          and(
            eq(workflowStateTransitions.tenantId, tenantId),
            eq(workflowStateTransitions.entityType, entityType),
            eq(workflowStateTransitions.entityId, entityId),
          ),
        )
        .orderBy(desc(workflowStateTransitions.version));
    });
  }
}
