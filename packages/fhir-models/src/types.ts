/**
 * COMKEY AFYA POA — Kenya Core HL7 FHIR R4 Model Definitions & Types
 * Conforming to Kenya Core FHIR Profiles under DHA HIE v1.x.
 */

export type FHIRResourceType =
  | 'Patient'
  | 'Encounter'
  | 'Practitioner'
  | 'PractitionerRole'
  | 'Organization'
  | 'Location'
  | 'Condition'
  | 'Observation'
  | 'AllergyIntolerance'
  | 'MedicationRequest'
  | 'MedicationDispense'
  | 'MedicationAdministration'
  | 'Medication'
  | 'ServiceRequest'
  | 'Specimen'
  | 'DiagnosticReport'
  | 'Coverage'
  | 'Claim'
  | 'ClaimResponse'
  | 'Consent'
  | 'Provenance'
  | 'AuditEvent'
  | 'Bundle'
  | 'OperationOutcome'
  | 'DocumentReference';

export interface FHIRCoding {
  system: string;
  code: string;
  display?: string;
  version?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary';
  type?: FHIRCodeableConcept;
  system: string;
  value: string;
  period?: FHIRPeriod;
}

export interface FHIRReference {
  reference: string;
  type?: string;
  identifier?: FHIRIdentifier;
  display?: string;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

export interface FHIRQuantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

export interface FHIRMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: FHIRCoding[];
  tag?: FHIRCoding[];
}

export interface FHIRNarrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

export interface FHIRAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRContactPoint {
  system: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
}

export interface FHIRHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family: string;
  given: string[];
  prefix?: string[];
  suffix?: string[];
}

// ============================================================================
// 1. PATIENT PROFILE (KenyaCorePatient)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-patient
// ============================================================================

export interface KenyaCorePatient {
  resourceType: 'Patient';
  id?: string;
  meta?: FHIRMeta;
  text?: FHIRNarrative;
  identifier: FHIRIdentifier[]; // Must contain CR ID or National ID or SHA Number
  active: boolean;
  name: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: FHIRAddress[];
  maritalStatus?: FHIRCodeableConcept;
  managingOrganization?: FHIRReference; // Reference to Organization KMFL
}

// ============================================================================
// 2. ENCOUNTER PROFILE (KenyaCoreEncounter)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-encounter
// ============================================================================

export interface KenyaCoreEncounter {
  resourceType: 'Encounter';
  id?: string;
  meta?: FHIRMeta;
  text?: FHIRNarrative;
  identifier?: FHIRIdentifier[];
  status:
    | 'planned'
    | 'arrived'
    | 'triaged'
    | 'in-progress'
    | 'onleave'
    | 'finished'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  class: FHIRCoding; // AMB, EMER, IMP, etc.
  type?: FHIRCodeableConcept[];
  serviceType?: FHIRCodeableConcept;
  priority?: FHIRCodeableConcept;
  subject: FHIRReference; // Reference to Patient
  episodeOfCare?: FHIRReference[]; // Invariant for SHR Collection Bundle
  participant?: Array<{
    type?: FHIRCodeableConcept[];
    individual?: FHIRReference; // Practitioner PUID
  }>;
  period?: FHIRPeriod;
  reasonCode?: FHIRCodeableConcept[];
  diagnosis?: Array<{
    condition: FHIRReference; // Condition reference
    use?: FHIRCodeableConcept;
    rank?: number;
  }>;
  hospitalization?: {
    preAdmissionIdentifier?: FHIRIdentifier;
    origin?: FHIRReference;
    admitSource?: FHIRCodeableConcept;
    reAdmission?: FHIRCodeableConcept;
    dietPreference?: FHIRCodeableConcept[];
    specialCourtesy?: FHIRCodeableConcept[];
    specialArrangement?: FHIRCodeableConcept[];
    destination?: FHIRReference;
    dischargeDisposition?: FHIRCodeableConcept;
  };
  location?: Array<{
    location: FHIRReference;
    status?: 'planned' | 'active' | 'reserved' | 'completed';
    period?: FHIRPeriod;
  }>;
  serviceProvider?: FHIRReference; // Organization KMFL
}

// ============================================================================
// 3. PRACTITIONER & PRACTITIONER ROLE PROFILES
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-practitioner
// ============================================================================

