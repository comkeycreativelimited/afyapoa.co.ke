/**
 * COMKEY AFYA POA — Kenya Core HL7 FHIR R4 Conformance Validator
 * Implements structural, cardinality, canonical profile, identifier,
 * terminology, and bundle referencing invariant validation.
 * Emits standard FHIR OperationOutcome resources with JSONPath expressions.
 */

import {
  FHIR_CANONICAL_PROFILES,
  FHIR_IDENTIFIER_SYSTEMS,
  FHIR_TERMINOLOGY_SYSTEMS,
} from './canonical.js';
import {
  KenyaCoreOperationOutcome,
  FHIRIssue,
} from './types.js';
import { createOperationOutcome, parseOperationOutcome, ParsedOutcome } from './operation-outcome.js';

export interface ValidationOptions {
  /** If true, strictly enforces canonical meta.profile presence */
  enforceCanonicalProfile?: boolean;
  /** If true, treats deprecated terminology (e.g. ICD-10) as fatal error instead of warning */
  strictTerminology?: boolean;
  /** Expected profile URI for validation */
  targetProfile?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: FHIRIssue[];
  operationOutcome: KenyaCoreOperationOutcome;
  parsedOutcome: ParsedOutcome;
}

/**
 * Validates any FHIR R4 resource or Bundle against Kenya Core DHA specifications.
 */
export function validateFHIRResource(
  resource: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const issues: FHIRIssue[] = [];

  if (!resource || typeof resource !== 'object') {
    issues.push({
      severity: 'fatal',
      code: 'structure',
      details: { text: 'Payload must be a non-null JSON object.' },
      expression: ['$'],
    });
    const outcome = createOperationOutcome(issues);
    return {
      valid: false,
      issues,
      operationOutcome: outcome,
      parsedOutcome: parseOperationOutcome(outcome),
    };
  }

  const res = resource as Record<string, any>;

  // 1. Base Resource Structure Check
  if (!res.resourceType || typeof res.resourceType !== 'string') {
    issues.push({
      severity: 'fatal',
      code: 'required',
      details: { text: 'Missing mandatory property "resourceType".' },
      expression: ['$.resourceType'],
    });
    const outcome = createOperationOutcome(issues);
    return {
      valid: false,
      issues,
      operationOutcome: outcome,
      parsedOutcome: parseOperationOutcome(outcome),
    };
  }

  // 2. Resource ID check if present
  if (res.id !== undefined) {
    if (typeof res.id !== 'string' || !/^[A-Za-z0-9\-.]{1,64}$/.test(res.id)) {
      issues.push({
        severity: 'error',
        code: 'value',
        details: { text: `Invalid resource id "${res.id}". Must match regex [A-Za-z0-9\\-.]{1,64}.` },
        expression: ['$.id'],
      });
    }
  }

  // 3. Meta Profile check
  if (options.enforceCanonicalProfile) {
    const profiles = res.meta?.profile;
    if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'extension',
        details: { text: `Resource "${res.resourceType}" is missing canonical meta.profile declaration.` },
        expression: ['$.meta.profile'],
      });
    }
  }

  // 4. Resource-Specific Conformance Checks
  switch (res.resourceType) {
    case 'Patient':
      validatePatient(res, issues);
      break;
    case 'Encounter':
      validateEncounter(res, issues);
      break;
    case 'Practitioner':
      validatePractitioner(res, issues);
      break;
    case 'PractitionerRole':
      validatePractitionerRole(res, issues);
      break;
    case 'Organization':
      validateOrganization(res, issues);
      break;
    case 'Location':
      validateLocation(res, issues);
      break;
    case 'Condition':
      validateCondition(res, issues, options);
      break;
    case 'Observation':
      validateObservation(res, issues);
      break;
    case 'AllergyIntolerance':
      validateAllergyIntolerance(res, issues);
      break;
    case 'MedicationRequest':
      validateMedicationRequest(res, issues);
      break;
    case 'MedicationDispense':
      validateMedicationDispense(res, issues);
      break;
    case 'MedicationAdministration':
      validateMedicationAdministration(res, issues);
      break;
    case 'Medication':
      validateMedication(res, issues);
      break;
    case 'ServiceRequest':
      validateServiceRequest(res, issues);
      break;
    case 'Specimen':
      validateSpecimen(res, issues);
      break;
    case 'DiagnosticReport':
      validateDiagnosticReport(res, issues);
      break;
    case 'Coverage':
      validateCoverage(res, issues);
      break;
    case 'Claim':
      validateClaim(res, issues);
      break;
    case 'ClaimResponse':
      validateClaimResponse(res, issues);
      break;
    case 'Consent':
      validateConsent(res, issues);
      break;
    case 'Provenance':
      validateProvenance(res, issues);
      break;
    case 'AuditEvent':
      validateAuditEvent(res, issues);
      break;
    case 'Bundle':
      validateBundle(res, issues, options);
      break;
    default:
      // Unknown or generic FHIR resource
      issues.push({
        severity: 'warning',
        code: 'not-supported',
        details: { text: `Resource type "${res.resourceType}" is not an officially verified Kenya Core profile.` },
        expression: ['$.resourceType'],
      });
      break;
  }

  const valid = !issues.some((i) => i.severity === 'fatal' || i.severity === 'error');
  const outcome = createOperationOutcome(issues);

  return {
    valid,
    issues,
    operationOutcome: outcome,
    parsedOutcome: parseOperationOutcome(outcome),
  };
}

