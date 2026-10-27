/**
 * COMKEY AFYA POA — Typed Domain-to-FHIR Mappings
 * Translates internal domain entities to Kenya Core FHIR R4 resources.
 */

import {
  FHIR_CANONICAL_PROFILES,
  FHIR_IDENTIFIER_SYSTEMS,
  FHIR_TERMINOLOGY_SYSTEMS,
} from './canonical.js';
import {
  KenyaCorePatient,
  KenyaCoreEncounter,
  KenyaCorePractitioner,
  KenyaCoreOrganization,
  KenyaCoreCondition,
  KenyaCoreObservation,
  KenyaCoreAllergyIntolerance,
  KenyaCoreMedicationRequest,
  KenyaCoreMedicationDispense,
  KenyaCoreMedicationAdministration,
  KenyaCoreMedication,
  KenyaCoreServiceRequest,
  KenyaCoreSpecimen,
  KenyaCoreDiagnosticReport,
  KenyaCoreCoverage,
  KenyaCoreClaim,
  KenyaCoreConsent,
  FHIRCoding,
  FHIRIdentifier,
  FHIRReference,
} from './types.js';

// ============================================================================
// 1. PATIENT MAPPER
// ============================================================================

export function toFHIRPatient(patient: {
  id: string;
  mrn?: string;
  dhaCrid?: string;
  shaNumber?: string;
  nationalId?: string;
  passportNumber?: string;
  birthCertificateNumber?: string;
  alienId?: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string | Date;
  gender: string;
  phoneMasked?: string;
  email?: string | null;
  county?: string | null;
  subCounty?: string | null;
  villageOrEstate?: string | null;
  postalAddress?: string | null;
  postalCode?: string | null;
  managingFacilityId?: string;
  status?: string;
}): KenyaCorePatient {
  const identifiers: FHIRIdentifier[] = [];

  if (patient.dhaCrid) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.CR_ID,
      value: patient.dhaCrid,
    });
  }

  if (patient.shaNumber) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.SHA_NUMBER,
      value: patient.shaNumber,
    });
  }

  if (patient.nationalId) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.NATIONAL_ID,
      value: patient.nationalId,
    });
  }

  if (patient.mrn) {
    identifiers.push({
      use: 'usual',
      system: FHIR_IDENTIFIER_SYSTEMS.MRN,
      value: patient.mrn,
    });
  }

  if (patient.birthCertificateNumber) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.BIRTH_CERTIFICATE,
      value: patient.birthCertificateNumber,
    });
  }

  if (patient.passportNumber) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.PASSPORT,
      value: patient.passportNumber,
    });
  }

  if (patient.alienId) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.ALIEN_ID,
      value: patient.alienId,
    });
  }

  // Fallback identifier if none supplied
  if (identifiers.length === 0) {
    identifiers.push({
      use: 'temp',
      system: FHIR_IDENTIFIER_SYSTEMS.MRN,
      value: patient.id,
    });
  }

  const givenNames: string[] = [patient.firstName];
  if (patient.middleName) {
    givenNames.push(patient.middleName);
  }

  const birthDateStr =
    typeof patient.dateOfBirth === 'string'
      ? patient.dateOfBirth.substring(0, 10)
      : patient.dateOfBirth.toISOString().substring(0, 10);

  const genderMap: Record<string, KenyaCorePatient['gender']> = {
    MALE: 'male',
    FEMALE: 'female',
    OTHER: 'other',
    UNKNOWN: 'unknown',
  };

  return {
    resourceType: 'Patient',
    id: patient.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.PATIENT],
      lastUpdated: new Date().toISOString(),
    },
    identifier: identifiers,
    active: patient.status !== 'INACTIVE' && patient.status !== 'DECEASED',
    name: [
      {
        use: 'official',
        family: patient.lastName,
        given: givenNames,
      },
    ],
    gender: genderMap[patient.gender.toUpperCase()] || 'unknown',
    birthDate: birthDateStr,
    ...(patient.phoneMasked || patient.email
      ? {
          telecom: [
            ...(patient.phoneMasked
              ? [{ system: 'phone' as const, value: patient.phoneMasked, use: 'mobile' as const }]
              : []),
            ...(patient.email
              ? [{ system: 'email' as const, value: patient.email, use: 'home' as const }]
              : []),
          ],
        }
      : {}),
    ...(patient.county || patient.subCounty || patient.villageOrEstate || patient.postalAddress
      ? {
          address: [
            {
              use: 'home',
              type: 'both',
              line: [patient.villageOrEstate || '', patient.postalAddress || ''].filter(Boolean),
              district: patient.subCounty || undefined,
              state: patient.county || undefined,
              postalCode: patient.postalCode || undefined,
              country: 'KEN',
            },
          ],
        }
      : {}),
    ...(patient.managingFacilityId
      ? {
          managingOrganization: {
            reference: `Organization/${patient.managingFacilityId}`,
            type: 'Organization',
          },
        }
      : {}),
  };
}

// ============================================================================
// 2. ENCOUNTER MAPPER
// ============================================================================

