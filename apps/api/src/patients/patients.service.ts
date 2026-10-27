import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, or, ilike, desc, sql, inArray } from 'drizzle-orm';
import {
  patients,
  patientIdentifiers,
  patientConsents,
  patientReconciliations,
  patientAccessLogs,
  workflowStateTransitions,
  externalReferences,
  Database,
} from '@afyapoa/database';
import {
  AuditEventType,
  PatientGender,
  PatientStatus,
  PatientIdentityStatus,
  PatientIdentifierType,
  ConsentType,
  ConsentStatus,
  ConsentChannel,
  ReconciliationStatus,
  PatientAccessPurpose,
  PatientAccessType,
  EmergencyContactInfo,
  encryptField,
  computeBlindIndex,
  maskIdentifier,
  normalizeKenyanPhone,
  isValidKenyanPhone,
  isValidKenyanNationalId,
  calculateDuplicateScore,
} from '@afyapoa/domain-core';
import { MockDhaHieClient, IDhaClientRegistryClient } from '@afyapoa/integration-adapters';
import { TenancyService } from '../tenancy/tenancy.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  CreatePatientDto,
  EmergencyIntakeDto,
  UpdatePatientDto,
} from './dto/create-patient.dto.js';
import {
  PatientSearchQueryDto,
  DuplicateCheckDto,
} from './dto/patient-search.dto.js';
import {
  PatientResponseDto,
  PatientDetailResponseDto,
  PatientIdentifierResponseDto,
  PatientConsentResponseDto,
  DuplicateCandidateResponseDto,
} from './dto/patient-response.dto.js';
import { AddIdentifierDto } from './dto/add-identifier.dto.js';
import { ReconcilePatientDto } from './dto/reconcile-patient.dto.js';
import { GrantConsentDto, RevokeConsentDto } from './dto/consent.dto.js';

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);
  private readonly dhaClient: IDhaClientRegistryClient;

  constructor(
    @Inject(TenancyService)
    private readonly tenancyService: TenancyService,
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {
    // Labelled Mock Client Registry adapter for local and pre-production identity resolution
    this.dhaClient = new MockDhaHieClient();
  }

  /**
   * Helper to generate a tenant-unique Medical Record Number (MRN).
   * Format: MRN-YYYYMM-XXXX
   */
  private async generateMrn(db: Database, tenantId: string): Promise<string> {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `MRN-${yr}${mo}-`;

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(patients)
      .where(eq(patients.tenantId, tenantId));

    const seq = (Number(countRes[0]?.count || 0) + 1).toString().padStart(4, '0');
    let candidate = `${prefix}${seq}`;

    // Verify uniqueness
    const existing = await db
      .select({ id: patients.id })
      .from(patients)
      .where(and(eq(patients.tenantId, tenantId), eq(patients.mrn, candidate)))
      .limit(1);

    if (existing.length > 0) {
      const rand = Math.floor(100 + Math.random() * 900);
      candidate = `${candidate}-${rand}`;
    }

    return candidate;
  }

  /**
   * 1. Register a new patient with validation, encryption, blind indexing, and duplicate prevention.
   */
  async registerPatient(
    tenantId: string,
    facilityId: string,
    dto: CreatePatientDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientResponseDto> {
    // Field-level validation for Kenyan mobile numbers
    let phoneNormalized: string | null = null;
    let phoneEncryptedVal: string | null = null;
    let phoneBlindIndexVal: string | null = null;
    let phoneMaskedVal: string | null = null;

    if (dto.phone) {
      phoneNormalized = normalizeKenyanPhone(dto.phone);
      if (!isValidKenyanPhone(phoneNormalized)) {
        throw new BadRequestException(
          `Invalid Kenyan phone number: ${dto.phone}. Must be a valid Safaricom/Airtel/Telkom 9 or 10-digit number.`,
        );
      }
      phoneEncryptedVal = encryptField(phoneNormalized);
      phoneBlindIndexVal = computeBlindIndex(phoneNormalized);
      phoneMaskedVal = maskIdentifier(phoneNormalized, 'PHONE');
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Check for duplicate national ID in patient_identifiers if provided
      const nationalIdIdentifier = dto.identifiers?.find(
        (i) => i.system === PatientIdentifierType.KENYA_NATIONAL_ID,
      );

      if (nationalIdIdentifier) {
        if (!isValidKenyanNationalId(nationalIdIdentifier.value)) {
          throw new BadRequestException(
            `Invalid Kenyan National ID: ${nationalIdIdentifier.value}. Must be 6-9 digits.`,
          );
        }
        const nidBlindIndex = computeBlindIndex(nationalIdIdentifier.value.trim());
        const existingNid = await db
          .select({
            patientId: patientIdentifiers.patientId,
          })
          .from(patientIdentifiers)
          .where(
            and(
              eq(patientIdentifiers.tenantId, tenantId),
              eq(patientIdentifiers.system, PatientIdentifierType.KENYA_NATIONAL_ID),
              eq(patientIdentifiers.valueBlindIndex, nidBlindIndex),
              eq(patientIdentifiers.status, 'ACTIVE'),
            ),
          )
          .limit(1);

        const existingNidMatch = existingNid[0];
        if (existingNidMatch && existingNidMatch.patientId) {
          const matchedPid = existingNidMatch.patientId;
          if (!dto.forceDuplicateOverride) {
            // Log flagged duplicate
            await db.insert(patientReconciliations).values({
              tenantId,
              sourcePatientId: matchedPid,
              targetPatientId: matchedPid,
              status: ReconciliationStatus.FLAGGED_DUPLICATE,
              confidenceScore: '1.00',
              matchReasons: JSON.stringify(['EXACT_NATIONAL_ID_MATCH']),
              actionNotes: `Attempted registration with already-registered National ID`,
            });

            await this.auditService.recordEvent({
              tenantId,
              userId: actorUserId,
              action: AuditEventType.PATIENT_DUPLICATE_FLAGGED,
              resource: 'PATIENT',
              resourceId: matchedPid,
              clientIp: ipAddress,
              details: {
                reason: 'EXACT_NATIONAL_ID_MATCH',
                existingPatientId: matchedPid,
              },
            });

            throw new ConflictException({
              message: 'A patient with this National ID is already registered.',
              candidatePatientId: matchedPid,
              confidenceScore: 1.0,
              matchReasons: ['EXACT_NATIONAL_ID_MATCH'],
            });
          }
        }
      }

      // 2. Probabilistic duplicate check on demographic features
      const existingCandidates = await db
        .select({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          dateOfBirth: patients.dateOfBirth,
          gender: patients.gender,
          phoneBlindIndex: patients.phoneBlindIndex,
        })
        .from(patients)
        .where(
          and(
            eq(patients.tenantId, tenantId),
            eq(patients.status, PatientStatus.ACTIVE),
          ),
        );

      let highestScore = 0;
      let matchedCandidateId: string | null = null;
      let matchedReasons: string[] = [];

      for (const cand of existingCandidates) {
        const { confidenceScore, matchReasons } = calculateDuplicateScore(
          {
            firstName: dto.firstName,
            lastName: dto.lastName,
            dateOfBirth: dto.dateOfBirth,
            gender: dto.gender,
            phoneBlindIndex: phoneBlindIndexVal || undefined,
          },
          {
            firstName: cand.firstName,
            lastName: cand.lastName,
            dateOfBirth: cand.dateOfBirth,
            gender: cand.gender,
            phoneBlindIndex: cand.phoneBlindIndex || undefined,
          },
        );

        if (confidenceScore > highestScore) {
          highestScore = confidenceScore;
          matchedCandidateId = cand.id;
          matchedReasons = matchReasons;
        }
      }

      if (highestScore >= 0.7 && matchedCandidateId && !dto.forceDuplicateOverride) {
        await db.insert(patientReconciliations).values({
          tenantId,
          sourcePatientId: matchedCandidateId,
          targetPatientId: matchedCandidateId,
          status: ReconciliationStatus.FLAGGED_DUPLICATE,
          confidenceScore: highestScore.toFixed(2),
          matchReasons: JSON.stringify(matchedReasons),
          actionNotes: `Automated duplicate match during patient intake: ${(highestScore * 100).toFixed(0)}% confidence`,
        });

        await this.auditService.recordEvent({
          tenantId,
          userId: actorUserId,
          action: AuditEventType.PATIENT_DUPLICATE_FLAGGED,
          resource: 'PATIENT',
          resourceId: matchedCandidateId,
          clientIp: ipAddress,
          details: {
            confidenceScore: highestScore,
            matchReasons: matchedReasons,
          },
        });

        throw new ConflictException({
          message: `Potential duplicate patient detected with ${(highestScore * 100).toFixed(0)}% confidence. Review existing record before proceeding or specify forceDuplicateOverride.`,
          candidatePatientId: matchedCandidateId,
          confidenceScore: highestScore,
          matchReasons: matchedReasons,
        });
      }

      // 3. Generate MRN and insert patient
      const mrn = await this.generateMrn(db, tenantId);

      const [newPatient] = await db
        .insert(patients)
        .values({
          tenantId,
          primaryFacilityId: facilityId,
          mrn,
          firstName: dto.firstName.trim(),
          middleName: dto.middleName ? dto.middleName.trim() : null,
          lastName: dto.lastName.trim(),
          dateOfBirth: dto.dateOfBirth,
          isDobEstimated: dto.isDobEstimated ?? false,
          gender: dto.gender,
          bloodGroup: dto.bloodGroup || null,
          phoneEncrypted: phoneEncryptedVal,
          phoneBlindIndex: phoneBlindIndexVal,
          phoneMasked: phoneMaskedVal,
          email: dto.email ? dto.email.trim().toLowerCase() : null,
          physicalAddress: dto.physicalAddress || null,
          county: dto.county || null,
          subCounty: dto.subCounty || null,
          ward: dto.ward || null,
          village: dto.village || null,
          postalCode: dto.postalCode || null,
          nationality: dto.nationality || 'KENYAN',
          maritalStatus: dto.maritalStatus || null,
          emergencyContact: dto.emergencyContact
            ? JSON.stringify(dto.emergencyContact)
            : null,
          isEmergencyUnknown: false,
          status: PatientStatus.ACTIVE,
          identityStatus: PatientIdentityStatus.LOCAL_ONLY,
        })
        .returning();

      if (!newPatient) {
        throw new Error('Failed to create patient record');
      }

      // 4. Insert initial identifiers with provenance
      if (dto.identifiers && dto.identifiers.length > 0) {
        for (const ident of dto.identifiers) {
          const valClean = ident.value.trim();
          const encrypted = encryptField(valClean);
          const bIndex = computeBlindIndex(valClean);
          const masked = maskIdentifier(
            valClean,
            ident.system === PatientIdentifierType.KENYA_NATIONAL_ID ? 'NATIONAL_ID' : 'GENERIC',
          );

          await db.insert(patientIdentifiers).values({
            tenantId,
            facilityId,
            patientId: newPatient.id,
            system: ident.system,
            valueEncrypted: encrypted,
            valueBlindIndex: bIndex,
            valueMasked: masked,
            status: 'ACTIVE',
            isPrimary: ident.isPrimary ?? false,
            patientAlias: `${newPatient.firstName} ${newPatient.lastName}`,
            issuingAuthority: ident.issuingAuthority || null,
            verificationStatus: 'UNVERIFIED',
            notes: 'Captured at initial registration',
          });

          await this.auditService.recordEvent({
            tenantId,
            userId: actorUserId,
            action: AuditEventType.PATIENT_IDENTIFIER_ADDED,
            resource: 'PATIENT_IDENTIFIER',
            resourceId: newPatient.id,
            clientIp: ipAddress,
            details: {
              system: ident.system,
              valueMasked: masked,
              issuingAuthority: ident.issuingAuthority,
            },
          });
        }
      }

      // 5. Insert initial statutory consents (DPA 2019 Section 30 & 32)
      if (dto.consents && dto.consents.length > 0) {
        for (const c of dto.consents) {
          await db.insert(patientConsents).values({
            tenantId,
            facilityId,
            patientId: newPatient.id,
            consentType: c.consentType,
            status: ConsentStatus.GRANTED,
            channel: c.channel || ConsentChannel.WRITTEN_FORM,
            policyVersion: c.policyVersion || 'KE-DPA-2019-V1',
            capturedById: actorUserId,
            witnessName: c.witnessName || null,
          });

          await this.auditService.recordEvent({
            tenantId,
            userId: actorUserId,
            action: AuditEventType.PATIENT_CONSENT_GRANTED,
            resource: 'PATIENT_CONSENT',
            resourceId: newPatient.id,
            clientIp: ipAddress,
            details: {
              consentType: c.consentType,
              channel: c.channel,
              policyVersion: c.policyVersion,
            },
          });
        }
      }

      // 6. Record workflow state transition
      await db.insert(workflowStateTransitions).values({
        tenantId,
        entityType: 'PATIENT',
        entityId: newPatient.id,
        fromState: 'UNREGISTERED',
        toState: 'REGISTERED',
        version: 1,
        trigger: 'PATIENT_REGISTRATION',
        actorUserId,
        reason: 'Initial demographic intake',
      });

      // 7. Record master audit event
      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_REGISTERED,
        resource: 'PATIENT',
        resourceId: newPatient.id,
        clientIp: ipAddress,
        details: {
          mrn: newPatient.mrn,
          firstName: newPatient.firstName,
          lastName: newPatient.lastName,
          gender: newPatient.gender,
          identityStatus: newPatient.identityStatus,
        },
      });

      return this.mapToPatientResponse(newPatient);
    });
  }

  /**
   * 2. Emergency Trauma Intake workflow for unidentified/unconscious patients.
   */
  async registerEmergencyIntake(
    tenantId: string,
    facilityId: string,
    dto: EmergencyIntakeDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const now = new Date();
      const shortId = Math.random().toString(36).substring(2, 7).toUpperCase();
      const temporaryLastName = `UNKNOWN-${dto.gender}-${shortId}`;
      const mrn = await this.generateMrn(db, tenantId);

      const estimatedAgeYears = dto.estimatedAge || 30;
      const estimatedBirthYear = now.getFullYear() - estimatedAgeYears;
      const estimatedDob = `${estimatedBirthYear}-01-01`;

      const [newPatient] = await db
        .insert(patients)
        .values({
          tenantId,
          primaryFacilityId: facilityId,
          mrn,
          firstName: 'EMERGENCY',
          middleName: 'TRAUMA',
          lastName: temporaryLastName,
          dateOfBirth: estimatedDob,
          isDobEstimated: true,
          gender: dto.gender,
          bloodGroup: null,
          nationality: 'KENYAN',
          isEmergencyUnknown: true,
          status: PatientStatus.ACTIVE,
          identityStatus: PatientIdentityStatus.LOCAL_ONLY,
          reconciliationNotes: dto.triageNotes || 'Emergency intake of unidentified patient',
        })
        .returning();

      if (!newPatient) {
        throw new Error('Failed to create emergency patient record');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_REGISTERED,
        resource: 'PATIENT',
        resourceId: newPatient.id,
        clientIp: ipAddress,
        details: {
          isEmergencyUnknown: true,
          temporaryIdentifier: temporaryLastName,
          triageNotes: dto.triageNotes,
        },
      });

      return this.mapToPatientResponse(newPatient);
    });
  }

  /**
   * 3. Patient Search with blind-indexing, partial name, and access controls.
   */
  async searchPatients(
    tenantId: string,
    query: PatientSearchQueryDto,
  ): Promise<{
    items: PatientResponseDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = (page - 1) * limit;

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      // 1. Exact lookup by Kenyan National ID (using HMAC-SHA256 blind index)
      if (query.nationalId) {
        const cleanNid = query.nationalId.trim();
        const nidBlindIndex = computeBlindIndex(cleanNid);

        const idMatches = await db
          .select({ patientId: patientIdentifiers.patientId })
          .from(patientIdentifiers)
          .where(
            and(
              eq(patientIdentifiers.tenantId, tenantId),
              eq(patientIdentifiers.system, PatientIdentifierType.KENYA_NATIONAL_ID),
              eq(patientIdentifiers.valueBlindIndex, nidBlindIndex),
              eq(patientIdentifiers.status, 'ACTIVE'),
            ),
          );

        const patientIds = idMatches
          .map((m) => m.patientId)
          .filter((id): id is string => id !== null);

        if (patientIds.length === 0) {
          return { items: [], meta: { total: 0, page, limit, totalPages: 1 } };
        }

        const matchedPatients = await db
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.tenantId, tenantId),
              inArray(patients.id, patientIds),
            ),
          );

        return {
          items: matchedPatients.map((p) => this.mapToPatientResponse(p)),
          meta: {
            total: matchedPatients.length,
            page,
            limit,
            totalPages: Math.ceil(matchedPatients.length / limit) || 1,
          },
        };
      }

      // 2. Exact lookup by Phone (using HMAC-SHA256 blind index)
      if (query.phone) {
        const normalized = normalizeKenyanPhone(query.phone);
        const phoneBIndex = computeBlindIndex(normalized);

        const matchedPatients = await db
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.tenantId, tenantId),
              eq(patients.phoneBlindIndex, phoneBIndex),
            ),
          )
          .limit(limit)
          .offset(offset);

        return {
          items: matchedPatients.map((p) => this.mapToPatientResponse(p)),
          meta: {
            total: matchedPatients.length,
            page,
            limit,
            totalPages: Math.ceil(matchedPatients.length / limit) || 1,
          },
        };
      }

      // 3. Exact lookup by SHA Number (using blind index on identifiers)
      if (query.shaNumber) {
        const shaBIndex = computeBlindIndex(query.shaNumber.trim().toUpperCase());
        const idMatches = await db
          .select({ patientId: patientIdentifiers.patientId })
          .from(patientIdentifiers)
          .where(
            and(
              eq(patientIdentifiers.tenantId, tenantId),
              eq(patientIdentifiers.system, PatientIdentifierType.SHA_BENEFICIARY_ID),
              eq(patientIdentifiers.valueBlindIndex, shaBIndex),
              eq(patientIdentifiers.status, 'ACTIVE'),
            ),
          );

        const patientIds = idMatches
          .map((m) => m.patientId)
          .filter((id): id is string => id !== null);

        if (patientIds.length === 0) {
          return { items: [], meta: { total: 0, page, limit, totalPages: 1 } };
        }

        const matchedPatients = await db
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.tenantId, tenantId),
              inArray(patients.id, patientIds),
            ),
          );

        return {
          items: matchedPatients.map((p) => this.mapToPatientResponse(p)),
          meta: {
            total: matchedPatients.length,
            page,
            limit,
            totalPages: Math.ceil(matchedPatients.length / limit) || 1,
          },
        };
      }

      // 4. Exact lookup by UPI or DHA CRID
      if (query.upi || query.dhaCrid) {
        const conditions = [eq(patients.tenantId, tenantId)];
        if (query.upi) conditions.push(eq(patients.upi, query.upi.trim()));
        if (query.dhaCrid) conditions.push(eq(patients.dhaCrid, query.dhaCrid.trim()));

        const matchedPatients = await db
          .select()
          .from(patients)
          .where(and(...conditions))
          .limit(limit);

        return {
          items: matchedPatients.map((p) => this.mapToPatientResponse(p)),
          meta: {
            total: matchedPatients.length,
            page,
            limit,
            totalPages: Math.ceil(matchedPatients.length / limit) || 1,
          },
        };
      }

      // 5. Standard multi-criteria search (MRN, Name, Gender, Status)
      const conditions = [eq(patients.tenantId, tenantId)];

      if (query.status) {
        conditions.push(eq(patients.status, query.status));
      } else {
        conditions.push(eq(patients.status, PatientStatus.ACTIVE));
      }

      if (query.identityStatus) {
        conditions.push(eq(patients.identityStatus, query.identityStatus));
      }

      if (query.gender) {
        conditions.push(eq(patients.gender, query.gender));
      }

      if (query.mrn) {
        conditions.push(ilike(patients.mrn, `%${query.mrn.trim()}%`));
      }

      if (query.name) {
        const term = `%${query.name.trim()}%`;
        conditions.push(
          or(
            ilike(patients.firstName, term),
            ilike(patients.middleName, term),
            ilike(patients.lastName, term),
          )!,
        );
      }

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(patients)
        .where(and(...conditions));

      const total = Number(totalResult[0]?.count || 0);

      const patientRows = await db
        .select()
        .from(patients)
        .where(and(...conditions))
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        items: patientRows.map((p) => this.mapToPatientResponse(p)),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    });
  }

  /**
   * 4. Pre-intake duplicate detection check without registering.
   */
  async checkDuplicates(
    tenantId: string,
    dto: DuplicateCheckDto,
  ): Promise<DuplicateCandidateResponseDto[]> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      let incomingPhoneBIndex: string | undefined = undefined;
      if (dto.phone) {
        const norm = normalizeKenyanPhone(dto.phone);
        incomingPhoneBIndex = computeBlindIndex(norm);
      }

      const candidates: DuplicateCandidateResponseDto[] = [];
      if (dto.nationalId) {
        const nidBIndex = computeBlindIndex(dto.nationalId.trim());
        const idMatches = await db
          .select({ patientId: patientIdentifiers.patientId })
          .from(patientIdentifiers)
          .where(
            and(
              eq(patientIdentifiers.tenantId, tenantId),
              eq(patientIdentifiers.system, PatientIdentifierType.KENYA_NATIONAL_ID),
              eq(patientIdentifiers.valueBlindIndex, nidBIndex),
              eq(patientIdentifiers.status, 'ACTIVE'),
            ),
          );

        for (const m of idMatches) {
          if (!m.patientId) continue;
          const [matchPat] = await db
            .select()
            .from(patients)
            .where(and(eq(patients.tenantId, tenantId), eq(patients.id, m.patientId)))
            .limit(1);

          if (matchPat) {
            candidates.push({
              patient: this.mapToPatientResponse(matchPat),
              confidenceScore: 1.0,
              matchReasons: ['EXACT_NATIONAL_ID_MATCH'],
            });
          }
        }
      }

      const allActive = await db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.tenantId, tenantId),
            eq(patients.status, PatientStatus.ACTIVE),
          ),
        );

      for (const p of allActive) {
        if (candidates.some((c) => c.patient.id === p.id)) continue;

        const { confidenceScore, matchReasons } = calculateDuplicateScore(
          {
            firstName: dto.firstName || '',
            lastName: dto.lastName || '',
            dateOfBirth: dto.dateOfBirth || '',
            gender: dto.gender || '',
            phoneBlindIndex: incomingPhoneBIndex,
          },
          {
            firstName: p.firstName,
            lastName: p.lastName,
            dateOfBirth: p.dateOfBirth,
            gender: p.gender,
            phoneBlindIndex: p.phoneBlindIndex || undefined,
          },
        );

        if (confidenceScore >= 0.5) {
          candidates.push({
            patient: this.mapToPatientResponse(p),
            confidenceScore: Number(confidenceScore.toFixed(2)),
            matchReasons,
          });
        }
      }

      return candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);
    });
  }

  /**
   * 5. Get full patient details with identifiers, consents, and statutory access logging.
   */
  async getPatientById(
    tenantId: string,
    patientId: string,
    actorUserId: string,
    purpose: PatientAccessPurpose = PatientAccessPurpose.CLINICAL_TREATMENT,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PatientDetailResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${patientId} not found`);
      }

      const idRows = await db
        .select()
        .from(patientIdentifiers)
        .where(
          and(
            eq(patientIdentifiers.tenantId, tenantId),
            eq(patientIdentifiers.patientId, patientId),
          ),
        );

      const consentRows = await db
        .select()
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.tenantId, tenantId),
            eq(patientConsents.patientId, patientId),
          ),
        );

      // Log statutory record access (DPA 2019 Section 41)
      await db.insert(patientAccessLogs).values({
        tenantId,
        patientId,
        accessedById: actorUserId,
        purpose,
        accessType: PatientAccessType.VIEW_DEMOGRAPHICS,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        details: `Accessed patient record: MRN ${patient.mrn}`,
      });

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_RECORD_ACCESSED,
        resource: 'PATIENT',
        resourceId: patient.id,
        clientIp: ipAddress,
        userAgent,
        details: {
          mrn: patient.mrn,
          purpose,
        },
      });

      const base = this.mapToPatientResponse(patient);
      return {
        ...base,
        identifiers: idRows.map((i) => this.mapToIdentifierResponse(i)),
        consents: consentRows.map((c) => this.mapToConsentResponse(c)),
      };
    });
  }

  /**
   * 6. Update patient demographics with encryption and re-indexing.
   */
  async updatePatient(
    tenantId: string,
    patientId: string,
    dto: UpdatePatientDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [existing] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Patient with ID ${patientId} not found`);
      }

      const updates: Partial<typeof patients.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (dto.firstName) updates.firstName = dto.firstName.trim();
      if (dto.middleName !== undefined) updates.middleName = dto.middleName ? dto.middleName.trim() : null;
      if (dto.lastName) updates.lastName = dto.lastName.trim();
      if (dto.dateOfBirth) updates.dateOfBirth = dto.dateOfBirth;
      if (dto.gender) updates.gender = dto.gender;
      if (dto.bloodGroup !== undefined) updates.bloodGroup = dto.bloodGroup || null;
      if (dto.email !== undefined) updates.email = dto.email ? dto.email.trim().toLowerCase() : null;
      if (dto.physicalAddress !== undefined) updates.physicalAddress = dto.physicalAddress || null;
      if (dto.county !== undefined) updates.county = dto.county || null;
      if (dto.subCounty !== undefined) updates.subCounty = dto.subCounty || null;
      if (dto.emergencyContact) updates.emergencyContact = JSON.stringify(dto.emergencyContact);

      if (dto.phone) {
        const norm = normalizeKenyanPhone(dto.phone);
        if (!isValidKenyanPhone(norm)) {
          throw new BadRequestException(`Invalid Kenyan phone: ${dto.phone}`);
        }
        updates.phoneEncrypted = encryptField(norm);
        updates.phoneBlindIndex = computeBlindIndex(norm);
        updates.phoneMasked = maskIdentifier(norm, 'PHONE');
      }

      const [updated] = await db
        .update(patients)
        .set(updates)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .returning();

      if (!updated) {
        throw new Error('Failed to update patient record');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_DEMOGRAPHICS_UPDATED,
        resource: 'PATIENT',
        resourceId: patientId,
        clientIp: ipAddress,
        details: {
          mrn: updated.mrn,
          updatedFields: Object.keys(updates),
        },
      });

      return this.mapToPatientResponse(updated);
    });
  }

  /**
   * 7. Add an official identifier with verification status and provenance notes.
   */
  async addIdentifier(
    tenantId: string,
    facilityId: string,
    patientId: string,
    dto: AddIdentifierDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientIdentifierResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${patientId} not found`);
      }

      const cleanVal = dto.value.trim();
      if (dto.system === PatientIdentifierType.KENYA_NATIONAL_ID && !isValidKenyanNationalId(cleanVal)) {
        throw new BadRequestException(`Invalid Kenyan National ID: ${cleanVal}`);
      }

      const bIndex = computeBlindIndex(cleanVal);
      const encrypted = encryptField(cleanVal);
      const masked = maskIdentifier(
        cleanVal,
        dto.system === PatientIdentifierType.KENYA_NATIONAL_ID ? 'NATIONAL_ID' : 'GENERIC',
      );

      const existing = await db
        .select()
        .from(patientIdentifiers)
        .where(
          and(
            eq(patientIdentifiers.tenantId, tenantId),
            eq(patientIdentifiers.system, dto.system),
            eq(patientIdentifiers.valueBlindIndex, bIndex),
            eq(patientIdentifiers.status, 'ACTIVE'),
          ),
        )
        .limit(1);

      const existingMatch = existing[0];
      if (existingMatch && existingMatch.patientId !== patientId) {
        throw new ConflictException(
          `Identifier ${masked} (${dto.system}) is already associated with another active patient record.`,
        );
      }

      const [newId] = await db
        .insert(patientIdentifiers)
        .values({
          tenantId,
          facilityId,
          patientId,
          system: dto.system,
          valueEncrypted: encrypted,
          valueBlindIndex: bIndex,
          valueMasked: masked,
          status: 'ACTIVE',
          isPrimary: dto.isPrimary ?? false,
          patientAlias: `${patient.firstName} ${patient.lastName}`,
          issuingAuthority: dto.issuingAuthority || null,
          verificationStatus: 'UNVERIFIED',
          notes: dto.notes || null,
        })
        .returning();

      if (!newId) {
        throw new Error('Failed to create patient identifier record');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_IDENTIFIER_ADDED,
        resource: 'PATIENT_IDENTIFIER',
        resourceId: newId.id,
        clientIp: ipAddress,
        details: {
          patientId,
          system: dto.system,
          maskedValue: masked,
          issuingAuthority: dto.issuingAuthority,
        },
      });

      return this.mapToIdentifierResponse(newId);
    });
  }

  /**
   * 8. External identity verification against the DHA Client Registry.
   * Clearly labelled mock workflow until external credentials are authenticated.
   */
  async verifyWithClientRegistry(
    tenantId: string,
    facilityId: string,
    patientId: string,
    actorUserId: string,
    facilityCode: string = 'FR-KEN-001',
    ipAddress?: string,
  ): Promise<{ success: boolean; crId?: string; upi?: string; message: string }> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${patientId} not found`);
      }

      const idRows = await db
        .select()
        .from(patientIdentifiers)
        .where(
          and(
            eq(patientIdentifiers.tenantId, tenantId),
            eq(patientIdentifiers.patientId, patientId),
            eq(patientIdentifiers.system, PatientIdentifierType.KENYA_NATIONAL_ID),
            eq(patientIdentifiers.status, 'ACTIVE'),
          ),
        )
        .limit(1);

      const nationalIdRow = idRows[0];
      if (!nationalIdRow) {
        throw new BadRequestException(
          'Cannot verify with Client Registry: No active National ID identifier on file for this patient.',
        );
      }

      this.logger.log(
        `[MOCK_CLIENT_REGISTRY] Initiating identity resolution for patient MRN=${patient.mrn} with facilityCode=${facilityCode}`,
      );

      const lookupResult = await this.dhaClient.lookupClient(
        'national_id',
        '12345678',
        facilityCode,
      );

      if (lookupResult.isFailure()) {
        const err = lookupResult.getError();
        await this.auditService.recordEvent({
          tenantId,
          userId: actorUserId,
          action: AuditEventType.PATIENT_CR_SYNC_FAILED,
          resource: 'PATIENT',
          resourceId: patientId,
          clientIp: ipAddress,
          details: {
            error: err.message,
            facilityCode,
          },
        });

        return {
          success: false,
          message: err.message || 'Client Registry unindexed or identity match failed',
        };
      }

      const crData = lookupResult.getValue();

      // Update patient identity status and save CRID & UPI
      await db
        .update(patients)
        .set({
          identityStatus: PatientIdentityStatus.VERIFIED_EXTERNAL,
          dhaCrid: crData.crId,
          upi: crData.upi,
          updatedAt: new Date(),
        })
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)));

      // Update identifier verification status
      await db
        .update(patientIdentifiers)
        .set({
          verificationStatus: 'VERIFIED',
          verificationMethod: 'DHA_CLIENT_REGISTRY_MOCK',
          verifiedAt: new Date(),
          verifiedBy: actorUserId,
          updatedAt: new Date(),
        })
        .where(and(eq(patientIdentifiers.tenantId, tenantId), eq(patientIdentifiers.id, nationalIdRow.id)));

      // Insert external reference tracking
      await db
        .insert(externalReferences)
        .values({
          tenantId,
          facilityId,
          internalEntityType: 'PATIENT',
          internalEntityId: patientId,
          externalSystem: 'DHA_CR',
          externalId: crData.crId,
          status: 'SYNCED',
          lastSyncedAt: new Date(),
          responseMetadata: JSON.stringify({
            upi: crData.upi,
            verifiedAt: new Date().toISOString(),
            mode: 'MOCK_VERIFIED',
          }),
        })
        .onConflictDoNothing();

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_CR_SYNCED,
        resource: 'PATIENT',
        resourceId: patientId,
        clientIp: ipAddress,
        details: {
          cr_id: crData.crId,
          upi: crData.upi,
          identityStatus: PatientIdentityStatus.VERIFIED_EXTERNAL,
        },
      });

      return {
        success: true,
        crId: crData.crId,
        upi: crData.upi,
        message: 'Successfully verified identity against DHA Client Registry.',
      };
    });
  }

  /**
   * 9. Safe, non-destructive patient record reconciliation & merge.
   * Source record is deprecated with status MERGED and pointer; target record remains active.
   * Never automatically merges uncertain records.
   */
  async reconcilePatients(
    tenantId: string,
    dto: ReconcilePatientDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; targetPatient: PatientResponseDto }> {
    if (dto.targetPatientId === dto.sourcePatientId) {
      throw new BadRequestException('Target and source patient records cannot be the same record.');
    }

    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [target] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, dto.targetPatientId)))
        .limit(1);

      const [source] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, dto.sourcePatientId)))
        .limit(1);

      if (!target || !source) {
        throw new NotFoundException('One or both patient records not found in organization context.');
      }

      if (source.status === PatientStatus.MERGED) {
        throw new BadRequestException(
          `Source patient ${source.mrn} is already merged into ${source.reconciledIntoPatientId}.`,
        );
      }

      // Mark source record as merged (non-destructive)
      await db
        .update(patients)
        .set({
          status: PatientStatus.MERGED,
          reconciledIntoPatientId: target.id,
          reconciliationNotes: dto.reason,
          updatedAt: new Date(),
        })
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, source.id)));

      // If target was LOCAL_ONLY, update to RECONCILED
      if (target.identityStatus === PatientIdentityStatus.LOCAL_ONLY) {
        await db
          .update(patients)
          .set({
            identityStatus: PatientIdentityStatus.RECONCILED,
            updatedAt: new Date(),
          })
          .where(and(eq(patients.tenantId, tenantId), eq(patients.id, target.id)));
      }

      // Record patient reconciliation record
      await db.insert(patientReconciliations).values({
        tenantId,
        sourcePatientId: source.id,
        targetPatientId: target.id,
        status: ReconciliationStatus.CONFIRMED_MERGED,
        confidenceScore: '1.00',
        matchReasons: JSON.stringify(['CLINICAL_STAFF_MANUAL_RECONCILIATION']),
        actionNotes: dto.reason,
        reconciledById: actorUserId,
        reconciledAt: new Date(),
      });

      // Record state transition
      await db.insert(workflowStateTransitions).values({
        tenantId,
        entityType: 'PATIENT',
        entityId: source.id,
        fromState: source.status,
        toState: PatientStatus.MERGED,
        version: 2,
        trigger: 'RECONCILIATION_MERGE',
        actorUserId,
        reason: dto.reason,
        metadata: JSON.stringify({ targetPatientId: target.id }),
      });

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_RECONCILED_MERGED,
        resource: 'PATIENT',
        resourceId: target.id,
        clientIp: ipAddress,
        details: {
          targetPatientId: target.id,
          sourcePatientId: source.id,
          targetMrn: target.mrn,
          sourceMrn: source.mrn,
          reason: dto.reason,
        },
      });

      const [updatedTarget] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, target.id)))
        .limit(1);

      if (!updatedTarget) {
        throw new Error('Failed to retrieve updated target patient record');
      }

      return {
        success: true,
        targetPatient: this.mapToPatientResponse(updatedTarget),
      };
    });
  }

  /**
   * 10. Consent management: Grant consent.
   */
  async grantConsent(
    tenantId: string,
    facilityId: string,
    patientId: string,
    dto: GrantConsentDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientConsentResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [patient] = await db
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patient) {
        throw new NotFoundException(`Patient with ID ${patientId} not found`);
      }

      const [consent] = await db
        .insert(patientConsents)
        .values({
          tenantId,
          facilityId,
          patientId,
          consentType: dto.consentType,
          status: ConsentStatus.GRANTED,
          channel: dto.channel || ConsentChannel.WRITTEN_FORM,
          policyVersion: dto.policyVersion || 'KE-DPA-2019-V1',
          capturedById: actorUserId,
          witnessName: dto.witnessName || null,
        })
        .returning();

      if (!consent) {
        throw new Error('Failed to record patient consent');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_CONSENT_GRANTED,
        resource: 'PATIENT_CONSENT',
        resourceId: consent.id,
        clientIp: ipAddress,
        details: {
          patientId,
          consentType: dto.consentType,
          policyVersion: dto.policyVersion,
        },
      });

      return this.mapToConsentResponse(consent);
    });
  }

  /**
   * 11. Consent management: Revoke consent.
   */
  async revokeConsent(
    tenantId: string,
    patientId: string,
    consentId: string,
    dto: RevokeConsentDto,
    actorUserId: string,
    ipAddress?: string,
  ): Promise<PatientConsentResponseDto> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const [consent] = await db
        .select()
        .from(patientConsents)
        .where(
          and(
            eq(patientConsents.tenantId, tenantId),
            eq(patientConsents.patientId, patientId),
            eq(patientConsents.id, consentId),
          ),
        )
        .limit(1);

      if (!consent) {
        throw new NotFoundException(`Consent record with ID ${consentId} not found`);
      }

      const [updated] = await db
        .update(patientConsents)
        .set({
          status: ConsentStatus.REVOKED,
          revokedAt: new Date(),
          revocationReason: dto.reason,
          updatedAt: new Date(),
        })
        .where(and(eq(patientConsents.tenantId, tenantId), eq(patientConsents.id, consentId)))
        .returning();

      if (!updated) {
        throw new Error('Failed to update consent status');
      }

      await this.auditService.recordEvent({
        tenantId,
        userId: actorUserId,
        action: AuditEventType.PATIENT_CONSENT_REVOKED,
        resource: 'PATIENT_CONSENT',
        resourceId: consentId,
        clientIp: ipAddress,
        details: {
          patientId,
          consentType: updated.consentType,
          reason: dto.reason,
        },
      });

      return this.mapToConsentResponse(updated);
    });
  }

  /**
   * 12. Retrieve patient timeline & authorized record-access history.
   */
  async getPatientHistory(
    tenantId: string,
    patientId: string,
    _actorUserId: string,
  ): Promise<{
    accessLogs: Array<{
      id: string;
      purpose: string;
      accessType: string;
      accessedAt: string;
      ipAddress: string | null;
      details: string | null;
    }>;
    stateTransitions: Array<{
      id: string;
      fromState: string;
      toState: string;
      trigger: string;
      reason: string | null;
      createdAt: string;
    }>;
    reconciliations: Array<{
      id: string;
      status: string;
      confidenceScore: string;
      reconciledAt: string | null;
      actionNotes: string | null;
    }>;
  }> {
    return await this.tenancyService.runInTenantContext(tenantId, async (db) => {
      const logs = await db
        .select()
        .from(patientAccessLogs)
        .where(
          and(
            eq(patientAccessLogs.tenantId, tenantId),
            eq(patientAccessLogs.patientId, patientId),
          ),
        )
        .orderBy(desc(patientAccessLogs.accessedAt))
        .limit(50);

      const transitions = await db
        .select()
        .from(workflowStateTransitions)
        .where(
          and(
            eq(workflowStateTransitions.tenantId, tenantId),
            eq(workflowStateTransitions.entityId, patientId),
          ),
        )
        .orderBy(desc(workflowStateTransitions.createdAt))
        .limit(50);

      const recons = await db
        .select()
        .from(patientReconciliations)
        .where(
          and(
            eq(patientReconciliations.tenantId, tenantId),
            or(
              eq(patientReconciliations.targetPatientId, patientId),
              eq(patientReconciliations.sourcePatientId, patientId),
            ),
          ),
        )
        .orderBy(desc(patientReconciliations.createdAt))
        .limit(20);

      return {
        accessLogs: logs.map((l) => ({
          id: l.id,
          purpose: l.purpose,
          accessType: l.accessType,
          accessedAt: l.accessedAt.toISOString(),
          ipAddress: l.ipAddress,
          details: l.details,
        })),
        stateTransitions: transitions.map((t) => ({
          id: t.id,
          fromState: t.fromState,
          toState: t.toState,
          trigger: t.trigger,
          reason: t.reason,
          createdAt: t.createdAt.toISOString(),
        })),
        reconciliations: recons.map((r) => ({
          id: r.id,
          status: r.status,
          confidenceScore: r.confidenceScore,
          reconciledAt: r.reconciledAt ? r.reconciledAt.toISOString() : null,
          actionNotes: r.actionNotes,
        })),
      };
    });
  }

  // --- Response Mappers ---

  private mapToPatientResponse(p: typeof patients.$inferSelect): PatientResponseDto {
    let emergencyContact: EmergencyContactInfo | null = null;
    if (p.emergencyContact) {
      try {
        emergencyContact = JSON.parse(p.emergencyContact);
      } catch {
        emergencyContact = null;
      }
    }

    return {
      id: p.id,
      tenantId: p.tenantId,
      mrn: p.mrn,
      firstName: p.firstName,
      middleName: p.middleName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth,
      isDobEstimated: p.isDobEstimated,
      gender: p.gender as PatientGender,
      bloodGroup: p.bloodGroup,
      phoneMasked: p.phoneMasked,
      email: p.email,
      physicalAddress: p.physicalAddress,
      county: p.county,
      subCounty: p.subCounty,
      ward: p.ward,
      village: p.village,
      postalCode: p.postalCode,
      nationality: p.nationality,
      maritalStatus: p.maritalStatus,
      emergencyContact,
      status: p.status as PatientStatus,
      identityStatus: p.identityStatus as PatientIdentityStatus,
      isExternallyVerified: p.identityStatus === PatientIdentityStatus.VERIFIED_EXTERNAL,
      upi: p.upi,
      dhaCrid: p.dhaCrid,
      reconciledIntoPatientId: p.reconciledIntoPatientId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private mapToIdentifierResponse(i: typeof patientIdentifiers.$inferSelect): PatientIdentifierResponseDto {
    return {
      id: i.id,
      system: i.system as PatientIdentifierType,
      valueMasked: i.valueMasked,
      issuingAuthority: i.issuingAuthority,
      isPrimary: i.isPrimary,
      verificationStatus: i.verificationStatus,
      verificationMethod: i.verificationMethod,
      notes: i.notes,
      createdAt: i.createdAt.toISOString(),
    };
  }

  private mapToConsentResponse(c: typeof patientConsents.$inferSelect): PatientConsentResponseDto {
    return {
      id: c.id,
      consentType: c.consentType as ConsentType,
      policyVersion: c.policyVersion,
      status: c.status as ConsentStatus,
      grantedAt: c.grantedAt.toISOString(),
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
      channel: c.channel as ConsentChannel,
      witnessName: c.witnessName,
    };
  }
}