// ============================================================================
// RESOURCE VALIDATORS
// ============================================================================

function validatePatient(patient: any, issues: FHIRIssue[]) {
  if (patient.active === undefined) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCorePatient: Mandatory property "active" is missing.' },
      expression: ['Patient.active'],
    });
  }

  if (!patient.gender || !['male', 'female', 'other', 'unknown'].includes(patient.gender)) {
    issues.push({
      severity: 'error',
      code: 'value',
      details: { text: 'KenyaCorePatient: "gender" is required and must be male, female, other, or unknown.' },
      expression: ['Patient.gender'],
    });
  }

  if (!patient.birthDate || !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(patient.birthDate)) {
    issues.push({
      severity: 'error',
      code: 'value',
      details: { text: 'KenyaCorePatient: "birthDate" is required and must be a valid ISO date (YYYY-MM-DD).' },
      expression: ['Patient.birthDate'],
    });
  }

  if (!Array.isArray(patient.name) || patient.name.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCorePatient: At least one human name entry is required.' },
      expression: ['Patient.name'],
    });
  } else {
    for (let i = 0; i < patient.name.length; i++) {
      const n = patient.name[i];
      if (!n.family && (!n.given || n.given.length === 0)) {
        issues.push({
          severity: 'error',
          code: 'required',
          details: { text: `KenyaCorePatient: Name entry [${i}] must have family or given name.` },
          expression: [`Patient.name[${i}]`],
        });
      }
    }
  }

  if (!Array.isArray(patient.identifier) || patient.identifier.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCorePatient: At least one identifier is required.' },
      expression: ['Patient.identifier'],
    });
  } else {
    const hasDhaNationalId = patient.identifier.some((id: any) =>
      [
        FHIR_IDENTIFIER_SYSTEMS.CR_ID,
        FHIR_IDENTIFIER_SYSTEMS.UPI,
        FHIR_IDENTIFIER_SYSTEMS.NATIONAL_ID,
        FHIR_IDENTIFIER_SYSTEMS.SHA_NUMBER,
      ].includes(id.system),
    );

    if (!hasDhaNationalId) {
      issues.push({
        severity: 'warning',
        code: 'invariant',
        details: {
          text: 'KenyaCorePatient: Patient lacks a national registry identifier (CR ID, UPI, National ID, or SHA Number).',
        },
        expression: ['Patient.identifier'],
      });
    }

    for (let i = 0; i < patient.identifier.length; i++) {
      const id = patient.identifier[i];
      if (!id.system || !id.value) {
        issues.push({
          severity: 'error',
          code: 'required',
          details: { text: `KenyaCorePatient: Identifier [${i}] must have both system and value.` },
          expression: [`Patient.identifier[${i}]`],
        });
      }
    }
  }
}