export interface KenyaCorePractitioner {
  resourceType: 'Practitioner';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[]; // Must contain PUID and/or Council Reg Number
  active: boolean;
  name?: FHIRHumanName[];
  telecom?: FHIRContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  qualification?: Array<{
    identifier?: FHIRIdentifier[];
    code: FHIRCodeableConcept;
    period?: FHIRPeriod;
    issuer?: FHIRReference; // KMPDC, NCK, PPB
  }>;
}

export interface KenyaCorePractitionerRole {
  resourceType: 'PractitionerRole';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  active?: boolean;
  period?: FHIRPeriod;
  practitioner?: FHIRReference; // Practitioner PUID
  organization?: FHIRReference; // Organization KMFL
  code?: FHIRCodeableConcept[]; // Doctor, Nurse, Pharmacist, Lab Tech
  specialty?: FHIRCodeableConcept[];
  location?: FHIRReference[];
  telecom?: FHIRContactPoint[];
}

// ============================================================================
// 4. ORGANIZATION & LOCATION PROFILES
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-organization
// ============================================================================

export interface KenyaCoreOrganization {
  resourceType: 'Organization';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[]; // Must contain KMFL / FR Code
  active: boolean;
  type?: FHIRCodeableConcept[]; // Level 2, Level 3, Level 4, Level 5, Level 6
  name: string;
  alias?: string[];
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress[];
  partOf?: FHIRReference; // County Health Department or Health Network
}

export interface KenyaCoreLocation {
  resourceType: 'Location';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status?: 'active' | 'suspended' | 'inactive';
  name: string;
  description?: string;
  mode?: 'instance' | 'kind';
  type?: FHIRCodeableConcept[]; // Ward, Consultation Room, Pharmacy, Lab
  telecom?: FHIRContactPoint[];
  address?: FHIRAddress;
  physicalType?: FHIRCodeableConcept;
  managingOrganization?: FHIRReference; // Organization KMFL
  partOf?: FHIRReference;
}

// ============================================================================
// 5. CONDITION PROFILE (KenyaCoreCondition)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-condition
// ============================================================================

export interface KenyaCoreCondition {
  resourceType: 'Condition';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  clinicalStatus?: FHIRCodeableConcept; // active, recurrence, relapse, inactive, remission, resolved
  verificationStatus?: FHIRCodeableConcept; // unconfirmed, provisional, differential, confirmed, refuted, entered-in-error
  category?: FHIRCodeableConcept[]; // problem-list-item, encounter-diagnosis
  severity?: FHIRCodeableConcept;
  code: FHIRCodeableConcept; // WHO ICD-11 MMS (Mandatory)
  bodySite?: FHIRCodeableConcept[];
  subject: FHIRReference; // Patient
  encounter?: FHIRReference; // Encounter
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FHIRReference; // Practitioner PUID
  asserter?: FHIRReference;
  stage?: Array<{
    summary?: FHIRCodeableConcept;
    assessment?: FHIRReference[];
    type?: FHIRCodeableConcept;
  }>;
  evidence?: Array<{
    code?: FHIRCodeableConcept[];
    detail?: FHIRReference[];
  }>;
  note?: Array<{ text: string }>;
}

// ============================================================================
// 6. OBSERVATION PROFILE (KenyaCoreObservation)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-observation
// ============================================================================

export interface KenyaCoreObservation {
  resourceType: 'Observation';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[]; // ServiceRequest
  status:
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: FHIRCodeableConcept[]; // vital-signs, laboratory, exam
  code: FHIRCodeableConcept; // LOINC (Mandatory)
  subject: FHIRReference; // Patient
  encounter?: FHIRReference; // Encounter
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued?: string;
  performer?: FHIRReference[]; // Practitioner PUID
  valueQuantity?: FHIRQuantity;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  dataAbsentReason?: FHIRCodeableConcept;
  interpretation?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
  bodySite?: FHIRCodeableConcept;
  method?: FHIRCodeableConcept;
  specimen?: FHIRReference; // Specimen
  device?: FHIRReference;
  referenceRange?: Array<{
    low?: FHIRQuantity;
    high?: FHIRQuantity;
    type?: FHIRCodeableConcept;
    appliesTo?: FHIRCodeableConcept[];
    age?: { low?: FHIRQuantity; high?: FHIRQuantity };
    text?: string;
  }>;
  hasMember?: FHIRReference[];
  derivedFrom?: FHIRReference[];
  component?: Array<{
    code: FHIRCodeableConcept;
    valueQuantity?: FHIRQuantity;
    valueCodeableConcept?: FHIRCodeableConcept;
    valueString?: string;
    interpretation?: FHIRCodeableConcept[];
    referenceRange?: Array<{
      low?: FHIRQuantity;
      high?: FHIRQuantity;
      text?: string;
    }>;
  }>;
}

