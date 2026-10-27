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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import {
  Permission,
  TenantContext,
} from '@afyapoa/domain-core';
import { RostersService } from './rosters.service.js';
import {
  CreateDepartmentDto,
  CreateStaffRosterDto,
  AssignShiftDto,
} from './dto/rosters.dto.js';

@ApiTags('Staff Rosters & Departmental Assignments (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rosters')
export class RostersController {
  constructor(
    @Inject(RostersService)
    private readonly rostersService: RostersService,
  ) {}

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  @Post('departments')
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a hospital clinical/administrative department' })
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.createDepartment(dto, context);
  }

  @Get('departments')
  @RequirePermissions(Permission.ROSTER_READ)
  @ApiOperation({ summary: 'List departments for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  async listDepartments(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.listDepartments(facilityId, context);
  }

  // ==========================================
  // ROSTERS & SHIFTS
  // ==========================================

  @Post()
  @RequirePermissions(Permission.ROSTER_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a monthly departmental staff roster draft' })
  async createRoster(
    @Body() dto: CreateStaffRosterDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.createRoster(dto, context);
  }

  @Post(':id/publish')
  @RequirePermissions(Permission.ROSTER_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a monthly staff roster' })
  async publishRoster(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.publishRoster(id, context);
  }

  @Post(':id/shifts')
  @RequirePermissions(Permission.ROSTER_MANAGE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign or update a shift slot for a staff member' })
  async assignShift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignShiftDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.assignShift(id, dto, context);
  }

  @Get()
  @RequirePermissions(Permission.ROSTER_READ)
  @ApiOperation({ summary: 'List staff rosters' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  async listRosters(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('departmentId') departmentId?: string,
  ) {
    return await this.rostersService.listRosters(facilityId, context, departmentId);
  }

  @Get(':id')
  @RequirePermissions(Permission.ROSTER_READ)
  @ApiOperation({ summary: 'Get roster details and assigned shifts by ID' })
  async getRosterById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.rostersService.getRosterById(id, context);
  }
}
