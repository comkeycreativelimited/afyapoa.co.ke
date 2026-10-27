/**
 * COMKEY AFYA POA — FHIR OperationOutcome Generator & Diagnostics Parser
 * Provides actionable error reporting, JSONPath field pointers, and remedial guidance.
 */

import { KenyaCoreOperationOutcome, FHIRIssue } from './types.js';

export interface ParsedOutcomeIssue {
  severity: FHIRIssue['severity'];
  code: FHIRIssue['code'];
  message: string;
  expression?: string[];
  remediation?: string;
}

export interface ParsedOutcome {
  valid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  totalIssues: number;
  errors: ParsedOutcomeIssue[];
  warnings: ParsedOutcomeIssue[];
  information: ParsedOutcomeIssue[];
  summary: string;
}

/**
 * Creates a compliant FHIR OperationOutcome resource.
 */
export function createOperationOutcome(
  issues: FHIRIssue[],
  id?: string,
): KenyaCoreOperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    id: id || `outcome-${Date.now()}`,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/OperationOutcome'],
      lastUpdated: new Date().toISOString(),
    },
    issue: issues.length > 0 ? issues : [
      {
        severity: 'information',
        code: 'informational',
        details: { text: 'All validation and structural checks passed successfully.' },
      },
    ],
  };
}

/**
 * Convenience helper to create an OperationOutcome from a single error.
 */
export function createSingleIssueOperationOutcome(
  severity: FHIRIssue['severity'],
  code: FHIRIssue['code'],
  message: string,
  expression?: string[],
  remediation?: string,
): KenyaCoreOperationOutcome {
  return createOperationOutcome([
    {
      severity,
      code,
      details: { text: message },
      diagnostics: remediation,
      expression: expression ? (Array.isArray(expression) ? expression : [expression]) : undefined,
    },
  ]);
}

/**
 * Actionable remediation suggestions based on FHIR issue code and diagnostic text.
 */
function resolveRemediation(issue: FHIRIssue): string {
  if (issue.diagnostics) {
    return issue.diagnostics;
  }

  const text = issue.details?.text?.toLowerCase() || '';

  if (text.includes('icd-11') || text.includes('icd11')) {
    return 'Map diagnostic concept to WHO ICD-11 MMS (e.g. URI: http://id.who.int/icd/release/11/mms). Legacy ICD-10 is deprecated for national DHA exchange.';
  }
  if (text.includes('loinc')) {
    return 'Ensure observation code uses system "http://loinc.org" with valid format (e.g., 85354-9).';
  }
  if (text.includes('puid') || text.includes('practitioner')) {
    return 'Attending practitioner must have a valid Practitioner Unique Identifier (PUID) issued by KMPDC/COC/NCKE.';
  }
  if (text.includes('kmfl') || text.includes('organization') || text.includes('facility')) {
    return 'Facility must be identified by KMFL FR Code (system: https://fhir.dha.go.ke/identifiers/kmfl-code).';
  }
  if (text.includes('cr-id') || text.includes('patient') || text.includes('upi')) {
    return 'Patient must have an authoritative DHA Client Registry ID (CR ID) or National ID.';
  }
  if (text.includes('encounter') && text.includes('bundle')) {
    return 'Kenya Core SHR Collection Bundles must include an Encounter resource that references EpisodeOfCare, and all clinical items must reference that Encounter.';
  }
  if (text.includes('keml') || text.includes('medication')) {
    return 'Medications must use Kenya National Essential Medicines List (KEML) or WHO ATC classification.';
  }

  switch (issue.code) {
    case 'required':
      return 'Supply the missing mandatory field in accordance with the Kenya Core FHIR profile.';
    case 'code-invalid':
      return 'Verify code against the national DHA Terminology Service (TS).';
    case 'value':
      return 'Correct the value syntax or type to conform to the profile constraint.';
    case 'duplicate':
      return 'Ensure entity or identifier is unique. If retrying, check existing status before re-dispatching.';
    case 'security':
    case 'forbidden':
      return 'Verify patient consent token (X-Consent-Token) and facility multi-tenant headers.';
    default:
      return 'Inspect the expression JSONPath and align payload with DHA Kenya Core specifications.';
  }
}

/**
 * Parses a FHIR OperationOutcome into structured, user-friendly diagnostics.
 */
export function parseOperationOutcome(outcome: KenyaCoreOperationOutcome): ParsedOutcome {
  const issues = outcome.issue || [];

  const errors: ParsedOutcomeIssue[] = [];
  const warnings: ParsedOutcomeIssue[] = [];
  const information: ParsedOutcomeIssue[] = [];

  for (const issue of issues) {
    const parsedIssue: ParsedOutcomeIssue = {
      severity: issue.severity,
      code: issue.code,
      message: issue.details?.text || issue.diagnostics || 'Validation issue occurred.',
      expression: issue.expression,
      remediation: resolveRemediation(issue),
    };

    if (issue.severity === 'fatal' || issue.severity === 'error') {
      errors.push(parsedIssue);
    } else if (issue.severity === 'warning') {
      warnings.push(parsedIssue);
    } else {
      information.push(parsedIssue);
    }
  }

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const valid = !hasErrors;

  let summary = 'FHIR resource/bundle is conformant.';
  if (hasErrors) {
    summary = `Conformance failed with ${errors.length} error(s)${hasWarnings ? ` and ${warnings.length} warning(s)` : ''}.`;
  } else if (hasWarnings) {
    summary = `Resource is conformant with ${warnings.length} warning(s).`;
  }

  return {
    valid,
    hasErrors,
    hasWarnings,
    totalIssues: issues.length,
    errors,
    warnings,
    information,
    summary,
  };
}