export function toFHIREncounter(encounter: {
  id: string;
  encounterNumber: string;
  patientId: string;
  facilityId: string;
  facilityCode?: string;
  clinicianId?: string;
  status: string;
  encounterType: string;
  startedAt: Date | string;
  endedAt?: Date | string | null;
  episodeOfCareId?: string;
}): KenyaCoreEncounter {
  const statusMap: Record<string, KenyaCoreEncounter['status']> = {
    PLANNED: 'planned',
    ARRIVED: 'arrived',
    TRIAGED: 'triaged',
    IN_PROGRESS: 'in-progress',
    ON_HOLD: 'onleave',
    COMPLETED: 'finished',
    CANCELLED: 'cancelled',
    REOPENED: 'in-progress',
  };

  const classCode =
    encounter.encounterType === 'EMERGENCY'
      ? 'EMER'
      : encounter.encounterType === 'INPATIENT'
      ? 'IMP'
      : 'AMB';

  const classDisplay =
    encounter.encounterType === 'EMERGENCY'
      ? 'emergency'
      : encounter.encounterType === 'INPATIENT'
      ? 'inpatient encounter'
      : 'ambulatory';

  return {
    resourceType: 'Encounter',
    id: encounter.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.ENCOUNTER],
      lastUpdated: new Date().toISOString(),
    },
    identifier: [
      {
        use: 'official',
        system: FHIR_IDENTIFIER_SYSTEMS.ENCOUNTER,
        value: encounter.encounterNumber,
      },
    ],
    status: statusMap[encounter.status] || 'in-progress',
    class: {
      system: FHIR_TERMINOLOGY_SYSTEMS.ACT_CODE,
      code: classCode,
      display: classDisplay,
    },
    subject: {
      reference: `Patient/${encounter.patientId}`,
      type: 'Patient',
    },
    ...(encounter.episodeOfCareId
      ? {
          episodeOfCare: [
            {
              reference: `EpisodeOfCare/${encounter.episodeOfCareId}`,
              type: 'EpisodeOfCare',
            },
          ],
        }
      : {}),
    serviceProvider: {
      reference: `Organization/${encounter.facilityId}`,
      type: 'Organization',
      display: encounter.facilityCode || 'Health Facility',
    },
    period: {
      start: typeof encounter.startedAt === 'string' ? encounter.startedAt : encounter.startedAt.toISOString(),
      ...(encounter.endedAt
        ? { end: typeof encounter.endedAt === 'string' ? encounter.endedAt : encounter.endedAt.toISOString() }
        : {}),
    },
    ...(encounter.clinicianId
      ? {
          participant: [
            {
              individual: {
                reference: `Practitioner/${encounter.clinicianId}`,
                type: 'Practitioner',
              },
            },
          ],
        }
      : {}),
  };
}

// ============================================================================
// 3. PRACTITIONER & ORGANIZATION MAPPERS
// ============================================================================

export function toFHIRPractitioner(user: {
  id: string;
  fullName: string;
  puid?: string;
  councilRegistrationNumber?: string;
  role: string;
  email?: string;
  phone?: string;
  active?: boolean;
}): KenyaCorePractitioner {
  const identifiers: FHIRIdentifier[] = [];

  if (user.puid) {
    identifiers.push({
      use: 'official',
      system: FHIR_IDENTIFIER_SYSTEMS.PUID,
      value: user.puid,
    });
  }

  if (user.councilRegistrationNumber) {
    identifiers.push({
      use: 'official',
      system: 'https://kmpdc.go.ke/identifiers/registration-number',
      value: user.councilRegistrationNumber,
    });
  }

  if (identifiers.length === 0) {
    identifiers.push({
      use: 'temp',
      system: 'https://afyapoa.co.ke/identifiers/staff-id',
      value: user.id,
    });
  }

  const parts = user.fullName.trim().split(/\s+/);
  const family = parts.length > 1 ? parts[parts.length - 1]! : parts[0]!;
  const given = parts.length > 1 ? parts.slice(0, parts.length - 1) : [];

  return {
    resourceType: 'Practitioner',
    id: user.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.PRACTITIONER],
    },
    identifier: identifiers,
    active: user.active !== false,
    name: [
      {
        use: 'official',
        family,
        given,
        text: user.fullName,
      },
    ],
    ...(user.email || user.phone
      ? {
          telecom: [
            ...(user.phone ? [{ system: 'phone' as const, value: user.phone }] : []),
            ...(user.email ? [{ system: 'email' as const, value: user.email }] : []),
          ],
        }
      : {}),
  };
}

export function toFHIROrganization(facility: {
  id: string;
  kmflCode: string;
  name: string;
  level?: string;
  county?: string;
  subCounty?: string;
  active?: boolean;
}): KenyaCoreOrganization {
  return {
    resourceType: 'Organization',
    id: facility.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.ORGANIZATION],
    },
    identifier: [
      {
        use: 'official',
        system: FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE,
        value: facility.kmflCode,
      },
    ],
    active: facility.active !== false,
    name: facility.name,
    ...(facility.level
      ? {
          type: [
            {
              coding: [
                {
                  system: 'https://dha.go.ke/facility-levels',
                  code: facility.level,
                  display: `Level ${facility.level}`,
                },
              ],
            },
          ],
        }
      : {}),
    ...(facility.county || facility.subCounty
      ? {
          address: [
            {
              district: facility.subCounty || undefined,
              state: facility.county || undefined,
              country: 'KEN',
            },
          ],
        }
      : {}),
  };
}

// ============================================================================
// 4. OBSERVATION & VITALS MAPPERS
// ============================================================================

