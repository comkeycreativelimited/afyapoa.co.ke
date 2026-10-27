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
  TheatreBookingStatus,
} from '@afyapoa/domain-core';
import { TheatreService } from './theatre.service.js';
import {
  CreateTheatreDto,
  CreateTheatreBookingDto,
  UpdateTheatreBookingStatusDto,
  SignWhoChecklistDto,
  CancelTheatreBookingDto,
} from './dto/theatre.dto.js';

@ApiTags('Operating Theatre & Procedure Scheduling (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['theatre', 'theatres'])
export class TheatreController {
  constructor(
    @Inject(TheatreService)
    private readonly theatreService: TheatreService,
  ) {}

  @Post()
  @RequirePermissions(Permission.THEATRE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure an operating theatre suite' })
  async createTheatre(
    @Body() dto: CreateTheatreDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.createTheatre(dto, context);
  }

  @Post('rooms')
  @RequirePermissions(Permission.THEATRE_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Configure an operating theatre suite (rooms alias)' })
  async createTheatreRoom(
    @Body() dto: CreateTheatreDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.createTheatre(dto, context);
  }

  @Get()
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'List operating theatres for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  async listTheatres(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.listTheatres(facilityId, context);
  }

  @Get('rooms')
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'List operating theatres for a facility (rooms alias)' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  async listTheatreRooms(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.listTheatres(facilityId, context);
  }

  @Get(':id')
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'Get theatre suite by ID' })
  async getTheatreById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.getTheatreById(id, context);
  }

  @Get('rooms/:id')
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'Get theatre suite by ID (rooms alias)' })
  async getTheatreRoomById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.getTheatreById(id, context);
  }

  @Post('bookings')
  @RequirePermissions(Permission.THEATRE_BOOK)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule surgery with conflict detection and concurrency control' })
  async createBooking(
    @Body() dto: CreateTheatreBookingDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.createBooking(dto, context);
  }

  @Get('bookings')
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'List theatre procedure bookings' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'theatreId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: TheatreBookingStatus })
  async listBookings(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('theatreId') theatreId?: string,
    @Query('status') status?: TheatreBookingStatus,
  ) {
    return await this.theatreService.listBookings(facilityId, context, theatreId, status);
  }

  @Get('bookings/:id')
  @RequirePermissions(Permission.THEATRE_READ)
  @ApiOperation({ summary: 'Get booking details by ID' })
  async getBookingById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.getBookingById(id, context);
  }

  @Patch('bookings/:id/status')
  @RequirePermissions(Permission.THEATRE_UPDATE)
  @ApiOperation({ summary: 'Update procedure status, anesthesia notes, and operative notes' })
  async updateBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTheatreBookingStatusDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.updateBookingStatus(id, dto, context);
  }

  @Post('bookings/:id/checklist')
  @RequirePermissions(Permission.THEATRE_CHECKLIST_SIGN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out)' })
  async signWhoChecklist(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignWhoChecklistDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.signWhoChecklist(id, dto, context);
  }

  @Post('bookings/:id/cancel')
  @RequirePermissions(Permission.THEATRE_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel theatre procedure booking' })
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTheatreBookingDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.theatreService.cancelBooking(id, dto, context);
  }
}
