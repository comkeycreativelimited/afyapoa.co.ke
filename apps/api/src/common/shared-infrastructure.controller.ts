import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CurrentTenantContext } from '../auth/decorators/auth.decorators.js';
import {
  WorkflowEntityType,
  WorkflowTrigger,
  JobQueueName,
  JobType,
  JobStatus,
  FileEntityType,
  FileAccessLevel,
  IntegrationSystemType,
  InternalEntityType,
  ExternalSystem,
  TenantContext,
} from '@afyapoa/domain-core';
import { StateMachineService } from './state-machine/state-machine.service.js';
import { JobsService } from './jobs/jobs.service.js';
import { StorageService } from './storage/storage.service.js';
import { IntegrationConfigService } from './integrations/integration-config.service.js';
import { ConfigFlagsService } from './config-flags/config-flags.service.js';
import { PaginationQueryDto } from './dto/pagination.dto.js';

@ApiTags('Shared Domain Infrastructure')
@ApiBearerAuth('JWT-auth')
@Controller('infrastructure')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class SharedInfrastructureController {
  constructor(
    @Inject(StateMachineService)
    private readonly stateMachineService: StateMachineService,
    @Inject(JobsService)
    private readonly jobsService: JobsService,
    @Inject(StorageService)
    private readonly storageService: StorageService,
    @Inject(IntegrationConfigService)
    private readonly integrationConfigService: IntegrationConfigService,
    @Inject(ConfigFlagsService)
    private readonly configFlagsService: ConfigFlagsService,
  ) {}

  // 1. Workflow State Transitions
  @Post('state-transitions')
  @ApiOperation({ summary: 'Execute and record a versioned workflow state transition' })
  async executeStateTransition(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      entityType: WorkflowEntityType;
      entityId: string;
      fromState: string;
      toState: string;
      trigger: WorkflowTrigger;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return await this.stateMachineService.executeTransition({
      tenantId: ctx.tenantId,
      entityType: body.entityType,
      entityId: body.entityId,
      fromState: body.fromState,
      toState: body.toState,
      trigger: body.trigger,
      actorUserId: ctx.userId,
      reason: body.reason,
      metadata: body.metadata,
    });
  }

  @Get('state-transitions/:entityType/:entityId')
  @ApiOperation({ summary: 'Get versioned state transition history for an entity' })
  async getTransitionHistory(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return await this.stateMachineService.getTransitionHistory(
      ctx.tenantId,
      entityType,
      entityId,
    );
  }

  // 2. Background Jobs
  @Post('jobs')
  @ApiOperation({ summary: 'Register and enqueue a background job under tenant context' })
  async registerJob(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      queueName: JobQueueName;
      jobType: JobType;
      payload: Record<string, unknown>;
      correlationId?: string;
    },
  ) {
    return await this.jobsService.registerJob({
      tenantId: ctx.tenantId,
      queueName: body.queueName,
      jobType: body.jobType,
      payload: body.payload,
      correlationId: body.correlationId,
      userId: ctx.userId,
    });
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List background jobs for caller tenant' })
  async listJobs(
    @CurrentTenantContext() ctx: TenantContext,
    @Query() query: PaginationQueryDto,
    @Query('status') status?: JobStatus,
  ) {
    return await this.jobsService.listJobs(
      ctx.tenantId,
      query.page,
      query.limit,
      status,
    );
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get background job status by ID' })
  async getJobById(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.jobsService.getJobById(ctx.tenantId, id);
  }

  // 3. File Metadata & Secure Storage Access
  @Post('files')
  @ApiOperation({ summary: 'Register file metadata with tenant-scoped isolation' })
  async registerFile(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      entityType: FileEntityType;
      entityId: string;
      accessLevel?: FileAccessLevel;
      sha256Checksum?: string;
    },
  ) {
    return await this.storageService.registerFile({
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      originalFilename: body.originalFilename,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      entityType: body.entityType,
      entityId: body.entityId,
      accessLevel: body.accessLevel,
      uploadedBy: ctx.userId,
      sha256Checksum: body.sha256Checksum,
    });
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Retrieve secure file descriptor and download URL' })
  async getFileDescriptor(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return await this.storageService.getFileDescriptor(
      ctx.tenantId,
      id,
      ctx.userId,
    );
  }

  // 4. Integrations & External References
  @Post('integrations/configs')
  @ApiOperation({ summary: 'Upsert external system configuration (DHA, SHA, KRA)' })
  async upsertIntegrationConfig(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      systemType: IntegrationSystemType;
      endpointUrl: string;
      rateLimitPerMinute?: number;
      settings?: Record<string, unknown>;
    },
  ) {
    return await this.integrationConfigService.upsertConfig({
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      systemType: body.systemType,
      endpointUrl: body.endpointUrl,
      rateLimitPerMinute: body.rateLimitPerMinute,
      settings: body.settings,
      userId: ctx.userId,
    });
  }

  @Get('integrations/configs/:systemType')
  @ApiOperation({ summary: 'Get active integration config for system' })
  async getIntegrationConfig(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('systemType') systemType: IntegrationSystemType,
  ) {
    return await this.integrationConfigService.getConfig(
      ctx.tenantId,
      systemType,
    );
  }

  @Post('integrations/references')
  @ApiOperation({ summary: 'Link internal entity UUID to external system identifier' })
  async linkExternalReference(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      internalEntityType: InternalEntityType;
      internalEntityId: string;
      externalSystem: ExternalSystem;
      externalId: string;
      responseMetadata?: Record<string, unknown>;
    },
  ) {
    return await this.integrationConfigService.linkExternalReference({
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      internalEntityType: body.internalEntityType,
      internalEntityId: body.internalEntityId,
      externalSystem: body.externalSystem,
      externalId: body.externalId,
      responseMetadata: body.responseMetadata,
      userId: ctx.userId,
    });
  }

  // 5. Config Flags & Feature Flags
  @Post('config/flags')
  @ApiOperation({ summary: 'Set tenant or facility feature flag' })
  async setConfigFlag(
    @CurrentTenantContext() ctx: TenantContext,
    @Body()
    body: {
      configKey: string;
      configValue: string;
      isEnabled?: boolean;
      description?: string;
    },
  ) {
    return await this.configFlagsService.setConfig({
      tenantId: ctx.tenantId,
      facilityId: ctx.facilityId,
      configKey: body.configKey,
      configValue: body.configValue,
      isEnabled: body.isEnabled,
      description: body.description,
      userId: ctx.userId,
    });
  }

  @Get('config/flags/:key')
  @ApiOperation({ summary: 'Evaluate feature flag with hierarchical inheritance' })
  async getConfigFlag(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('key') key: string,
  ) {
    return await this.configFlagsService.getConfig(
      key,
      ctx.tenantId,
      ctx.facilityId,
    );
  }
}
