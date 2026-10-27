/**
 * COMKEY AFYA POA — Kenya Core HL7 FHIR R4 Canonical Definitions
 * Grounded in DHA HIE v1.x specifications and Kenya Core FHIR Implementation Guide.
 */

// ============================================================================
// 1. CANONICAL PROFILE URIS
// ============================================================================

export const FHIR_CANONICAL_PROFILES = {
  // Kenya Core Profiles
  PATIENT: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-patient',
  ENCOUNTER: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-encounter',
  PRACTITIONER: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner',
  PRACTITIONER_ROLE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner-role',
  ORGANIZATION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-organization',
  LOCATION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-location',
  CONDITION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-condition',
  OBSERVATION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-observation',
  ALLERGY_INTOLERANCE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-allergy-intolerance',
  MEDICATION_REQUEST: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-request',
  MEDICATION_DISPENSE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-dispense',
  MEDICATION_ADMINISTRATION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-administration',
  MEDICATION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication',
  SERVICE_REQUEST: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-service-request',
  SPECIMEN: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-specimen',
  DIAGNOSTIC_REPORT: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-diagnostic-report',
  COVERAGE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-coverage',
  CLAIM: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-claim',
  CLAIM_RESPONSE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-claim-response',
  CONSENT: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-consent',
  PROVENANCE: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-provenance',
  AUDIT_EVENT: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-audit-event',
  BUNDLE_COLLECTION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-collection-bundle',
  BUNDLE_TRANSACTION: 'https://fhir.dha.go.ke/core/StructureDefinition/kenya-transaction-bundle',
  OPERATION_OUTCOME: 'http://hl7.org/fhir/StructureDefinition/OperationOutcome',
} as const;

// ============================================================================
// 2. IDENTIFIER SYSTEMS
// ============================================================================

export const FHIR_IDENTIFIER_SYSTEMS = {
  // National Registries
  CR_ID: 'https://fhir.dha.go.ke/identifiers/cr-id',
  UPI: 'https://fhir.dha.go.ke/identifiers/upi',
  NATIONAL_ID: 'https://fhir.dha.go.ke/identifiers/national-id',
  SHA_NUMBER: 'https://fhir.dha.go.ke/identifiers/sha-number',
  KMFL_CODE: 'https://fhir.dha.go.ke/identifiers/kmfl-code',
  PUID: 'https://fhir.dha.go.ke/identifiers/puid',
  BIRTH_CERTIFICATE: 'https://fhir.dha.go.ke/identifiers/birth-certificate',
  ALIEN_ID: 'https://fhir.dha.go.ke/identifiers/alien-id',
  PASSPORT: 'https://fhir.dha.go.ke/identifiers/passport',

  // Local Facility & Internal Identifiers
  MRN: 'https://afyapoa.co.ke/identifiers/mrn',
  ENCOUNTER: 'https://afyapoa.co.ke/identifiers/encounter',
  CLAIM: 'https://afyapoa.co.ke/identifiers/claim',
  PREAUTH: 'https://afyapoa.co.ke/identifiers/preauth',
  ORDER: 'https://afyapoa.co.ke/identifiers/clinical-order',
  DISPENSE: 'https://afyapoa.co.ke/identifiers/medication-dispense',
  SPECIMEN_ACCESSION: 'https://afyapoa.co.ke/identifiers/specimen-accession',
  SPECIMEN_BARCODE: 'https://afyapoa.co.ke/identifiers/specimen-barcode',
  LAB_RESULT: 'https://afyapoa.co.ke/identifiers/lab-result',
  DIAGNOSTIC_REPORT: 'https://afyapoa.co.ke/identifiers/diagnostic-report',
  INVOICE: 'https://afyapoa.co.ke/identifiers/invoice',
  PAYMENT: 'https://afyapoa.co.ke/identifiers/payment',
} as const;

// ============================================================================
// 3. TERMINOLOGY SYSTEMS
// ============================================================================

export const FHIR_TERMINOLOGY_SYSTEMS = {
  // Diagnostic
  ICD11_MMS: 'http://id.who.int/icd/release/11/mms',
  ICD_11_MMS: 'http://id.who.int/icd/release/11/mms',
  ICD10: 'http://hl7.org/fhir/sid/icd-10', // Legacy, flagged as deprecated for national exchange
  ICD_10: 'http://hl7.org/fhir/sid/icd-10',

  // Laboratory & Clinical Observations
  LOINC: 'http://loinc.org',

  // Clinical Interventions & Procedures
  WHO_ICHI: 'https://id.who.int/ichi',

  // Medications
  KEML: 'http://keml.health.go.ke',
  ATC: 'http://www.whocc.no/atc',
  PPB: 'https://pharmacyboardkenya.org/systems/drug-codes',

  // Clinical & Concepts
  SNOMED_CT: 'http://snomed.info/sct',
  UCUM: 'http://unitsofmeasure.org',

  // Standard HL7 Terminology Code Systems
  ACT_CODE: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  ACT_PHARMACY_CODE: 'http://terminology.hl7.org/CodeSystem/v3-ActPharmacyCode',
  OBSERVATION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  OBSERVATION_INTERPRETATION: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
  CONDITION_CLINICAL: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  CONDITION_VERIFICATION: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
  CONDITION_CATEGORY: 'http://terminology.hl7.org/CodeSystem/condition-category',
  ALLERGY_CLINICAL: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
  ALLERGY_VERIFICATION: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
  SERVICE_REQUEST_CATEGORY: 'http://terminology.hl7.org/CodeSystem/servicerequest-category',
  DIAGNOSTIC_SERVICE_SECTION: 'http://terminology.hl7.org/CodeSystem/v2-0074',
  CONFIDENTIALITY: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
  SECURITY_SENSITIVITY: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  PROVENANCE_PARTICIPANT_TYPE: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
  PROVENANCE_ACTIVITY_TYPE: 'http://terminology.hl7.org/CodeSystem/v3-DataOperation',
} as const;

// ============================================================================
// 4. SECURITY & SENSITIVITY TAGS
// ============================================================================

export const FHIR_SECURITY_TAGS = {
  CONFIDENTIALITY_NORMAL: {
    system: FHIR_TERMINOLOGY_SYSTEMS.CONFIDENTIALITY,
    code: 'N',
    display: 'normal',
  },
  CONFIDENTIALITY_RESTRICTED: {
    system: FHIR_TERMINOLOGY_SYSTEMS.CONFIDENTIALITY,
    code: 'R',
    display: 'restricted',
  },
  SENSITIVITY_HIV: {
    system: FHIR_TERMINOLOGY_SYSTEMS.SECURITY_SENSITIVITY,
    code: 'HIV',
    display: 'Human immunodeficiency virus information sensitivity',
  },
  SENSITIVITY_PSY: {
    system: FHIR_TERMINOLOGY_SYSTEMS.SECURITY_SENSITIVITY,
    code: 'PSY',
    display: 'Psychiatric information sensitivity',
  },
  SENSITIVITY_SUD: {
    system: FHIR_TERMINOLOGY_SYSTEMS.SECURITY_SENSITIVITY,
    code: 'SUD',
    display: 'Substance use disorder information sensitivity',
  },
  SENSITIVITY_RH: {
    system: FHIR_TERMINOLOGY_SYSTEMS.SECURITY_SENSITIVITY,
    code: 'RH',
    display: 'Reproductive health information sensitivity',
  },
} as const;
