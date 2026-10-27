import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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
import { TerminologyService } from './terminology.service.js';
import {
  TerminologySearchQueryDto,
  ValidateTerminologyDto,
  ImportCatalogueDto,
} from './dto/terminology.dto.js';

@ApiTags('Clinical Terminology (WHO ICD-11, LOINC, Kenya EML/ATC)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('terminology')
export class TerminologyController {
  constructor(
    @Inject(TerminologyService)
    private readonly terminologyService: TerminologyService,
  ) {}

  @Get('catalogues')
  @RequirePermissions(Permission.TERMINOLOGY_READ)
  @ApiOperation({
    summary: 'List available terminology catalogues (ICD-11, ICD-10, LOINC, Kenya EML)',
    description: 'Retrieves imported standard terminology catalogues with versions, authority, and status.',
  })
  @ApiResponse({ status: 200, description: 'Catalogues retrieved successfully' })
  async listCatalogues() {
    return await this.terminologyService.listCatalogues();
  }

  @Get('search')
  @RequirePermissions(Permission.TERMINOLOGY_READ)
  @ApiOperation({
    summary: 'Search terminology concepts by code, display name, or synonym',
    description: 'Fast autocomplete search across WHO ICD-11 MMS, LOINC, and Kenya EML/ATC catalogues.',
  })
  @ApiResponse({ status: 200, description: 'Concepts retrieved successfully' })
  async searchConcepts(@Query() query: TerminologySearchQueryDto) {
    return await this.terminologyService.searchConcepts(query);
  }

  @Post('validate')
  @RequirePermissions(Permission.TERMINOLOGY_READ)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate clinical code against authorized Kenyan terminology catalogue',
    description: 'Rejects invented codes or unknown concept codes with HTTP 400 Bad Request.',
  })
  @ApiResponse({ status: 200, description: 'Concept code is valid and active' })
  @ApiResponse({ status: 400, description: 'Code is invalid, unknown, or inactive' })
  async validateConcept(@Body() dto: ValidateTerminologyDto) {
    return await this.terminologyService.validateConcept(dto.system, dto.code);
  }

  @Post('import')
  @RequirePermissions(Permission.TERMINOLOGY_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Import or update a versioned terminology catalogue',
    description: 'Authorized administrator upload of Kenyan standard clinical terminology.',
  })
  @ApiResponse({ status: 201, description: 'Catalogue imported successfully' })
  async importCatalogue(
    @Body() dto: ImportCatalogueDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return await this.terminologyService.importCatalogue(dto, context);
  }
}