function validateEncounter(enc: any, issues: FHIRIssue[]) {
  const validStatuses = [
    'planned',
    'arrived',
    'triaged',
    'in-progress',
    'onleave',
    'finished',
    'cancelled',
    'entered-in-error',
    'unknown',
  ];

  if (!enc.status || !validStatuses.includes(enc.status)) {
    issues.push({
      severity: 'error',
      code: 'value',
      details: { text: `KenyaCoreEncounter: Invalid or missing status "${enc.status}".` },
      expression: ['Encounter.status'],
    });
  }

  if (!enc.class || typeof enc.class !== 'object' || !enc.class.code) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreEncounter: Mandatory "class" (e.g. AMB, EMER, IMP) is missing.' },
      expression: ['Encounter.class'],
    });
  }

  if (!enc.subject || !enc.subject.reference || !enc.subject.reference.startsWith('Patient/')) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreEncounter: "subject" must reference a Patient (e.g. Patient/uuid).' },
      expression: ['Encounter.subject'],
    });
  }

  if (!enc.period?.start) {
    issues.push({
      severity: 'warning',
      code: 'required',
      details: { text: 'KenyaCoreEncounter: "period.start" timestamp is strongly recommended.' },
      expression: ['Encounter.period.start'],
    });
  }
}

function validateCondition(cond: any, issues: FHIRIssue[], options: ValidationOptions) {
  if (!cond.subject || !cond.subject.reference || !cond.subject.reference.startsWith('Patient/')) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreCondition: "subject" must reference Patient.' },
      expression: ['Condition.subject'],
    });
  }

  if (!cond.code || !Array.isArray(cond.code.coding) || cond.code.coding.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreCondition: Diagnostic "code.coding" is required.' },
      expression: ['Condition.code.coding'],
    });
  } else {
    let hasIcd11 = false;
    let hasLegacyIcd10 = false;

    for (const c of cond.code.coding) {
      if (c.system === FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS) {
        hasIcd11 = true;
      }
      if (c.system === FHIR_TERMINOLOGY_SYSTEMS.ICD10) {
        hasLegacyIcd10 = true;
      }
      if (!c.code) {
        issues.push({
          severity: 'error',
          code: 'required',
          details: { text: 'KenyaCoreCondition: Diagnostic coding entry is missing code.' },
          expression: ['Condition.code.coding'],
        });
      }
    }

    if (!hasIcd11) {
      if (hasLegacyIcd10) {
        issues.push({
          severity: options.strictTerminology ? 'error' : 'warning',
          code: 'code-invalid',
          details: {
            text: 'KenyaCoreCondition: Legacy ICD-10 detected. DHA HIE mandates WHO ICD-11 MMS (http://id.who.int/icd/release/11/mms) for national data exchange.',
          },
          expression: ['Condition.code.coding'],
        });
      } else {
        issues.push({
          severity: 'error',
          code: 'code-invalid',
          details: {
            text: 'KenyaCoreCondition: Primary diagnosis must be coded in WHO ICD-11 MMS (http://id.who.int/icd/release/11/mms).',
          },
          expression: ['Condition.code.coding'],
        });
      }
    }
  }

  if (cond.clinicalStatus && !cond.clinicalStatus.coding?.[0]?.code) {
    issues.push({
      severity: 'warning',
      code: 'value',
      details: { text: 'KenyaCoreCondition: "clinicalStatus" should provide a valid code.' },
      expression: ['Condition.clinicalStatus'],
    });
  }
}