// ============================================================================
// 7. ALLERGY INTOLERANCE PROFILE (KenyaCoreAllergyIntolerance)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-allergy-intolerance
// ============================================================================

export interface KenyaCoreAllergyIntolerance {
  resourceType: 'AllergyIntolerance';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  clinicalStatus: FHIRCodeableConcept;
  verificationStatus: FHIRCodeableConcept;
  type?: 'allergy' | 'intolerance';
  category?: Array<'food' | 'medication' | 'environment' | 'biologic'>;
  criticality?: 'low' | 'high' | 'unable-to-assess';
  code: FHIRCodeableConcept;
  patient: FHIRReference;
  encounter?: FHIRReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FHIRReference;
  asserter?: FHIRReference;
  reaction?: Array<{
    substance?: FHIRCodeableConcept;
    manifestation: FHIRCodeableConcept[];
    description?: string;
    onset?: string;
    severity?: 'mild' | 'moderate' | 'severe';
    exposureRoute?: FHIRCodeableConcept;
    note?: Array<{ text: string }>;
  }>;
}

// ============================================================================
// 8. MEDICATION WORKFLOW PROFILES
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-medication-request
// ============================================================================

export interface KenyaCoreMedication {
  resourceType: 'Medication';
  id?: string;
  meta?: FHIRMeta;
  code: FHIRCodeableConcept; // KEML, PPB, or ATC
  status: 'active' | 'inactive' | 'entered-in-error';
  manufacturer?: FHIRReference;
  form?: FHIRCodeableConcept;
  amount?: {
    numerator?: FHIRQuantity;
    denominator?: FHIRQuantity;
  };
  ingredient?: Array<{
    itemCodeableConcept?: FHIRCodeableConcept;
    itemReference?: FHIRReference;
    isActive?: boolean;
    strength?: {
      numerator?: FHIRQuantity;
      denominator?: FHIRQuantity;
    };
  }>;
  batch?: {
    lotNumber?: string;
    expirationDate?: string;
  };
}

export interface KenyaCoreMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status:
    | 'active'
    | 'on-hold'
    | 'cancelled'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'draft'
    | 'unknown';
  statusReason?: FHIRCodeableConcept;
  intent:
    | 'proposal'
    | 'plan'
    | 'order'
    | 'original-order'
    | 'reflex-order'
    | 'filler-order'
    | 'instance-order'
    | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference; // Patient
  encounter?: FHIRReference; // Encounter
  authoredOn?: string;
  requester?: FHIRReference; // Practitioner PUID
  performer?: FHIRReference;
  recorder?: FHIRReference;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  note?: Array<{ text: string }>;
  dosageInstruction?: Array<{
    sequence?: number;
    text?: string;
    additionalInstruction?: FHIRCodeableConcept[];
    timing?: {
      code?: FHIRCodeableConcept;
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
    route?: FHIRCodeableConcept;
    method?: FHIRCodeableConcept;
    doseAndRate?: Array<{
      type?: FHIRCodeableConcept;
      doseQuantity?: FHIRQuantity;
    }>;
  }>;
  dispenseRequest?: {
    initialFill?: {
      quantity?: FHIRQuantity;
      duration?: FHIRQuantity;
    };
    dispenseInterval?: FHIRQuantity;
    validityPeriod?: FHIRPeriod;
    numberOfRepeatsAllowed?: number;
    quantity?: FHIRQuantity;
    expectedSupplyDuration?: FHIRQuantity;
    performer?: FHIRReference;
  };
  substitution?: {
    allowedBoolean?: boolean;
    allowedCodeableConcept?: FHIRCodeableConcept;
    reason?: FHIRCodeableConcept;
  };
}

