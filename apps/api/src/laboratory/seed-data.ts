import {
  LabDepartment,
  SpecimenType,
  ContainerType,
  LabConsumableCategory,
} from '@afyapoa/domain-core';

export interface SeedLabTest {
  testCode: string;
  codingSystem: string;
  testName: string;
  department: LabDepartment;
  specimenType: SpecimenType;
  containerType: ContainerType;
  targetTatMinutes: number;
  methodology: string;
  referenceRanges: Array<{
    gender: 'MALE' | 'FEMALE' | 'ANY';
    ageMinDays: number;
    ageMaxDays: number;
    lowNumeric?: number;
    highNumeric?: number;
    criticalLowNumeric?: number;
    criticalHighNumeric?: number;
    unit: string;
    textualRange?: string;
    source: string;
    sourceVersion: string;
  }>;
}

export interface SeedLabConsumable {
  itemCode: string;
  name: string;
  category: LabConsumableCategory;
  quantityOnHand: number;
  reorderLevel: number;
  unitOfMeasure: string;
  lotNumber: string;
}

/**
 * Kenyan standard laboratory tests based on MOH Kenya Essential in vitro Diagnostics List (EDL)
 * and WHO Laboratory Manual Guidelines with published reference ranges and official versions.
 */
export const KENYA_MOH_LAB_TESTS: SeedLabTest[] = [
  {
    testCode: '718-7',
    codingSystem: 'LOINC',
    testName: 'Hemoglobin [Mass/volume] in Blood',
    department: LabDepartment.HEMATOLOGY,
    specimenType: SpecimenType.WHOLE_BLOOD,
    containerType: ContainerType.EDTA_TUBE_LAVENDER,
    targetTatMinutes: 30,
    methodology: 'Spectrophotometric cyanmethemoglobin method',
    referenceRanges: [
      {
        gender: 'MALE',
        ageMinDays: 5475, // 15 years
        ageMaxDays: 43800,
        lowNumeric: 13.0,
        highNumeric: 18.0,
        criticalLowNumeric: 7.0,
        criticalHighNumeric: 20.0,
        unit: 'g/dL',
        source: 'WHO Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity',
        sourceVersion: 'WHO/NMH/NHD/MNM/11.1',
      },
      {
        gender: 'FEMALE',
        ageMinDays: 5475,
        ageMaxDays: 43800,
        lowNumeric: 12.0,
        highNumeric: 16.0,
        criticalLowNumeric: 7.0,
        criticalHighNumeric: 20.0,
        unit: 'g/dL',
        source: 'WHO Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity',
        sourceVersion: 'WHO/NMH/NHD/MNM/11.1',
      },
    ],
  },
  {
    testCode: '6690-2',
    codingSystem: 'LOINC',
    testName: 'Leukocytes [#/volume] in Blood by Automated count',
    department: LabDepartment.HEMATOLOGY,
    specimenType: SpecimenType.WHOLE_BLOOD,
    containerType: ContainerType.EDTA_TUBE_LAVENDER,
    targetTatMinutes: 30,
    methodology: 'Impedance / Flow Cytometry',
    referenceRanges: [
      {
        gender: 'ANY',
        ageMinDays: 4380, // 12 years
        ageMaxDays: 43800,
        lowNumeric: 4.0,
        highNumeric: 11.0,
        criticalLowNumeric: 2.0,
        criticalHighNumeric: 30.0,
        unit: '10^3/uL',
        source: 'KEMRI Clinical Reference Intervals for Sub-Saharan African Adults',
        sourceVersion: 'KEMRI-CR-2023.v2',
      },
    ],
  },
  {
    testCode: '2160-0',
    codingSystem: 'LOINC',
    testName: 'Creatinine [Mass/volume] in Serum or Plasma',
    department: LabDepartment.CLINICAL_CHEMISTRY,
    specimenType: SpecimenType.SERUM,
    containerType: ContainerType.SST_TUBE_GOLD,
    targetTatMinutes: 60,
    methodology: 'Enzymatic colorimetric assay IDMS-traceable',
    referenceRanges: [
      {
        gender: 'MALE',
        ageMinDays: 6570, // 18 years
        ageMaxDays: 43800,
        lowNumeric: 62.0,
        highNumeric: 106.0,
        criticalLowNumeric: 30.0,
        criticalHighNumeric: 350.0,
        unit: 'umol/L',
        source: 'Kenya Renal Association / KDIGO Clinical Practice Guideline',
        sourceVersion: 'KDIGO-CKD-2023.1',
      },
      {
        gender: 'FEMALE',
        ageMinDays: 6570,
        ageMaxDays: 43800,
        lowNumeric: 44.0,
        highNumeric: 80.0,
        criticalLowNumeric: 25.0,
        criticalHighNumeric: 300.0,
        unit: 'umol/L',
        source: 'Kenya Renal Association / KDIGO Clinical Practice Guideline',
        sourceVersion: 'KDIGO-CKD-2023.1',
      },
    ],
  },
  {
    testCode: '2345-7',
    codingSystem: 'LOINC',
    testName: 'Glucose [Mass/volume] in Serum or Plasma - Fasting',
    department: LabDepartment.CLINICAL_CHEMISTRY,
    specimenType: SpecimenType.SERUM,
    containerType: ContainerType.FLUORIDE_OXALATE_TUBE_GRAY,
    targetTatMinutes: 45,
    methodology: 'Hexokinase / Glucose oxidase enzymatic',
    referenceRanges: [
      {
        gender: 'ANY',
        ageMinDays: 0,
        ageMaxDays: 43800,
        lowNumeric: 3.9,
        highNumeric: 6.1,
        criticalLowNumeric: 2.5,
        criticalHighNumeric: 20.0,
        unit: 'mmol/L',
        source: 'Kenya National Clinical Guidelines for the Management of Diabetes Mellitus',
        sourceVersion: 'MOH-NCD-GL-2024.v1',
      },
    ],
  },
  {
    testCode: '57021-8',
    codingSystem: 'LOINC',
    testName: 'Plasmodium falciparum antigen [Presence] in Blood by Rapid immunoassay',
    department: LabDepartment.PARASITOLOGY,
    specimenType: SpecimenType.WHOLE_BLOOD,
    containerType: ContainerType.EDTA_TUBE_LAVENDER,
    targetTatMinutes: 20,
    methodology: 'Lateral Flow Immunochromatographic Assay (HRP-2 / pLDH)',
    referenceRanges: [
      {
        gender: 'ANY',
        ageMinDays: 0,
        ageMaxDays: 43800,
        unit: 'qualitative',
        textualRange: 'Negative',
        source: 'Kenya National Malaria Control Programme (NMCP) Diagnosis Guidelines',
        sourceVersion: 'MOH-NMCP-2023.v4',
      },
    ],
  },
  {
    testCode: '24357-6',
    codingSystem: 'LOINC',
    testName: 'Urinalysis complete panel - Urine by Dipstick',
    department: LabDepartment.URINALYSIS,
    specimenType: SpecimenType.URINE,
    containerType: ContainerType.URINE_CONTAINER_STERILE,
    targetTatMinutes: 15,
    methodology: 'Dry reagent strip reflectance photometry',
    referenceRanges: [
      {
        gender: 'ANY',
        ageMinDays: 0,
        ageMaxDays: 43800,
        unit: 'qualitative',
        textualRange: 'Normal',
        source: 'WHO Essential in vitro Diagnostics (EDL) Technical Specifications',
        sourceVersion: 'WHO-EDL-2023.v1',
      },
    ],
  },
  {
    testCode: '2093-3',
    codingSystem: 'LOINC',
    testName: 'Cholesterol [Mass/volume] in Serum or Plasma',
    department: LabDepartment.CLINICAL_CHEMISTRY,
    specimenType: SpecimenType.SERUM,
    containerType: ContainerType.SST_TUBE_GOLD,
    targetTatMinutes: 60,
    methodology: 'Cholesterol oxidase enzymatic endpoint',
    referenceRanges: [
      {
        gender: 'ANY',
        ageMinDays: 6570,
        ageMaxDays: 43800,
        lowNumeric: 0.0,
        highNumeric: 5.2,
        criticalLowNumeric: 1.0,
        criticalHighNumeric: 10.0,
        unit: 'mmol/L',
        source: 'Kenya National Cardiovascular Diseases Guidelines',
        sourceVersion: 'MOH-CVD-2024.v1',
      },
    ],
  },
];

