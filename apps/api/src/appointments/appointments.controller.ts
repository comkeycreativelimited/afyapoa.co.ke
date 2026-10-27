import {
  Controller,
  Get,
  Post,
  Patch,
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
  AppointmentStatus,
} from '@afyapoa/domain-core';
import { AppointmentsService } from './appointments.service.js';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
  CancelAppointmentDto,
} from './dto/appointment.dto.js';

@ApiTags('Appointments & Clinic Scheduling (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    @Inject(AppointmentsService)
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Post()
  @RequirePermissions(Permission.APPOINTMENT_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a patient appointment with double-booking prevention' })
  async createAppointment(
    @Body() dto: CreateAppointmentDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.appointmentsService.createAppointment(dto, context);
  }

  @Get()
  @RequirePermissions(Permission.APPOINTMENT_READ)
  @ApiOperation({ summary: 'List clinic appointments for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'practitionerId', required: false, type: String })
  @ApiQuery({ name: 'patientId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  async listAppointments(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('practitionerId') practitionerId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: AppointmentStatus,
  ) {
    return await this.appointmentsService.listAppointments(
      facilityId,
      context,
      practitionerId,
      patientId,
      status,
    );
  }

  @Get(':id')
  @RequirePermissions(Permission.APPOINTMENT_READ)
  @ApiOperation({ summary: 'Get appointment details by ID' })
  async getAppointmentById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.appointmentsService.getAppointmentById(id, context);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.APPOINTMENT_UPDATE)
  @ApiOperation({ summary: 'Update appointment lifecycle status (Confirmed, Checked-in, Completed)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.appointmentsService.updateStatus(id, dto, context);
  }

  @Post(':id/cancel')
  @RequirePermissions(Permission.APPOINTMENT_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an appointment and free the slot' })
  async cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.appointmentsService.cancelAppointment(id, dto, context);
  }
}