export function toFHIRObservations(vitals: {
  id: string;
  patientId: string;
  encounterId: string;
  assessedById: string;
  assessedAt: Date | string;
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperature?: number | null;
  oxygenSaturation?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  bmi?: number | null;
  bloodGlucose?: number | null;
}): KenyaCoreObservation[] {
  const effectiveDateTime =
    typeof vitals.assessedAt === 'string' ? vitals.assessedAt : vitals.assessedAt.toISOString();
  const subject: FHIRReference = { reference: `Patient/${vitals.patientId}`, type: 'Patient' };
  const encounter: FHIRReference = { reference: `Encounter/${vitals.encounterId}`, type: 'Encounter' };
  const performer: FHIRReference[] = [{ reference: `Practitioner/${vitals.assessedById}`, type: 'Practitioner' }];

  const observations: KenyaCoreObservation[] = [];

  // Blood Pressure Panel (LOINC 85354-9)
  if (vitals.systolicBp != null || vitals.diastolicBp != null) {
    const components: KenyaCoreObservation['component'] = [];
    if (vitals.systolicBp != null) {
      components.push({
        code: {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '8480-6', display: 'Systolic blood pressure' }],
          text: 'Systolic blood pressure',
        },
        valueQuantity: {
          value: Number(vitals.systolicBp),
          unit: 'mmHg',
          system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
          code: 'mm[Hg]',
        },
      });
    }
    if (vitals.diastolicBp != null) {
      components.push({
        code: {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '8462-4', display: 'Diastolic blood pressure' }],
          text: 'Diastolic blood pressure',
        },
        valueQuantity: {
          value: Number(vitals.diastolicBp),
          unit: 'mmHg',
          system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
          code: 'mm[Hg]',
        },
      });
    }
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-bp`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '85354-9', display: 'Blood pressure panel with all children optional' }],
        text: 'Blood Pressure',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      component: components,
    });
  }

  // Heart Rate (LOINC 8867-4)
  if (vitals.heartRate != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-hr`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '8867-4', display: 'Heart rate' }],
        text: 'Heart Rate',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.heartRate),
        unit: 'beats/minute',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: '/min',
      },
    });
  }

  // Respiratory Rate (LOINC 9279-1)
  if (vitals.respiratoryRate != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-rr`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '9279-1', display: 'Respiratory rate' }],
        text: 'Respiratory Rate',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.respiratoryRate),
        unit: 'breaths/minute',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: '/min',
      },
    });
  }

  // Body Temperature (LOINC 8310-5)
  if (vitals.temperature != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-temp`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '8310-5', display: 'Body temperature' }],
        text: 'Body Temperature',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.temperature),
        unit: 'Celsius',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: 'Cel',
      },
    });
  }

  // Oxygen Saturation (LOINC 2708-6)
  if (vitals.oxygenSaturation != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-spo2`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '2708-6', display: 'Oxygen saturation in Arterial blood' }],
        text: 'Oxygen Saturation',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.oxygenSaturation),
        unit: '%',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: '%',
      },
    });
  }

  // Weight (LOINC 29463-7)
  if (vitals.weightKg != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-wt`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '29463-7', display: 'Body weight' }],
        text: 'Weight',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.weightKg),
        unit: 'kg',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: 'kg',
      },
    });
  }

  // Height (LOINC 8302-2)
  if (vitals.heightCm != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-ht`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '8302-2', display: 'Body height' }],
        text: 'Height',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.heightCm),
        unit: 'cm',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: 'cm',
      },
    });
  }

  // BMI (LOINC 39156-5)
  if (vitals.bmi != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${vitals.id}-bmi`,
      meta: { profile: [FHIR_CANONICAL_PROFILES.OBSERVATION] },
      status: 'final',
      category: [
        {
          coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY, code: 'vital-signs', display: 'Vital Signs' }],
        },
      ],
      code: {
        coding: [{ system: FHIR_TERMINOLOGY_SYSTEMS.LOINC, code: '39156-5', display: 'Body mass index' }],
        text: 'Body Mass Index',
      },
      subject,
      encounter,
      effectiveDateTime,
      performer,
      valueQuantity: {
        value: Number(vitals.bmi),
        unit: 'kg/m2',
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: 'kg/m2',
      },
    });
  }

  return observations;
}

// ============================================================================
// 5. ALLERGY INTOLERANCE MAPPER
// ============================================================================

export function toFHIRAllergyIntolerance(allergy: {
  id: string;
  patientId: string;
  encounterId?: string | null;
  allergen: string;
  allergenType: string;
  severity: string;
  reaction?: string | null;
  clinicalStatus: string;
  verificationStatus: string;
  recordedAt: Date | string;
  recordedById?: string | null;
}): KenyaCoreAllergyIntolerance {
  const categoryMap: Record<string, KenyaCoreAllergyIntolerance['category']> = {
    FOOD: ['food'],
    MEDICATION: ['medication'],
    ENVIRONMENTAL: ['environment'],
    BIOLOGICAL: ['biologic'],
    OTHER: ['environment'],
  };

  const criticalityMap: Record<string, KenyaCoreAllergyIntolerance['criticality']> = {
    MILD: 'low',
    MODERATE: 'low',
    SEVERE: 'high',
    LIFE_THREATENING: 'high',
  };

  const severityMap: Record<string, 'mild' | 'moderate' | 'severe'> = {
    MILD: 'mild',
    MODERATE: 'moderate',
    SEVERE: 'severe',
    LIFE_THREATENING: 'severe',
  };

  return {
    resourceType: 'AllergyIntolerance',
    id: allergy.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.ALLERGY_INTOLERANCE],
    },
    clinicalStatus: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.ALLERGY_CLINICAL,
          code: allergy.clinicalStatus.toLowerCase(),
          display: allergy.clinicalStatus,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.ALLERGY_VERIFICATION,
          code: allergy.verificationStatus.toLowerCase(),
          display: allergy.verificationStatus,
        },
      ],
    },
    category: categoryMap[allergy.allergenType] || ['medication'],
    criticality: criticalityMap[allergy.severity] || 'low',
    code: {
      text: allergy.allergen,
      coding: [
        {
          system: 'https://afyapoa.co.ke/allergens',
          code: allergy.allergen.toLowerCase().replace(/\s+/g, '-'),
          display: allergy.allergen,
        },
      ],
    },
    patient: {
      reference: `Patient/${allergy.patientId}`,
      type: 'Patient',
    },
    ...(allergy.encounterId
      ? { encounter: { reference: `Encounter/${allergy.encounterId}`, type: 'Encounter' } }
      : {}),
    recordedDate:
      typeof allergy.recordedAt === 'string' ? allergy.recordedAt : allergy.recordedAt.toISOString(),
    ...(allergy.recordedById
      ? { recorder: { reference: `Practitioner/${allergy.recordedById}`, type: 'Practitioner' } }
      : {}),
    ...(allergy.reaction
      ? {
          reaction: [
            {
              manifestation: [
                {
                  text: allergy.reaction,
                  coding: [
                    {
                      system: 'https://afyapoa.co.ke/allergy-reactions',
                      code: allergy.reaction.toLowerCase().replace(/\s+/g, '-'),
                      display: allergy.reaction,
                    },
                  ],
                },
              ],
              severity: severityMap[allergy.severity] || 'moderate',
            },
          ],
        }
      : {}),
  };
}

// ============================================================================
// 6. CONDITION MAPPER (ICD-11 ENFORCEMENT)
// ============================================================================