export interface KenyaCoreMedicationDispense {
  resourceType: 'MedicationDispense';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  partOf?: FHIRReference[];
  status:
    | 'preparation'
    | 'in-progress'
    | 'cancelled'
    | 'on-hold'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'declined'
    | 'unknown';
  statusReasonCodeableConcept?: FHIRCodeableConcept;
  category?: FHIRCodeableConcept;
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference; // Patient
  context?: FHIRReference; // Encounter
  authorizingPrescription?: FHIRReference[]; // MedicationRequest
  type?: FHIRCodeableConcept;
  quantity?: FHIRQuantity;
  daysSupply?: FHIRQuantity;
  whenPrepared?: string;
  whenHandedOver?: string;
  destination?: FHIRReference;
  receiver?: FHIRReference[];
  note?: Array<{ text: string }>;
  dosageInstruction?: Array<{ text?: string }>;
  substitution?: {
    wasSubstituted: boolean;
    type?: FHIRCodeableConcept;
    reason?: FHIRCodeableConcept;
    responsibleParty?: FHIRReference[];
  };
  performer?: Array<{
    function?: FHIRCodeableConcept;
    actor: FHIRReference; // Pharmacist Practitioner PUID
  }>;
}

export interface KenyaCoreMedicationAdministration {
  resourceType: 'MedicationAdministration';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  partOf?: FHIRReference[];
  status:
    | 'in-progress'
    | 'not-done'
    | 'on-hold'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'unknown';
  statusReason?: FHIRCodeableConcept[];
  category?: FHIRCodeableConcept;
  medicationCodeableConcept?: FHIRCodeableConcept;
  medicationReference?: FHIRReference;
  subject: FHIRReference; // Patient
  context?: FHIRReference; // Encounter
  effectiveDateTime: string;
  effectivePeriod?: FHIRPeriod;
  performer?: Array<{
    function?: FHIRCodeableConcept;
    actor: FHIRReference; // Nurse Practitioner PUID
  }>;
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  request?: FHIRReference; // MedicationRequest
  device?: FHIRReference[];
  note?: Array<{ text: string }>;
  dosage?: {
    text?: string;
    site?: FHIRCodeableConcept;
    route?: FHIRCodeableConcept;
    method?: FHIRCodeableConcept;
    dose?: FHIRQuantity;
    rateQuantity?: FHIRQuantity;
  };
}

// ============================================================================
// 9. DIAGNOSTIC & SERVICE REQUEST PROFILES
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-service-request
// ============================================================================

export interface KenyaCoreServiceRequest {
  resourceType: 'ServiceRequest';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  basedOn?: FHIRReference[];
  replaces?: FHIRReference[];
  requisition?: FHIRIdentifier;
  status:
    | 'draft'
    | 'active'
    | 'on-hold'
    | 'revoked'
    | 'completed'
    | 'entered-in-error'
    | 'unknown';
  intent:
    | 'proposal'
    | 'plan'
    | 'directive'
    | 'order'
    | 'original-order'
    | 'reflex-order'
    | 'filler-order'
    | 'instance-order'
    | 'option';
  category?: FHIRCodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  code: FHIRCodeableConcept; // LOINC for Labs, WHO ICHI for Procedures
  orderDetail?: FHIRCodeableConcept[];
  quantityQuantity?: FHIRQuantity;
  subject: FHIRReference; // Patient
  encounter?: FHIRReference; // Encounter
  authoredOn?: string;
  requester?: FHIRReference; // Practitioner PUID
  performerType?: FHIRCodeableConcept;
  performer?: FHIRReference[];
  locationCode?: FHIRCodeableConcept[];
  locationReference?: FHIRReference[];
  reasonCode?: FHIRCodeableConcept[];
  reasonReference?: FHIRReference[];
  bodySite?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
  patientInstruction?: string;
}

export interface KenyaCoreSpecimen {
  resourceType: 'Specimen';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[];
  accessionIdentifier?: FHIRIdentifier;
  status?: 'available' | 'unavailable' | 'unsatisfactory' | 'entered-in-error';
  type: FHIRCodeableConcept;
  subject: FHIRReference; // Patient
  receivedTime?: string;
  parent?: FHIRReference[];
  request?: FHIRReference[]; // ServiceRequest
  collection?: {
    collector?: FHIRReference;
    collectedDateTime?: string;
    collectedPeriod?: FHIRPeriod;
    duration?: FHIRQuantity;
    quantity?: FHIRQuantity;
    method?: FHIRCodeableConcept;
    bodySite?: FHIRCodeableConcept;
    fastingStatusCodeableConcept?: FHIRCodeableConcept;
    container?: Array<{
      identifier?: FHIRIdentifier[];
      description?: string;
      type?: FHIRCodeableConcept;
      capacity?: FHIRQuantity;
      specimenQuantity?: FHIRQuantity;
      additiveCodeableConcept?: FHIRCodeableConcept;
    }>;
  };
  processing?: Array<{
    description?: string;
    procedure?: FHIRCodeableConcept;
    additive?: FHIRReference[];
    timeDateTime?: string;
  }>;
  container?: Array<{
    identifier?: FHIRIdentifier[];
    description?: string;
    type?: FHIRCodeableConcept;
    capacity?: FHIRQuantity;
    specimenQuantity?: FHIRQuantity;
    additiveCodeableConcept?: FHIRCodeableConcept;
  }>;
  condition?: FHIRCodeableConcept[];
  note?: Array<{ text: string }>;
}

