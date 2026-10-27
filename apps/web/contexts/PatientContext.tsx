'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PatientContextData } from '@afyapoa/ui';

export const INITIAL_DEMO_PATIENTS: PatientContextData[] = [
  {
    id: 'p-101',
    mrn: 'MRN-202610-0012',
    fullName: 'Amina Fatuma Bakari',
    dob: '1995-07-24',
    age: 31,
    gender: 'FEMALE',
    nationalId: '29881234',
    county: 'Mombasa',
    isExternallyVerified: true,
    upi: 'UPI-KEN-2026-12345678',
    dhaCrid: 'CRID-KE-DHA-12345678',
    shaContract: 'SHA-CTR-00101',
    shaScheme: 'SHIF Standard Comprehensive',
    bloodGroup: 'O Positive',
    activeEncounterId: 'ENC-202610-0089',
    encounterType: 'OUTPATIENT',
    triageAcuity: 'URGENT',
    allergies: [
      { allergen: 'Penicillin', severity: 'SEVERE', reaction: 'Anaphylaxis, severe bronchospasm' },
      { allergen: 'Sulphonamides (Bactrim)', severity: 'MODERATE', reaction: 'Maculopapular rash' },
    ],
  },
  {
    id: 'p-102',
    mrn: 'MRN-202610-0015',
    fullName: 'David Kiprono Kipkorir',
    dob: '1992-09-18',
    age: 34,
    gender: 'MALE',
    nationalId: '31445566',
    county: 'Nakuru',
    isExternallyVerified: false,
    upi: null,
    dhaCrid: null,
    shaContract: 'SHA-CTR-00101',
    shaScheme: 'PHC Capitation Pool',
    bloodGroup: 'B Positive',
    activeEncounterId: 'ENC-202610-0092',
    encounterType: 'OUTPATIENT',
    triageAcuity: 'SEMI_URGENT',
    allergies: [],
  },
  {
    id: 'p-103',
    mrn: 'MRN-202610-0099',
    fullName: 'EMERGENCY TRAUMA UNKNOWN-MALE-A8K2Z',
    dob: '1996-01-01',
    age: 30,
    gender: 'MALE',
    nationalId: undefined,
    county: 'Nairobi',
    isExternallyVerified: false,
    upi: null,
    dhaCrid: null,
    shaContract: 'SHA-CTR-00101',
    shaScheme: 'ECCIF Emergency Fund',
    bloodGroup: 'Unknown',
    activeEncounterId: 'ENC-202610-0099',
    encounterType: 'CASUALTY',
    triageAcuity: 'RESUSCITATION',
    allergies: [],
  },
  {
    id: 'p-104',
    mrn: 'MRN-202610-0044',
    fullName: 'Faith Wangari Mwangi',
    dob: '1988-03-12',
    age: 38,
    gender: 'FEMALE',
    nationalId: '25667788',
    county: 'Nairobi (Kasarani)',
    isExternallyVerified: true,
    upi: 'UPI-KEN-2026-88776655',
    dhaCrid: 'CRID-KE-DHA-88776655',
    shaContract: 'SHA-CTR-00101',
    shaScheme: 'SHIF Comprehensive & MCH',
    bloodGroup: 'A Positive',
    activeEncounterId: 'ENC-202610-0104',
    encounterType: 'MCH',
    triageAcuity: 'NON_URGENT',
    allergies: [
      { allergen: 'Ibuprofen (NSAIDs)', severity: 'MODERATE', reaction: 'Gastric ulceration flare' },
    ],
  },
];

interface PatientContextType {
  activePatient: PatientContextData | null;
  setActivePatient: (patient: PatientContextData | null) => void;
  allPatients: PatientContextData[];
  selectPatientById: (patientId: string) => void;
  clearPatientContext: () => void;
  updateActivePatient: (updates: Partial<PatientContextData>) => void;
  addNewPatient: (patient: PatientContextData) => void;
}

const PatientContext = createContext<PatientContextType>({
  activePatient: null,
  setActivePatient: () => {},
  allPatients: INITIAL_DEMO_PATIENTS,
  selectPatientById: () => {},
  clearPatientContext: () => {},
  updateActivePatient: () => {},
  addNewPatient: () => {},
});

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allPatients, setAllPatients] = useState<PatientContextData[]>(INITIAL_DEMO_PATIENTS);
  const [activePatient, setActivePatient] = useState<PatientContextData | null>(INITIAL_DEMO_PATIENTS[0] || null);

  useEffect(() => {
    try {
      const savedPatientId = localStorage.getItem('afyapoa_active_patient_id');
      if (savedPatientId) {
        const found = allPatients.find((p) => p.id === savedPatientId);
        if (found) {
          setActivePatient(found);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const selectPatientById = (patientId: string) => {
    const found = allPatients.find((p) => p.id === patientId);
    if (found) {
      setActivePatient(found);
      try {
        localStorage.setItem('afyapoa_active_patient_id', patientId);
      } catch {
        // Ignore
      }
    }
  };

  const clearPatientContext = () => {
    setActivePatient(null);
    try {
      localStorage.removeItem('afyapoa_active_patient_id');
    } catch {
      // Ignore
    }
  };

  const updateActivePatient = (updates: Partial<PatientContextData>) => {
    if (!activePatient) return;
    const updated = { ...activePatient, ...updates };
    setActivePatient(updated);
    setAllPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const addNewPatient = (patient: PatientContextData) => {
    setAllPatients((prev) => [patient, ...prev]);
    setActivePatient(patient);
    try {
      localStorage.setItem('afyapoa_active_patient_id', patient.id);
    } catch {
      // Ignore
    }
  };

  return (
    <PatientContext.Provider
      value={{
        activePatient,
        setActivePatient,
        allPatients,
        selectPatientById,
        clearPatientContext,
        updateActivePatient,
        addNewPatient,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatientContext = () => useContext(PatientContext);
