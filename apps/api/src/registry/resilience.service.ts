import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  RegistryType,
  CircuitBreakerState,
  JobQueueName,
  JobType,
  JobStatus,
  AuditEventType,
  encryptField,
  decryptField,
} from '@afyapoa/domain-core';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import { jobExecutions } from '@afyapoa/database';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
}

export interface RegistryCircuitState {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
  lastProbeTime?: number;
}

export interface IntegrationHealthMetric {
  registryType: RegistryType;
  circuitState: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  latencyMs: number;
  isHealthy: boolean;
  lastCheckedAt: string;
}

export interface OperationalAlert {
  id: string;
  registryType: RegistryType;
  severity: 'WARNING' | 'CRITICAL';
  message: string;
  consecutiveFailures: number;
  triggeredAt: string;
  resolved: boolean;
}

export interface EnqueueEncryptedJobParams {
  tenantId: string;
  queueName: JobQueueName;
  jobType: JobType;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  correlationId?: string;
  userId?: string;
}

@Injectable()
export class ResilienceService {
  private readonly circuitStates = new Map<RegistryType, RegistryCircuitState>();
  private readonly latencyHistory = new Map<RegistryType, number[]>();
  private readonly activeAlerts: OperationalAlert[] = [];

  private readonly defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    resetTimeoutMs: 5000, // 5 seconds recovery probe timeout
  };

  private readonly alertThreshold = 5; // 5 consecutive failures triggers persistent alert

  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {
    this.initCircuitBreakers();
  }

  private initCircuitBreakers() {
    for (const type of Object.values(RegistryType)) {
      this.circuitStates.set(type, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: Date.now(),
      });
      this.latencyHistory.set(type, [15, 20, 25]);
    }
  }

  // ===========================================================================
  // 1. CIRCUIT BREAKER OPERATIONS
  // ===========================================================================

  getCircuitState(registryType: RegistryType): CircuitBreakerState {
    const breaker = this.circuitStates.get(registryType);
    if (!breaker) return CircuitBreakerState.CLOSED;

    const now = Date.now();
    if (breaker.state === CircuitBreakerState.OPEN) {
      if (now - (breaker.lastFailureTime || 0) >= this.defaultConfig.resetTimeoutMs) {
        breaker.state = CircuitBreakerState.HALF_OPEN;
        breaker.lastStateChange = now;
      }
    }
    return breaker.state;
  }

  canExecute(registryType: RegistryType): boolean {
    const state = this.getCircuitState(registryType);
    return state === CircuitBreakerState.CLOSED || state === CircuitBreakerState.HALF_OPEN;
  }

  async recordSuccess(registryType: RegistryType, durationMs: number, tenantId?: string) {
    const breaker = this.circuitStates.get(registryType);
    if (!breaker) return;

    breaker.successCount++;
    breaker.failureCount = 0;

    // Record latency
    const latencies = this.latencyHistory.get(registryType) || [];
    latencies.push(durationMs);
    if (latencies.length > 20) latencies.shift();
    this.latencyHistory.set(registryType, latencies);

    // Resolve any active alerts for this registry
    for (const alert of this.activeAlerts) {
      if (alert.registryType === registryType && !alert.resolved) {
        alert.resolved = true;
      }
    }

    if (breaker.state === CircuitBreakerState.HALF_OPEN || breaker.state === CircuitBreakerState.OPEN) {
      const oldState = breaker.state;
      breaker.state = CircuitBreakerState.CLOSED;
      breaker.lastStateChange = Date.now();

      if (tenantId) {
        await this.auditService.recordEvent({
          tenantId,
          action: AuditEventType.REGISTRY_CIRCUIT_STATE_CHANGED,
          resource: 'CircuitBreaker',
          resourceId: registryType,
          details: JSON.stringify({
            registryType,
            oldState,
            newState: CircuitBreakerState.CLOSED,
            reason: 'Successful execution probe closed circuit',
          }),
        });
      }
    }
  }

  async recordFailure(registryType: RegistryType, error: Error, tenantId?: string) {
    const breaker = this.circuitStates.get(registryType);
    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    // Check for operational alert condition
    if (breaker.failureCount >= this.alertThreshold) {
      this.triggerOperationalAlert(registryType, breaker.failureCount, error.message, tenantId);
    }

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      // Failed during half-open probe -> return immediately to OPEN
      const oldState = breaker.state;
      breaker.state = CircuitBreakerState.OPEN;
      breaker.lastStateChange = Date.now();

      if (tenantId) {
        await this.auditService.recordEvent({
          tenantId,
          action: AuditEventType.REGISTRY_CIRCUIT_STATE_CHANGED,
          resource: 'CircuitBreaker',
          resourceId: registryType,
          details: JSON.stringify({
            registryType,
            oldState,
            newState: CircuitBreakerState.OPEN,
            reason: `Probe failed: ${error.message}`,
          }),
        });
      }
    } else if (breaker.state === CircuitBreakerState.CLOSED) {
      if (breaker.failureCount >= this.defaultConfig.failureThreshold) {
        breaker.state = CircuitBreakerState.OPEN;
        breaker.lastStateChange = Date.now();

        if (tenantId) {
          await this.auditService.recordEvent({
            tenantId,
            action: AuditEventType.REGISTRY_CIRCUIT_STATE_CHANGED,
            resource: 'CircuitBreaker',
            resourceId: registryType,
            details: JSON.stringify({
              registryType,
              oldState: CircuitBreakerState.CLOSED,
              newState: CircuitBreakerState.OPEN,
              reason: `Failure threshold (${this.defaultConfig.failureThreshold}) reached: ${error.message}`,
            }),
          });
        }
      }
    }
  }

  private triggerOperationalAlert(
    registryType: RegistryType,
    consecutiveFailures: number,
    errorReason: string,
    tenantId?: string,
  ) {
    const alertId = randomUUID();
    const alert: OperationalAlert = {
      id: alertId,
      registryType,
      severity: consecutiveFailures >= 10 ? 'CRITICAL' : 'WARNING',
      message: `Registry '${registryType}' experienced ${consecutiveFailures} consecutive failures: ${errorReason}`,
      consecutiveFailures,
      triggeredAt: new Date().toISOString(),
      resolved: false,
    };
    this.activeAlerts.push(alert);

    if (tenantId) {
      this.auditService.recordEvent({
        tenantId,
        action: AuditEventType.REGISTRY_PERSISTENT_FAILURE_ALERT,
        resource: 'OperationalAlert',
        resourceId: alertId,
        details: JSON.stringify(alert),
      });
    }
  }

  // ===========================================================================
  // 2. BOUNDED RETRIES & EXPONENTIAL BACKOFF WITH JITTER
  // ===========================================================================

  calculateBackoffDelay(attempt: number, initialDelayMs = 200, factor = 2, maxDelayMs = 10000): number {
    const exponential = initialDelayMs * Math.pow(factor, Math.max(0, attempt - 1));
    const jitter = Math.random() * 100;
    return Math.min(maxDelayMs, Math.round(exponential + jitter));
  }

  // ===========================================================================
  // 3. ENCRYPTED QUEUE STORAGE & SENSITIVE DATA PRIVACY (AES-256-GCM)
  // ===========================================================================

  async enqueueEncryptedJob(params: EnqueueEncryptedJobParams) {
    const { tenantId, queueName, jobType, payload, userId } = params;
    const maxAttempts = params.maxAttempts || 3;
    const correlationId = params.correlationId || randomUUID();

    // Sensitive clinical / PII fields are encrypted at rest with AES-256-GCM
    const plaintextPayload = JSON.stringify(payload);
    const encryptedPayload = encryptField(plaintextPayload);

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [job] = await db
        .insert(jobExecutions)
        .values({
          tenantId,
          queueName,
          jobType,
          payload: encryptedPayload,
          status: JobStatus.PENDING,
          correlationId,
          attempts: 0,
          maxAttempts,
        })
        .returning();

      if (!job) {
        throw new Error('Failed to enqueue encrypted background job');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.BACKGROUND_JOB_ENQUEUED,
        resource: 'JobExecution',
        resourceId: job.id,
        details: JSON.stringify({
          queueName,
          jobType,
          correlationId,
          encrypted: true,
          retentionPolicy: 'COMPLETED: 14 days, DLQ: 30 days',
        }),
      });

      return job;
    });
  }

  // ===========================================================================
  // 4. DEAD-LETTER QUEUE (DLQ) & FAILED-JOB INSPECTION
  // ===========================================================================

  async recordJobFailure(
    tenantId: string,
    jobId: string,
    error: Error,
  ): Promise<{ status: JobStatus; nextRetryDelayMs?: number }> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [existing] = await db
        .select()
        .from(jobExecutions)
        .where(and(eq(jobExecutions.tenantId, tenantId), eq(jobExecutions.id, jobId)));

      if (!existing) {
        throw new NotFoundException(`Job ${jobId} not found`);
      }

      const nextAttempts = existing.attempts + 1;
      const reachedMax = nextAttempts >= existing.maxAttempts;

      if (reachedMax) {
        // Transition to DEAD_LETTER queue
        await db
          .update(jobExecutions)
          .set({
            status: JobStatus.DEAD_LETTER,
            attempts: nextAttempts,
            errorDetails: error.message,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(jobExecutions.tenantId, tenantId), eq(jobExecutions.id, jobId)));

        await this.auditService.recordEvent({
          tenantId,
          action: AuditEventType.REGISTRY_DLQ_JOB_ENQUEUED,
          resource: 'JobExecution',
          resourceId: jobId,
          details: JSON.stringify({
            attempts: nextAttempts,
            maxAttempts: existing.maxAttempts,
            error: error.message,
            queueName: JobQueueName.DEAD_LETTER,
          }),
        });

        return { status: JobStatus.DEAD_LETTER };
      } else {
        const delayMs = this.calculateBackoffDelay(nextAttempts);
        await db
          .update(jobExecutions)
          .set({
            status: JobStatus.RETRYING,
            attempts: nextAttempts,
            errorDetails: error.message,
            updatedAt: new Date(),
          })
          .where(and(eq(jobExecutions.tenantId, tenantId), eq(jobExecutions.id, jobId)));

        return { status: JobStatus.RETRYING, nextRetryDelayMs: delayMs };
      }
    });
  }

  async listFailedAndDlqJobs(tenantId: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const jobs = await db
        .select()
        .from(jobExecutions)
        .where(
          and(
            eq(jobExecutions.tenantId, tenantId),
            inArray(jobExecutions.status, [JobStatus.FAILED, JobStatus.DEAD_LETTER, JobStatus.RETRYING]),
          ),
        )
        .orderBy(desc(jobExecutions.updatedAt));

      return jobs.map((job) => {
        let decryptedData: Record<string, unknown> | null = null;
        try {
          const raw = decryptField(job.payload);
          decryptedData = JSON.parse(raw);
        } catch {
          try {
            decryptedData = JSON.parse(job.payload);
          } catch {
            decryptedData = { raw: '[UNPARSABLE_OR_NON_STANDARD_PAYLOAD]' };
          }
        }

        return {
          id: job.id,
          queueName: job.queueName,
          jobType: job.jobType,
          status: job.status,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          correlationId: job.correlationId,
          errorDetails: job.errorDetails,
          payloadSummary: decryptedData,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        };
      });
    });
  }

  async replayDlqJob(tenantId: string, jobId: string, userId?: string) {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [job] = await db
        .select()
        .from(jobExecutions)
        .where(and(eq(jobExecutions.tenantId, tenantId), eq(jobExecutions.id, jobId)));

      if (!job) {
        throw new NotFoundException(`Dead-letter job ${jobId} not found`);
      }

      const newCorrelationId = randomUUID();
      const [replayed] = await db
        .update(jobExecutions)
        .set({
          status: JobStatus.PENDING,
          attempts: 0,
          errorDetails: null,
          correlationId: newCorrelationId,
          updatedAt: new Date(),
        })
        .where(and(eq(jobExecutions.tenantId, tenantId), eq(jobExecutions.id, jobId)))
        .returning();

      await this.auditService.recordEvent({
        tenantId,
        userId,
        action: AuditEventType.REGISTRY_DLQ_JOB_REPLAYED,
        resource: 'JobExecution',
        resourceId: jobId,
        details: JSON.stringify({
          jobType: job.jobType,
          previousAttempts: job.attempts,
          newCorrelationId,
        }),
      });

      return replayed;
    });
  }

  // ===========================================================================
  // 5. INTEGRATION HEALTH MONITORING & ACTIVE ALERTS
  // ===========================================================================

  getIntegrationHealth(): {
    timestamp: string;
    overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    registries: IntegrationHealthMetric[];
    activeAlerts: OperationalAlert[];
  } {
    const registries: IntegrationHealthMetric[] = [];
    let hasOpen = false;
    let hasHalfOpen = false;

    for (const type of Object.values(RegistryType)) {
      const breaker = this.circuitStates.get(type) || {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: Date.now(),
      };

      const latencies = this.latencyHistory.get(type) || [20];
      const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

      const currentState = this.getCircuitState(type);
      if (currentState === CircuitBreakerState.OPEN) hasOpen = true;
      if (currentState === CircuitBreakerState.HALF_OPEN) hasHalfOpen = true;

      registries.push({
        registryType: type,
        circuitState: currentState,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        latencyMs: avgLatency,
        isHealthy: currentState === CircuitBreakerState.CLOSED && breaker.failureCount === 0,
        lastCheckedAt: new Date().toISOString(),
      });
    }

    const overallStatus = hasOpen ? 'DOWN' : hasHalfOpen ? 'DEGRADED' : 'HEALTHY';

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      registries,
      activeAlerts: this.activeAlerts.filter((a) => !a.resolved),
    };
  }

  resetBreakerForTesting(registryType?: RegistryType) {
    if (registryType) {
      this.circuitStates.set(registryType, {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastStateChange: Date.now(),
      });
    } else {
      this.initCircuitBreakers();
      this.activeAlerts.length = 0;
    }
  }
}
