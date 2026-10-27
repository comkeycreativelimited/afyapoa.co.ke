import {
  BillingCategory,
  TaxCode,
} from '@afyapoa/domain-core';

export interface StandardBillingItem {
  serviceCode: string;
  serviceName: string;
  category: BillingCategory;
  department: string;
  basePrice: number;
  taxRate: number;
  taxCode: TaxCode;
  clinicalCode?: string;
  clinicalCodingSystem?: string;
  shaCovered: boolean;
  shaStandardTariff: number;
  preauthorizationRequired: boolean;
}

/**
 * Standard Kenya Hospital Service Catalogue (Tariffs)
 * Aligned with Kenyan MOH Level 4/5 hospitals, LOINC lab diagnostics, KEML medicines, and SHA tariff schedules.
 */
export const STANDARD_BILLING_SERVICES: StandardBillingItem[] = [
  // 1. Consultations (Outpatient & Casualty)
  {
    serviceCode: 'SRV-CONS-001',
    serviceName: 'General Outpatient Clinical Consultation (Medical Officer)',
    category: BillingCategory.CONSULTATION,
    department: 'OUTPATIENT',
    basePrice: 1500.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E, // VAT Exempt under Kenya VAT Act First Schedule
    shaCovered: true,
    shaStandardTariff: 1200.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-CONS-002',
    serviceName: 'Specialist Consultant Physician Review',
    category: BillingCategory.CONSULTATION,
    department: 'SPECIALIST_CLINIC',
    basePrice: 3000.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    shaCovered: true,
    shaStandardTariff: 2500.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-CONS-003',
    serviceName: 'Emergency Triage, Resuscitation & Stabilization',
    category: BillingCategory.CONSULTATION,
    department: 'CASUALTY',
    basePrice: 4500.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    shaCovered: true,
    shaStandardTariff: 4500.00, // Emergency Care (ECCIF covered under SHIA Sec 47)
    preauthorizationRequired: false,
  },

  // 2. Laboratory Services (LOINC Coded)
  {
    serviceCode: 'SRV-LAB-718-7',
    serviceName: 'Full Blood Count (FBC) with 5-Part Differential',
    category: BillingCategory.LABORATORY,
    department: 'LABORATORY',
    basePrice: 800.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: '718-7',
    clinicalCodingSystem: 'LOINC',
    shaCovered: true,
    shaStandardTariff: 650.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-LAB-50554-5',
    serviceName: 'Malaria Rapid Diagnostic Test (mRDT)',
    category: BillingCategory.LABORATORY,
    department: 'LABORATORY',
    basePrice: 500.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: '50554-5',
    clinicalCodingSystem: 'LOINC',
    shaCovered: true,
    shaStandardTariff: 400.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-LAB-2345-7',
    serviceName: 'Blood Glucose, Fasting / Random',
    category: BillingCategory.LABORATORY,
    department: 'LABORATORY',
    basePrice: 300.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: '2345-7',
    clinicalCodingSystem: 'LOINC',
    shaCovered: true,
    shaStandardTariff: 250.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-LAB-24356-8',
    serviceName: 'Urinalysis Multistix 10-Parameter Automated Strip',
    category: BillingCategory.LABORATORY,
    department: 'LABORATORY',
    basePrice: 400.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: '24356-8',
    clinicalCodingSystem: 'LOINC',
    shaCovered: true,
    shaStandardTariff: 300.00,
    preauthorizationRequired: false,
  },

  // 3. Pharmacy Dispensing (Formulary Prices)
  {
    serviceCode: 'SRV-PHARM-001',
    serviceName: 'Paracetamol 500mg Tablets (Dispensing unit: tablet)',
    category: BillingCategory.PHARMACY,
    department: 'PHARMACY',
    basePrice: 15.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: 'KEML-MED-0001',
    clinicalCodingSystem: 'KENYA_EML',
    shaCovered: true,
    shaStandardTariff: 12.00,
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-PHARM-002',
    serviceName: 'Amoxicillin/Clavulanate 625mg Tablets',
    category: BillingCategory.PHARMACY,
    department: 'PHARMACY',
    basePrice: 80.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: 'KEML-MED-0002',
    clinicalCodingSystem: 'KENYA_EML',
    shaCovered: true,
    shaStandardTariff: 65.00,
    preauthorizationRequired: false,
  },

  // 4. Clinical Procedures
  {
    serviceCode: 'SRV-PROC-001',
    serviceName: 'Normal Spontaneous Vaginal Delivery (SVD)',
    category: BillingCategory.PROCEDURE,
    department: 'MATERNITY',
    basePrice: 10000.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    clinicalCode: 'ICHI-DEL-01',
    clinicalCodingSystem: 'WHO_ICHI',
    shaCovered: true,
    shaStandardTariff: 10000.00, // Linda Mama / PHC Covered
    preauthorizationRequired: false,
  },
  {
    serviceCode: 'SRV-PROC-002',
    serviceName: 'Wound Debridement, Toilet & Layered Surgical Closure',
    category: BillingCategory.PROCEDURE,
    department: 'THEATRE',
    basePrice: 2500.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    shaCovered: true,
    shaStandardTariff: 2000.00,
    preauthorizationRequired: false,
  },

  // 5. Inpatient Accommodation & Nursing Care
  {
    serviceCode: 'SRV-ACCOM-001',
    serviceName: 'General Medical Inpatient Bed Charge (Per Diem)',
    category: BillingCategory.ACCOMMODATION,
    department: 'INPATIENT',
    basePrice: 2000.00,
    taxRate: 0.0000,
    taxCode: TaxCode.E,
    shaCovered: true,
    shaStandardTariff: 1800.00,
    preauthorizationRequired: true,
  },

  // 6. Non-Clinical Administrative Services (Tax Code A: 16% VAT standard)
  {
    serviceCode: 'SRV-ADMIN-001',
    serviceName: 'Official Medical-Legal Report / Insurance Assessment Certificate',
    category: BillingCategory.MISC,
    department: 'RECORDS',
    basePrice: 1000.00,
    taxRate: 0.1600, // Standard rated 16% VAT
    taxCode: TaxCode.A,
    shaCovered: false,
    shaStandardTariff: 0.00,
    preauthorizationRequired: false,
  },
];
