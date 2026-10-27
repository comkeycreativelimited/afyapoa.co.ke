import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import {
  patients,
  facilities,
  encounters,
  triageVitals,
  diagnoses,
  patientAllergies,
  shaClaims,
  shaClaimItems,
  withTenantContext,
} from '@afyapoa/database';
import {
  TenantContext,
  AuditEventType,
} from '@afyapoa/domain-core';
import {
  validateFHIRResource,
  buildKenyaShrCollectionBundle,
  toFHIRPatient,
  toFHIREncounter,
  toFHIRObservations,
  toFHIRAllergyIntolerance,
  toFHIRCondition,
  toFHIRClaim,
  createOperationOutcome,
  FHIR_CANONICAL_PROFILES,
  KenyaCoreOperationOutcome,
  KenyaCoreBundle,
  KenyaCoreClaim,
} from '@afyapoa/fhir-models';
import { AuditService } from '../audit/audit.service.js';
import { ShrExchangeHeaders } from './dto/fhir.dto.js';

interface IngestionRecord {
  tenantId: string;
  receiptId: string;
  ingestedAt: string;
  entryCount: number;
  authorPuid: string;
  facilityKmfl: string;
}

@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);

  // In-memory idempotency deduplication cache indexed by tenantId:payloadDigest
  private readonly idempotencyStore = new Map<string, IngestionRecord>();

  constructor(
    @Inject(AuditService)
    private readonly auditService: AuditService,
  ) {}

  /**
   * 1. Validate arbitrary FHIR R4 resource or Bundle against Kenya Core profiles,
   * terminology bindings (ICD-11 MMS, LOINC, UCUM, KEML), and identifier systems.
   */
  async validateResource(
    resource: unknown,
    targetProfile?: string,
    context?: TenantContext,
  ): Promise<KenyaCoreOperationOutcome> {
    const result = validateFHIRResource(resource, {
      targetProfile,
      strictTerminology: true,
    });
    const outcome = result.operationOutcome;

    if (context) {
      const hasErrors = !result.valid;
      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.FHIR_RESOURCE_VALIDATED,
        resource: 'FHIR',
        resourceId: (resource as { id?: string })?.id || null,
        details: {
          targetProfile,
          valid: !hasErrors,
          issueCount: outcome.issue.length,
        },
      });
    }

    return outcome;
  }

  /**
   * 2. Ingest DHA Shared Health Record (SHR) Collection Bundle.
   * Enforces DHA HIE security headers, idempotency digest, SHR invariants, and provenance tracking.
   */
  async ingestShrBundle(
    bundle: KenyaCoreBundle,
    headers: ShrExchangeHeaders,
    context: TenantContext,
    clientIp?: string,
    userAgent?: string,
  ): Promise<{ outcome: KenyaCoreOperationOutcome; statusCode: number; receiptId?: string }> {
    // 1. Mandatory Exchange Headers Check
    const missingHeaders: string[] = [];
    if (!headers.facilityId) missingHeaders.push('X-Facility-Id (KMFL Code)');
    if (!headers.consentToken) missingHeaders.push('X-Consent-Token (Patient Consent Authorization)');
    if (!headers.puid) missingHeaders.push('X-PUID (Practitioner Universal Identifier)');

    if (missingHeaders.length > 0) {
      const outcome = createOperationOutcome([
        {
          severity: 'error',
          code: 'security',
          diagnostics: `DHA HIE exchange headers missing or invalid: ${missingHeaders.join(', ')}`,
          location: ['Bundle/meta'],
        },
      ]);
      return { outcome, statusCode: 400 };
    }

    // 2. Compute Payload Digest for Idempotency
    const payloadString = JSON.stringify(bundle);
    const digest = crypto.createHash('sha256').update(payloadString).digest('hex');
    const idempotencyKey = `${context.tenantId}:${digest}`;

    const existingSubmission = this.idempotencyStore.get(idempotencyKey);
    if (existingSubmission) {
      this.logger.warn(
        `[FHIR-IDEMPOTENCY] Duplicate submission detected for tenant ${context.tenantId}, digest: ${digest}`,
      );

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.FHIR_EXCHANGE_DUPLICATE_DETECTED,
        resource: 'FHIR_BUNDLE',
        resourceId: bundle.id || existingSubmission.receiptId,
        clientIp,
        userAgent,
        details: {
          payloadDigest: digest,
          originalReceiptId: existingSubmission.receiptId,
          originalIngestedAt: existingSubmission.ingestedAt,
        },
      });

      const duplicateOutcome = createOperationOutcome(
        [
          {
            severity: 'information',
            code: 'informational',
            diagnostics: `Duplicate submission detected: payload digest ${digest} was previously ingested on ${existingSubmission.ingestedAt}. Original receipt: ${existingSubmission.receiptId}. Idempotent receipt acknowledged.`,
            location: ['Bundle/' + (bundle.id || 'unknown')],
          },
        ],
        `dup-${digest.substring(0, 16)}`,
      );

      return {
        outcome: duplicateOutcome,
        statusCode: 200,
        receiptId: existingSubmission.receiptId,
      };
    }

    // 3. Conformance Validation against Kenya Core SHR Invariants
    const validationResult = validateFHIRResource(bundle, {
      targetProfile: FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION,
      strictTerminology: true,
    });
    const validationOutcome = validationResult.operationOutcome;

    if (!validationResult.valid) {
      this.logger.warn(
        `[FHIR-VALIDATION-FAILED] SHR Collection Bundle rejected for tenant ${context.tenantId}: ${validationOutcome.issue.length} issues`,
      );
      return { outcome: validationOutcome, statusCode: 422 };
    }

    // 4. Register Idempotency Record and Log Ingestion
    const receiptId = `DHA-SHR-ACK-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const entryCount = bundle.entry?.length ?? 0;
    const ingestedAt = new Date().toISOString();

    this.idempotencyStore.set(idempotencyKey, {
      tenantId: context.tenantId,
      receiptId,
      ingestedAt,
      entryCount,
      authorPuid: headers.puid!,
      facilityKmfl: headers.facilityId!,
    });

    await this.auditService.recordEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      action: AuditEventType.FHIR_BUNDLE_INGESTED,
      resource: 'FHIR_BUNDLE',
      resourceId: bundle.id || receiptId,
      clientIp,
      userAgent,
      details: {
        receiptId,
        payloadDigest: digest,
        entryCount,
        authorPuid: headers.puid,
        facilityKmfl: headers.facilityId,
        consentTokenMasked: headers.consentToken
          ? `${headers.consentToken.substring(0, 4)}***`
          : undefined,
      },
    });

    const successOutcome = createOperationOutcome(
      [
        {
          severity: 'information',
          code: 'informational',
          diagnostics: `SHR Collection Bundle successfully validated and ingested under DHA HIE v1.0 specifications. Total entries processed: ${entryCount}. Author PUID: ${headers.puid}, Facility KMFL: ${headers.facilityId}.`,
          location: ['Bundle/' + (bundle.id || 'unknown')],
        },
      ],
      receiptId,
    );

    return { outcome: successOutcome, statusCode: 201, receiptId };
  }

  /**
   * 3. Export Patient Clinical History as a conformant FHIR SHR Collection Bundle.
   * Maps internal domain records (Patient, Encounter, Vitals, Diagnoses, Allergies) into Kenya Core resources.
   */
  async exportPatientShrBundle(
    patientId: string,
    context: TenantContext,
    encounterIdFilter?: string,
  ): Promise<KenyaCoreBundle> {
    return await withTenantContext(context.tenantId, async (tx) => {
      // 1. Fetch Patient
      const [patientRecord] = await tx
        .select()
        .from(patients)
        .where(and(eq(patients.tenantId, context.tenantId), eq(patients.id, patientId)))
        .limit(1);

      if (!patientRecord) {
        throw new NotFoundException(`Patient with ID ${patientId} not found.`);
      }

      // 2. Fetch Managing Facility
      const [facilityRecord] = await tx
        .select()
        .from(facilities)
        .where(
          and(
            eq(facilities.tenantId, context.tenantId),
            eq(facilities.id, patientRecord.primaryFacilityId),
          ),
        )
        .limit(1);

      const facilityKmfl = facilityRecord?.kmflCode || '12345';

      // 3. Fetch Encounters
      const encounterConditions = [
        eq(encounters.tenantId, context.tenantId),
        eq(encounters.patientId, patientId),
      ];
      if (encounterIdFilter) {
        encounterConditions.push(eq(encounters.id, encounterIdFilter));
      }

      const encounterRows = await tx
        .select()
        .from(encounters)
        .where(and(...encounterConditions))
        .orderBy(desc(encounters.startedAt))
        .limit(10);

      const primaryEncounter = encounterRows[0];
      if (!primaryEncounter) {
        throw new NotFoundException(
          `No clinical encounters found for patient ${patientId}${
            encounterIdFilter ? ` matching encounter ID ${encounterIdFilter}` : ''
          }.`,
        );
      }

      // 4. Fetch Clinical Observations (Vitals)
      const vitalsList = await tx
        .select()
        .from(triageVitals)
        .where(
          and(
            eq(triageVitals.tenantId, context.tenantId),
            eq(triageVitals.encounterId, primaryEncounter.id),
          ),
        )
        .orderBy(desc(triageVitals.assessedAt));

      // 5. Fetch Diagnoses (Conditions)
      const diagnosisList = await tx
        .select()
        .from(diagnoses)
        .where(
          and(
            eq(diagnoses.tenantId, context.tenantId),
            eq(diagnoses.encounterId, primaryEncounter.id),
          ),
        )
        .orderBy(desc(diagnoses.recordedAt));

      // 6. Fetch Allergies
      const allergiesList = await tx
        .select()
        .from(patientAllergies)
        .where(
          and(
            eq(patientAllergies.tenantId, context.tenantId),
            eq(patientAllergies.patientId, patientId),
          ),
        )
        .orderBy(desc(patientAllergies.recordedAt));

      // 7. Map to FHIR Resources
      const fhirPatient = toFHIRPatient({
        id: patientRecord.id,
        mrn: patientRecord.mrn,
        dhaCrid: patientRecord.dhaCrid || undefined,
        shaNumber: patientRecord.shaNumber || undefined,
        firstName: patientRecord.firstName,
        middleName: patientRecord.middleName,
        lastName: patientRecord.lastName,
        dateOfBirth: patientRecord.dateOfBirth,
        gender: patientRecord.gender,
        phoneMasked: patientRecord.phoneMasked || undefined,
        email: patientRecord.email,
        county: patientRecord.county,
        subCounty: patientRecord.subCounty,
        postalAddress: patientRecord.physicalAddress,
        postalCode: patientRecord.postalCode,
        status: patientRecord.status,
      });

      const fhirEncounter = toFHIREncounter({
        id: primaryEncounter.id,
        encounterNumber: primaryEncounter.encounterNumber,
        patientId: patientRecord.id,
        facilityId: primaryEncounter.facilityId,
        facilityCode: facilityKmfl,
        clinicianId: primaryEncounter.practitionerId || undefined,
        status: primaryEncounter.status,
        encounterType: primaryEncounter.encounterType,
        startedAt: primaryEncounter.startedAt,
        endedAt: primaryEncounter.endedAt,
        episodeOfCareId: `EOC-${primaryEncounter.encounterNumber}`,
      });

      const clinicalItems: any[] = [];

      // Map vitals to LOINC observations
      for (const vitals of vitalsList) {
        const obsList = toFHIRObservations({
          id: vitals.id,
          patientId: patientRecord.id,
          encounterId: primaryEncounter.id,
          assessedById: vitals.assessedById,
          assessedAt: vitals.assessedAt,
          systolicBp: vitals.systolicBp ? Number(vitals.systolicBp) : undefined,
          diastolicBp: vitals.diastolicBp ? Number(vitals.diastolicBp) : undefined,
          heartRate: vitals.heartRate ? Number(vitals.heartRate) : undefined,
          respiratoryRate: vitals.respiratoryRate ? Number(vitals.respiratoryRate) : undefined,
          temperature: vitals.temperature ? Number(vitals.temperature) : undefined,
          oxygenSaturation: vitals.oxygenSaturation ? Number(vitals.oxygenSaturation) : undefined,
          weightKg: vitals.weightKg ? Number(vitals.weightKg) : undefined,
          heightCm: vitals.heightCm ? Number(vitals.heightCm) : undefined,
          bmi: vitals.bmi ? Number(vitals.bmi) : undefined,
          bloodGlucose: vitals.bloodGlucose ? Number(vitals.bloodGlucose) : undefined,
        });
        clinicalItems.push(...obsList);
      }

      // Map diagnoses to Conditions
      for (const diag of diagnosisList) {
        clinicalItems.push(
          toFHIRCondition({
            id: diag.id,
            patientId: patientRecord.id,
            encounterId: primaryEncounter.id,
            code: diag.code,
            codingSystem: 'http://id.who.int/icd/release/11/mms',
            display: diag.display,
            clinicalStatus: diag.clinicalStatus.toLowerCase(),
            verificationStatus: diag.verificationStatus.toLowerCase(),
            certainty: diag.certainty || undefined,
            isPrimary: diag.isPrimary,
            onsetDate: diag.onsetDate || undefined,
            notes: diag.notes || undefined,
            recordedById: diag.recordedById,
            recordedAt: diag.recordedAt,
          }),
        );
      }

      // Map allergies
      for (const allergy of allergiesList) {
        clinicalItems.push(
          toFHIRAllergyIntolerance({
            id: allergy.id,
            patientId: patientRecord.id,
            encounterId: primaryEncounter.id,
            allergen: allergy.allergen,
            allergenType: allergy.allergenType,
            severity: allergy.severity,
            reaction: allergy.reaction,
            clinicalStatus: allergy.clinicalStatus,
            verificationStatus: allergy.verificationStatus,
            recordedAt: allergy.recordedAt,
            recordedById: allergy.recordedById,
          }),
        );
      }

      // 8. Assemble DHA SHR Collection Bundle
      const bundle = buildKenyaShrCollectionBundle(
        fhirPatient,
        fhirEncounter,
        clinicalItems,
        {
          facilityKmflCode: facilityKmfl,
          authorPractitionerPuid: 'PUID-DOC-001',
          confidentiality: 'N',
        },
      );

      await this.auditService.recordEvent({
        tenantId: context.tenantId,
        userId: context.userId,
        action: AuditEventType.FHIR_BUNDLE_EXPORTED,
        resource: 'FHIR_BUNDLE',
        resourceId: bundle.id || null,
        details: {
          patientId,
          encounterId: primaryEncounter.id,
          entryCount: bundle.entry?.length ?? 0,
          facilityKmfl,
        },
      });

      return bundle;
    });
  }

  /**
   * 4. Export Claim as a conformant FHIR KenyaCoreClaim resource.
   */
  async exportClaim(claimId: string, context: TenantContext): Promise<KenyaCoreClaim> {
    return await withTenantContext(context.tenantId, async (tx) => {
      const [claimRecord] = await tx
        .select()
        .from(shaClaims)
        .where(and(eq(shaClaims.tenantId, context.tenantId), eq(shaClaims.id, claimId)))
        .limit(1);

      if (!claimRecord) {
        throw new NotFoundException(`Claim with ID ${claimId} not found.`);
      }

      const itemsList = await tx
        .select()
        .from(shaClaimItems)
        .where(
          and(
            eq(shaClaimItems.tenantId, context.tenantId),
            eq(shaClaimItems.claimId, claimId),
          ),
        );

      const [facilityRecord] = await tx
        .select()
        .from(facilities)
        .where(
          and(
            eq(facilities.tenantId, context.tenantId),
            eq(facilities.id, claimRecord.facilityId),
          ),
        )
        .limit(1);

      const fhirClaim = toFHIRClaim({
        id: claimRecord.id,
        claimNumber: claimRecord.claimNumber,
        patientId: claimRecord.patientId,
        facilityKmflCode: facilityRecord?.kmflCode || '12345',
        fund: claimRecord.fund,
        scenario: claimRecord.scenario,
        serviceStartDate: claimRecord.serviceStartDate,
        serviceEndDate: claimRecord.serviceEndDate,
        totalClaimAmountKES: Number(claimRecord.totalClaimAmountKES),
        status: claimRecord.status,
        items: itemsList.map((item, idx) => ({
          sequence: idx + 1,
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          unitPriceKES: Number(item.unitPriceKES),
          totalAmountKES: Number(item.totalAmountKES),
        })),
      });

      const validation = validateFHIRResource(fhirClaim, {
        targetProfile: FHIR_CANONICAL_PROFILES.CLAIM,
      });
      if (!validation.valid) {
        this.logger.warn(
          `[FHIR-CLAIM-VALIDATION-WARNING] Exported claim ${claimId} has conformance issues: ${validation.issues.length}`,
        );
      }

      return fhirClaim;
    });
  }

  /**
   * 5. Return CapabilityStatement for COMKEY AFYA POA FHIR Server.
   */
  getCapabilityStatement() {
    return {
      resourceType: 'CapabilityStatement',
      id: 'comkey-afyapoa-fhir-r4',
      status: 'active',
      date: '2026-10-21T00:00:00Z',
      publisher: 'COMKEY CREATIVE LIMITED / Ministry of Health Kenya (DHA)',
      kind: 'instance',
      software: {
        name: 'COMKEY AFYA POA Kenya Core FHIR Gateway',
        version: '1.0.0',
        releaseDate: '2026-10-21',
      },
      implementation: {
        description: 'COMKEY AFYA POA FHIR R4 Interoperability Platform for DHA Shared Health Record',
        url: 'https://api.afyapoa.co.ke/api/v1/fhir',
      },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json', 'json'],
      rest: [
        {
          mode: 'server',
          security: {
            cors: true,
            service: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/restful-security-service',
                    code: 'SMART-on-FHIR',
                    display: 'SMART on FHIR',
                  },
                ],
                text: 'OAuth2 with JWT Bearer Token and Tenant Scope',
              },
            ],
          },
          resource: [
            {
              type: 'Patient',
              profile: FHIR_CANONICAL_PROFILES.PATIENT,
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            {
              type: 'Encounter',
              profile: FHIR_CANONICAL_PROFILES.ENCOUNTER,
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            {
              type: 'Observation',
              profile: FHIR_CANONICAL_PROFILES.OBSERVATION,
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            {
              type: 'Condition',
              profile: FHIR_CANONICAL_PROFILES.CONDITION,
              interaction: [{ code: 'read' }, { code: 'search-type' }],
            },
            {
              type: 'Claim',
              profile: FHIR_CANONICAL_PROFILES.CLAIM,
              interaction: [{ code: 'read' }],
            },
            {
              type: 'Bundle',
              profile: FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION,
              interaction: [{ code: 'create' }, { code: 'read' }],
            },
          ],
          operation: [
            {
              name: 'validate',
              definition: 'http://hl7.org/fhir/OperationDefinition/Resource-validate',
            },
            {
              name: 'export',
              definition: 'http://hl7.org/fhir/uv/bulkdata/OperationDefinition/patient-export',
            },
          ],
        },
      ],
    };
  }
}
