/**
 * COMKEY AFYA POA — Kenya Core FHIR Bundle Generator
 * Enforces DHA Shared Health Record (SHR) Bundle Invariants & Provenance Attestation.
 */

import {
  FHIR_CANONICAL_PROFILES,
  FHIR_IDENTIFIER_SYSTEMS,
  FHIR_TERMINOLOGY_SYSTEMS,
  FHIR_SECURITY_TAGS,
} from './canonical.js';
import {
  KenyaCoreBundle,
  KenyaCoreBundleEntry,
  KenyaCoreEncounter,
  KenyaCorePatient,
  KenyaCoreProvenance,
  FHIRCoding,
} from './types.js';

export interface ShrBundleOptions {
  bundleId?: string;
  facilityKmflCode: string;
  authorPractitionerPuid: string;
  authorPractitionerName?: string;
  episodeOfCareId?: string;
  confidentiality?: 'N' | 'R';
  sensitivityTags?: Array<'HIV' | 'PSY' | 'SUD' | 'RH'>;
  digitalSignature?: string;
}

/**
 * Builds a DHA-conformant Kenya Core SHR Collection Bundle.
 * Enforces Encounter referencing EpisodeOfCare, clinical items referencing Encounter,
 * and appends a Provenance record.
 */
export function buildKenyaShrCollectionBundle(
  patient: KenyaCorePatient,
  encounter: KenyaCoreEncounter,
  clinicalResources: Array<Record<string, any>>,
  options: ShrBundleOptions,
): KenyaCoreBundle {
  const bundleId = options.bundleId || `bundle-shr-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Ensure Encounter references EpisodeOfCare (DHA SHR Invariant 1)
  const episodeOfCareRef = options.episodeOfCareId
    ? `EpisodeOfCare/${options.episodeOfCareId}`
    : `EpisodeOfCare/EOC-${encounter.id || 'current'}`;

  const conformantEncounter: KenyaCoreEncounter = {
    ...encounter,
    episodeOfCare: encounter.episodeOfCare && encounter.episodeOfCare.length > 0
      ? encounter.episodeOfCare
      : [{ reference: episodeOfCareRef, type: 'EpisodeOfCare' }],
    meta: {
      ...encounter.meta,
      profile: [FHIR_CANONICAL_PROFILES.ENCOUNTER],
    },
  };

  const encounterRef = `Encounter/${conformantEncounter.id || 'enc-1'}`;
  const patientRef = `Patient/${patient.id || 'pat-1'}`;

  // Ensure all clinical items reference the encounter (DHA SHR Invariant 2)
  const linkedClinicalResources = clinicalResources.map((res) => {
    const updated = { ...res };
    if (!updated.encounter && !updated.context) {
      if (updated.resourceType === 'MedicationDispense' || updated.resourceType === 'MedicationAdministration') {
        updated.context = { reference: encounterRef, type: 'Encounter' };
      } else {
        updated.encounter = { reference: encounterRef, type: 'Encounter' };
      }
    }
    if (!updated.subject && !updated.patient) {
      if (updated.resourceType === 'AllergyIntolerance') {
        updated.patient = { reference: patientRef, type: 'Patient' };
      } else {
        updated.subject = { reference: patientRef, type: 'Patient' };
      }
    }
    return updated;
  });

  // Security tags
  const securityTags: FHIRCoding[] = [];
  if (options.confidentiality === 'R') {
    securityTags.push(FHIR_SECURITY_TAGS.CONFIDENTIALITY_RESTRICTED);
  } else {
    securityTags.push(FHIR_SECURITY_TAGS.CONFIDENTIALITY_NORMAL);
  }

  if (options.sensitivityTags) {
    for (const tag of options.sensitivityTags) {
      const key = `SENSITIVITY_${tag}` as keyof typeof FHIR_SECURITY_TAGS;
      if (FHIR_SECURITY_TAGS[key]) {
        securityTags.push(FHIR_SECURITY_TAGS[key]);
      }
    }
  }

  // Construct Provenance Resource
  const targetReferences = [
    { reference: patientRef, type: 'Patient' },
    { reference: encounterRef, type: 'Encounter' },
    ...linkedClinicalResources.map((r) => ({
      reference: `${r.resourceType}/${r.id || 'unknown'}`,
      type: r.resourceType,
    })),
  ];

  const provenance: KenyaCoreProvenance = {
    resourceType: 'Provenance',
    id: `prov-${bundleId}`,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.PROVENANCE],
    },
    target: targetReferences,
    recorded: timestamp,
    activity: {
      coding: [
        {
          system: FHIR_TERMINOLOGY_SYSTEMS.PROVENANCE_ACTIVITY_TYPE,
          code: 'CREATE',
          display: 'Record Creation',
        },
      ],
      text: 'Clinical Encounter Documentation Ingestion',
    },
    agent: [
      {
        type: {
          coding: [
            {
              system: FHIR_TERMINOLOGY_SYSTEMS.PROVENANCE_PARTICIPANT_TYPE,
              code: 'author',
              display: 'Author',
            },
          ],
        },
        who: {
          reference: `Practitioner/${options.authorPractitionerPuid}`,
          identifier: {
            system: FHIR_IDENTIFIER_SYSTEMS.PUID,
            value: options.authorPractitionerPuid,
          },
          display: options.authorPractitionerName || 'Attending Practitioner',
        },
        onBehalfOf: {
          reference: `Organization/${options.facilityKmflCode}`,
          identifier: {
            system: FHIR_IDENTIFIER_SYSTEMS.KMFL_CODE,
            value: options.facilityKmflCode,
          },
          display: `Facility KMFL: ${options.facilityKmflCode}`,
        },
      },
    ],
    ...(options.digitalSignature
      ? {
          signature: [
            {
              type: [
                {
                  system: 'urn:iso-astm:E1762-95:2013',
                  code: '1.2.840.10065.1.12.1.1',
                  display: "Author's Signature",
                },
              ],
              when: timestamp,
              who: {
                reference: `Practitioner/${options.authorPractitionerPuid}`,
              },
              data: options.digitalSignature,
            },
          ],
        }
      : {}),
  };

  // Compile Bundle Entries
  const entries: KenyaCoreBundleEntry[] = [
    {
      fullUrl: `urn:uuid:${patient.id || 'patient'}`,
      resource: patient,
    },
    {
      fullUrl: `urn:uuid:${conformantEncounter.id || 'encounter'}`,
      resource: conformantEncounter,
    },
    ...linkedClinicalResources.map((res) => ({
      fullUrl: `urn:uuid:${res.id || 'resource'}`,
      resource: res,
    })),
    {
      fullUrl: `urn:uuid:${provenance.id}`,
      resource: provenance,
    },
  ];

  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.BUNDLE_COLLECTION],
      security: securityTags,
      lastUpdated: timestamp,
    },
    type: 'collection',
    timestamp,
    entry: entries,
  };
}

/**
 * Builds a FHIR Transaction Bundle for batch resource operations.
 */
export function buildKenyaTransactionBundle(
  resources: Array<{ resource: Record<string, any>; method?: 'POST' | 'PUT'; ifNoneExist?: string }>,
  bundleId?: string,
): KenyaCoreBundle {
  const id = bundleId || `tx-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const entries: KenyaCoreBundleEntry[] = resources.map((item) => {
    const res = item.resource;
    const method = item.method || (res.id ? 'PUT' : 'POST');
    const url = res.id ? `${res.resourceType}/${res.id}` : res.resourceType;

    return {
      fullUrl: `urn:uuid:${res.id || Math.random().toString(36).substring(7)}`,
      resource: res,
      request: {
        method,
        url,
        ifNoneExist: item.ifNoneExist,
      },
    };
  });

  return {
    resourceType: 'Bundle',
    id,
    meta: {
      profile: [FHIR_CANONICAL_PROFILES.BUNDLE_TRANSACTION],
      lastUpdated: timestamp,
    },
    type: 'transaction',
    timestamp,
    entry: entries,
  };
}