export interface KenyaCoreDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[];
  basedOn?: FHIRReference[]; // ServiceRequest
  status:
    | 'registered'
    | 'partial'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'appended'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  category?: FHIRCodeableConcept[];
  code: FHIRCodeableConcept;
  subject: FHIRReference; // Patient
  encounter?: FHIRReference; // Encounter
  effectiveDateTime?: string;
  effectivePeriod?: FHIRPeriod;
  issued: string;
  performer?: FHIRReference[]; // Practitioner PUID
  resultsInterpreter?: FHIRReference[];
  specimen?: FHIRReference[];
  result?: FHIRReference[]; // Observations
  imagingStudy?: FHIRReference[];
  media?: Array<{
    comment?: string;
    link: FHIRReference;
  }>;
  conclusion?: string;
  conclusionCode?: FHIRCodeableConcept[];
  presentedForm?: Array<{
    contentType?: string;
    data?: string;
    url?: string;
    title?: string;
  }>;
}

// ============================================================================
// 10. FINANCIAL & COVERAGE PROFILES (KenyaCoreCoverage, KenyaCoreClaim)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-coverage
// ============================================================================

export interface KenyaCoreCoverage {
  resourceType: 'Coverage';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[]; // SHA Number
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type?: FHIRCodeableConcept; // PHC, SHIF, ECCIF
  subscriber?: FHIRReference;
  subscriberId?: string;
  beneficiary: FHIRReference; // Patient
  dependent?: string;
  relationship?: FHIRCodeableConcept;
  period?: FHIRPeriod;
  payor: FHIRReference[]; // SHA Organization
  class?: Array<{
    type: FHIRCodeableConcept;
    value: string;
    name?: string;
  }>;
  order?: number;
  network?: string;
  costToBeneficiary?: Array<{
    type?: FHIRCodeableConcept;
    valueQuantity?: FHIRQuantity;
    valueMoney?: { value: number; currency: 'KES' };
  }>;
}

export interface KenyaCoreClaim {
  resourceType: 'Claim';
  id?: string;
  meta?: FHIRMeta;
  identifier: FHIRIdentifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: FHIRCodeableConcept;
  subType?: FHIRCodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: FHIRReference; // Patient
  billablePeriod: FHIRPeriod;
  created: string;
  enterer?: FHIRReference;
  insurer?: FHIRReference; // SHA Organization
  provider: FHIRReference; // Organization KMFL
  priority?: FHIRCodeableConcept;
  fundsReserve?: FHIRCodeableConcept;
  related?: Array<{
    claim?: FHIRReference; // Original claim for resubmissions
    relationship?: FHIRCodeableConcept;
    reference?: FHIRIdentifier;
  }>;
  prescription?: FHIRReference;
  originalPrescription?: FHIRReference;
  payee?: {
    type: FHIRCodeableConcept;
    party?: FHIRReference;
  };
  referral?: FHIRReference;
  facility?: FHIRReference;
  careTeam?: Array<{
    sequence: number;
    provider: FHIRReference; // Practitioner PUID
    responsible?: boolean;
    role?: FHIRCodeableConcept;
    qualification?: FHIRCodeableConcept;
  }>;
  supportingInfo?: Array<{
    sequence: number;
    category: FHIRCodeableConcept;
    code?: FHIRCodeableConcept;
    timingDate?: string;
    valueString?: string;
    valueReference?: FHIRReference;
  }>;
  diagnosis?: Array<{
    sequence: number;
    diagnosisCodeableConcept?: FHIRCodeableConcept; // WHO ICD-11
    diagnosisReference?: FHIRReference;
    type?: FHIRCodeableConcept[];
    onAdmission?: FHIRCodeableConcept;
  }>;
  procedure?: Array<{
    sequence: number;
    type?: FHIRCodeableConcept[];
    date?: string;
    procedureCodeableConcept?: FHIRCodeableConcept;
    procedureReference?: FHIRReference;
  }>;
  insurance: Array<{
    sequence: number;
    focal: boolean;
    identifier?: FHIRIdentifier;
    coverage: FHIRReference; // Coverage
    preAuthRef?: string[];
  }>;
  item: Array<{
    sequence: number;
    careTeamSequence?: number[];
    diagnosisSequence?: number[];
    procedureSequence?: number[];
    informationSequence?: number[];
    revenue?: FHIRCodeableConcept;
    category?: FHIRCodeableConcept;
    productOrService: FHIRCodeableConcept;
    modifier?: FHIRCodeableConcept[];
    programCode?: FHIRCodeableConcept[];
    servicedDate?: string;
    quantity?: FHIRQuantity;
    unitPrice?: { value: number; currency: 'KES' };
    factor?: number;
    net?: { value: number; currency: 'KES' };
  }>;
  total?: {
    value: number;
    currency: 'KES';
  };
}

