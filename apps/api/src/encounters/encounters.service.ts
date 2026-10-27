import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { eq, and, or, ilike, desc, sql, inArray } from 'drizzle-orm';
import {
  encounters,
  triageVitals,
  patientAllergies,
  clinicalNotes,
  clinicalNoteAmendments,
  patients,
  workflowStateTransitions,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
  WorkflowEntityType,
  WorkflowTrigger,
  WorkflowStateMachine,
  calculateBmi,
  EncounterStatus,
  EncounterType,
  TriagePriority,
  ServiceDepartment,
  ClinicalNoteStatus,
  ClinicalNoteType,
  AllergenType,
  AllergySeverity,
  AllergyClinicalStatus,
  AllergyVerificationStatus,
  AvpuLevel,
  buildPaginationMeta,
} from '@afyapoa/domain-core';
import { AuditService } from '../audit/audit.service.js';
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

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * Generates a unique, sequential Medical Encounter Number: ENC-YYYYMM-XXXX
   */
  private generateEncounterNumber(): string {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ENC-${yearMonth}-${randomSuffix}`;
  }

  /**
   * 1. Register a new patient encounter (Walk-in, Appointment, Emergency, or Referral).
   */
  async createEncounter(dto: CreateEncounterDto, context: TenantContext) {
    if (!dto.patientId) {
      throw new BadRequestException('Patient ID is required.');
    }
    if (!dto.facilityId) {
      throw new BadRequestException('Facility ID is required.');
    }

    this.logger.log(`Registering encounter for patient ${dto.patientId} in facility ${dto.facilityId}`);

    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Verify patient exists within the tenant
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, dto.patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${dto.patientId} does not exist.`);
      }

      // 2. Determine initial status
      const initialStatus =
        dto.encounterType === EncounterType.APPOINTMENT
          ? EncounterStatus.PLANNED
          : EncounterStatus.ARRIVED;

      const encounterNumber = this.generateEncounterNumber();

      const [newEncounter] = await tx
        .insert(encounters)
        .values({
          tenantId: context.tenantId,
          facilityId: dto.facilityId,
          patientId: dto.patientId,
          practitionerId: dto.practitionerId || null,
          encounterNumber,
          encounterType: dto.encounterType,
          serviceDepartment: dto.serviceDepartment || ServiceDepartment.OUTPATIENT,
          status: initialStatus,
          priority: dto.priority || TriagePriority.SEMI_URGENT,
          reasonForVisit: dto.reasonForVisit || null,
          startedAt: new Date(),
          version: 1,
        })
        .returning();

      if (!newEncounter) {
        throw new BadRequestException('Failed to register encounter.');
      }

      // 3. Record initial workflow state transition
      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.ENCOUNTER,
        entityId: newEncounter.id,
        fromState: 'NONE',
        toState: initialStatus,
        version: 1,
        trigger: WorkflowTrigger.CREATE,
        actorUserId: context.userId,
        reason: `Encounter registered as ${dto.encounterType}`,
        metadata: JSON.stringify({ encounterNumber, department: dto.serviceDepartment }),
      });

      // 4. Audit trail
      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.ENCOUNTER_CREATED,
        resource: 'Encounter',
        resourceId: newEncounter.id,
        details: JSON.stringify({
          encounterNumber,
          encounterType: dto.encounterType,
          department: dto.serviceDepartment,
          patientId: dto.patientId,
        }),
      });

      return newEncounter;
    });
  }

  /**
   * 2. Search and filter patient queue (Outpatient, Emergency, Triage, Doctor consultations).
   */
  async searchQueue(query: EncounterSearchQueryDto, context: TenantContext) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const offset = (page - 1) * limit;

    return await withTenantContext(context.tenantId, async (tx) => {
      const conditions = [eq(encounters.tenantId, context.tenantId)];

      if (query.facilityId) {
        conditions.push(eq(encounters.facilityId, query.facilityId));
      }
      if (query.patientId) {
        conditions.push(eq(encounters.patientId, query.patientId));
      }
      if (query.practitionerId) {
        conditions.push(eq(encounters.practitionerId, query.practitionerId));
      }
      if (query.status) {
        conditions.push(eq(encounters.status, query.status));
      }
      if (query.serviceDepartment) {
        conditions.push(eq(encounters.serviceDepartment, query.serviceDepartment));
      }
      if (query.priority) {
        conditions.push(eq(encounters.priority, query.priority));
      }

      if (query.search) {
        conditions.push(
          or(
            ilike(encounters.encounterNumber, `%${query.search}%`),
            ilike(patients.firstName, `%${query.search}%`),
            ilike(patients.lastName, `%${query.search}%`),
            ilike(patients.mrn, `%${query.search}%`),
          )!,
        );
      }

      const rows = await tx
        .select({
          encounter: encounters,
          patient: {
            id: patients.id,
            mrn: patients.mrn,
            firstName: patients.firstName,
            lastName: patients.lastName,
            gender: patients.gender,
            dateOfBirth: patients.dateOfBirth,
            phoneMasked: patients.phoneMasked,
            identityStatus: patients.identityStatus,
          },
        })
        .from(encounters)
        .innerJoin(patients, eq(encounters.patientId, patients.id))
        .where(and(...conditions))
        .orderBy(desc(encounters.startedAt))
        .limit(limit)
        .offset(offset);

      // Get count
      const countResult = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(encounters)
        .innerJoin(patients, eq(encounters.patientId, patients.id))
        .where(and(...conditions));

      const total = countResult[0]?.count || 0;
      const meta = buildPaginationMeta(total, page, limit);

      const items = rows.map((r) => ({
        ...r.encounter,
        patient: r.patient,
      }));

      return { items, meta };
    });
  }

  /**
   * 3. Retrieve single encounter details including vitals, notes, and patient allergies.
   */
  async getEncounterById(encounterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, encounter.patientId)))
        .limit(1);

      const vitalsList = await tx
        .select()
        .from(triageVitals)
        .where(and(eq(triageVitals.tenantId, context.tenantId), eq(triageVitals.encounterId, encounterId)))
        .orderBy(desc(triageVitals.assessedAt));

      const notesList = await tx
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.tenantId, context.tenantId), eq(clinicalNotes.encounterId, encounterId)))
        .orderBy(desc(clinicalNotes.createdAt));

      const allergiesList = await tx
        .select()
        .from(patientAllergies)
        .where(and(eq(patientAllergies.tenantId, context.tenantId), eq(patientAllergies.patientId, encounter.patientId)))
        .orderBy(desc(patientAllergies.recordedAt));

      return {
        ...encounter,
        patient,
        vitals: vitalsList,
        notes: notesList,
        allergies: allergiesList,
      };
    });
  }

  /**
   * 4. Lifecycle state transitions (PLANNED -> ARRIVED -> TRIAGED -> IN_PROGRESS -> ON_HOLD -> COMPLETED).
   */
  async updateEncounterStatus(
    encounterId: string,
    dto: UpdateEncounterStatusDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      // Assert transition validity
      WorkflowStateMachine.assertValidTransition(
        WorkflowEntityType.ENCOUNTER,
        encounter.status,
        dto.status,
      );

      const nextVersion = encounter.version + 1;
      const [updated] = await tx
        .update(encounters)
        .set({
          status: dto.status,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .returning();

      // Log transition
      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.ENCOUNTER,
        entityId: encounterId,
        fromState: encounter.status,
        toState: dto.status,
        version: nextVersion,
        trigger: WorkflowTrigger.SUBMIT,
        actorUserId: context.userId,
        reason: dto.reason || `Status updated to ${dto.status}`,
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.ENCOUNTER_STATUS_CHANGED,
        resource: 'Encounter',
        resourceId: encounterId,
        details: JSON.stringify({ from: encounter.status, to: dto.status, reason: dto.reason }),
      });

      return updated;
    });
  }

  /**
   * 5. Encounter closure with validation that clinical notes are not left as dangling drafts.
   */
  async closeEncounter(encounterId: string, dto: CloseEncounterDto, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      if (encounter.status === EncounterStatus.COMPLETED) {
        throw new ConflictException(`Encounter ${encounter.encounterNumber} is already closed.`);
      }

      WorkflowStateMachine.assertValidTransition(
        WorkflowEntityType.ENCOUNTER,
        encounter.status,
        EncounterStatus.COMPLETED,
      );

      // Verify that no unfinalized DRAFT notes exist for this encounter
      const unfinalizedNotes = await tx
        .select()
        .from(clinicalNotes)
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.encounterId, encounterId),
            eq(clinicalNotes.status, ClinicalNoteStatus.DRAFT),
          ),
        );

      if (unfinalizedNotes.length > 0) {
        throw new UnprocessableEntityException(
          `Cannot close encounter: ${unfinalizedNotes.length} unfinalized draft clinical note(s) must be finalized or cancelled first.`,
        );
      }

      const nextVersion = encounter.version + 1;
      const [closed] = await tx
        .update(encounters)
        .set({
          status: EncounterStatus.COMPLETED,
          endedAt: new Date(),
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .returning();

      const summary = dto.clinicalSummary || dto.closureSummary || 'Encounter completed and closed';

      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.ENCOUNTER,
        entityId: encounterId,
        fromState: encounter.status,
        toState: EncounterStatus.COMPLETED,
        version: nextVersion,
        trigger: WorkflowTrigger.SUBMIT,
        actorUserId: context.userId,
        reason: summary,
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.ENCOUNTER_CLOSED,
        resource: 'Encounter',
        resourceId: encounterId,
        details: JSON.stringify({ summary, disposition: dto.disposition }),
      });

      return closed;
    });
  }

  /**
   * 6. Reopen a closed encounter with mandatory justification.
   */
  async reopenEncounter(encounterId: string, dto: ReopenEncounterDto, context: TenantContext) {
    const reason = dto.reopeningReason || dto.reason;
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('A clinical or administrative reopening reason of at least 10 characters is required.');
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      if (encounter.status !== EncounterStatus.COMPLETED) {
        throw new BadRequestException(`Only completed/closed encounters can be reopened (Current status: ${encounter.status}).`);
      }

      WorkflowStateMachine.assertValidTransition(
        WorkflowEntityType.ENCOUNTER,
        encounter.status,
        EncounterStatus.REOPENED,
      );

      const nextVersion = encounter.version + 1;
      const [reopened] = await tx
        .update(encounters)
        .set({
          status: EncounterStatus.REOPENED,
          reopenedAt: new Date(),
          reopenedById: context.userId,
          reopeningReason: reason,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .returning();

      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.ENCOUNTER,
        entityId: encounterId,
        fromState: EncounterStatus.COMPLETED,
        toState: EncounterStatus.REOPENED,
        version: nextVersion,
        trigger: WorkflowTrigger.REVISE,
        actorUserId: context.userId,
        reason: reason,
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.ENCOUNTER_REOPENED,
        resource: 'Encounter',
        resourceId: encounterId,
        details: JSON.stringify({ reason }),
      });

      return reopened;
    });
  }

  /**
   * 7. Triage vital signs recording with explicit units and automatic BMI computation.
   */
  async recordTriageVitals(
    encounterId: string,
    dto: RecordTriageVitalsDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      // Auto-compute BMI if weight and height are supplied and BMI is not explicitly sent
      const computedBmi =
        dto.bmi != null
          ? dto.bmi
          : calculateBmi(dto.weightKg, dto.heightCm);

      const [vitals] = await tx
        .insert(triageVitals)
        .values({
          tenantId: context.tenantId,
          facilityId: encounter.facilityId,
          encounterId,
          patientId: encounter.patientId,
          assessedById: context.userId,
          systolicBp: dto.systolicBp || null,
          diastolicBp: dto.diastolicBp || null,
          heartRate: dto.heartRate || null,
          respiratoryRate: dto.respiratoryRate || null,
          temperature: dto.temperature != null ? String(dto.temperature) : null,
          oxygenSaturation: dto.oxygenSaturation || null,
          weightKg: dto.weightKg != null ? String(dto.weightKg) : null,
          heightCm: dto.heightCm != null ? String(dto.heightCm) : null,
          bmi: computedBmi != null ? String(computedBmi) : null,
          bloodGlucose: dto.bloodGlucose != null ? String(dto.bloodGlucose) : null,
          avpuLevel: dto.avpuLevel || AvpuLevel.ALERT,
          triagePriority: dto.triagePriority || TriagePriority.SEMI_URGENT,
          triageNotes: dto.triageNotes || null,
          assessedAt: new Date(),
        })
        .returning();

      if (!vitals) {
        throw new BadRequestException('Failed to record triage vitals.');
      }

      // If encounter status is ARRIVED, advance to TRIAGED
      if (encounter.status === EncounterStatus.ARRIVED) {
        await tx
          .update(encounters)
          .set({
            status: EncounterStatus.TRIAGED,
            priority: dto.triagePriority || encounter.priority,
            version: encounter.version + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)));

        await tx.insert(workflowStateTransitions).values({
          tenantId: context.tenantId,
          entityType: WorkflowEntityType.ENCOUNTER,
          entityId: encounterId,
          fromState: EncounterStatus.ARRIVED,
          toState: EncounterStatus.TRIAGED,
          version: encounter.version + 1,
          trigger: WorkflowTrigger.SUBMIT,
          actorUserId: context.userId,
          reason: 'Triage vitals recorded',
        });
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.TRIAGE_VITALS_RECORDED,
        resource: 'TriageVitals',
        resourceId: vitals.id,
        details: JSON.stringify({
          encounterId,
          bp: dto.systolicBp && dto.diastolicBp ? `${dto.systolicBp}/${dto.diastolicBp} mmHg` : undefined,
          hr: dto.heartRate ? `${dto.heartRate} bpm` : undefined,
          temp: dto.temperature ? `${dto.temperature} °C` : undefined,
          spo2: dto.oxygenSaturation ? `${dto.oxygenSaturation} %` : undefined,
          priority: dto.triagePriority,
        }),
      });

      return vitals;
    });
  }

  /**
   * 8. Retrieve triage vitals for an encounter.
   */
  async getEncounterVitals(encounterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(triageVitals)
        .where(and(eq(triageVitals.tenantId, context.tenantId), eq(triageVitals.encounterId, encounterId)))
        .orderBy(desc(triageVitals.assessedAt));
    });
  }

  /**
   * 9. Create draft clinical note for outpatient consultation.
   */
  async createClinicalNote(
    encounterId: string,
    dto: CreateClinicalNoteDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [encounter] = await tx
        .select()
        .from(encounters)
        .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)))
        .limit(1);

      if (!encounter) {
        throw new NotFoundException(`Encounter with ID ${encounterId} not found.`);
      }

      if (encounter.status === EncounterStatus.COMPLETED || encounter.status === EncounterStatus.CANCELLED) {
        throw new UnprocessableEntityException(`Cannot create clinical note on a ${encounter.status.toLowerCase()} encounter.`);
      }

      const [newNote] = await tx
        .insert(clinicalNotes)
        .values({
          tenantId: context.tenantId,
          facilityId: encounter.facilityId,
          encounterId,
          patientId: encounter.patientId,
          authorId: context.userId,
          noteType: dto.noteType || ClinicalNoteType.CONSULTATION_NOTE,
          status: ClinicalNoteStatus.DRAFT,
          chiefComplaint: dto.chiefComplaint,
          historyOfPresentIllness: dto.historyOfPresentIllness || null,
          pastMedicalHistory: dto.pastMedicalHistory || null,
          reviewOfSystems: dto.reviewOfSystems || null,
          physicalExamination: dto.physicalExamination || null,
          assessment: dto.assessment,
          plan: dto.plan,
          effectiveTime: dto.effectiveTime ? new Date(dto.effectiveTime) : new Date(),
          entryTime: new Date(),
          version: 1,
        })
        .returning();

      if (!newNote) {
        throw new BadRequestException('Failed to create clinical note.');
      }

      // If encounter was TRIAGED or ARRIVED, transition to IN_PROGRESS
      if (encounter.status === EncounterStatus.TRIAGED || encounter.status === EncounterStatus.ARRIVED) {
        await tx
          .update(encounters)
          .set({
            status: EncounterStatus.IN_PROGRESS,
            practitionerId: context.userId,
            version: encounter.version + 1,
            updatedAt: new Date(),
          })
          .where(and(eq(encounters.tenantId, context.tenantId), eq(encounters.id, encounterId)));

        await tx.insert(workflowStateTransitions).values({
          tenantId: context.tenantId,
          entityType: WorkflowEntityType.ENCOUNTER,
          entityId: encounterId,
          fromState: encounter.status,
          toState: EncounterStatus.IN_PROGRESS,
          version: encounter.version + 1,
          trigger: WorkflowTrigger.SUBMIT,
          actorUserId: context.userId,
          reason: 'Doctor consultation started',
        });
      }

      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.CLINICAL_NOTE,
        entityId: newNote.id,
        fromState: 'NONE',
        toState: ClinicalNoteStatus.DRAFT,
        version: 1,
        trigger: WorkflowTrigger.CREATE,
        actorUserId: context.userId,
        reason: 'Clinical consultation note drafted',
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_NOTE_CREATED,
        resource: 'ClinicalNote',
        resourceId: newNote.id,
        details: JSON.stringify({ encounterId, noteType: newNote.noteType, status: newNote.status }),
      });

      return newNote;
    });
  }

  /**
   * 10. Update a clinical note (Allowed ONLY while in DRAFT status).
   * PREVENTS UNAUTHORIZED ALTERATION OF FINALIZED CLINICAL RECORDS.
   */
  async updateClinicalNote(
    encounterId: string,
    noteId: string,
    dto: UpdateClinicalNoteDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [note] = await tx
        .select()
        .from(clinicalNotes)
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.encounterId, encounterId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .limit(1);

      if (!note) {
        throw new NotFoundException(`Clinical note with ID ${noteId} not found.`);
      }

      // CRITICAL STATUTORY SAFEGUARD: Cannot directly alter a finalized or amended note
      if (note.status !== ClinicalNoteStatus.DRAFT) {
        throw new UnprocessableEntityException(
          `Finalized or amended clinical notes cannot be directly updated or modified (Current status: ${note.status}). Use the formal amendment workflow.`,
        );
      }

      const [updatedNote] = await tx
        .update(clinicalNotes)
        .set({
          chiefComplaint: dto.chiefComplaint ?? note.chiefComplaint,
          historyOfPresentIllness: dto.historyOfPresentIllness ?? note.historyOfPresentIllness,
          pastMedicalHistory: dto.pastMedicalHistory ?? note.pastMedicalHistory,
          reviewOfSystems: dto.reviewOfSystems ?? note.reviewOfSystems,
          physicalExamination: dto.physicalExamination ?? note.physicalExamination,
          assessment: dto.assessment ?? note.assessment,
          plan: dto.plan ?? note.plan,
          version: note.version + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .returning();

      return updatedNote;
    });
  }

  /**
   * 11. Finalize and sign clinical note.
   */
  async finalizeClinicalNote(
    encounterId: string,
    noteId: string,
    dto: FinalizeClinicalNoteDto,
    context: TenantContext,
  ) {
    if (!dto.signatureConfirmation) {
      throw new BadRequestException('Signature confirmation is required to finalize and lock the clinical note.');
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      const [note] = await tx
        .select()
        .from(clinicalNotes)
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.encounterId, encounterId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .limit(1);

      if (!note) {
        throw new NotFoundException(`Clinical note with ID ${noteId} not found.`);
      }

      if (note.status !== ClinicalNoteStatus.DRAFT) {
        throw new ConflictException(`Clinical note is already in ${note.status} status.`);
      }

      WorkflowStateMachine.assertValidTransition(
        WorkflowEntityType.CLINICAL_NOTE,
        ClinicalNoteStatus.DRAFT,
        ClinicalNoteStatus.FINALIZED,
      );

      const nextVersion = note.version + 1;
      const [finalized] = await tx
        .update(clinicalNotes)
        .set({
          status: ClinicalNoteStatus.FINALIZED,
          finalizedAt: new Date(),
          finalizedById: context.userId,
          digitalSignature: dto.digitalSignature,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .returning();

      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.CLINICAL_NOTE,
        entityId: noteId,
        fromState: ClinicalNoteStatus.DRAFT,
        toState: ClinicalNoteStatus.FINALIZED,
        version: nextVersion,
        trigger: WorkflowTrigger.AUTHORIZE,
        actorUserId: context.userId,
        reason: 'Practitioner signed and finalized clinical note',
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_NOTE_FINALIZED,
        resource: 'ClinicalNote',
        resourceId: noteId,
        details: JSON.stringify({ encounterId, signedBy: context.userId }),
      });

      return finalized;
    });
  }

  /**
   * 12. Amend a finalized clinical note with addendum and reason provenance.
   */
  async amendClinicalNote(
    encounterId: string,
    noteId: string,
    dto: AmendClinicalNoteDto,
    context: TenantContext,
  ) {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('A clinical reason of at least 10 characters is required to amend a finalized record.');
    }

    return await withTenantContext(context.tenantId, async (tx) => {
      const [note] = await tx
        .select()
        .from(clinicalNotes)
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.encounterId, encounterId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .limit(1);

      if (!note) {
        throw new NotFoundException(`Clinical note with ID ${noteId} not found.`);
      }

      if (note.status === ClinicalNoteStatus.DRAFT) {
        throw new BadRequestException('Draft notes can be edited directly without an amendment addendum.');
      }

      // Record immutable amendment entry
      const [amendment] = await tx
        .insert(clinicalNoteAmendments)
        .values({
          tenantId: context.tenantId,
          noteId,
          amendedById: context.userId,
          reason: dto.reason,
          amendmentText: dto.amendmentText,
          amendedAt: new Date(),
        })
        .returning();

      if (!amendment) {
        throw new BadRequestException('Failed to record note amendment.');
      }

      // Transition note state to AMENDED
      const nextVersion = note.version + 1;
      const [updatedNote] = await tx
        .update(clinicalNotes)
        .set({
          status: ClinicalNoteStatus.AMENDED,
          version: nextVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clinicalNotes.tenantId, context.tenantId),
            eq(clinicalNotes.id, noteId),
          ),
        )
        .returning();

      await tx.insert(workflowStateTransitions).values({
        tenantId: context.tenantId,
        entityType: WorkflowEntityType.CLINICAL_NOTE,
        entityId: noteId,
        fromState: note.status,
        toState: ClinicalNoteStatus.AMENDED,
        version: nextVersion,
        trigger: WorkflowTrigger.REVISE,
        actorUserId: context.userId,
        reason: dto.reason,
      });

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.CLINICAL_NOTE_AMENDED,
        resource: 'ClinicalNote',
        resourceId: noteId,
        details: JSON.stringify({ amendmentId: amendment.id, reason: dto.reason }),
      });

      return {
        note: updatedNote,
        amendment: {
          ...amendment,
          clinicalNoteId: amendment.noteId,
        },
      };
    });
  }

  /**
   * 13. Get all notes for an encounter with amendment history.
   */
  async getEncounterNotes(encounterId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const notesList = await tx
        .select()
        .from(clinicalNotes)
        .where(and(eq(clinicalNotes.tenantId, context.tenantId), eq(clinicalNotes.encounterId, encounterId)))
        .orderBy(desc(clinicalNotes.createdAt));

      if (notesList.length === 0) return [];

      const noteIds = notesList.map((n) => n.id);
      const amendmentsList = await tx
        .select()
        .from(clinicalNoteAmendments)
        .where(and(eq(clinicalNoteAmendments.tenantId, context.tenantId), inArray(clinicalNoteAmendments.noteId, noteIds)))
        .orderBy(desc(clinicalNoteAmendments.amendedAt));

      return notesList.map((note) => ({
        ...note,
        amendments: amendmentsList.filter((a) => a.noteId === note.id),
      }));
    });
  }

  /**
   * 14. Record patient allergy.
   */
  async recordAllergy(patientId: string, dto: RecordAllergyDto, context: TenantContext) {
    if (!patientId) {
      throw new BadRequestException('Patient ID is required.');
    }
    return await withTenantContext(context.tenantId, async (tx) => {
      const [patient] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${patientId} not found.`);
      }

      const [allergy] = await tx
        .insert(patientAllergies)
        .values({
          tenantId: context.tenantId,
          patientId,
          encounterId: dto.encounterId || null,
          recordedById: context.userId,
          allergen: dto.allergen,
          allergenType: dto.allergenType || AllergenType.MEDICATION,
          severity: dto.severity || AllergySeverity.MODERATE,
          reaction: dto.reaction || null,
          clinicalStatus: dto.clinicalStatus || AllergyClinicalStatus.ACTIVE,
          verificationStatus: dto.verificationStatus || AllergyVerificationStatus.CONFIRMED,
          onsetAgeYears: dto.onsetAgeYears || null,
          notes: dto.notes || null,
          recordedAt: new Date(),
        })
        .returning();

      if (!allergy) {
        throw new BadRequestException('Failed to record allergy.');
      }

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PATIENT_ALLERGY_RECORDED,
        resource: 'PatientAllergy',
        resourceId: allergy.id,
        details: JSON.stringify({ patientId, allergen: dto.allergen, severity: dto.severity }),
      });

      return allergy;
    });
  }

  /**
   * 15. Retrieve patient allergies.
   */
  async getPatientAllergies(patientId: string, context: TenantContext) {
    return await withTenantContext(context.tenantId, async (tx) => {
      return await tx
        .select()
        .from(patientAllergies)
        .where(and(eq(patientAllergies.tenantId, context.tenantId), eq(patientAllergies.patientId, patientId)))
        .orderBy(desc(patientAllergies.recordedAt));
    });
  }

  /**
   * 16. Update an existing allergy record.
   */
  async updateAllergy(
    patientId: string,
    allergyId: string,
    dto: UpdateAllergyDto,
    context: TenantContext,
  ) {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [allergy] = await tx
        .select()
        .from(patientAllergies)
        .where(
          and(
            eq(patientAllergies.tenantId, context.tenantId),
            eq(patientAllergies.patientId, patientId),
            eq(patientAllergies.id, allergyId),
          ),
        )
        .limit(1);

      if (!allergy) {
        throw new NotFoundException(`Allergy record with ID ${allergyId} not found.`);
      }

      const [updated] = await tx
        .update(patientAllergies)
        .set({
          clinicalStatus: dto.clinicalStatus ?? allergy.clinicalStatus,
          severity: dto.severity ?? allergy.severity,
          reaction: dto.reaction ?? allergy.reaction,
          notes: dto.notes ?? allergy.notes,
          updatedAt: new Date(),
        })
        .where(and(eq(patientAllergies.tenantId, context.tenantId), eq(patientAllergies.id, allergyId)))
        .returning();

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.PATIENT_ALLERGY_UPDATED,
        resource: 'PatientAllergy',
        resourceId: allergyId,
        details: JSON.stringify({ patientId, allergen: allergy.allergen, newStatus: dto.clinicalStatus }),
      });

      return updated;
    });
  }
}