export function toFHIRCondition(diagnosis: {
  id: string;
  patientId: string;
  encounterId: string;
  code: string;
  codingSystem: string;
  display: string;
  clinicalStatus: string;
  verificationStatus: string;
  certainty?: string;
  isPrimary?: boolean;
  onsetDate?: string | Date;
  notes?: string;
  recordedById?: string;
  recordedAt: string | Date;
}): KenyaCoreCondition {
  const systemMap: Record<string, string> = {
    ICD_11_MMS: FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS,
    ICD11: FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS,
    ICD_10: FHIR_TERMINOLOGY_SYSTEMS.ICD10,
    SNOMED_CT: FHIR_TERMINOLOGY_SYSTEMS.SNOMED_CT,
  };

  const codingSystemUri = systemMap[diagnosis.codingSystem] || FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS;

  return {
    resourceType: 'Condition',
    id: diagnosis.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.CONDITION],
    },
    clinicalStatus: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.CONDITION_CLINICAL,
          code: diagnosis.clinicalStatus.toLowerCase(),
          display: diagnosis.clinicalStatus,
        },
      ],
    },
    verificationStatus: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.CONDITION_VERIFICATION,
          code: diagnosis.verificationStatus.toLowerCase().replace(/_/g, '-'),
          display: diagnosis.verificationStatus,
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.CONDITION_CATEGORY,
            code: diagnosis.isPrimary ? 'encounter-diagnosis' : 'problem-list-item',
            display: diagnosis.isPrimary ? 'Encounter Diagnosis' : 'Problem List Item',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: codingSystemUri,
          code: diagnosis.code,
          display: diagnosis.display,
        },
      ],
      text: diagnosis.display,
    },
    subject: {
      reference: `Patient/${diagnosis.patientId}`,
      type: 'Patient',
    },
    encounter: {
      reference: `Encounter/${diagnosis.encounterId}`,
      type: 'Encounter',
    },
    ...(diagnosis.onsetDate
      ? {
          onsetDateTime:
            typeof diagnosis.onsetDate === 'string'
              ? diagnosis.onsetDate
              : diagnosis.onsetDate.toISOString(),
        }
      : {}),
    recordedDate:
      typeof diagnosis.recordedAt === 'string'
        ? diagnosis.recordedAt
        : diagnosis.recordedAt.toISOString(),
    ...(diagnosis.recordedById
      ? {
          recorder: {
            reference: `Practitioner/${diagnosis.recordedById}`,
            type: 'Practitioner',
          },
        }
      : {}),
    ...(diagnosis.notes ? { note: [{ text: diagnosis.notes }] } : {}),
  };
}

// ============================================================================
// 7. MEDICATION WORKFLOW MAPPERS
// ============================================================================

export function toFHIRMedicationRequest(
  order: {
    id: string;
    patientId: string;
    encounterId: string;
    orderNumber: string;
    status: string;
    priority: string;
    intent: string;
    clinicalIndication?: string;
    notes?: string;
    orderingPractitionerId: string;
    orderedAt: string | Date;
  },
  medication: {
    medicationCode: string;
    medicationName: string;
    codingSystem: string;
    dosage: string;
    dosageUnit: string;
    route: string;
    frequency: string;
    durationValue: number;
    durationUnit: string;
    totalQuantity: number;
    quantityUnit: string;
    instructions?: string;
    refillsAllowed?: number;
  },
): KenyaCoreMedicationRequest {
  const statusMap: Record<string, KenyaCoreMedicationRequest['status']> = {
    DRAFT: 'draft',
    SUBMITTED: 'active',
    ACTIVE: 'active',
    AUTHORIZED: 'active',
    IN_PROGRESS: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    SUSPENDED: 'on-hold',
    AMENDED: 'stopped',
  };

  const priorityMap: Record<string, KenyaCoreMedicationRequest['priority']> = {
    ROUTINE: 'routine',
    URGENT: 'urgent',
    STAT: 'stat',
    ASAP: 'asap',
  };

  return {
    resourceType: 'MedicationRequest',
    id: order.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.MEDICATION_REQUEST],
    },
    status: statusMap[order.status] || 'active',
    intent: 'order',
    priority: priorityMap[order.priority] || 'routine',
    medicationCodeableConcept: {
      coding: [
        {
          system: medication.codingSystem === 'KENYA_EML' ? FHIR_TERMINOLOGY_SYSTEMS.KEML : FHIR_TERMINOLOGY_SYSTEMS.ATC,
          code: medication.medicationCode,
          display: medication.medicationName,
        },
      ],
      text: medication.medicationName,
    },
    subject: {
      reference: `Patient/${order.patientId}`,
      type: 'Patient',
    },
    encounter: {
      reference: `Encounter/${order.encounterId}`,
      type: 'Encounter',
    },
    authoredOn: typeof order.orderedAt === 'string' ? order.orderedAt : order.orderedAt.toISOString(),
    requester: {
      reference: `Practitioner/${order.orderingPractitionerId}`,
      type: 'Practitioner',
    },
    ...(order.clinicalIndication ? { reasonCode: [{ text: order.clinicalIndication }] } : {}),
    ...(medication.instructions ? { note: [{ text: medication.instructions }] } : {}),
    dosageInstruction: [
      {
        text: `${medication.dosage} ${medication.dosageUnit} ${medication.route} ${medication.frequency} for ${medication.durationValue} ${medication.durationUnit}`,
        route: {
          coding: [
            {
              system: FHIR_TERMINOLOGY_SYSTEMS.SNOMED_CT,
              code: medication.route.toLowerCase(),
              display: medication.route,
            },
          ],
          text: medication.route,
        },
        timing: {
          code: {
            text: medication.frequency,
          },
        },
        doseAndRate: [
          {
            doseQuantity: {
              value: parseFloat(medication.dosage) || 1,
              unit: medication.dosageUnit,
            },
          },
        ],
      },
    ],
    dispenseRequest: {
      numberOfRepeatsAllowed: medication.refillsAllowed ?? 0,
      quantity: {
        value: medication.totalQuantity,
        unit: medication.quantityUnit,
      },
      expectedSupplyDuration: {
        value: medication.durationValue,
        unit: medication.durationUnit.toLowerCase(),
        system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
        code: medication.durationUnit === 'DAYS' ? 'd' : 'wk',
      },
    },
  };
}