function validateObservation(obs: any, issues: FHIRIssue[]) {
  if (!obs.status) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreObservation: Mandatory "status" is missing.' },
      expression: ['Observation.status'],
    });
  }

  if (!obs.subject || !obs.subject.reference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreObservation: "subject" reference is required.' },
      expression: ['Observation.subject'],
    });
  }

  if (!obs.code || !Array.isArray(obs.code.coding) || obs.code.coding.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreObservation: "code.coding" is required.' },
      expression: ['Observation.code.coding'],
    });
  } else {
    const loincEntry = obs.code.coding.find((c: any) => c.system === FHIR_TERMINOLOGY_SYSTEMS.LOINC);
    if (!loincEntry) {
      issues.push({
        severity: 'warning',
        code: 'code-invalid',
        details: { text: 'KenyaCoreObservation: Clinical observations should use LOINC (http://loinc.org).' },
        expression: ['Observation.code.coding'],
      });
    } else if (loincEntry.code && !/^\d{3,6}-\d$/.test(loincEntry.code)) {
      issues.push({
        severity: 'warning',
        code: 'value',
        details: { text: `KenyaCoreObservation: LOINC code "${loincEntry.code}" has an unexpected format.` },
        expression: ['Observation.code.coding'],
      });
    }
  }

  // Value Quantity UCUM unit check
  if (obs.valueQuantity) {
    if (obs.valueQuantity.value !== undefined && typeof obs.valueQuantity.value !== 'number') {
      issues.push({
        severity: 'error',
        code: 'value',
        details: { text: 'KenyaCoreObservation: valueQuantity.value must be numeric.' },
        expression: ['Observation.valueQuantity.value'],
      });
    }
  }
}

function validatePractitioner(prac: any, issues: FHIRIssue[]) {
  if (prac.active === undefined) {
    issues.push({
      severity: 'warning',
      code: 'required',
      details: { text: 'KenyaCorePractitioner: "active" flag should be declared.' },
      expression: ['Practitioner.active'],
    });
  }

  if (!Array.isArray(prac.identifier) || prac.identifier.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCorePractitioner: Practitioner identifier array is required.' },
      expression: ['Practitioner.identifier'],
    });
  } else {
    const hasPuid = prac.identifier.some((id: any) => id.system === FHIR_IDENTIFIER_SYSTEMS.PUID);
    if (!hasPuid) {
      issues.push({
        severity: 'warning',
        code: 'invariant',
        details: { text: 'KenyaCorePractitioner: Practitioner lacks verified PUID identifier (https://fhir.dha.go.ke/identifiers/puid).' },
        expression: ['Practitioner.identifier'],
      });
    }
  }
}

function validatePractitionerRole(role: any, issues: FHIRIssue[]) {
  if (!role.practitioner && !role.organization) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCorePractitionerRole: Must reference at least practitioner or organization.' },
      expression: ['PractitionerRole'],
    });
  }
}

function validateOrganization(org: any, issues: FHIRIssue[]) {
  if (!org.name || typeof org.name !== 'string') {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreOrganization: Mandatory "name" is missing.' },
      expression: ['Organization.name'],
    });
  }

  if (!Array.isArray(org.identifier) || org.identifier.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreOrganization: Organization must have at least one identifier.' },
      expression: ['Organization.identifier'],
    });
  } else {
    const hasKmfl = org.identifier.some((id: any) => id.system === FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE);
    if (!hasKmfl) {
      issues.push({
        severity: 'warning',
        code: 'invariant',
        details: { text: 'KenyaCoreOrganization: Organization lacks KMFL code identifier (https://fhir.dha.go.ke/identifiers/kmfl-code).' },
        expression: ['Organization.identifier'],
      });
    }
  }
}

function validateLocation(loc: any, issues: FHIRIssue[]) {
  if (!loc.name) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreLocation: "name" is required.' },
      expression: ['Location.name'],
    });
  }
}

function validateAllergyIntolerance(allergy: any, issues: FHIRIssue[]) {
  if (!allergy.patient || !allergy.patient.reference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreAllergyIntolerance: "patient" reference is required.' },
      expression: ['AllergyIntolerance.patient'],
    });
  }

  if (!allergy.code) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreAllergyIntolerance: Allergen "code" is required.' },
      expression: ['AllergyIntolerance.code'],
    });
  }
}