export interface KenyaCoreClaimResponse {
  resourceType: 'ClaimResponse';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'active' | 'cancelled' | 'draft' | 'entered-in-error';
  type: FHIRCodeableConcept;
  use: 'claim' | 'preauthorization' | 'predetermination';
  patient: FHIRReference;
  created: string;
  insurer: FHIRReference;
  requestor?: FHIRReference;
  request?: FHIRReference; // Reference to Claim
  outcome: 'queued' | 'complete' | 'error' | 'partial';
  disposition?: string;
  preAuthRef?: string;
  preAuthPeriod?: FHIRPeriod;
  payeeType?: FHIRCodeableConcept;
  item?: Array<{
    itemSequence: number;
    adjudication: Array<{
      category: FHIRCodeableConcept;
      reason?: FHIRCodeableConcept;
      amount?: { value: number; currency: 'KES' };
      value?: number;
    }>;
  }>;
  total?: Array<{
    category: FHIRCodeableConcept;
    amount: { value: number; currency: 'KES' };
  }>;
  payment?: {
    type: FHIRCodeableConcept;
    adjustment?: { value: number; currency: 'KES' };
    adjustmentReason?: FHIRCodeableConcept;
    date?: string;
    amount: { value: number; currency: 'KES' };
    identifier?: FHIRIdentifier;
  };
  error?: Array<{
    itemSequence?: number;
    detailSequence?: number;
    subDetailSequence?: number;
    code: FHIRCodeableConcept;
  }>;
}

// ============================================================================
// 11. CONSENT PROFILE (KenyaCoreConsent)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-consent
// ============================================================================

export interface KenyaCoreConsent {
  resourceType: 'Consent';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier[];
  status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
  scope: FHIRCodeableConcept; // patient-privacy
  category: FHIRCodeableConcept[]; // SHR Consent, Emergency Override
  patient: FHIRReference; // Patient
  dateTime?: string;
  performer?: FHIRReference[];
  organization?: FHIRReference[]; // KMFL Facility
  policy?: Array<{
    authority?: string;
    uri?: string;
  }>;
  policyRule?: FHIRCodeableConcept;
  verification?: Array<{
    verified: boolean;
    verifiedWith?: FHIRReference;
    verificationDate?: string;
  }>;
  provision?: {
    type?: 'deny' | 'permit';
    period?: FHIRPeriod;
    actor?: Array<{
      role: FHIRCodeableConcept;
      reference: FHIRReference;
    }>;
    action?: FHIRCodeableConcept[];
    securityLabel?: FHIRCoding[];
    purpose?: FHIRCoding[];
    data?: Array<{
      meaning: 'instance' | 'related' | 'dependents' | 'authoredby';
      reference: FHIRReference;
    }>;
  };
}

// ============================================================================
// 12. PROVENANCE & AUDIT EVENT PROFILES
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-provenance
// ============================================================================

