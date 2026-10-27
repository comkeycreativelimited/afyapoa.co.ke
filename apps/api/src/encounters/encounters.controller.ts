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
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
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
import { EncountersService } from './encounters.service.js';
import {
  CreateEncounterDto,
  UpdateEncounterStatusDto,
  CloseEncounterDto,
  ReopenEncounterDto,
  RecordTriageVitalsDto,
  CreateClinicalNoteDto,
  UpdateClinicalNoteDto,
  FinalizeClinicalNoteDto,
  AmendClinicalNoteDto,
  RecordAllergyDto,
  UpdateAllergyDto,
  EncounterSearchQueryDto,
} from './dto/encounters.dto.js';

@ApiTags('Encounters & Clinical Documentation (Milestone 5)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('encounters')
export class EncountersController {
  constructor(
    @Inject(EncountersService)
    private readonly encountersService: EncountersService,
  ) {}

  @Post()
  @RequirePermissions(Permission.ENCOUNTER_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a patient encounter',
    description: 'Creates a new clinical encounter (walk-in, appointment, emergency, referral) and enqueues the patient.',
  })
  @ApiResponse({ status: 201, description: 'Encounter registered successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid input or appointment scheduled in the past.' })
  @ApiResponse({ status: 404, description: 'Patient not found.' })
  async createEncounter(
    @Body() dto: CreateEncounterDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.createEncounter(dto, context);
  }

  @Get()
  @RequirePermissions(Permission.ENCOUNTER_READ)
  @ApiOperation({
    summary: 'Search and query patient encounter queue',
    description: 'Retrieves queued and active encounters filtered by facility, service department, status, priority, or practitioner.',
  })
  @ApiResponse({ status: 200, description: 'Encounter queue retrieved successfully.' })
  async searchQueue(
    @Query() query: EncounterSearchQueryDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.searchQueue(query, context);
  }

  @Get(':id')
  @RequirePermissions(Permission.ENCOUNTER_READ)
  @ApiOperation({
    summary: 'Get encounter details by ID',
    description: 'Retrieves complete encounter details including current status, assigned clinician, vitals, notes, and patient profile.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Encounter details retrieved.' })
  @ApiResponse({ status: 404, description: 'Encounter not found.' })
  async getEncounterById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.getEncounterById(id, context);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.ENCOUNTER_UPDATE)
  @ApiOperation({
    summary: 'Update encounter lifecycle status',
    description: 'Transitions encounter through allowable workflow states (e.g., ARRIVED -> IN_PROGRESS -> ON_HOLD).',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Encounter status updated.' })
  @ApiResponse({ status: 400, description: 'Invalid state transition.' })
  async updateEncounterStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEncounterStatusDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.updateEncounterStatus(id, dto, context);
  }

  @Post(':id/close')
  @RequirePermissions(Permission.ENCOUNTER_CLOSE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Close clinical encounter',
    description: 'Validates that all clinical notes are finalized and closes the encounter (transitions to COMPLETED).',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Encounter successfully closed.' })
  @ApiResponse({ status: 422, description: 'Unfinalized draft notes prevent encounter closure.' })
  async closeEncounter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseEncounterDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.closeEncounter(id, dto, context);
  }

  @Post(':id/reopen')
  @RequirePermissions(Permission.ENCOUNTER_REOPEN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reopen completed encounter with reason',
    description: 'Reopens a closed encounter for administrative correction or subsequent clinical addendum with mandatory audit trail.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Encounter reopened.' })
  @ApiResponse({ status: 400, description: 'Encounter is not in COMPLETED status.' })
  async reopenEncounter(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReopenEncounterDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.reopenEncounter(id, dto, context);
  }

  @Post(':id/vitals')
  @RequirePermissions(Permission.TRIAGE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record triage observations and vital signs',
    description: 'Captures vital signs with units, AVPU scale, calculates BMI, and advances encounter to TRIAGED.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Vitals recorded successfully.' })
  async recordTriageVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordTriageVitalsDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.recordTriageVitals(id, dto, context);
  }

  @Get(':id/vitals')
  @RequirePermissions(Permission.ENCOUNTER_READ)
  @ApiOperation({
    summary: 'Get encounter triage observations and vitals history',
    description: 'Lists all triage vitals recorded for this encounter ordered chronologically.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Vitals history retrieved.' })
  async getEncounterVitals(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.getEncounterVitals(id, context);
  }

  @Post(':id/notes')
  @RequirePermissions(Permission.CLINICAL_NOTE_WRITE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create draft clinical note',
    description: 'Creates a structured clinical note (SOAP, H&P, consultation, progress, discharge summary) in DRAFT status.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Draft clinical note created.' })
  @ApiResponse({ status: 400, description: 'Encounter is closed.' })
  async createClinicalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateClinicalNoteDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.createClinicalNote(id, dto, context);
  }

  @Get(':id/notes')
  @RequirePermissions(Permission.ENCOUNTER_READ)
  @ApiOperation({
    summary: 'Get all clinical notes and amendments for encounter',
    description: 'Returns all clinical notes along with their complete amendment history.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Clinical notes retrieved.' })
  async getEncounterNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.getEncounterNotes(id, context);
  }

  @Patch(':id/notes/:noteId')
  @RequirePermissions(Permission.CLINICAL_NOTE_WRITE)
  @ApiOperation({
    summary: 'Update draft clinical note',
    description: 'Updates a draft clinical note. REJECTED if note is already FINALIZED or AMENDED.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiParam({ name: 'noteId', description: 'Clinical Note UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Draft note updated.' })
  @ApiResponse({ status: 422, description: 'Finalized or amended clinical notes cannot be edited directly.' })
  async updateClinicalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateClinicalNoteDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.updateClinicalNote(id, noteId, dto, context);
  }

  @Post(':id/notes/:noteId/finalize')
  @RequirePermissions(Permission.CLINICAL_NOTE_SIGN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalize and digitally sign clinical note',
    description: 'Finalizes a draft note, locking it from direct modification with practitioner attribution.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiParam({ name: 'noteId', description: 'Clinical Note UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Clinical note finalized and signed.' })
  @ApiResponse({ status: 422, description: 'Note is already finalized or amended.' })
  async finalizeClinicalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: FinalizeClinicalNoteDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.finalizeClinicalNote(id, noteId, dto, context);
  }

  @Post(':id/notes/:noteId/amend')
  @RequirePermissions(Permission.CLINICAL_NOTE_AMEND)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Amend a finalized clinical note with addendum',
    description: 'Appends an amendment to a finalized note with full provenance, rationale, and practitioner attribution.',
  })
  @ApiParam({ name: 'id', description: 'Encounter UUID', format: 'uuid' })
  @ApiParam({ name: 'noteId', description: 'Clinical Note UUID', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Amendment created and linked to note.' })
  @ApiResponse({ status: 400, description: 'Draft notes must be finalized before amendment.' })
  async amendClinicalNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: AmendClinicalNoteDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.amendClinicalNote(id, noteId, dto, context);
  }

  @Post('patients/:patientId/allergies')
  @RequirePermissions(Permission.ALLERGY_MANAGE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record patient allergy or intolerance',
    description: 'Documents a verified or suspected allergy for the patient record.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Allergy recorded successfully.' })
  async recordAllergy(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: RecordAllergyDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.recordAllergy(patientId, dto, context);
  }

  @Get('patients/:patientId/allergies')
  @RequirePermissions(Permission.ENCOUNTER_READ)
  @ApiOperation({
    summary: 'Get patient allergy list',
    description: 'Retrieves all documented allergies and adverse reactions for a patient.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Patient allergies retrieved.' })
  async getPatientAllergies(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.getPatientAllergies(patientId, context);
  }

  @Patch('patients/:patientId/allergies/:allergyId')
  @RequirePermissions(Permission.ALLERGY_MANAGE)
  @ApiOperation({
    summary: 'Update patient allergy status or reaction',
    description: 'Modifies clinical status (active, inactive, resolved) or verification status of an allergy.',
  })
  @ApiParam({ name: 'patientId', description: 'Patient UUID', format: 'uuid' })
  @ApiParam({ name: 'allergyId', description: 'Allergy UUID', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Allergy updated successfully.' })
  async updateAllergy(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('allergyId', ParseUUIDPipe) allergyId: string,
    @Body() dto: UpdateAllergyDto,
    @CurrentTenantContext() context: TenantContext,
  ) {
    return this.encountersService.updateAllergy(patientId, allergyId, dto, context);
  }
}
