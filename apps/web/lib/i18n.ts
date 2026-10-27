export type SupportedLocale = 'en' | 'sw';

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    sw: string;
  };
}

export const translations: TranslationDictionary = {
  // Navigation & Platform Header
  'app.name': {
    en: 'COMKEY AFYA POA',
    sw: 'COMKEY AFYA POA',
  },
  'app.tagline': {
    en: 'Kenya HMIS SaaS • Sovereign Clinical Application',
    sw: 'Mfumo wa Afya wa HMIS Kenya • Mfumo wa Kliniki wa Kitaifa',
  },
  'nav.reception': {
    en: 'Reception & Registry',
    sw: 'Mapokezi na Usajili',
  },
  'nav.triage': {
    en: 'Nursing & Triage',
    sw: 'Uuguzi na Uchunguzi wa Awali',
  },
  'nav.clinicians': {
    en: 'Clinicians OPD',
    sw: 'Kliniki ya Madaktari',
  },
  'nav.laboratory': {
    en: 'Laboratory LIS',
    sw: 'Maabara na Vipimo',
  },
  'nav.pharmacy': {
    en: 'Pharmacy & Dispensing',
    sw: 'Famasi na Utoaji Dawa',
  },
  'nav.billing': {
    en: 'Billing & Cashier',
    sw: 'Hazina na Ankara',
  },
  'nav.claims': {
    en: 'SHA eClaims & Insurance',
    sw: 'Madai ya Bima (SHA)',
  },
  'nav.facility_admin': {
    en: 'Facility Administration',
    sw: 'Usimamizi wa Hospitali',
  },
  'nav.platform_admin': {
    en: 'Platform SaaS Admin',
    sw: 'Usimamizi Mkuu wa Mfumo',
  },

  // Roles
  'role.RECORDS_OFFICER': {
    en: 'Reception / Records Officer',
    sw: 'Afisa wa Mapokezi na Kumbukumbu',
  },
  'role.TRIAGE_NURSE': {
    en: 'Triage / Inpatient Nurse',
    sw: 'Muuguzi wa Uchunguzi wa Awali',
  },
  'role.CLINICIAN': {
    en: 'Clinician / Medical Officer',
    sw: 'Daktari / Mganga wa Kliniki',
  },
  'role.LAB_TECH': {
    en: 'Laboratory Technologist',
    sw: 'Mtaalamu wa Maabara',
  },
  'role.PHARMACIST': {
    en: 'Pharmacist / Pharmacy Tech',
    sw: 'Mfamasia / Mhudumu wa Dawa',
  },
  'role.BILLING_CLERK': {
    en: 'Billing Clerk / Cashier',
    sw: 'Mhasibu wa Hazina na Malipo',
  },
  'role.FINANCE_USER': {
    en: 'Claims Officer / Finance Manager',
    sw: 'Afisa wa Madai ya Bima na Fedha',
  },
  'role.FACILITY_ADMIN': {
    en: 'Facility Administrator',
    sw: 'Msimamizi wa Hospitali',
  },
  'role.SUPER_ADMIN': {
    en: 'Platform Super-Admin',
    sw: 'Msimamizi Mkuu wa Mfumo (SaaS)',
  },

  // Common Actions
  'common.search': {
    en: 'Search',
    sw: 'Tafuta',
  },
  'common.save': {
    en: 'Save',
    sw: 'Hifadhi',
  },
  'common.cancel': {
    en: 'Cancel',
    sw: 'Ghairi',
  },
  'common.submit': {
    en: 'Submit',
    sw: 'Wasilisha',
  },
  'common.verify': {
    en: 'Verify',
    sw: 'Thibitisha',
  },
  'common.dispense': {
    en: 'Dispense',
    sw: 'Sambaza Dawa',
  },
  'common.print': {
    en: 'Print',
    sw: 'Chapa',
  },
  'common.filter': {
    en: 'Filter',
    sw: 'Chuja',
  },
  'common.switch': {
    en: 'Switch',
    sw: 'Badilisha',
  },
  'common.clear': {
    en: 'Clear',
    sw: 'Futa',
  },
  'common.loading': {
    en: 'Loading...',
    sw: 'Inapakia...',
  },
  'common.actions': {
    en: 'Actions',
    sw: 'Vitendo',
  },
  'common.status': {
    en: 'Status',
    sw: 'Hali',
  },

  // Network & Connectivity
  'network.online': {
    en: 'Online • Synced',
    sw: 'Mtandaoni • Imesawazishwa',
  },
  'network.offline': {
    en: 'Offline Mode (Local Cached)',
    sw: 'Bila Mtandao (Kumbukumbu ya Kifaa)',
  },
  'network.syncing': {
    en: 'Syncing National DHA/SHA...',
    sw: 'Inasawazisha na Mfumo wa Kitaifa...',
  },
  'network.pending_sync': {
    en: 'pending sync',
    sw: 'zinazosubiri kusawazishwa',
  },
  'network.sync_now': {
    en: 'Sync Now',
    sw: 'Sawazisha Sasa',
  },

  // Clinical & Triage
  'clinical.vitals': {
    en: 'Vital Signs',
    sw: 'Ishara Muhimu za Uhai',
  },
  'clinical.blood_pressure': {
    en: 'Blood Pressure',
    sw: 'Shinikizo la Damu',
  },
  'clinical.heart_rate': {
    en: 'Heart Rate (Pulse)',
    sw: 'Mapigo ya Moyo',
  },
  'clinical.respiratory_rate': {
    en: 'Respiratory Rate',
    sw: 'Kasi ya Upumuaji',
  },
  'clinical.temperature': {
    en: 'Temperature (°C)',
    sw: 'Joto la Mwili (°C)',
  },
  'clinical.spo2': {
    en: 'Oxygen Saturation (SpO2 %)',
    sw: 'Kiwango cha Oksijeni (SpO2 %)',
  },
  'clinical.blood_glucose': {
    en: 'Blood Glucose (mmol/L)',
    sw: 'Kiwango cha Sukari (mmol/L)',
  },
  'clinical.bmi': {
    en: 'Body Mass Index (BMI)',
    sw: 'Kipimo cha Uzito na Urefu (BMI)',
  },
  'clinical.allergies': {
    en: 'Documented Allergies',
    sw: 'Mzio na Mihemko ya Dawa',
  },
  'clinical.no_allergies': {
    en: 'No Known Drug Allergies (NKDA)',
    sw: 'Hakuna Mzio wa Dawa Unaofahamika (NKDA)',
  },
  'clinical.soap_notes': {
    en: 'Clinical Documentation (SOAP)',
    sw: 'Maelezo ya Kimatibabu (SOAP)',
  },
  'clinical.diagnosis': {
    en: 'ICD-11 / ICD-10 Diagnosis',
    sw: 'Uchunguzi wa Maradhi (ICD-11 / ICD-10)',
  },
  'clinical.cpoe_orders': {
    en: 'Computerized Physician Orders (CPOE)',
    sw: 'Maagizo ya Daktari (Maabara, Dawa, X-Ray)',
  },
  'clinical.sign_note': {
    en: 'Digitally Sign Note',
    sw: 'Weka Sahihi ya Kidijitali',
  },

  // Triage Categories
  'triage.resuscitation': {
    en: 'Resuscitation (Immediate)',
    sw: 'Ufufuo wa Dharura (Papo Hapo)',
  },
  'triage.emergency': {
    en: 'Emergency (< 15 mins)',
    sw: 'Dharura Kubwa (< dakika 15)',
  },
  'triage.urgent': {
    en: 'Urgent (< 30 mins)',
    sw: 'Dharura ya Wastani (< dakika 30)',
  },
  'triage.semi_urgent': {
    en: 'Semi-Urgent (< 60 mins)',
    sw: 'Hali ya Kawaida (< dakika 60)',
  },
  'triage.non_urgent': {
    en: 'Non-Urgent (< 120 mins)',
    sw: 'Si ya Dharura (< dakika 120)',
  },

  // Pharmacy & Dispensing
  'pharmacy.queue': {
    en: 'Prescription Dispensing Queue',
    sw: 'Msururu wa Maagizo ya Dawa',
  },
  'pharmacy.batch_allocation': {
    en: 'Batch & Expiry (FEFO Allocation)',
    sw: 'Kundi na Tarehe ya Kuisha (Mbinu ya FEFO)',
  },
  'pharmacy.counseling': {
    en: 'Patient Medication Counseling',
    sw: 'Ushauri wa Matumizi ya Dawa kwa Mgonjwa',
  },

  // Billing & Finance
  'billing.shift': {
    en: 'Cashier Shift Status',
    sw: 'Hali ya Zamu ya Mhasibu',
  },
  'billing.invoices': {
    en: 'Patient Invoices',
    sw: 'Ankara za Wagonjwa',
  },
  'billing.payments': {
    en: 'Process Payment & eTIMS Receipt',
    sw: 'Lipisha na Toa Risiti ya eTIMS',
  },
  'billing.etims_signed': {
    en: 'eTIMS Fiscal QR Signed (Sec 23A)',
    sw: 'Imethibitishwa na KRA eTIMS (Sec 23A)',
  },

  // Claims & SHA
  'claims.sha_portal': {
    en: 'Social Health Authority (SHA) eClaims',
    sw: 'Madai ya Bima ya Afya ya Jamii (SHA)',
  },
  'claims.sla_timer': {
    en: 'Statutory 24-Hour SLA Timer',
    sw: 'Muda wa Kisheria wa Saa 24 (SLA)',
  },
  'claims.preauth': {
    en: 'Pre-Authorization Verification',
    sw: 'Uthibitisho wa Ruhusa ya Awali',
  },

  // Patient Identity
  'patient.no_active': {
    en: 'No patient selected in active clinical session.',
    sw: 'Hakuna mgonjwa aliyechaguliwa kwenye kipindi cha sasa.',
  },
  'patient.select_prompt': {
    en: 'Select a patient from Reception or Triage to begin documentation.',
    sw: 'Chagua mgonjwa kutoka Mapokezi au Uchunguzi wa Awali kuanza matibabu.',
  },
  'patient.search_select': {
    en: 'Search Patient',
    sw: 'Tafuta Mgonjwa',
  },
  'patient.gender': {
    en: 'Sex',
    sw: 'Jinsia',
  },
  'patient.age': {
    en: 'Age',
    sw: 'Umri',
  },
};

export function getTranslation(key: string, locale: SupportedLocale, defaultText?: string): string {
  if (translations[key] && translations[key][locale]) {
    return translations[key][locale];
  }
  return defaultText || key;
}
