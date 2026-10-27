import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { RegistrySyncService } from './registry-sync.service.js';
import { ResilienceService } from './resilience.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import { Permission, TenantContext, RegistryType } from '@afyapoa/domain-core';
import {
  SyncClientRegistryDto,
  SyncFacilityRegistryDto,
  SyncHealthWorkerRegistryDto,
  SyncTerminologyDto,
  ReconcileRegistryDto,
  InvalidateCacheDto,
} from './dto/registry.dto.js';

@ApiTags('National Registry Synchronization & Resilience (DHA / KMFL / HWR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('registry')
export class RegistryController {
  constructor(
    @Inject(RegistrySyncService)
    private readonly registrySyncService: RegistrySyncService,
    @Inject(ResilienceService)
    private readonly resilienceService: ResilienceService,
  ) {}

  // ===========================================================================
  // 1. REGISTRY SYNCHRONIZATION ENDPOINTS
  // ===========================================================================

  @Post('sync/client')
  @RequirePermissions(Permission.REGISTRY_SYNC_TRIGGER)
  @ApiOperation({ summary: 'Synchronize patient record with DHA Client Registry (CR / MPI)' })
  @ApiResponse({ status: 200, description: 'Client synchronization result' })
  async syncClientRegistry(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: SyncClientRegistryDto,
  ) {
    return await this.registrySyncService.syncClientRegistry(
      ctx.tenantId,
      {
        patientId: dto.patientId,
        nationalId: dto.nationalId,
        facilityCode: dto.facilityCode,
        forceRefresh: dto.forceRefresh,
      },
      ctx.userId,
    );
  }

  @Post('sync/facility')
  @RequirePermissions(Permission.REGISTRY_SYNC_TRIGGER)
  @ApiOperation({ summary: 'Synchronize facility metadata with Master Health Facility List (KMFL)' })
  @ApiResponse({ status: 200, description: 'Facility synchronization result' })
  async syncFacilityRegistry(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: SyncFacilityRegistryDto,
  ) {
    return await this.registrySyncService.syncFacilityRegistry(
      ctx.tenantId,
      dto.kmflCode,
      dto.forceRefresh,
      ctx.userId,
    );
  }

  @Post('sync/health-worker')
  @RequirePermissions(Permission.REGISTRY_SYNC_TRIGGER)
  @ApiOperation({ summary: 'Synchronize practitioner credentials with Health Worker Registry (HWR)' })
  @ApiResponse({ status: 200, description: 'Practitioner synchronization result' })
  async syncHealthWorkerRegistry(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: SyncHealthWorkerRegistryDto,
  ) {
    return await this.registrySyncService.syncHealthWorkerRegistry(
      ctx.tenantId,
      dto.puid,
      dto.forceRefresh,
      ctx.userId,
    );
  }

  @Post('sync/terminology')
  @RequirePermissions(Permission.REGISTRY_SYNC_TRIGGER)
  @ApiOperation({ summary: 'Synchronize and validate concept against DHA Terminology Service (TS)' })
  @ApiResponse({ status: 200, description: 'Terminology synchronization result' })
  async syncTerminology(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: SyncTerminologyDto,
  ) {
    return await this.registrySyncService.syncTerminologyConcept(
      ctx.tenantId,
      dto.system,
      dto.code,
      dto.forceRefresh,
      ctx.userId,
    );
  }

  // ===========================================================================
  // 2. PER-RECORD SYNCHRONIZATION STATUS LOOKUP
  // ===========================================================================

  @Get('status/:registryType/:recordKey')
  @RequirePermissions(Permission.REGISTRY_SYNC_READ)
  @ApiOperation({ summary: 'Lookup per-record synchronization status, version, and freshness' })
  async getRecordStatus(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('registryType') registryType: RegistryType,
    @Param('recordKey') recordKey: string,
  ) {
    return await this.registrySyncService.getRecordSyncStatus(
      ctx.tenantId,
      registryType,
      recordKey,
    );
  }

  // ===========================================================================
  // 3. INTEGRATION HEALTH MONITORING & OPERATIONAL DASHBOARD
  // ===========================================================================

  @Get('health')
  @RequirePermissions(Permission.INTEGRATION_HEALTH_READ)
  @ApiOperation({ summary: 'Get live integration health metrics, circuit breaker states, and alerts' })
  getIntegrationHealth() {
    return this.resilienceService.getIntegrationHealth();
  }

  // ===========================================================================
  // 4. FAILED-JOB INSPECTION & DEAD-LETTER QUEUE (DLQ) REPLAY
  // ===========================================================================

  @Get('failed-jobs')
  @RequirePermissions(Permission.INTEGRATION_HEALTH_READ)
  @ApiOperation({ summary: 'Inspect failed and dead-letter queue (DLQ) integration background jobs' })
  async listFailedJobs(@CurrentTenantContext() ctx: TenantContext) {
    return await this.resilienceService.listFailedAndDlqJobs(ctx.tenantId);
  }

  @Post('failed-jobs/:jobId/replay')
  @RequirePermissions(Permission.REGISTRY_REPLAY_MANAGE)
  @ApiOperation({ summary: 'Safely replay a dead-letter queue (DLQ) job with bounded retries' })
  async replayJob(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('jobId') jobId: string,
  ) {
    return await this.resilienceService.replayDlqJob(ctx.tenantId, jobId, ctx.userId);
  }

  // ===========================================================================
  // 5. CACHE INVALIDATION & RECONCILIATION
  // ===========================================================================

  @Post('cache/invalidate')
  @RequirePermissions(Permission.REGISTRY_SYNC_TRIGGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate cached registry records and mark for stale-revalidation' })
  async invalidateCache(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: InvalidateCacheDto,
  ) {
    return await this.registrySyncService.invalidateCache(
      ctx.tenantId,
      dto.registryType,
      dto.recordKey,
    );
  }

  @Post('reconcile')
  @RequirePermissions(Permission.REGISTRY_REPLAY_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reconcile stale or failed registry records with optional dry-run preview' })
  async reconcileRegistry(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: ReconcileRegistryDto,
  ) {
    return await this.registrySyncService.reconcileRegistry(
      ctx.tenantId,
      dto.registryType,
      dto.dryRun,
      ctx.userId,
    );
  }
}