export function toFHIRMedicationDispense(dispense: {
  id: string;
  dispenseNumber: string;
  status: string;
  dispenseType: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  medicationRequestId: string;
  medicationName?: string;
  medicationCode?: string;
  quantityDispensed: number;
  daysSupply?: number;
  dispenserId: string;
  dispensedAt: string | Date;
  dosageInstructions?: string;
  substitutionReason?: string;
  patientCounselingNotes?: string;
  notes?: string;
}): KenyaCoreMedicationDispense {
  const statusMap: Record<string, KenyaCoreMedicationDispense['status']> = {
    PREPARATION: 'preparation',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    ENTERED_IN_ERROR: 'entered-in-error',
    STOPPED: 'stopped',
    DECLINED: 'declined',
  };

  const notes: Array<{ text: string }> = [];
  if (dispense.patientCounselingNotes) {
    notes.push({ text: `Counseling: ${dispense.patientCounselingNotes}` });
  }
  if (dispense.notes) {
    notes.push({ text: dispense.notes });
  }

  return {
    resourceType: 'MedicationDispense',
    id: dispense.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.MEDICATION_DISPENSE],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.DISPENSE,
        value: dispense.dispenseNumber,
      },
    ],
    status: statusMap[dispense.status] || 'completed',
    type: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.ACT_PHARMACY_CODE,
          code: dispense.dispenseType,
          display: dispense.dispenseType,
        },
      ],
      text: dispense.dispenseType,
    },
    ...(dispense.medicationName
      ? {
          medicationCodeableConcept: {
            coding: dispense.medicationCode
              ? [
                  {
                    system: FHIR_TERMINOLOGY_SYSTEMS.KEML,
                    code: dispense.medicationCode,
                    display: dispense.medicationName,
                  },
                ]
              : undefined,
            text: dispense.medicationName,
          },
        }
      : {}),
    subject: {
      reference: `Patient/${dispense.patientId}`,
      type: 'Patient',
    },
    context: {
      reference: `Encounter/${dispense.encounterId}`,
      type: 'Encounter',
    },
    authorizingPrescription: [
      {
        reference: `MedicationRequest/${dispense.medicationRequestId}`,
        type: 'MedicationRequest',
      },
    ],
    quantity: {
      value: dispense.quantityDispensed,
    },
    ...(dispense.daysSupply
      ? {
          daysSupply: {
            value: dispense.daysSupply,
            unit: 'days',
          },
        }
      : {}),
    whenHandedOver:
      typeof dispense.dispensedAt === 'string'
        ? dispense.dispensedAt
        : dispense.dispensedAt.toISOString(),
    performer: [
      {
        actor: {
          reference: `Practitioner/${dispense.dispenserId}`,
          type: 'Practitioner',
        },
      },
    ],
    ...(dispense.dosageInstructions ? { dosageInstruction: [{ text: dispense.dosageInstructions }] } : {}),
    substitution: {
      wasSubstituted: Boolean(dispense.substitutionReason),
      ...(dispense.substitutionReason ? { reason: { text: dispense.substitutionReason } } : {}),
    },
    ...(notes.length > 0 ? { note: notes } : {}),
  };
}

export function toFHIRMedicationAdministration(admin: {
  id: string;
  status: string;
  patientId: string;
  encounterId: string;
  medicationRequestId: string;
  dispenseId?: string;
  medicationName: string;
  doseQuantity: number;
  doseUnit: string;
  route: string;
  site?: string;
  administratorId: string;
  administeredAt: string | Date;
  reasonNotAdministered?: string;
  notes?: string;
}): KenyaCoreMedicationAdministration {
  const statusMap: Record<string, KenyaCoreMedicationAdministration['status']> = {
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    NOT_DONE: 'not-done',
    ENTERED_IN_ERROR: 'entered-in-error',
    ON_HOLD: 'on-hold',
  };

  const notes: Array<{ text: string }> = [];
  if (admin.notes) {
    notes.push({ text: admin.notes });
  }

  return {
    resourceType: 'MedicationAdministration',
    id: admin.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.MEDICATION_ADMINISTRATION],
    },
    status: statusMap[admin.status] || 'completed',
    medicationCodeableConcept: {
      text: admin.medicationName,
    },
    subject: {
      reference: `Patient/${admin.patientId}`,
      type: 'Patient',
    },
    context: {
      reference: `Encounter/${admin.encounterId}`,
      type: 'Encounter',
    },
    effectiveDateTime:
      typeof admin.administeredAt === 'string'
        ? admin.administeredAt
        : admin.administeredAt.toISOString(),
    performer: [
      {
        actor: {
          reference: `Practitioner/${admin.administratorId}`,
          type: 'Practitioner',
        },
      },
    ],
    request: {
      reference: `MedicationRequest/${admin.medicationRequestId}`,
      type: 'MedicationRequest',
    },
    dosage: {
      text: `${admin.doseQuantity} ${admin.doseUnit} via ${admin.route}${admin.site ? ' at ' + admin.site : ''}`,
      route: {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.SNOMED_CT,
            code: admin.route,
            display: admin.route,
          },
        ],
        text: admin.route,
      },
      dose: {
        value: admin.doseQuantity,
        unit: admin.doseUnit,
      },
    },
    ...(admin.reasonNotAdministered
      ? {
          statusReason: [
            {
              text: admin.reasonNotAdministered,
            },
          ],
        }
      : {}),
    ...(notes.length > 0 ? { note: notes } : {}),
  };
}

export function toFHIRMedication(product: {
  id: string;
  itemCode: string;
  genericName: string;
  brandName?: string;
  atcCode?: string;
  form: string;
  strength: string;
  strengthUnit: string;
  isActive: boolean;
}): KenyaCoreMedication {
  const codings: FHIRCoding[] = [
    {
      system: FHIR_TERMINOLOGY_SYSTEMS.KEML,
      code: product.itemCode,
      display: product.genericName,
    },
  ];
  if (product.atcCode) {
    codings.push({
      system: FHIR_TERMINOLOGY_SYSTEMS.ATC,
      code: product.atcCode,
      display: product.genericName,
    });
  }

  return {
    resourceType: 'Medication',
    id: product.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.MEDICATION],
    },
    code: {
      coding: codings,
      text: `${product.genericName} ${product.strength}${product.strengthUnit}${product.brandName ? ` (${product.brandName})` : ''}`,
    },
    status: product.isActive ? 'active' : 'inactive',
    form: {
      text: product.form,
    },
  };
}

// ============================================================================
// 8. SERVICE REQUEST & LAB MAPPERS
// ============================================================================