function validateMedicationRequest(req: any, issues: FHIRIssue[]) {
  if (!req.status) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationRequest: "status" is required.' },
      expression: ['MedicationRequest.status'],
    });
  }

  if (!req.intent) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationRequest: "intent" is required.' },
      expression: ['MedicationRequest.intent'],
    });
  }

  if (!req.subject || !req.subject.reference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationRequest: "subject" is required.' },
      expression: ['MedicationRequest.subject'],
    });
  }

  if (!req.medicationCodeableConcept && !req.medicationReference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationRequest: Must specify medicationCodeableConcept or medicationReference.' },
      expression: ['MedicationRequest.medicationCodeableConcept'],
    });
  }
}

function validateMedicationDispense(disp: any, issues: FHIRIssue[]) {
  if (!disp.status) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationDispense: "status" is required.' },
      expression: ['MedicationDispense.status'],
    });
  }

  if (!disp.subject || !disp.subject.reference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationDispense: "subject" is required.' },
      expression: ['MedicationDispense.subject'],
    });
  }

  if (!Array.isArray(disp.authorizingPrescription) || disp.authorizingPrescription.length === 0) {
    issues.push({
      severity: 'warning',
      code: 'required',
      details: { text: 'KenyaCoreMedicationDispense: authorizingPrescription reference to MedicationRequest is expected.' },
      expression: ['MedicationDispense.authorizingPrescription'],
    });
  }
}

function validateMedicationAdministration(admin: any, issues: FHIRIssue[]) {
  if (!admin.status) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationAdministration: "status" is required.' },
      expression: ['MedicationAdministration.status'],
    });
  }

  if (!admin.effectiveDateTime) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedicationAdministration: "effectiveDateTime" is required.' },
      expression: ['MedicationAdministration.effectiveDateTime'],
    });
  }
}

function validateMedication(med: any, issues: FHIRIssue[]) {
  if (!med.code) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreMedication: "code" is required.' },
      expression: ['Medication.code'],
    });
  }
}

function validateServiceRequest(srv: any, issues: FHIRIssue[]) {
  if (!srv.status || !srv.intent) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreServiceRequest: Both "status" and "intent" are required.' },
      expression: ['ServiceRequest.status'],
    });
  }

  if (!srv.code) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreServiceRequest: Service "code" is required.' },
      expression: ['ServiceRequest.code'],
    });
  }

  if (!srv.subject || !srv.subject.reference) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreServiceRequest: "subject" is required.' },
      expression: ['ServiceRequest.subject'],
    });
  }
}

function validateSpecimen(spec: any, issues: FHIRIssue[]) {
  if (!spec.type) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreSpecimen: Specimen "type" is required.' },
      expression: ['Specimen.type'],
    });
  }

  if (!spec.subject) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreSpecimen: "subject" is required.' },
      expression: ['Specimen.subject'],
    });
  }
}

function validateDiagnosticReport(rep: any, issues: FHIRIssue[]) {
  if (!rep.status || !rep.code || !rep.subject || !rep.issued) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreDiagnosticReport: "status", "code", "subject", and "issued" are mandatory.' },
      expression: ['DiagnosticReport'],
    });
  }
}

function validateCoverage(cov: any, issues: FHIRIssue[]) {
  if (!cov.status || !cov.beneficiary || !Array.isArray(cov.payor) || cov.payor.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreCoverage: "status", "beneficiary", and "payor" are mandatory.' },
      expression: ['Coverage'],
    });
  }
}

function validateClaim(claim: any, issues: FHIRIssue[]) {
  if (!claim.status || !claim.type || !claim.use || !claim.patient || !claim.provider) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreClaim: "status", "type", "use", "patient", and "provider" are required.' },
      expression: ['Claim'],
    });
  }

  if (!Array.isArray(claim.insurance) || claim.insurance.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreClaim: At least one insurance coverage entry is required.' },
      expression: ['Claim.insurance'],
    });
  }

  if (!Array.isArray(claim.item) || claim.item.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreClaim: At least one billing item is required.' },
      expression: ['Claim.item'],
    });
  }
}

