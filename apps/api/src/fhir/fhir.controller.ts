import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  Req,
  Res,
  UseGuards,
  Inject,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import {
  RequirePermissions,
  CurrentTenantContext,
} from '../auth/decorators/auth.decorators.js';
import { Permission, TenantContext } from '@afyapoa/domain-core';
import {
  KenyaCoreOperationOutcome,
  KenyaCoreBundle,
  KenyaCoreClaim,
} from '@afyapoa/fhir-models';
import { FhirService } from './fhir.service.js';
import { FhirValidationQueryDto, FhirExportQueryDto } from './dto/fhir.dto.js';

@ApiTags('FHIR R4 Interoperability (DHA HIE v1.0)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('fhir')
export class FhirController {
  constructor(
    @Inject(FhirService)
    private readonly fhirService: FhirService,
  ) {}

  @Get('metadata')
  @ApiOperation({
    summary: 'FHIR R4 CapabilityStatement (DHA HIE conformance statement)',
    description: 'Returns server capabilities, supported profiles, search parameters, and exchange operations.',
  })
  @ApiResponse({
    status: 200,
    description: 'CapabilityStatement resource',
  })
  getMetadata() {
    return this.fhirService.getCapabilityStatement();
  }

  @Post(['\\$validate', '$validate', 'validate'])
  @RequirePermissions(Permission.FHIR_VALIDATE)
  @ApiOperation({
    summary: 'Validate resource or Bundle against Kenya Core FHIR profiles and DHA rules',
    description: 'Performs deep structural, canonical profile, terminology (ICD-11, LOINC, UCUM), and identifier validation. Returns OperationOutcome.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resource is conformant (OperationOutcome with informational/warning severity)',
  })
  @ApiResponse({
    status: 422,
    description: 'Validation failed (OperationOutcome with error/fatal severity and remediation)',
  })
  async validateResource(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() payload: unknown,
    @Query() query: FhirValidationQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<KenyaCoreOperationOutcome> {
    const outcome = await this.fhirService.validateResource(payload, query.profile, ctx);
    const hasErrors = outcome.issue.some(
      (i) => i.severity === 'fatal' || i.severity === 'error',
    );
    if (hasErrors) {
      res.status(HttpStatus.UNPROCESSABLE_ENTITY);
    } else {
      res.status(HttpStatus.OK);
    }
    return outcome;
  }

  @Post('bundles/shr')
  @RequirePermissions(Permission.FHIR_EXCHANGE)
  @ApiOperation({
    summary: 'Ingest DHA Shared Health Record (SHR) Collection Bundle',
    description: 'Ingests clinical collection bundle with mandatory DHA HIE exchange headers, idempotency digest, SHR invariants, and provenance tracking.',
  })
  @ApiHeader({
    name: 'X-Facility-Id',
    description: 'Master Facility List (KMFL) Code',
    required: true,
    example: '12345',
  })
  @ApiHeader({
    name: 'X-Facility-Id-Type',
    description: 'Facility identifier type (fr-code)',
    required: true,
    example: 'fr-code',
  })
  @ApiHeader({
    name: 'X-Consent-Token',
    description: 'Patient Consent authorization token',
    required: true,
    example: 'CONSENT-TOKEN-AUTH-XYZ',
  })
  @ApiHeader({
    name: 'X-PUID',
    description: 'Practitioner Universal Identifier',
    required: true,
    example: 'PUID-DOC-001',
  })
  @ApiResponse({
    status: 201,
    description: 'Bundle successfully validated, ingested, and audit recorded',
  })
  @ApiResponse({
    status: 200,
    description: 'Duplicate submission safely detected and acknowledged idempotently',
  })
  @ApiResponse({
    status: 400,
    description: 'Missing mandatory exchange headers',
  })
  @ApiResponse({
    status: 422,
    description: 'Bundle failed DHA SHR collection invariants or terminology constraints',
  })
  async ingestShrBundle(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() bundle: KenyaCoreBundle,
    @Headers('x-facility-id') facilityId?: string,
    @Headers('x-facility-id-type') facilityIdType?: string,
    @Headers('x-consent-token') consentToken?: string,
    @Headers('x-puid') puid?: string,
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<KenyaCoreOperationOutcome> {
    const result = await this.fhirService.ingestShrBundle(
      bundle,
      {
        facilityId,
        facilityIdType,
        consentToken,
        puid,
      },
      ctx,
      req?.ip,
      req?.headers['user-agent'],
    );

    if (res) {
      res.status(result.statusCode);
      if (result.receiptId) {
        res.setHeader('X-Receipt-Id', result.receiptId);
      }
    }

    return result.outcome;
  }

  @Get(['patients/:id/\\$export', 'patients/:id/$export', 'patients/:id/export'])
  @RequirePermissions(Permission.FHIR_EXPORT)
  @ApiOperation({
    summary: 'Export Patient Shared Health Record as conformant FHIR Collection Bundle',
    description: 'Serializes patient demographic data, clinical encounters, LOINC vitals, ICD-11 conditions, and allergies into a Kenya Core SHR Collection Bundle.',
  })
  @ApiParam({ name: 'id', description: 'Patient UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Conformant FHIR SHR Collection Bundle with Provenance and Security tags',
  })
  async exportPatientShr(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: FhirExportQueryDto,
  ): Promise<KenyaCoreBundle> {
    return await this.fhirService.exportPatientShrBundle(id, ctx, query.encounterId);
  }

  @Get(['claims/:id/\\$export', 'claims/:id/$export', 'claims/:id/export'])
  @RequirePermissions(Permission.FHIR_EXPORT)
  @ApiOperation({
    summary: 'Export Financial Claim as conformant FHIR KenyaCoreClaim resource',
    description: 'Serializes internal SHA claim and claim items into Kenya Core Claim resource with tariff codes.',
  })
  @ApiParam({ name: 'id', description: 'Claim UUID', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Conformant FHIR Claim resource',
  })
  async exportClaim(
    @CurrentTenantContext() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<KenyaCoreClaim> {
    return await this.fhirService.exportClaim(id, ctx);
  }
}
