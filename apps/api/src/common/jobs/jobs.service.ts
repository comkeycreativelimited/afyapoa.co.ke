import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  JobQueueName,
  JobType,
  JobStatus,
  AuditEventType,
  buildPaginationMeta,
} from '@afyapoa/domain-core';
import { TenancyService } from '../../tenancy/tenancy.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { jobExecutions } from '@afyapoa/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface RegisterJobParams {
  tenantId: string;
  queueName: JobQueueName;
  jobType: JobType;
  payload: Record<string, unknown>;
  correlationId?: string;
  userId?: string;
}

@Injectable()
export class JobsService {
  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Registers an asynchronous background job under the tenant's RLS boundary.
   */
  async registerJob(params: RegisterJobParams) {
    const { tenantId, queueName, jobType, payload, userId } = params;
    const correlationId = params.correlationId || randomUUID();

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [job] = await db
        .insert(jobExecutions)
        .values({
          tenantId,
          queueName,
          jobType,
          payload: JSON.stringify(payload),
          status: JobStatus.PENDING,
          correlationId,
        })
        .returning();

      if (!job) {
        throw new Error('Failed to insert job execution');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.BACKGROUND_JOB_ENQUEUED,
        resource: 'JobExecution',
        resourceId: job.id,
        details: JSON.stringify({ queueName, jobType, correlationId }),
      });

      return job;
    });
  }

  /**
   * Updates background job state (e.g. called by worker process).
   */
  async updateJobStatus(
    tenantId: string,
    jobId: string,
    status: JobStatus,
    errorDetails?: string,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
      };

      if (status === JobStatus.RUNNING) {
        updateData.startedAt = new Date();
      } else if (status === JobStatus.COMPLETED) {
        updateData.completedAt = new Date();
      } else if (status === JobStatus.FAILED) {
        updateData.completedAt = new Date();
        updateData.errorDetails = errorDetails;
      }

      const [updated] = await db
        .update(jobExecutions)
        .set(updateData)
        .where(
          and(
            eq(jobExecutions.tenantId, tenantId),
            eq(jobExecutions.id, jobId),
          ),
        )
        .returning();

      if (!updated) {
        throw new NotFoundException(`Job execution ${jobId} not found`);
      }

      const auditAction =
        status === JobStatus.COMPLETED
          ? AuditEventType.BACKGROUND_JOB_COMPLETED
          : status === JobStatus.FAILED
          ? AuditEventType.BACKGROUND_JOB_FAILED
          : undefined;

      if (auditAction) {
        await this.auditService.recordEvent({
          tenantId,
          action: auditAction,
          resource: 'JobExecution',
          resourceId: jobId,
          details: JSON.stringify({ status, errorDetails }),
        });
      }

      return updated;
    });
  }

  /**
   * Fetches job status by ID scoped to caller's tenant.
   */
  async getJobById(tenantId: string, jobId: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [job] = await db
        .select()
        .from(jobExecutions)
        .where(
          and(
            eq(jobExecutions.tenantId, tenantId),
            eq(jobExecutions.id, jobId),
          ),
        );
      return job || null;
    });
  }

  /**
   * Lists jobs with pagination and status filtering.
   */
  async listJobs(
    tenantId: string,
    page: number = 1,
    limit: number = 20,
    status?: JobStatus,
  ) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const conditions = [eq(jobExecutions.tenantId, tenantId)];
      if (status) {
        conditions.push(eq(jobExecutions.status, status));
      }

      const whereClause = and(...conditions);
      const safePage = Math.max(1, page);
      const safeLimit = Math.max(1, Math.min(100, limit));
      const offset = (safePage - 1) * safeLimit;

      const [totalCountResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobExecutions)
        .where(whereClause);

      const total = totalCountResult?.count || 0;

      const items = await db
        .select()
        .from(jobExecutions)
        .where(whereClause)
        .orderBy(desc(jobExecutions.createdAt))
        .limit(safeLimit)
        .offset(offset);

      const meta = buildPaginationMeta(total, safePage, safeLimit);
      return { items, meta };
    });
  }
}