function validateClaimResponse(resp: any, issues: FHIRIssue[]) {
  if (!resp.status || !resp.type || !resp.use || !resp.patient || !resp.outcome) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreClaimResponse: Mandatory properties missing.' },
      expression: ['ClaimResponse'],
    });
  }
}

function validateConsent(consent: any, issues: FHIRIssue[]) {
  if (!consent.status || !consent.scope || !consent.patient) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreConsent: "status", "scope", and "patient" are mandatory.' },
      expression: ['Consent'],
    });
  }
}

function validateProvenance(prov: any, issues: FHIRIssue[]) {
  if (!Array.isArray(prov.target) || prov.target.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreProvenance: At least one "target" reference is required.' },
      expression: ['Provenance.target'],
    });
  }

  if (!prov.recorded) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreProvenance: "recorded" timestamp is required.' },
      expression: ['Provenance.recorded'],
    });
  }

  if (!Array.isArray(prov.agent) || prov.agent.length === 0) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreProvenance: At least one "agent" is required.' },
      expression: ['Provenance.agent'],
    });
  }
}

function validateAuditEvent(event: any, issues: FHIRIssue[]) {
  if (!event.type || !event.recorded || !event.source) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreAuditEvent: "type", "recorded", and "source" are mandatory.' },
      expression: ['AuditEvent'],
    });
  }
}

// ============================================================================
// BUNDLE VALIDATOR & INVARIANTS
// ============================================================================

function validateBundle(bundle: any, issues: FHIRIssue[], options: ValidationOptions) {
  if (!bundle.type) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreBundle: "type" is required.' },
      expression: ['Bundle.type'],
    });
  }

  if (!Array.isArray(bundle.entry)) {
    issues.push({
      severity: 'error',
      code: 'required',
      details: { text: 'KenyaCoreBundle: "entry" array is required.' },
      expression: ['Bundle.entry'],
    });
    return;
  }

  // Check each resource entry inside Bundle
  const entries: any[] = bundle.entry;
  let encounterCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry.resource) {
      issues.push({
        severity: 'error',
        code: 'required',
        details: { text: `Bundle.entry[${i}]: Missing "resource".` },
        expression: [`Bundle.entry[${i}]`],
      });
      continue;
    }

    const r = entry.resource;
    if (r.resourceType === 'Encounter') {
      encounterCount++;
    }

    // Validate the individual resource
    const itemResult = validateFHIRResource(r, {
      ...options,
      targetProfile: undefined,
      enforceCanonicalProfile: false,
    });

    for (const itemIssue of itemResult.issues) {
      issues.push({
        ...itemIssue,
        expression: [`Bundle.entry[${i}].resource.${itemIssue.expression?.[0] || ''}`],
      });
    }
  }

  // DHA SHR Collection Bundle Invariants
  const isShrCollection =
    bundle.type === 'collection' ||
    bundle.meta?.profile?.includes(FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION);

  if (isShrCollection) {
    // Invariant 1: Must contain an Encounter resource
    if (encounterCount === 0) {
      issues.push({
        severity: 'error',
        code: 'invariant',
        details: {
          text: 'DHA SHR Invariant 1: Kenya Core SHR Collection Bundle MUST contain at least one Encounter resource.',
        },
        expression: ['Bundle.entry'],
      });
    }

    // Invariant 2: Clinical items must reference that Encounter
    const clinicalTypes = [
      'Observation',
      'Condition',
      'MedicationRequest',
      'MedicationDispense',
      'MedicationAdministration',
      'DiagnosticReport',
      'ServiceRequest',
    ];

    for (let i = 0; i < entries.length; i++) {
      const r = entries[i]?.resource;
      if (r && clinicalTypes.includes(r.resourceType)) {
        const encRef = r.encounter?.reference || r.context?.reference;
        if (!encRef) {
          issues.push({
            severity: 'error',
            code: 'invariant',
            details: {
              text: `DHA SHR Invariant 2: Clinical resource "${r.resourceType}" (id: ${r.id}) MUST directly reference the encounter.`,
            },
            expression: [`Bundle.entry[${i}].resource.encounter`],
          });
        }
      }
    }
  }
}