export function toFHIRServiceRequest(
  order: {
    id: string;
    patientId: string;
    encounterId: string;
    orderNumber: string;
    status: string;
    priority: string;
    intent: string;
    clinicalIndication?: string;
    notes?: string;
    orderingPractitionerId: string;
    orderedAt: string | Date;
  },
  service: {
    serviceCategory: string;
    serviceCode: string;
    serviceName: string;
    codingSystem: string;
    specimenType?: string;
    bodySite?: string;
    clinicalNotes?: string;
    urgency: string;
  },
): KenyaCoreServiceRequest {
  const statusMap: Record<string, KenyaCoreServiceRequest['status']> = {
    DRAFT: 'draft',
    SUBMITTED: 'active',
    ACTIVE: 'active',
    AUTHORIZED: 'active',
    IN_PROGRESS: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'revoked',
    SUSPENDED: 'on-hold',
    AMENDED: 'revoked',
  };

  const priorityMap: Record<string, KenyaCoreServiceRequest['priority']> = {
    ROUTINE: 'routine',
    URGENT: 'urgent',
    STAT: 'stat',
    ASAP: 'asap',
  };

  const codingSystem =
    service.codingSystem === 'LOINC'
      ? FHIR_TERMINOLOGY_SYSTEMS.LOINC
      : service.codingSystem === 'ICHI'
      ? FHIR_TERMINOLOGY_SYSTEMS.WHO_ICHI
      : 'https://afyapoa.co.ke/procedures';

  return {
    resourceType: 'ServiceRequest',
    id: order.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.SERVICE_REQUEST],
    },
    status: statusMap[order.status] || 'active',
    intent: 'order',
    priority: priorityMap[order.priority] || 'routine',
    category: [
      {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.SERVICE_REQUEST_CATEGORY,
            code: service.serviceCategory.toLowerCase(),
            display: service.serviceCategory,
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: codingSystem,
          code: service.serviceCode,
          display: service.serviceName,
        },
      ],
      text: service.serviceName,
    },
    subject: {
      reference: `Patient/${order.patientId}`,
      type: 'Patient',
    },
    encounter: {
      reference: `Encounter/${order.encounterId}`,
      type: 'Encounter',
    },
    authoredOn: typeof order.orderedAt === 'string' ? order.orderedAt : order.orderedAt.toISOString(),
    requester: {
      reference: `Practitioner/${order.orderingPractitionerId}`,
      type: 'Practitioner',
    },
    ...(service.bodySite ? { bodySite: [{ text: service.bodySite }] } : {}),
    ...(service.clinicalNotes ? { note: [{ text: service.clinicalNotes }] } : {}),
  };
}

export function toFHIRSpecimen(specimen: {
  id: string;
  patientId: string;
  orderId: string;
  accessionNumber: string;
  barcode: string;
  specimenType: string;
  containerType: string;
  status: string;
  collectedById?: string;
  collectedAt?: string | Date;
  volumeMl?: number;
  collectionSite?: string;
  rejectionReason?: string;
  rejectionNotes?: string;
}): KenyaCoreSpecimen {
  const statusMap: Record<string, KenyaCoreSpecimen['status']> = {
    PENDING_COLLECTION: 'unavailable',
    COLLECTED: 'available',
    IN_TRANSIT: 'available',
    RECEIVED_IN_LAB: 'available',
    PROCESSING: 'available',
    COMPLETED: 'available',
    REJECTED: 'unsatisfactory',
  };

  const notes: Array<{ text: string }> = [];
  if (specimen.rejectionReason) {
    notes.push({ text: `Rejection Reason: ${specimen.rejectionReason}${specimen.rejectionNotes ? ' - ' + specimen.rejectionNotes : ''}` });
  }

  return {
    resourceType: 'Specimen',
    id: specimen.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.SPECIMEN],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.SPECIMEN_ACCESSION,
        value: specimen.accessionNumber,
      },
      {
        system: FHIR_IDENTIFIER_SYSTEMS.SPECIMEN_BARCODE,
        value: specimen.barcode,
      },
    ],
    status: statusMap[specimen.status] || 'available',
    type: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.SNOMED_CT,
          code: specimen.specimenType,
          display: specimen.specimenType,
        },
      ],
      text: specimen.specimenType,
    },
    subject: {
      reference: `Patient/${specimen.patientId}`,
      type: 'Patient',
    },
    request: [
      {
        reference: `ServiceRequest/${specimen.orderId}`,
        type: 'ServiceRequest',
      },
    ],
    collection: {
      ...(specimen.collectedById
        ? {
            collector: {
              reference: `Practitioner/${specimen.collectedById}`,
              type: 'Practitioner',
            },
          }
        : {}),
      ...(specimen.collectedAt
        ? {
            collectedDateTime:
              typeof specimen.collectedAt === 'string'
                ? specimen.collectedAt
                : specimen.collectedAt.toISOString(),
          }
        : {}),
      ...(specimen.volumeMl
        ? {
            quantity: {
              value: specimen.volumeMl,
              unit: 'mL',
            },
          }
        : {}),
      ...(specimen.collectionSite
        ? {
            bodySite: {
              text: specimen.collectionSite,
            },
          }
        : {}),
      container: [
        {
          type: {
            text: specimen.containerType,
          },
          description: specimen.containerType,
        },
      ],
    },
    ...(notes.length > 0 ? { note: notes } : {}),
  };
}