export interface KenyaCoreProvenance {
  resourceType: 'Provenance';
  id?: string;
  meta?: FHIRMeta;
  target: FHIRReference[]; // Resources created/updated by this activity
  occurredDateTime?: string;
  recorded: string;
  policy?: string[];
  location?: FHIRReference;
  reason?: FHIRCodeableConcept[];
  activity?: FHIRCodeableConcept; // CREATE, UPDATE, DELETE, DISCHARGE
  agent: Array<{
    type?: FHIRCodeableConcept;
    role?: FHIRCodeableConcept[];
    who: FHIRReference; // Practitioner PUID or Organization KMFL
    onBehalfOf?: FHIRReference; // Organization KMFL
  }>;
  entity?: Array<{
    role: 'derivation' | 'revision' | 'quotation' | 'source' | 'removal';
    what: FHIRReference;
  }>;
  signature?: Array<{
    type: FHIRCoding[];
    when: string;
    who: FHIRReference;
    sigFormat?: string;
    data?: string; // Base64 signature hash
  }>;
}

export interface KenyaCoreAuditEvent {
  resourceType: 'AuditEvent';
  id?: string;
  meta?: FHIRMeta;
  type: FHIRCoding; // REST, SEARCH, AUTH
  subtype?: FHIRCoding[];
  action?: 'C' | 'R' | 'U' | 'D' | 'E';
  period?: FHIRPeriod;
  recorded: string;
  outcome?: '0' | '4' | '8' | '12'; // 0 = Success, 4 = Minor failure, 8 = Serious failure, 12 = Major failure
  outcomeDesc?: string;
  purposeOfEvent?: FHIRCodeableConcept[];
  agent: Array<{
    type?: FHIRCodeableConcept;
    role?: FHIRCodeableConcept[];
    who?: FHIRReference;
    altId?: string;
    name?: string;
    requestor: boolean;
    location?: FHIRReference;
    network?: {
      address?: string;
      type?: '1' | '2' | '3' | '4' | '5';
    };
  }>;
  source: {
    site?: string;
    observer: FHIRReference;
    type?: FHIRCoding[];
  };
  entity?: Array<{
    what?: FHIRReference;
    type?: FHIRCoding;
    role?: FHIRCoding;
    name?: string;
    query?: string;
    detail?: Array<{
      type: string;
      valueString?: string;
      valueBase64Binary?: string;
    }>;
  }>;
}

// ============================================================================
// 13. BUNDLE PROFILES (KenyaCollectionBundle & KenyaTransactionBundle)
// Canonical: https://fhir.dha.go.ke/core/StructureDefinition/kenya-collection-bundle
// ============================================================================

export interface KenyaCoreBundleEntry<T = unknown> {
  fullUrl?: string;
  resource: T;
  search?: {
    mode?: 'match' | 'include' | 'outcome';
    score?: number;
  };
  request?: {
    method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    ifNoneMatch?: string;
    ifMatch?: string;
    ifNoneExist?: string;
  };
  response?: {
    status: string;
    location?: string;
    etag?: string;
    lastModified?: string;
    outcome?: unknown;
  };
}

export interface KenyaCoreBundle {
  resourceType: 'Bundle';
  id?: string;
  meta?: FHIRMeta;
  identifier?: FHIRIdentifier;
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry: KenyaCoreBundleEntry[];
  signature?: {
    type: FHIRCoding[];
    when: string;
    who: FHIRReference;
    data: string;
  };
}

// ============================================================================
// 14. OPERATION OUTCOME (KenyaCoreOperationOutcome)
// ============================================================================

export interface FHIRIssue {
  severity: 'fatal' | 'error' | 'warning' | 'information';
  code:
    | 'invalid'
    | 'structure'
    | 'required'
    | 'value'
    | 'invariant'
    | 'security'
    | 'login'
    | 'unknown'
    | 'expired'
    | 'forbidden'
    | 'suppressed'
    | 'processing'
    | 'not-supported'
    | 'duplicate'
    | 'multiple-matches'
    | 'not-found'
    | 'deleted'
    | 'too-long'
    | 'code-invalid'
    | 'extension'
    | 'too-costly'
    | 'business-rule'
    | 'conflict'
    | 'transient'
    | 'lock-error'
    | 'no-store'
    | 'exception'
    | 'timeout'
    | 'incomplete'
    | 'throttled'
    | 'informational';
  details?: FHIRCodeableConcept;
  diagnostics?: string;
  location?: string[];
  expression?: string[];
}

export interface KenyaCoreOperationOutcome {
  resourceType: 'OperationOutcome';
  id?: string;
  meta?: FHIRMeta;
  issue: FHIRIssue[];
}