export const KENYA_MOH_LAB_CONSUMABLES: SeedLabConsumable[] = [
  {
    itemCode: 'VAC-EDTA-LAV',
    name: 'Vacutainer K2 EDTA Blood Collection Tube 4.0 mL (Lavender Top)',
    category: LabConsumableCategory.VACUTAINER,
    quantityOnHand: 500,
    reorderLevel: 50,
    unitOfMeasure: 'TUBE',
    lotNumber: 'LOT-EDTA-2026A',
  },
  {
    itemCode: 'VAC-SST-GOLD',
    name: 'Vacutainer Serum Separator Tube (SST II Advance) 5.0 mL (Gold Top)',
    category: LabConsumableCategory.VACUTAINER,
    quantityOnHand: 450,
    reorderLevel: 45,
    unitOfMeasure: 'TUBE',
    lotNumber: 'LOT-SST-2026B',
  },
  {
    itemCode: 'VAC-GLU-GRAY',
    name: 'Vacutainer Sodium Fluoride / Potassium Oxalate Tube 2.0 mL (Gray Top)',
    category: LabConsumableCategory.VACUTAINER,
    quantityOnHand: 200,
    reorderLevel: 25,
    unitOfMeasure: 'TUBE',
    lotNumber: 'LOT-GLU-2026C',
  },
  {
    itemCode: 'URN-CUP-STER',
    name: 'Sterile Urine Specimen Container with Integrated Pour Spout 60 mL',
    category: LabConsumableCategory.CONSUMABLE,
    quantityOnHand: 350,
    reorderLevel: 30,
    unitOfMeasure: 'CUP',
    lotNumber: 'LOT-URN-2026D',
  },
  {
    itemCode: 'RDT-MAL-PF',
    name: 'CareStart Malaria Pf (HRP2) Antigen Rapid Diagnostic Test Cassette',
    category: LabConsumableCategory.RAPID_TEST_KIT,
    quantityOnHand: 300,
    reorderLevel: 40,
    unitOfMeasure: 'CASSETTE',
    lotNumber: 'LOT-MRDT-2026E',
  },
  {
    itemCode: 'REAG-CBC-DIL',
    name: 'Cellpack DCL Automated Hematology Analyzer Diluent Reagent 20L',
    category: LabConsumableCategory.REAGENT,
    quantityOnHand: 15,
    reorderLevel: 3,
    unitOfMeasure: 'PACK',
    lotNumber: 'LOT-DIL-2026F',
  },
];