export function toFHIRLaboratoryObservation(result: {
  id: string;
  patientId: string;
  orderId: string;
  specimenId: string;
  testCode: string;
  testName: string;
  department: string;
  numericValue?: number;
  textValue?: string;
  unit?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  referenceRangeText?: string;
  referenceSource?: string;
  referenceSourceVersion?: string;
  abnormalFlag: string;
  technologistId: string;
  enteredAt: string | Date;
  status: string;
  correctionReason?: string;
  notes?: string;
}): KenyaCoreObservation {
  const statusMap: Record<string, KenyaCoreObservation['status']> = {
    PRELIMINARY: 'preliminary',
    VERIFIED: 'final',
    AUTHORIZED: 'final',
    AMENDED: 'amended',
    CORRECTED: 'corrected',
    CANCELLED: 'cancelled',
  };

  const interpretationMap: Record<string, string> = {
    NORMAL: 'N',
    ABNORMAL: 'A',
    LOW: 'L',
    HIGH: 'H',
    CRITICAL_LOW: 'LL',
    CRITICAL_HIGH: 'HH',
  };

  const interpretationCode = interpretationMap[result.abnormalFlag] || 'N';

  const notes: Array<{ text: string }> = [];
  if (result.correctionReason) {
    notes.push({ text: `Correction Reason: ${result.correctionReason}` });
  }
  if (result.notes) {
    notes.push({ text: result.notes });
  }

  return {
    resourceType: 'Observation',
    id: result.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.OBSERVATION],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.LAB_RESULT,
        value: result.id,
      },
    ],
    basedOn: [
      {
        reference: `ServiceRequest/${result.orderId}`,
        type: 'ServiceRequest',
      },
    ],
    status: statusMap[result.status] || 'preliminary',
    category: [
      {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_CATEGORY,
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.LOINC,
          code: result.testCode,
          display: result.testName,
        },
      ],
      text: result.testName,
    },
    subject: {
      reference: `Patient/${result.patientId}`,
      type: 'Patient',
    },
    specimen: {
      reference: `Specimen/${result.specimenId}`,
      type: 'Specimen',
    },
    effectiveDateTime: typeof result.enteredAt === 'string' ? result.enteredAt : result.enteredAt.toISOString(),
    performer: [
      {
        reference: `Practitioner/${result.technologistId}`,
        type: 'Practitioner',
      },
    ],
    ...(result.numericValue !== undefined && result.numericValue !== null
      ? {
          valueQuantity: {
            value: Number(result.numericValue),
            unit: result.unit || '',
            system: FHIR_TERMINOLOGY_SYSTEMS.UCUM,
          },
        }
      : {}),
    ...(result.textValue ? { valueString: result.textValue } : {}),
    interpretation: [
      {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.OBSERVATION_INTERPRETATION,
            code: interpretationCode,
            display: result.abnormalFlag,
          },
        ],
      },
    ],
    referenceRange: [
      {
        ...(result.referenceRangeLow !== undefined && result.referenceRangeLow !== null
          ? { low: { value: Number(result.referenceRangeLow), unit: result.unit } }
          : {}),
        ...(result.referenceRangeHigh !== undefined && result.referenceRangeHigh !== null
          ? { high: { value: Number(result.referenceRangeHigh), unit: result.unit } }
          : {}),
        ...(result.referenceRangeText || result.referenceSource
          ? { text: result.referenceRangeText || `${result.referenceSource} (v${result.referenceSourceVersion || '1.0'})` }
          : {}),
      },
    ],
    ...(notes.length > 0 ? { note: notes } : {}),
  };
}

export function toFHIRDiagnosticReport(report: {
  id: string;
  patientId: string;
  orderId: string;
  encounterId: string;
  reportNumber: string;
  status: string;
  title: string;
  conclusion?: string;
  issuedAt: string | Date;
  performerId: string;
  authorizerId?: string;
  resultIds?: string[];
}): KenyaCoreDiagnosticReport {
  const statusMap: Record<string, KenyaCoreDiagnosticReport['status']> = {
    REGISTERED: 'registered',
    PARTIAL: 'partial',
    PRELIMINARY: 'preliminary',
    FINAL: 'final',
    AMENDED: 'amended',
    CORRECTED: 'corrected',
    CANCELLED: 'cancelled',
  };

  return {
    resourceType: 'DiagnosticReport',
    id: report.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.DIAGNOSTIC_REPORT],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.DIAGNOSTIC_REPORT,
        value: report.reportNumber,
      },
    ],
    basedOn: [
      {
        reference: `ServiceRequest/${report.orderId}`,
        type: 'ServiceRequest',
      },
    ],
    status: statusMap[report.status] || 'preliminary',
    category: [
      {
        coding: [
          {
            system: FHIR_TERMINOLOGY_SYSTEMS.DIAGNOSTIC_SERVICE_SECTION,
            code: 'LAB',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      text: report.title,
    },
    subject: {
      reference: `Patient/${report.patientId}`,
      type: 'Patient',
    },
    encounter: {
      reference: `Encounter/${report.encounterId}`,
      type: 'Encounter',
    },
    issued: typeof report.issuedAt === 'string' ? report.issuedAt : report.issuedAt.toISOString(),
    performer: [
      {
        reference: `Practitioner/${report.performerId}`,
        type: 'Practitioner',
      },
    ],
    ...(report.authorizerId
      ? {
          resultsInterpreter: [
            {
              reference: `Practitioner/${report.authorizerId}`,
              type: 'Practitioner',
            },
          ],
        }
      : {}),
    ...(report.resultIds
      ? {
          result: report.resultIds.map((rid) => ({
            reference: `Observation/${rid}`,
            type: 'Observation',
          })),
        }
      : {}),
    ...(report.conclusion ? { conclusion: report.conclusion } : {}),
  };
}

// ============================================================================
// 9. FINANCIAL CLAIM & COVERAGE MAPPERS
// ============================================================================

export function toFHIRCoverage(coverage: {
  id: string;
  patientId: string;
  shaNumber: string;
  fundType: string;
  status: string;
  payorOrganizationId?: string;
  periodStart?: string | Date;
  periodEnd?: string | Date;
}): KenyaCoreCoverage {
  return {
    resourceType: 'Coverage',
    id: coverage.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.COVERAGE],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.SHA_NUMBER,
        value: coverage.shaNumber,
      },
    ],
    status: coverage.status === 'ACTIVE' ? 'active' : 'cancelled',
    type: {
      coding: [
        {
          system: 'https://sha.go.ke/funds',
          code: coverage.fundType,
          display: coverage.fundType,
        },
      ],
      text: coverage.fundType,
    },
    beneficiary: {
      reference: `Patient/${coverage.patientId}`,
      type: 'Patient',
    },
    payor: [
      {
        reference: `Organization/${coverage.payorOrganizationId || 'sha-ke'}`,
        type: 'Organization',
        display: 'Social Health Authority (SHA)',
      },
    ],
    ...(coverage.periodStart
      ? {
          period: {
            start:
              typeof coverage.periodStart === 'string'
                ? coverage.periodStart
                : coverage.periodStart.toISOString(),
            ...(coverage.periodEnd
              ? {
                  end:
                    typeof coverage.periodEnd === 'string'
                      ? coverage.periodEnd
                      : coverage.periodEnd.toISOString(),
                }
              : {}),
          },
        }
      : {}),
  };
}

