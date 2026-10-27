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
import { MaternityService } from './maternity.service.js';
import {
  RecordMaternityDeliveryDto,
  RegisterNewbornDto,
} from './dto/maternity.dto.js';

@ApiTags('Maternity & Newborn Workflows (Phase 2)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('maternity')
export class MaternityController {
  constructor(
    @Inject(MaternityService)
    private readonly maternityService: MaternityService,
  ) {}

  @Post('deliveries')
  @RequirePermissions(Permission.MATERNITY_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record maternal delivery with Partograph summary and clinical outcome' })
  async recordDelivery(
    @Body() dto: RecordMaternityDeliveryDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.maternityService.recordDelivery(dto, context);
  }

  @Get('deliveries')
  @RequirePermissions(Permission.MATERNITY_READ)
  @ApiOperation({ summary: 'List maternal deliveries for facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'motherPatientId', required: false, type: String })
  async listDeliveries(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('motherPatientId') motherPatientId?: string,
  ) {
    return await this.maternityService.listDeliveries(facilityId, context, motherPatientId);
  }

  @Get('deliveries/:id')
  @RequirePermissions(Permission.MATERNITY_READ)
  @ApiOperation({ summary: 'Get delivery record and attached newborn profiles by ID' })
  async getDeliveryById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.maternityService.getDeliveryById(id, context);
  }

  @Post('newborns')
  @RequirePermissions(Permission.NEWBORN_REGISTER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register newborn profile with APGAR scores and Civil Registration linkage' })
  async registerNewborn(
    @Body() dto: RegisterNewbornDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.maternityService.registerNewborn(dto, context);
  }

  @Get('newborns')
  @RequirePermissions(Permission.NEWBORN_READ)
  @ApiOperation({ summary: 'List newborn profiles for a facility' })
  @ApiQuery({ name: 'facilityId', required: true, type: String })
  @ApiQuery({ name: 'deliveryId', required: false, type: String })
  async listNewborns(
    @Query('facilityId', ParseUUIDPipe) facilityId: string,
    @CurrentTenantContext() context: TenantContext,
    @Query('deliveryId') deliveryId?: string,
  ) {
    return await this.maternityService.listNewborns(facilityId, context, deliveryId);
  }
}