export function toFHIRClaim(claim: {
  id: string;
  claimNumber: string;
  patientId: string;
  facilityKmflCode: string;
  fund: string;
  scenario: string;
  serviceStartDate: string | Date;
  serviceEndDate?: string | Date | null;
  totalClaimAmountKES: number | string;
  status: string;
  practitionerPuid?: string;
  preauthReference?: string;
  primaryDiagnosisIcd11?: string;
  items: Array<{
    sequence: number;
    code: string;
    description: string;
    quantity: number;
    unitPriceKES: number;
    totalAmountKES: number;
  }>;
}): KenyaCoreClaim {
  const statusMap: Record<string, KenyaCoreClaim['status']> = {
    DRAFT: 'draft',
    QUEUED: 'active',
    SUBMITTED: 'active',
    ACKNOWLEDGED: 'active',
    ACCEPTED: 'active',
    REJECTED: 'active',
    ADJUDICATED: 'active',
    PAID: 'active',
    CANCELLED: 'cancelled',
  };

  const periodStart =
    typeof claim.serviceStartDate === 'string'
      ? claim.serviceStartDate
      : claim.serviceStartDate.toISOString();
  const periodEnd = claim.serviceEndDate
    ? typeof claim.serviceEndDate === 'string'
      ? claim.serviceEndDate
      : claim.serviceEndDate.toISOString()
    : periodStart;

  return {
    resourceType: 'Claim',
    id: claim.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.CLAIM],
    },
    identifier: [
      {
        system: FHIR_IDENTIFIER_SYSTEMS.CLAIM,
        value: claim.claimNumber,
      },
    ],
    status: statusMap[claim.status] || 'active',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'institutional',
          display: 'Institutional',
        },
      ],
      text: claim.fund,
    },
    use: 'claim',
    patient: {
      reference: `Patient/${claim.patientId}`,
      type: 'Patient',
    },
    billablePeriod: {
      start: periodStart,
      end: periodEnd,
    },
    created: new Date().toISOString(),
    provider: {
      reference: `Organization/${claim.facilityKmflCode}`,
      identifier: {
        system: FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE,
        value: claim.facilityKmflCode,
      },
      display: `KMFL ${claim.facilityKmflCode}`,
    },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          reference: `Coverage/cov-${claim.patientId}`,
          display: `SHA ${claim.fund} (${claim.scenario})`,
        },
        ...(claim.preauthReference ? { preAuthRef: [claim.preauthReference] } : {}),
      },
    ],
    ...(claim.primaryDiagnosisIcd11
      ? {
          diagnosis: [
            {
              sequence: 1,
              diagnosisCodeableConcept: {
                coding: [
                  {
                    system: FHIR_TERMINOLOGY_SYSTEMS.ICD11_MMS,
                    code: claim.primaryDiagnosisIcd11,
                  },
                ],
              },
            },
          ],
        }
      : {}),
    ...(claim.practitionerPuid
      ? {
          careTeam: [
            {
              sequence: 1,
              provider: {
                reference: `Practitioner/${claim.practitionerPuid}`,
                identifier: {
                  system: FHIR_IDENTIFIER_SYSTEMS.PUID,
                  value: claim.practitionerPuid,
                },
              },
              responsible: true,
            },
          ],
        }
      : {}),
    item: claim.items.map((it) => ({
      sequence: it.sequence,
      productOrService: {
        coding: [
          {
            system: 'https://sha.go.ke/tariffs',
            code: it.code,
            display: it.description,
          },
        ],
        text: it.description,
      },
      quantity: {
        value: it.quantity,
      },
      unitPrice: {
        value: it.unitPriceKES,
        currency: 'KES',
      },
      net: {
        value: it.totalAmountKES,
        currency: 'KES',
      },
    })),
    total: {
      value: Number(claim.totalClaimAmountKES),
      currency: 'KES',
    },
  };
}

// ============================================================================
// 10. CONSENT MAPPER
// ============================================================================

export function toFHIRConsent(consent: {
  id: string;
  patientId: string;
  facilityKmflCode: string;
  status: string;
  consentType: string; // OTP, BIOMETRIC, EMERGENCY_OVERRIDE
  grantedAt: string | Date;
  expiresAt?: string | Date;
  practitionerPuid?: string;
  emergencyReason?: string;
}): KenyaCoreConsent {
  const statusMap: Record<string, KenyaCoreConsent['status']> = {
    ACTIVE: 'active',
    PENDING: 'proposed',
    REJECTED: 'rejected',
    EXPIRED: 'inactive',
    REVOKED: 'inactive',
  };

  return {
    resourceType: 'Consent',
    id: consent.id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.CONSENT],
    },
    status: statusMap[consent.status] || 'active',
    scope: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          code: 'patient-privacy',
          display: 'Patient Privacy',
        },
      ],
    },
    category: [
      {
        coding: [
          {
            system: 'https://fhir.dha.go.ke/consent-category',
            code: consent.consentType,
            display: consent.consentType,
          },
        ],
      },
    ],
    patient: {
      reference: `Patient/${consent.patientId}`,
      type: 'Patient',
    },
    dateTime:
      typeof consent.grantedAt === 'string'
        ? consent.grantedAt
        : consent.grantedAt.toISOString(),
    organization: [
      {
        reference: `Organization/${consent.facilityKmflCode}`,
        identifier: {
          system: FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE,
          value: consent.facilityKmflCode,
        },
      },
    ],
    provision: {
      type: 'permit',
      ...(consent.expiresAt
        ? {
            period: {
              start:
                typeof consent.grantedAt === 'string'
                  ? consent.grantedAt
                  : consent.grantedAt.toISOString(),
              end:
                typeof consent.expiresAt === 'string'
                  ? consent.expiresAt
                  : consent.expiresAt.toISOString(),
            },
          }
        : {}),
      ...(consent.practitionerPuid
        ? {
            actor: [
              {
                role: { text: 'Attending Clinician' },
                reference: {
                  reference: `Practitioner/${consent.practitionerPuid}`,
                  identifier: {
                    system: FHIR_IDENTIFIER_SYSTEMS.PUID,
                    value: consent.practitionerPuid,
                  },
                },
              },
            ],
          }
        : {}),
    },
  };
}
