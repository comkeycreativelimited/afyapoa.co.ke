'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Edit3,
  FileCheck2,
  FileText,
  History,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  Unlock,
  UserPlus,
  AlertTriangle,
  Scale,
  Pill,
  FlaskConical,
  ClipboardList,
  CheckCheck,
  XCircle,
  PlusCircle,
  FileCode2,
} from 'lucide-react';

export type EncounterStatus =
  | 'PLANNED'
  | 'ARRIVED'
  | 'TRIAGED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REOPENED';

export type TriagePriority =
  | 'RESUSCITATION'
  | 'EMERGENCY'
  | 'URGENT'
  | 'SEMI_URGENT'
  | 'NON_URGENT';

export type ServiceDepartment =
  | 'OUTPATIENT'
  | 'CASUALTY'
  | 'MCH'
  | 'SPECIALIST_CLINIC'
  | 'DENTAL'
  | 'EYE_CLINIC'
  | 'PHYSIOTHERAPY';

export interface VitalsRecord {
  id: string;
  assessedAt: string;
  assessedByName: string;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  bloodGlucose?: number;
  avpuLevel: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
  triagePriority: TriagePriority;
  triageNotes?: string;
}

export interface NoteAmendment {
  id: string;
  amendedAt: string;
  amendedByName: string;
  reason: string;
  amendmentText: string;
}

export interface ClinicalNoteRecord {
  id: string;
  noteType: string;
  status: 'DRAFT' | 'FINALIZED' | 'AMENDED';
  chiefComplaint: string;
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string;
  reviewOfSystems?: string;
  physicalExamination?: string;
  assessment: string;
  plan: string;
  authorName: string;
  authorRole: string;
  entryTime: string;
  finalizedAt?: string;
  digitalSignature?: string;
  amendments: NoteAmendment[];
}

export interface PatientAllergyItem {
  id: string;
  allergen: string;
  allergenType: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
  reaction?: string;
  clinicalStatus: 'ACTIVE' | 'RESOLVED';
  verificationStatus: 'CONFIRMED' | 'SUSPECTED';
  recordedAt: string;
}

export interface EncounterDiagnosis {
  id: string;
  code: string;
  codingSystem: 'ICD_11_MMS' | 'ICD_10';
  display: string;
  diagnosisType: 'WORKING' | 'PRESUMPTIVE' | 'CONFIRMED' | 'DIFFERENTIAL' | 'DISCHARGE';
  clinicalStatus: 'ACTIVE' | 'RESOLVED' | 'INACTIVE';
  verificationStatus: 'PROVISIONAL' | 'CONFIRMED' | 'REFUTED' | 'ENTERED_IN_ERROR';
  isPrimary: boolean;
  notes?: string;
  recordedAt: string;
}

export interface ClinicalOrderDisplay {
  id: string;
  orderNumber: string;
  orderType: 'MEDICATION_REQUEST' | 'LAB_SERVICE_REQUEST' | 'RADIOLOGY_SERVICE_REQUEST';
  status: 'ACTIVE' | 'AUTHORIZED' | 'COMPLETED' | 'CANCELLED' | 'AMENDED';
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  itemCode: string;
  itemName: string;
  codingSystem: string;
  clinicalIndication?: string;
  orderedAt: string;
  orderingPractitioner: string;
  // Medication specific
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  // Service specific
  specimenType?: string;
  cancellationReason?: string;
}

export interface PatientEncounter {
  id: string;
  encounterNumber: string;
  patientId: string;
  patientName: string;
  mrn: string;
  ageYears: number;
  gender: 'MALE' | 'FEMALE';
  encounterType: 'WALK_IN' | 'APPOINTMENT' | 'EMERGENCY' | 'REFERRAL';
  serviceDepartment: ServiceDepartment;
  status: EncounterStatus;
  priority: TriagePriority;
  reasonForVisit: string;
  startedAt: string;
  practitionerName?: string;
  vitals?: VitalsRecord[];
  notes?: ClinicalNoteRecord[];
  allergies?: PatientAllergyItem[];
  diagnoses?: EncounterDiagnosis[];
  orders?: ClinicalOrderDisplay[];
}

const INITIAL_ENCOUNTERS: PatientEncounter[] = [
  {
    id: 'enc-202610-001',
    encounterNumber: 'ENC-202610-1042',
    patientId: 'p-101',
    patientName: 'Amina Fatuma Bakari',
    mrn: 'MRN-202610-0012',
    ageYears: 31,
    gender: 'FEMALE',
    encounterType: 'WALK_IN',
    serviceDepartment: 'OUTPATIENT',
    status: 'IN_PROGRESS',
    priority: 'SEMI_URGENT',
    reasonForVisit: 'Persistent epigastric pain and late afternoon headaches',
    startedAt: '2026-10-19T09:15:00+03:00',
    practitionerName: 'Dr. Otieno Odhiambo (Medical Officer)',
    vitals: [
      {
        id: 'vit-01',
        assessedAt: '2026-10-19T09:20:00+03:00',
        assessedByName: 'Nurse Wanjiku Kamau, KRCHN',
        systolicBp: 124,
        diastolicBp: 82,
        heartRate: 76,
        respiratoryRate: 18,
        temperature: 36.8,
        oxygenSaturation: 98,
        weightKg: 64.0,
        heightCm: 165.0,
        bmi: 23.5,
        bloodGlucose: 5.4,
        avpuLevel: 'ALERT',
        triagePriority: 'SEMI_URGENT',
        triageNotes: 'Patient alert, cooperative, no acute respiratory distress. Mild epigastric discomfort on palpation.',
      },
    ],
    notes: [
      {
        id: 'note-01',
        noteType: 'CONSULTATION_NOTE',
        status: 'FINALIZED',
        chiefComplaint: 'Throbbing frontal headache for 3 days and dyspepsia',
        historyOfPresentIllness: '31yo female reporting dull, non-radiating epigastric pain exacerbated by spicy foods, accompanied by frontal tension headache.',
        pastMedicalHistory: 'No chronic illness. Treated for mild H. pylori in 2024.',
        reviewOfSystems: 'No nausea, no visual disturbance, no melena.',
        physicalExamination: 'Abdomen soft, tender on epigastric palpation without guarding. Supple neck.',
        assessment: 'Dyspepsia secondary to gastritis; mild tension headache.',
        plan: '1. Tab Omeprazole 20mg PO BD for 14 days.\n2. Tab Paracetamol 1g PO TDS PRN for 3 days.\n3. Lifestyle and dietary counseling.',
        authorName: 'Dr. Otieno Odhiambo',
        authorRole: 'CLINICIAN',
        entryTime: '2026-10-19T09:35:00+03:00',
        finalizedAt: '2026-10-19T09:45:00+03:00',
        digitalSignature: 'SIG-DR-OTIENO-A99281746B',
        amendments: [
          {
            id: 'amend-01',
            amendedAt: '2026-10-19T09:50:00+03:00',
            amendedByName: 'Dr. Otieno Odhiambo',
            reason: 'Patient clarified prior adverse reaction to NSAIDs.',
            amendmentText: 'ADDENDUM 09:50: Patient advised strictly against over-the-counter Ibuprofen or Diclofenac due to severe gastritis flare-up history.',
          },
        ],
      },
    ],
    allergies: [
      {
        id: 'alg-01',
        allergen: 'Penicillin V',
        allergenType: 'MEDICATION',
        severity: 'SEVERE',
        reaction: 'Generalised urticaria and facial angioedema',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        recordedAt: '2026-10-19T09:25:00+03:00',
      },
      {
        id: 'alg-02',
        allergen: 'Peanuts',
        allergenType: 'FOOD',
        severity: 'MODERATE',
        reaction: 'Oral itching and localized erythema',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        recordedAt: '2026-10-19T09:25:00+03:00',
      },
    ],
    diagnoses: [
      {
        id: 'diag-01',
        code: '1F40.0',
        codingSystem: 'ICD_11_MMS',
        display: 'Plasmodium falciparum malaria',
        diagnosisType: 'WORKING',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        isPrimary: true,
        notes: 'Microscopy confirmed 2+ trophozoites in whole blood.',
        recordedAt: '2026-10-19T09:40:00+03:00',
      },
      {
        id: 'diag-02',
        code: 'BA00',
        codingSystem: 'ICD_11_MMS',
        display: 'Essential hypertension',
        diagnosisType: 'CONFIRMED',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'CONFIRMED',
        isPrimary: false,
        notes: 'Known hypertensive on regular follow-up.',
        recordedAt: '2026-10-19T09:40:00+03:00',
      },
    ],
    orders: [
      {
        id: 'ord-01',
        orderNumber: 'ORD-202610-8812',
        orderType: 'MEDICATION_REQUEST',
        status: 'AUTHORIZED',
        priority: 'URGENT',
        itemCode: 'P01BF01',
        itemName: 'Artemether + lumefantrine 20mg/120mg tablet',
        codingSystem: 'KENYA_EML',
        clinicalIndication: 'P. falciparum acute uncomplicated malaria',
        orderedAt: '2026-10-19T09:42:00+03:00',
        orderingPractitioner: 'Dr. Otieno Odhiambo',
        dosage: '4 tabs',
        route: 'ORAL',
        frequency: 'BID',
        duration: '3 days',
        quantity: 24,
      },
      {
        id: 'ord-02',
        orderNumber: 'ORD-202610-8813',
        orderType: 'LAB_SERVICE_REQUEST',
        status: 'COMPLETED',
        priority: 'STAT',
        itemCode: '58453-2',
        itemName: 'Malaria smear in Blood by Light microscopy',
        codingSystem: 'LOINC',
        clinicalIndication: 'Acute febrile illness investigation',
        orderedAt: '2026-10-19T09:22:00+03:00',
        orderingPractitioner: 'Dr. Otieno Odhiambo',
        specimenType: 'WHOLE_BLOOD',
      },
    ],
  },
  {
    id: 'enc-202610-002',
    encounterNumber: 'ENC-202610-1043',
    patientId: 'p-102',
    patientName: 'David Kiprono Kipkorir',
    mrn: 'MRN-202610-0015',
    ageYears: 34,
    gender: 'MALE',
    encounterType: 'APPOINTMENT',
    serviceDepartment: 'OUTPATIENT',
    status: 'ARRIVED',
    priority: 'SEMI_URGENT',
    reasonForVisit: 'Hypertension routine monthly clinic follow-up and prescription renewal',
    startedAt: '2026-10-19T09:30:00+03:00',
    vitals: [],
    notes: [],
    allergies: [],
  },
  {
    id: 'enc-202610-003',
    encounterNumber: 'ENC-202610-1044',
    patientId: 'p-103',
    patientName: 'UNKNOWN TRAUMA MALE (TRAUMA-A8K2)',
    mrn: 'MRN-202610-0099',
    ageYears: 30,
    gender: 'MALE',
    encounterType: 'EMERGENCY',
    serviceDepartment: 'CASUALTY',
    status: 'TRIAGED',
    priority: 'RESUSCITATION',
    reasonForVisit: 'Pedestrian vs Boda-Boda collision along Jogoo Road. Severe head laceration.',
    startedAt: '2026-10-19T09:40:00+03:00',
    vitals: [
      {
        id: 'vit-03',
        assessedAt: '2026-10-19T09:42:00+03:00',
        assessedByName: 'Nurse Kipchumba Rotich, KRCHN',
        systolicBp: 95,
        diastolicBp: 60,
        heartRate: 118,
        respiratoryRate: 26,
        temperature: 36.1,
        oxygenSaturation: 93,
        weightKg: 70.0,
        heightCm: 172.0,
        bmi: 23.7,
        bloodGlucose: 6.8,
        avpuLevel: 'VOICE',
        triagePriority: 'RESUSCITATION',
        triageNotes: 'Immediate casualty admission. IV access 2x 16G secured. High-flow oxygen started via non-rebreather mask.',
      },
    ],
    notes: [],
    allergies: [],
  },
];

export default function EncountersPage() {
  const [encountersList, setEncountersList] = useState<PatientEncounter[]>(INITIAL_ENCOUNTERS);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>('enc-202610-001');
  const [activeTab, setActiveTab] = useState<'queue' | 'triage' | 'consultation' | 'allergies' | 'orders'>('queue');
  const [filterDepartment, setFilterDepartment] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Diagnosis Form State (Authentic ICD-11 MMS Kenya Standard)
  const [diagForm, setDiagForm] = useState({
    code: 'BA00',
    codingSystem: 'ICD_11_MMS' as 'ICD_11_MMS' | 'ICD_10',
    display: 'Essential hypertension',
    diagnosisType: 'CONFIRMED' as 'WORKING' | 'PRESUMPTIVE' | 'CONFIRMED' | 'DIFFERENTIAL' | 'DISCHARGE',
    isPrimary: false,
    notes: '',
  });

  // Medication Order Form State (Authentic KEML 2023 / WHO ATC Standard)
  const [medOrderForm, setMedOrderForm] = useState({
    itemCode: 'C09AA02',
    itemName: 'Enalapril maleate 10mg tablet',
    codingSystem: 'KEML_2023',
    dosage: '10mg',
    route: 'ORAL',
    frequency: 'OD',
    duration: '30',
    quantity: '30',
    priority: 'ROUTINE' as 'ROUTINE' | 'URGENT' | 'STAT',
    clinicalIndication: 'Hypertension management',
  });

  // Service Order Form State (Authentic LOINC v2.76 Diagnostic Tests)
  const [serviceOrderForm, setServiceOrderForm] = useState({
    orderType: 'LAB_SERVICE_REQUEST' as 'LAB_SERVICE_REQUEST' | 'RADIOLOGY_SERVICE_REQUEST',
    itemCode: '2160-0',
    itemName: 'Creatinine in serum/plasma',
    codingSystem: 'LOINC_2_76',
    priority: 'ROUTINE' as 'ROUTINE' | 'URGENT' | 'STAT',
    specimenType: 'SERUM',
    clinicalIndication: 'Baseline renal function before ACE inhibitor dose titration',
  });

  // CPOE Safety & Workflow Dialog States
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [duplicateWarningOrder, setDuplicateWarningOrder] = useState<any | null>(null);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState('');
  const [fhirExportPayload, setFhirExportPayload] = useState<{ title: string; json: string } | null>(null);

  // Triage Form State
  const [triageForm, setTriageForm] = useState({
    systolicBp: '120',
    diastolicBp: '80',
    heartRate: '72',
    respiratoryRate: '18',
    temperature: '36.8',
    oxygenSaturation: '98',
    weightKg: '68.0',
    heightCm: '170.0',
    bloodGlucose: '5.5',
    avpuLevel: 'ALERT' as const,
    triagePriority: 'SEMI_URGENT' as TriagePriority,
    triageNotes: '',
  });

  // Clinical Note Form State
  const [noteForm, setNoteForm] = useState({
    noteType: 'CONSULTATION_NOTE',
    chiefComplaint: '',
    historyOfPresentIllness: '',
    pastMedicalHistory: '',
    reviewOfSystems: '',
    physicalExamination: '',
    assessment: '',
    plan: '',
  });

  // Amendment Dialog State
  const [amendingNoteId, setAmendingNoteId] = useState<string | null>(null);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentText, setAmendmentText] = useState('');

  // Encounter Closure & Reopen States
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Guarantee non-null selected encounter
  const selectedEncounter: PatientEncounter =
    (encountersList.find((e) => e.id === selectedEncounterId) || encountersList[0] || INITIAL_ENCOUNTERS[0]) as PatientEncounter;

  const calcBmi = (weightKg: number, heightCm: number): number | undefined => {
    if (!weightKg || !heightCm || heightCm <= 0) return undefined;
    const heightM = heightCm / 100;
    return parseFloat((weightKg / (heightM * heightM)).toFixed(1));
  };

  const currentPreviewBmi = calcBmi(parseFloat(triageForm.weightKg), parseFloat(triageForm.heightCm));

  const handleRegisterEncounter = (type: 'WALK_IN' | 'APPOINTMENT') => {
    const encNum = `ENC-202610-${Math.floor(1000 + Math.random() * 9000)}`;
    const newEnc: PatientEncounter = {
      id: `enc-${Date.now()}`,
      encounterNumber: encNum,
      patientId: 'p-new',
      patientName: 'Jane Wambui Mwangi',
      mrn: `MRN-202610-${Math.floor(1000 + Math.random() * 9000)}`,
      ageYears: 28,
      gender: 'FEMALE',
      encounterType: type,
      serviceDepartment: 'OUTPATIENT',
      status: type === 'WALK_IN' ? 'ARRIVED' : 'PLANNED',
      priority: 'SEMI_URGENT',
      reasonForVisit: 'General check-up and mild flu symptoms',
      startedAt: new Date().toISOString(),
      vitals: [],
      notes: [],
      allergies: [],
    };

    setEncountersList([newEnc, ...encountersList]);
    setSelectedEncounterId(newEnc.id);
    setActionNotice(`Encounter ${encNum} registered successfully (${type}).`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveTriage = (e: React.FormEvent) => {
    e.preventDefault();

    const newVital: VitalsRecord = {
      id: `vit-${Date.now()}`,
      assessedAt: new Date().toISOString(),
      assessedByName: 'Nurse Wanjiku Kamau, KRCHN',
      systolicBp: parseInt(triageForm.systolicBp) || undefined,
      diastolicBp: parseInt(triageForm.diastolicBp) || undefined,
      heartRate: parseInt(triageForm.heartRate) || undefined,
      respiratoryRate: parseInt(triageForm.respiratoryRate) || undefined,
      temperature: parseFloat(triageForm.temperature) || undefined,
      oxygenSaturation: parseInt(triageForm.oxygenSaturation) || undefined,
      weightKg: parseFloat(triageForm.weightKg) || undefined,
      heightCm: parseFloat(triageForm.heightCm) || undefined,
      bmi: currentPreviewBmi,
      bloodGlucose: parseFloat(triageForm.bloodGlucose) || undefined,
      avpuLevel: triageForm.avpuLevel,
      triagePriority: triageForm.triagePriority,
      triageNotes: triageForm.triageNotes || undefined,
    };

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        return {
          ...enc,
          status: enc.status === 'ARRIVED' || enc.status === 'PLANNED' ? ('TRIAGED' as EncounterStatus) : enc.status,
          priority: triageForm.triagePriority,
          vitals: [newVital, ...(enc.vitals || [])],
        };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setActionNotice(`Triage vitals recorded for ${selectedEncounter.patientName}. Status advanced to TRIAGED.`);
    setActiveTab('queue');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSaveDraftNote = () => {
    if (!noteForm.chiefComplaint.trim() || !noteForm.assessment.trim() || !noteForm.plan.trim()) {
      alert('Chief Complaint, Clinical Assessment, and Plan are mandatory.');
      return;
    }

    const newNote: ClinicalNoteRecord = {
      id: `note-${Date.now()}`,
      noteType: noteForm.noteType,
      status: 'DRAFT',
      chiefComplaint: noteForm.chiefComplaint,
      historyOfPresentIllness: noteForm.historyOfPresentIllness,
      pastMedicalHistory: noteForm.pastMedicalHistory,
      reviewOfSystems: noteForm.reviewOfSystems,
      physicalExamination: noteForm.physicalExamination,
      assessment: noteForm.assessment,
      plan: noteForm.plan,
      authorName: 'Dr. Otieno Odhiambo',
      authorRole: 'CLINICIAN',
      entryTime: new Date().toISOString(),
      amendments: [],
    };

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        return {
          ...enc,
          status: 'IN_PROGRESS' as EncounterStatus,
          notes: [newNote, ...(enc.notes || [])],
        };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setActionNotice('Clinical consultation note saved as DRAFT. Encounter transitioned to IN_PROGRESS.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleFinalizeNote = (noteId: string) => {
    const signature = `SIG-DR-OTIENO-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        const updatedNotes = (enc.notes || []).map((n) => {
          if (n.id === noteId) {
            return {
              ...n,
              status: 'FINALIZED' as const,
              finalizedAt: new Date().toISOString(),
              digitalSignature: signature,
            };
          }
          return n;
        });
        return { ...enc, notes: updatedNotes };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setActionNotice(`Clinical note legally signed and locked (${signature}).`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleAddAmendment = (noteId: string) => {
    if (amendmentReason.trim().length < 10) {
      alert('Statutory requirement: Clinical amendment justification must be at least 10 characters long.');
      return;
    }
    if (!amendmentText.trim()) {
      alert('Amendment text is required.');
      return;
    }

    const newAmendment: NoteAmendment = {
      id: `amend-${Date.now()}`,
      amendedAt: new Date().toISOString(),
      amendedByName: 'Dr. Otieno Odhiambo (Medical Officer)',
      reason: amendmentReason,
      amendmentText: amendmentText,
    };

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        const updatedNotes = (enc.notes || []).map((n) => {
          if (n.id === noteId) {
            return {
              ...n,
              status: 'AMENDED' as const,
              amendments: [...n.amendments, newAmendment],
            };
          }
          return n;
        });
        return { ...enc, notes: updatedNotes };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setAmendingNoteId(null);
    setAmendmentReason('');
    setAmendmentText('');
    setActionNotice('Formal addendum recorded with full practitioner provenance.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleCloseEncounter = () => {
    const openDrafts = (selectedEncounter.notes || []).filter((n) => n.status === 'DRAFT');
    if (openDrafts.length > 0) {
      alert(`Cannot close encounter: There are ${openDrafts.length} unfinalized draft notes. Please finalize or cancel them first.`);
      return;
    }

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        return {
          ...enc,
          status: 'COMPLETED' as EncounterStatus,
        };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setActionNotice(`Encounter ${selectedEncounter.encounterNumber} completed and closed.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleReopenEncounter = () => {
    if (reopenReason.trim().length < 10) {
      alert('Reopening justification must be at least 10 characters long.');
      return;
    }

    const updatedList = encountersList.map((enc) => {
      if (enc.id === selectedEncounter.id) {
        return {
          ...enc,
          status: 'REOPENED' as EncounterStatus,
        };
      }
      return enc;
    });

    setEncountersList(updatedList);
    setShowReopenModal(false);
    setReopenReason('');
    setActionNotice(`Encounter ${selectedEncounter.encounterNumber} reopened for clinical correction.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const getPriorityBadge = (p: TriagePriority) => {
    switch (p) {
      case 'RESUSCITATION':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'EMERGENCY':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'URGENT':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'SEMI_URGENT':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'NON_URGENT':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const getStatusBadge = (s: EncounterStatus) => {
    switch (s) {
      case 'PLANNED':
        return 'bg-slate-700/60 text-slate-300 border-slate-600';
      case 'ARRIVED':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'TRIAGED':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'IN_PROGRESS':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'ON_HOLD':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'COMPLETED':
        return 'bg-slate-600/40 text-slate-400 border-slate-700';
      case 'REOPENED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const filteredQueue = encountersList.filter((enc) => {
    const matchesDept = filterDepartment === 'ALL' || enc.serviceDepartment === filterDepartment;
    const matchesStatus = filterStatus === 'ALL' || enc.status === filterStatus;
    const matchesSearch =
      !searchQuery.trim() ||
      enc.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enc.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enc.encounterNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesStatus && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">
                <Stethoscope className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">Outpatient Clinical Documentation</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Milestone 5
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Reception Queue • Nurse Triage • Outpatient Consultation • Allergy Safety Guard
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleRegisterEncounter('WALK_IN')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            Check-In Walk-In
          </button>
          <button
            onClick={() => handleRegisterEncounter('APPOINTMENT')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Calendar className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </header>

      {/* Notifications Banner */}
      {actionNotice && (
        <div className="bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200 px-6 py-2.5 text-xs font-medium flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Queue on Left, Workspace on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Patient Queue (4 cols) */}
        <aside className="lg:col-span-4 border-r border-slate-800 flex flex-col bg-slate-900/40 overflow-y-auto">
          {/* Queue Filter Bar */}
          <div className="p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient name, MRN, or encounter #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="filter-department" className="sr-only">Filter by Department</label>
              <select
                id="filter-department"
                aria-label="Filter encounters by department"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="flex-1 py-1 px-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Departments</option>
                <option value="OUTPATIENT">Outpatient</option>
                <option value="CASUALTY">Casualty / ER</option>
                <option value="MCH">MCH / Clinic</option>
                <option value="SPECIALIST_CLINIC">Specialist</option>
              </select>

              <label htmlFor="filter-status" className="sr-only">Filter by Status</label>
              <select
                id="filter-status"
                aria-label="Filter encounters by status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="flex-1 py-1 px-2 bg-slate-800 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="ARRIVED">Arrived</option>
                <option value="TRIAGED">Triaged</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="REOPENED">Reopened</option>
              </select>
            </div>
          </div>

          {/* Queue Items List */}
          <div className="divide-y divide-slate-800/80 flex-1 overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No patient encounters matching the filter criteria.
              </div>
            ) : (
              filteredQueue.map((enc) => {
                const isSelected = enc.id === selectedEncounter.id;
                return (
                  <div
                    key={enc.id}
                    onClick={() => setSelectedEncounterId(enc.id)}
                    className={`p-4 cursor-pointer transition flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-slate-800/90 border-l-4 border-emerald-500'
                        : 'hover:bg-slate-800/40 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-white flex items-center gap-2">
                          {enc.patientName}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({enc.ageYears}y, {enc.gender})
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {enc.mrn} • {enc.encounterNumber}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getPriorityBadge(
                          enc.priority,
                        )}`}
                      >
                        {enc.priority}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 line-clamp-1 italic">
                      &quot;{enc.reasonForVisit}&quot;
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span className="font-medium text-slate-300">{enc.serviceDepartment}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadge(enc.status)}`}>
                        {enc.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Clinical Workspace (8 cols) */}
        <section className="lg:col-span-8 flex flex-col bg-slate-950 overflow-y-auto">
          {/* Patient Banner */}
          <div className="p-5 border-b border-slate-800 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-white">{selectedEncounter.patientName}</h2>
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {selectedEncounter.mrn}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusBadge(selectedEncounter.status)}`}>
                  {selectedEncounter.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-3">
                <span>Encounter: <strong className="text-slate-200">{selectedEncounter.encounterNumber}</strong></span>
                <span>•</span>
                <span>Dept: <strong className="text-slate-200">{selectedEncounter.serviceDepartment}</strong></span>
                <span>•</span>
                <span>Assigned: <strong className="text-slate-200">{selectedEncounter.practitionerName || 'Pending Clinician'}</strong></span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {selectedEncounter.status === 'COMPLETED' ? (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Reopen Encounter
                </button>
              ) : (
                <button
                  onClick={handleCloseEncounter}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition"
                  title="Close encounter upon completion of care"
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Close & Discharge
                </button>
              )}
            </div>
          </div>

          {/* Allergy Alert Pill Bar (Clinical Safety Control) */}
          <div className="px-6 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5 flex-shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
              Allergy Alerts:
            </span>
            {(selectedEncounter.allergies || []).length === 0 ? (
              <span className="text-xs text-slate-500 italic">No recorded allergies (NKA)</span>
            ) : (
              (selectedEncounter.allergies || []).map((alg) => (
                <span
                  key={alg.id}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium whitespace-nowrap"
                >
                  <strong>{alg.allergen}</strong>
                  <span className="text-[10px] text-rose-400">({alg.severity})</span>
                </span>
              ))
            )}
          </div>

          {/* Workspace Tabs Navigation */}
          <div className="border-b border-slate-800 px-6 flex items-center gap-6 text-xs font-medium bg-slate-900/30">
            <button
              onClick={() => setActiveTab('queue')}
              className={`py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === 'queue'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Encounter Overview
            </button>
            <button
              onClick={() => setActiveTab('triage')}
              className={`py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === 'triage'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              Nurse Triage & Vitals ({(selectedEncounter.vitals || []).length})
            </button>
            <button
              onClick={() => setActiveTab('consultation')}
              className={`py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === 'consultation'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              Outpatient Notes ({(selectedEncounter.notes || []).length})
            </button>
            <button
              onClick={() => setActiveTab('allergies')}
              className={`py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === 'allergies'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-4 h-4" />
              Allergies Management ({(selectedEncounter.allergies || []).length})
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`py-3 border-b-2 transition flex items-center gap-2 ${
                activeTab === 'orders'
                  ? 'border-emerald-500 text-emerald-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              CPOE & Terminology ({(selectedEncounter.orders || []).length + (selectedEncounter.diagnoses || []).length})
            </button>
          </div>

          {/* Tab Content Panes */}
          <div className="p-6 flex-1 overflow-y-auto space-y-6">
            {/* TAB 1: ENCOUNTER OVERVIEW */}
            {activeTab === 'queue' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Registration Mode</span>
                    <div className="text-sm font-semibold text-white">{selectedEncounter.encounterType}</div>
                    <div className="text-xs text-slate-400">Initiated: {new Date(selectedEncounter.startedAt).toLocaleTimeString()}</div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Triage Acuity</span>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded border ${getPriorityBadge(selectedEncounter.priority)}`}>
                        {selectedEncounter.priority}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">Department: {selectedEncounter.serviceDepartment}</div>
                  </div>

                  <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Clinical Status</span>
                    <div className="text-sm font-semibold text-white">{selectedEncounter.status}</div>
                    <div className="text-xs text-slate-400">Notes recorded: {(selectedEncounter.notes || []).length}</div>
                  </div>
                </div>

                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Presenting Reason for Visit</h3>
                  <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-950 p-4 rounded-lg border border-slate-800">
                    &quot;{selectedEncounter.reasonForVisit}&quot;
                  </p>
                </div>

                {/* Latest Vitals Snapshot */}
                {selectedEncounter.vitals && selectedEncounter.vitals.length > 0 && (() => {
                  const latestVitals = selectedEncounter.vitals[0];
                  if (!latestVitals) return null;
                  return (
                    <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Latest Recorded Vitals</h3>
                        <span className="text-xs text-slate-400 font-mono">
                          {new Date(latestVitals.assessedAt).toLocaleTimeString()} • {latestVitals.assessedByName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-[11px] text-slate-400">Blood Pressure</span>
                          <div className="text-base font-bold text-white mt-1">
                            {latestVitals.systolicBp}/{latestVitals.diastolicBp} <span className="text-xs text-slate-400">mmHg</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-[11px] text-slate-400">Heart Rate</span>
                          <div className="text-base font-bold text-white mt-1">
                            {latestVitals.heartRate} <span className="text-xs text-slate-400">bpm</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-[11px] text-slate-400">Temperature</span>
                          <div className="text-base font-bold text-white mt-1">
                            {latestVitals.temperature} <span className="text-xs text-slate-400">°C</span>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                          <span className="text-[11px] text-slate-400">SpO2 Oxygen</span>
                          <div className="text-base font-bold text-white mt-1">
                            {latestVitals.oxygenSaturation} <span className="text-xs text-slate-400">%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: NURSE TRIAGE & VITAL SIGNS */}
            {activeTab === 'triage' && (
              <div className="space-y-6">
                <form onSubmit={handleSaveTriage} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-emerald-400" />
                      Capture Triage Observations & Vital Signs
                    </h3>
                    <span className="text-xs text-slate-400">All physiological measurements with explicit Kenyan units</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Systolic BP (mmHg)</label>
                      <input
                        type="number"
                        value={triageForm.systolicBp}
                        onChange={(e) => setTriageForm({ ...triageForm, systolicBp: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="40"
                        max="300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Diastolic BP (mmHg)</label>
                      <input
                        type="number"
                        value={triageForm.diastolicBp}
                        onChange={(e) => setTriageForm({ ...triageForm, diastolicBp: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="20"
                        max="200"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Heart Rate (bpm)</label>
                      <input
                        type="number"
                        value={triageForm.heartRate}
                        onChange={(e) => setTriageForm({ ...triageForm, heartRate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="30"
                        max="250"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Respiratory Rate (/min)</label>
                      <input
                        type="number"
                        value={triageForm.respiratoryRate}
                        onChange={(e) => setTriageForm({ ...triageForm, respiratoryRate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="6"
                        max="60"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Body Temperature (°C)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={triageForm.temperature}
                        onChange={(e) => setTriageForm({ ...triageForm, temperature: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="30.0"
                        max="43.0"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">SpO2 Saturation (%)</label>
                      <input
                        type="number"
                        value={triageForm.oxygenSaturation}
                        onChange={(e) => setTriageForm({ ...triageForm, oxygenSaturation: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="50"
                        max="100"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={triageForm.weightKg}
                        onChange={(e) => setTriageForm({ ...triageForm, weightKg: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="1"
                        max="300"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={triageForm.heightCm}
                        onChange={(e) => setTriageForm({ ...triageForm, heightCm: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        min="30"
                        max="240"
                        required
                      />
                    </div>
                  </div>

                  {/* Auto-computed BMI & AVPU Consciousness */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-400">Auto-Computed BMI</span>
                        <div className="text-base font-bold text-emerald-400 mt-0.5">
                          {currentPreviewBmi ? `${currentPreviewBmi} kg/m²` : 'Enter wt & ht'}
                        </div>
                      </div>
                      <Scale className="w-5 h-5 text-slate-600" />
                    </div>

                    <div>
                      <label htmlFor="triage-avpu-select" className="block text-xs font-medium text-slate-300 mb-1">AVPU Consciousness Scale</label>
                      <select
                        id="triage-avpu-select"
                        aria-label="AVPU Consciousness Scale"
                        value={triageForm.avpuLevel}
                        onChange={(e) => setTriageForm({ ...triageForm, avpuLevel: e.target.value as any })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                      >
                        <option value="ALERT">Alert (Conscious & responsive)</option>
                        <option value="VOICE">Voice (Responds to verbal command)</option>
                        <option value="PAIN">Pain (Responds only to painful stimuli)</option>
                        <option value="UNRESPONSIVE">Unresponsive (Comatose)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="triage-priority-select" className="block text-xs font-medium text-slate-300 mb-1">Assessed Triage Priority</label>
                      <select
                        id="triage-priority-select"
                        aria-label="Assessed Triage Priority"
                        value={triageForm.triagePriority}
                        onChange={(e) => setTriageForm({ ...triageForm, triagePriority: e.target.value as TriagePriority })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                      >
                        <option value="SEMI_URGENT">Semi-Urgent (Standard OPD)</option>
                        <option value="URGENT">Urgent (Priority assessment)</option>
                        <option value="EMERGENCY">Emergency (Immediate danger)</option>
                        <option value="RESUSCITATION">Resuscitation (Life-threatening)</option>
                        <option value="NON_URGENT">Non-Urgent (Elective)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Triage Remarks / Clinical Notes</label>
                    <textarea
                      rows={2}
                      value={triageForm.triageNotes}
                      onChange={(e) => setTriageForm({ ...triageForm, triageNotes: e.target.value })}
                      placeholder="Add observations, skin color, distress cues, or immediate nurse instructions..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Save Triage & Advance Encounter
                    </button>
                  </div>
                </form>

                {/* Vitals History List */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Prior Vitals History</h4>
                  {(selectedEncounter.vitals || []).map((v) => (
                    <div key={v.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{v.assessedByName}</span>
                        <span className="text-slate-400 font-mono">{new Date(v.assessedAt).toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-slate-300 flex flex-wrap gap-4">
                        <span>BP: <strong>{v.systolicBp}/{v.diastolicBp} mmHg</strong></span>
                        <span>HR: <strong>{v.heartRate} bpm</strong></span>
                        <span>Temp: <strong>{v.temperature} °C</strong></span>
                        <span>SpO2: <strong>{v.oxygenSaturation}%</strong></span>
                        <span>BMI: <strong>{v.bmi} kg/m²</strong></span>
                        <span>AVPU: <strong>{v.avpuLevel}</strong></span>
                      </div>
                      {v.triageNotes && (
                        <div className="text-xs text-slate-400 italic bg-slate-950 p-2 rounded">
                          &quot;{v.triageNotes}&quot;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: OUTPATIENT NOTES & CLINICAL CONSULTATION */}
            {activeTab === 'consultation' && (
              <div className="space-y-6">
                {/* Note Authoring Form */}
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-emerald-400" />
                      Doctor Consultation / Progress Note
                    </h3>
                    <span className="text-xs text-slate-400">Preserves Draft vs Signed vs Amended Legal Distinction</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Chief Complaint *</label>
                      <input
                        type="text"
                        placeholder="Patient main presenting issue e.g. Fever, productive cough for 4 days"
                        value={noteForm.chiefComplaint}
                        onChange={(e) => setNoteForm({ ...noteForm, chiefComplaint: e.target.value })}
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">History of Present Illness (HPI)</label>
                        <textarea
                          rows={3}
                          placeholder="Onset, character, duration, aggravating and relieving factors..."
                          value={noteForm.historyOfPresentIllness}
                          onChange={(e) => setNoteForm({ ...noteForm, historyOfPresentIllness: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Physical Examination Findings</label>
                        <textarea
                          rows={3}
                          placeholder="Chest auscultation, abdominal palpation, neurological exam..."
                          value={noteForm.physicalExamination}
                          onChange={(e) => setNoteForm({ ...noteForm, physicalExamination: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Assessment / Impression *</label>
                        <textarea
                          rows={2}
                          placeholder="Clinical diagnosis, differential impression..."
                          value={noteForm.assessment}
                          onChange={(e) => setNoteForm({ ...noteForm, assessment: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Management Plan & Rx *</label>
                        <textarea
                          rows={2}
                          placeholder="Prescriptions with dosages, lab orders, follow-up schedule..."
                          value={noteForm.plan}
                          onChange={(e) => setNoteForm({ ...noteForm, plan: e.target.value })}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={handleSaveDraftNote}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
                    >
                      Save as DRAFT
                    </button>
                  </div>
                </div>

                {/* Recorded Clinical Notes Stream */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Documented Clinical Notes History</h4>
                  {(selectedEncounter.notes || []).map((note) => (
                    <div
                      key={note.id}
                      className={`p-5 rounded-xl border space-y-3 ${
                        note.status === 'FINALIZED'
                          ? 'bg-slate-900 border-slate-800'
                          : note.status === 'AMENDED'
                          ? 'bg-slate-900 border-amber-500/30'
                          : 'bg-slate-900/60 border-dashed border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{note.chiefComplaint}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                note.status === 'FINALIZED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : note.status === 'AMENDED'
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                  : 'bg-slate-700 text-slate-300 border-slate-600'
                              }`}
                            >
                              {note.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Author: <strong className="text-slate-300">{note.authorName}</strong> ({note.authorRole}) •{' '}
                            {new Date(note.entryTime).toLocaleString()}
                          </div>
                        </div>

                        {/* Note Actions: Sign if draft, Amend if finalized/amended */}
                        <div className="flex items-center gap-2">
                          {note.status === 'DRAFT' && (
                            <button
                              onClick={() => handleFinalizeNote(note.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Sign & Finalize
                            </button>
                          )}

                          {(note.status === 'FINALIZED' || note.status === 'AMENDED') && (
                            <button
                              onClick={() => setAmendingNoteId(note.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-xs font-medium transition"
                            >
                              <History className="w-3.5 h-3.5" />
                              Add Legal Addendum
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                        {note.historyOfPresentIllness && (
                          <div>
                            <span className="text-slate-500 font-semibold uppercase text-[10px]">HPI:</span>
                            <p className="mt-0.5">{note.historyOfPresentIllness}</p>
                          </div>
                        )}
                        {note.physicalExamination && (
                          <div>
                            <span className="text-slate-500 font-semibold uppercase text-[10px]">Physical Exam:</span>
                            <p className="mt-0.5">{note.physicalExamination}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px]">Assessment:</span>
                          <p className="mt-0.5 font-medium text-emerald-300">{note.assessment}</p>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px]">Plan:</span>
                          <p className="mt-0.5 font-mono text-slate-200 whitespace-pre-line">{note.plan}</p>
                        </div>
                      </div>

                      {/* Digital Signature Badge */}
                      {note.digitalSignature && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono bg-emerald-950/20 border border-emerald-900/40 p-2 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Finalized & Digitally Signed: {note.digitalSignature} at {note.finalizedAt ? new Date(note.finalizedAt).toLocaleTimeString() : ''}</span>
                        </div>
                      )}

                      {/* Amendments & Addenda Audit List */}
                      {note.amendments && note.amendments.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5" />
                            Correction & Addendum History ({note.amendments.length})
                          </span>
                          {note.amendments.map((am) => (
                            <div key={am.id} className="p-3 bg-amber-950/15 border border-amber-800/30 rounded text-xs space-y-1">
                              <div className="flex items-center justify-between text-amber-300">
                                <strong>Reason: {am.reason}</strong>
                                <span className="text-slate-400 font-mono text-[10px]">{new Date(am.amendedAt).toLocaleString()}</span>
                              </div>
                              <p className="text-slate-200">{am.amendmentText}</p>
                              <div className="text-[10px] text-slate-400">By {am.amendedByName}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline Amendment Modal/Drawer */}
                      {amendingNoteId === note.id && (
                        <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-lg space-y-3 mt-3 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Formal Legal Addendum to Finalized Record
                            </h5>
                            <button onClick={() => setAmendingNoteId(null)} className="text-xs text-slate-400 hover:text-white">
                              Cancel
                            </button>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Mandatory Justification / Clinical Reason (Min 10 characters) *
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Patient clarified drug allergy after initial chart finalization"
                              value={amendmentReason}
                              onChange={(e) => setAmendmentReason(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Addendum Clinical Text *
                            </label>
                            <textarea
                              rows={2}
                              placeholder="ADDENDUM timestamp & details..."
                              value={amendmentText}
                              onChange={(e) => setAmendmentText(e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setAmendingNoteId(null)}
                              className="px-3 py-1 bg-slate-800 text-slate-300 rounded text-xs hover:bg-slate-700"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => handleAddAmendment(note.id)}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-bold transition shadow-sm"
                            >
                              Commit Legal Addendum
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: PATIENT ALLERGIES MANAGEMENT */}
            {activeTab === 'allergies' && (
              <div className="space-y-6">
                <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    Record Patient Allergy / Adverse Reaction
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Allergen Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Penicillin, Sulfa, Aspirin, Latex"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        id="newAllergen"
                      />
                    </div>

                    <div>
                      <label htmlFor="newSeverity" className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
                      <select
                        id="newSeverity"
                        aria-label="Allergy Severity"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                      >
                        <option value="MILD">Mild</option>
                        <option value="MODERATE">Moderate</option>
                        <option value="SEVERE">Severe</option>
                        <option value="LIFE_THREATENING">Life Threatening (Anaphylaxis)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Manifested Reaction</label>
                      <input
                        type="text"
                        placeholder="e.g. Hives, facial swelling, bronchospasm"
                        className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs"
                        id="newReaction"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        const allergenInput = document.getElementById('newAllergen') as HTMLInputElement;
                        const severityInput = document.getElementById('newSeverity') as HTMLSelectElement;
                        const reactionInput = document.getElementById('newReaction') as HTMLInputElement;

                        if (!allergenInput.value.trim()) {
                          alert('Allergen name is required.');
                          return;
                        }

                        const newAllergy: PatientAllergyItem = {
                          id: `alg-${Date.now()}`,
                          allergen: allergenInput.value,
                          allergenType: 'MEDICATION',
                          severity: severityInput.value as any,
                          reaction: reactionInput.value || undefined,
                          clinicalStatus: 'ACTIVE',
                          verificationStatus: 'CONFIRMED',
                          recordedAt: new Date().toISOString(),
                        };

                        const updatedList = encountersList.map((enc) => {
                          if (enc.id === selectedEncounter.id) {
                            return { ...enc, allergies: [newAllergy, ...(enc.allergies || [])] };
                          }
                          return enc;
                        });

                        setEncountersList(updatedList);
                        allergenInput.value = '';
                        reactionInput.value = '';
                        setActionNotice(`Allergy for ${newAllergy.allergen} added to medical record.`);
                        setTimeout(() => setActionNotice(null), 4000);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                    >
                      Record Allergy
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Allergies on Patient Chart</h4>
                  {(selectedEncounter.allergies || []).map((alg) => (
                    <div key={alg.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{alg.allergen}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {alg.severity}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                            {alg.clinicalStatus}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Reaction: <strong className="text-slate-300">{alg.reaction || 'None specified'}</strong> •{' '}
                          Recorded: {new Date(alg.recordedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: CLINICAL TERMINOLOGY & CPOE ORDERS */}
            {activeTab === 'orders' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Clinical Safety & Boundary Banner */}
                <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                  <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg flex-shrink-0 mt-0.5">
                    <ShieldAlert className="w-5 h-5" />
                  </span>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-white text-sm">
                      Clinical Terminology Governance & CPOE Boundary
                    </div>
                    <p className="text-emerald-200/80 leading-relaxed">
                      All diagnoses and clinical orders conform to official Kenya Ministry of Health standards (WHO ICD-11 MMS 2024, LOINC v2.76, KEML 2023 / WHO ATC).
                      Automated autonomous prescription or unverified treatment recommendations are strictly prohibited.
                      Clinical orders represent clinician ordering intent and are strictly separated from pharmacy dispensing and laboratory result records.
                    </p>
                  </div>
                </div>

                {/* SECTION 1: CLINICAL DIAGNOSES */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Stethoscope className="w-5 h-5 text-emerald-400" />
                        Clinical Diagnoses Entry (WHO ICD-11 MMS / ICD-10)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Authentic Kenya MOH Standard • Encounter-bound • Primary & Differential Diagnosis Management
                      </p>
                    </div>
                    <span className="text-[11px] px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                      Standard: WHO ICD-11 MMS (2024-01)
                    </span>
                  </div>

                  {/* Standard Quick-Pick Catalogues */}
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">
                      Standard Catalogue Fast Selection (Kenya Outpatient High-Frequency):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { code: 'BA00', system: 'ICD_11_MMS', display: 'Essential hypertension' },
                        { code: '1F40', system: 'ICD_11_MMS', display: 'Malaria' },
                        { code: '5A11', system: 'ICD_11_MMS', display: 'Type 2 diabetes mellitus' },
                        { code: 'CA40', system: 'ICD_11_MMS', display: 'Pneumonia' },
                        { code: '1A00', system: 'ICD_11_MMS', display: 'Cholera' },
                        { code: 'FA20', system: 'ICD_11_MMS', display: 'Rheumatoid arthritis' },
                        { code: 'I10', system: 'ICD_10', display: 'Essential (primary) hypertension' },
                        { code: 'B54', system: 'ICD_10', display: 'Unspecified malaria' },
                      ].map((item) => (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => {
                            setDiagForm({
                              ...diagForm,
                              code: item.code,
                              codingSystem: item.system as any,
                              display: item.display,
                            });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition text-left ${
                            diagForm.code === item.code
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <span className="font-mono text-[10px] text-emerald-400 mr-1.5">{item.code}</span>
                          {item.display}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Diagnosis Input Form */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl">
                    <div>
                      <label htmlFor="diag-coding-system" className="block text-xs font-medium text-slate-300 mb-1">Standard Coding System *</label>
                      <select
                        id="diag-coding-system"
                        aria-label="Standard Coding System"
                        value={diagForm.codingSystem}
                        onChange={(e) => setDiagForm({ ...diagForm, codingSystem: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="ICD_11_MMS">WHO ICD-11 MMS (Kenya Standard)</option>
                        <option value="ICD_10">WHO ICD-10 (Legacy Compatibility)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="diag-code-input" className="block text-xs font-medium text-slate-300 mb-1">Catalogue Code *</label>
                      <input
                        id="diag-code-input"
                        type="text"
                        value={diagForm.code}
                        onChange={(e) => setDiagForm({ ...diagForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                        placeholder="e.g. BA00"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="diag-display-input" className="block text-xs font-medium text-slate-300 mb-1">Clinical Display *</label>
                      <input
                        id="diag-display-input"
                        type="text"
                        value={diagForm.display}
                        onChange={(e) => setDiagForm({ ...diagForm, display: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                        placeholder="Official diagnosis description"
                      />
                    </div>

                    <div>
                      <label htmlFor="diag-type-select" className="block text-xs font-medium text-slate-300 mb-1">Diagnosis Type</label>
                      <select
                        id="diag-type-select"
                        aria-label="Diagnosis Type"
                        value={diagForm.diagnosisType}
                        onChange={(e) => setDiagForm({ ...diagForm, diagnosisType: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="CONFIRMED">CONFIRMED</option>
                        <option value="WORKING">WORKING</option>
                        <option value="PRESUMPTIVE">PRESUMPTIVE</option>
                        <option value="DIFFERENTIAL">DIFFERENTIAL</option>
                        <option value="DISCHARGE">DISCHARGE</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="isPrimaryDiag"
                        checked={diagForm.isPrimary}
                        onChange={(e) => setDiagForm({ ...diagForm, isPrimary: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700"
                      />
                      <label htmlFor="isPrimaryDiag" className="text-xs font-medium text-slate-300 cursor-pointer">
                        Mark as Primary Diagnosis
                      </label>
                    </div>

                    <div className="md:col-span-2 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!diagForm.code.trim() || !diagForm.display.trim()) {
                            alert('Code and clinical display name are required.');
                            return;
                          }
                          const existing = (selectedEncounter.diagnoses || []).some(
                            (d) => d.code === diagForm.code && d.codingSystem === diagForm.codingSystem
                          );
                          if (existing) {
                            alert(`Diagnosis code ${diagForm.code} already recorded for this encounter.`);
                            return;
                          }
                          const newDiag: EncounterDiagnosis = {
                            id: `diag-${Date.now()}`,
                            code: diagForm.code,
                            codingSystem: diagForm.codingSystem,
                            display: diagForm.display,
                            diagnosisType: diagForm.diagnosisType,
                            clinicalStatus: 'ACTIVE',
                            verificationStatus: 'CONFIRMED',
                            isPrimary: diagForm.isPrimary,
                            notes: diagForm.notes || undefined,
                            recordedAt: new Date().toISOString(),
                          };

                          const updatedList = encountersList.map((enc) => {
                            if (enc.id === selectedEncounter.id) {
                              let cur = enc.diagnoses || [];
                              if (newDiag.isPrimary) {
                                cur = cur.map((d) => ({ ...d, isPrimary: false }));
                              }
                              return { ...enc, diagnoses: [newDiag, ...cur] };
                            }
                            return enc;
                          });

                          setEncountersList(updatedList);
                          setActionNotice(`Diagnosis ${newDiag.code} (${newDiag.display}) recorded.`);
                          setTimeout(() => setActionNotice(null), 4000);
                        }}
                        className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Record Diagnosis
                      </button>
                    </div>
                  </div>

                  {/* Diagnoses List */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Diagnoses for Encounter ({ (selectedEncounter.diagnoses || []).length })
                    </h4>
                    {(!selectedEncounter.diagnoses || selectedEncounter.diagnoses.length === 0) ? (
                      <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-500 text-center">
                        No clinical diagnoses recorded for this encounter yet.
                      </div>
                    ) : (
                      selectedEncounter.diagnoses.map((diag) => (
                        <div
                          key={diag.id}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {diag.isPrimary && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  PRIMARY
                                </span>
                              )}
                              <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                {diag.code}
                              </span>
                              <span className="font-bold text-sm text-white">{diag.display}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {diag.codingSystem}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                {diag.diagnosisType}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 flex items-center gap-3">
                              <span>Clinical Status: <strong className="text-slate-300">{diag.clinicalStatus}</strong></span>
                              <span>•</span>
                              <span>Verification: <strong className="text-slate-300">{diag.verificationStatus}</strong></span>
                              <span>•</span>
                              <span>Recorded: {new Date(diag.recordedAt).toLocaleTimeString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const fhirCond = {
                                  resourceType: 'Condition',
                                  id: diag.id,
                                  meta: { profile: ['http://health.go.ke/fhir/StructureDefinition/kenya-condition'] },
                                  clinicalStatus: {
                                    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: diag.clinicalStatus.toLowerCase() }],
                                  },
                                  verificationStatus: {
                                    coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: diag.verificationStatus.toLowerCase() }],
                                  },
                                  code: {
                                    coding: [{
                                      system: diag.codingSystem === 'ICD_11_MMS' ? 'http://id.who.int/icd11/mms' : 'http://hl7.org/fhir/sid/icd-10',
                                      code: diag.code,
                                      display: diag.display,
                                    }],
                                    text: diag.display,
                                  },
                                  subject: { reference: `Patient/${selectedEncounter.patientId}`, display: selectedEncounter.patientName },
                                  encounter: { reference: `Encounter/${selectedEncounter.id}`, display: selectedEncounter.encounterNumber },
                                  recordedDate: diag.recordedAt,
                                  recorder: { reference: 'Practitioner/pract-001', display: 'Dr. Otieno Odhiambo' },
                                };
                                setFhirExportPayload({
                                  title: `FHIR R4 Condition • ${diag.code}`,
                                  json: JSON.stringify(fhirCond, null, 2),
                                });
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                            >
                              <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
                              FHIR R4 Condition
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SECTION 2: COMPUTERIZED PROVIDER ORDER ENTRY (CPOE) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Medication Order Entry (KEML 2023 / WHO ATC) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                    <div className="border-b border-slate-800 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Pill className="w-5 h-5 text-emerald-400" />
                        Medication Request (KEML 2023 / WHO ATC)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Authentic Kenya Formulary • Posology, Route, Frequency & Duplicate Guard
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="med-order-item" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Formulary Preset (Kenya Essential Medicines List):
                        </label>
                        <select
                          id="med-order-item"
                          aria-label="Formulary Preset (Kenya Essential Medicines List)"
                          value={medOrderForm.itemCode}
                          onChange={(e) => {
                            const map: Record<string, string> = {
                              'C09AA02': 'Enalapril maleate 10mg tablet',
                              'P01BF01': 'Artemether + Lumefantrine 20/120mg tablet',
                              'A10BA02': 'Metformin hydrochloride 500mg tablet',
                              'J01CA04': 'Amoxicillin 500mg capsule',
                              'N02BE01': 'Paracetamol 500mg tablet',
                              'C08CA01': 'Amlodipine 5mg tablet',
                            };
                            setMedOrderForm({
                              ...medOrderForm,
                              itemCode: e.target.value,
                              itemName: map[e.target.value] || e.target.value,
                            });
                          }}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                        >
                          <option value="C09AA02">C09AA02 • Enalapril maleate 10mg tablet</option>
                          <option value="P01BF01">P01BF01 • Artemether + Lumefantrine 20/120mg</option>
                          <option value="A10BA02">A10BA02 • Metformin hydrochloride 500mg tablet</option>
                          <option value="J01CA04">J01CA04 • Amoxicillin 500mg capsule</option>
                          <option value="N02BE01">N02BE01 • Paracetamol 500mg tablet</option>
                          <option value="C08CA01">C08CA01 • Amlodipine 5mg tablet</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="med-order-dosage" className="block text-xs font-medium text-slate-300 mb-1">Dosage *</label>
                          <input
                            id="med-order-dosage"
                            type="text"
                            value={medOrderForm.dosage}
                            onChange={(e) => setMedOrderForm({ ...medOrderForm, dosage: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. 10mg"
                          />
                        </div>
                        <div>
                          <label htmlFor="med-order-route" className="block text-xs font-medium text-slate-300 mb-1">Route *</label>
                          <select
                            id="med-order-route"
                            aria-label="Route"
                            value={medOrderForm.route}
                            onChange={(e) => setMedOrderForm({ ...medOrderForm, route: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="ORAL">Oral</option>
                            <option value="INTRAVENOUS">Intravenous (IV)</option>
                            <option value="INTRAMUSCULAR">Intramuscular (IM)</option>
                            <option value="SUBCUTANEOUS">Subcutaneous (SC)</option>
                            <option value="TOPICAL">Topical</option>
                            <option value="INHALATION">Inhalation</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label htmlFor="med-order-frequency" className="block text-xs font-medium text-slate-300 mb-1">Frequency *</label>
                          <select
                            id="med-order-frequency"
                            aria-label="Frequency"
                            value={medOrderForm.frequency}
                            onChange={(e) => setMedOrderForm({ ...medOrderForm, frequency: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                          >
                            <option value="OD">Once Daily (OD)</option>
                            <option value="BD">Twice Daily (BD)</option>
                            <option value="TDS">Three Times Daily (TDS)</option>
                            <option value="QID">Four Times Daily (QID)</option>
                            <option value="PRN">As Needed (PRN)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Duration (Days)</label>
                          <input
                            type="number"
                            value={medOrderForm.duration}
                            onChange={(e) => setMedOrderForm({ ...medOrderForm, duration: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Dispense Qty</label>
                          <input
                            type="number"
                            value={medOrderForm.quantity}
                            onChange={(e) => setMedOrderForm({ ...medOrderForm, quantity: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Indication</label>
                        <input
                          type="text"
                          value={medOrderForm.clinicalIndication}
                          onChange={(e) => setMedOrderForm({ ...medOrderForm, clinicalIndication: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. Stage II essential hypertension"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const existingActive = (selectedEncounter.orders || []).find(
                            (o) => o.itemCode === medOrderForm.itemCode && (o.status === 'ACTIVE' || o.status === 'AUTHORIZED')
                          );
                          if (existingActive) {
                            setDuplicateWarningOrder({
                              type: 'MEDICATION_REQUEST',
                              itemCode: medOrderForm.itemCode,
                              itemName: medOrderForm.itemName,
                              existingOrderNumber: existingActive.orderNumber,
                              orderPayload: { ...medOrderForm },
                            });
                            return;
                          }

                          const orderNum = `ORD-202610-${Math.floor(1000 + Math.random() * 9000)}`;
                          const newOrder: ClinicalOrderDisplay = {
                            id: `ord-${Date.now()}`,
                            orderNumber: orderNum,
                            orderType: 'MEDICATION_REQUEST',
                            status: 'ACTIVE',
                            priority: medOrderForm.priority,
                            itemCode: medOrderForm.itemCode,
                            itemName: medOrderForm.itemName,
                            codingSystem: medOrderForm.codingSystem,
                            clinicalIndication: medOrderForm.clinicalIndication,
                            orderedAt: new Date().toISOString(),
                            orderingPractitioner: 'Dr. Otieno Odhiambo (MOH/A8794)',
                            dosage: medOrderForm.dosage,
                            route: medOrderForm.route,
                            frequency: medOrderForm.frequency,
                            duration: `${medOrderForm.duration} days`,
                            quantity: parseInt(medOrderForm.quantity) || 1,
                          };

                          const updatedList = encountersList.map((enc) => {
                            if (enc.id === selectedEncounter.id) {
                              return { ...enc, orders: [newOrder, ...(enc.orders || [])] };
                            }
                            return enc;
                          });

                          setEncountersList(updatedList);
                          setActionNotice(`Prescription order ${newOrder.orderNumber} placed. Status: ACTIVE.`);
                          setTimeout(() => setActionNotice(null), 4000);
                        }}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <Pill className="w-4 h-4" />
                        Place Medication Order
                      </button>
                    </div>
                  </div>

                  {/* Laboratory Service Request (LOINC v2.76) */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                    <div className="border-b border-slate-800 pb-3">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <FlaskConical className="w-5 h-5 text-blue-400" />
                        Diagnostic & Lab Request (LOINC v2.76)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Authentic Laboratory Observations • Specimen Protocols & Acuity Triage
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label htmlFor="service-order-item" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Standard Test Preset (LOINC v2.76 Kenya Diagnostic Standard):
                        </label>
                        <select
                          id="service-order-item"
                          aria-label="Standard Test Preset (LOINC v2.76 Kenya Diagnostic Standard)"
                          value={serviceOrderForm.itemCode}
                          onChange={(e) => {
                            const map: Record<string, { name: string; specimen: string }> = {
                              '2160-0': { name: 'Creatinine in serum/plasma', specimen: 'SERUM' },
                              '57021-8': { name: 'Malaria rapid diagnostic test (Ag blood)', specimen: 'WHOLE_BLOOD' },
                              '718-7': { name: 'Hemoglobin in blood', specimen: 'WHOLE_BLOOD' },
                              '2345-7': { name: 'Glucose in serum/plasma', specimen: 'SERUM' },
                              '2093-3': { name: 'Cholesterol in serum/plasma', specimen: 'SERUM' },
                              '24357-6': { name: 'Urinalysis macro (automated)', specimen: 'URINE' },
                            };
                            const match = map[e.target.value] || { name: e.target.value, specimen: 'SERUM' };
                            setServiceOrderForm({
                              ...serviceOrderForm,
                              itemCode: e.target.value,
                              itemName: match.name,
                              specimenType: match.specimen,
                            });
                          }}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                        >
                          <option value="2160-0">2160-0 • Creatinine in serum/plasma</option>
                          <option value="57021-8">57021-8 • Malaria rapid diagnostic test (Ag blood)</option>
                          <option value="718-7">718-7 • Hemoglobin in blood</option>
                          <option value="2345-7">2345-7 • Glucose in serum/plasma</option>
                          <option value="2093-3">2093-3 • Cholesterol in serum/plasma</option>
                          <option value="24357-6">24357-6 • Urinalysis macro test</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="service-order-priority" className="block text-xs font-medium text-slate-300 mb-1">Priority / Acuity *</label>
                          <select
                            id="service-order-priority"
                            aria-label="Priority / Acuity"
                            value={serviceOrderForm.priority}
                            onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, priority: e.target.value as any })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                          >
                            <option value="ROUTINE">ROUTINE</option>
                            <option value="URGENT">URGENT</option>
                            <option value="STAT">STAT (Immediate Emergency)</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="service-order-specimen" className="block text-xs font-medium text-slate-300 mb-1">Specimen Protocol *</label>
                          <select
                            id="service-order-specimen"
                            aria-label="Specimen Protocol"
                            value={serviceOrderForm.specimenType}
                            onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, specimenType: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                          >
                            <option value="SERUM">Serum (Gold/Red Top)</option>
                            <option value="WHOLE_BLOOD">Whole Blood (EDTA Purple Top)</option>
                            <option value="PLASMA">Plasma (Heparin Green Top)</option>
                            <option value="URINE">Mid-stream Urine</option>
                            <option value="STOOL">Stool Sample</option>
                            <option value="SPUTUM">Sputum</option>
                            <option value="SWAB">Nasopharyngeal Swab</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Clinical Indication / Reason *</label>
                        <input
                          type="text"
                          value={serviceOrderForm.clinicalIndication}
                          onChange={(e) => setServiceOrderForm({ ...serviceOrderForm, clinicalIndication: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-blue-500"
                          placeholder="e.g. Assessment of baseline renal function prior to ACEi"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const existingActive = (selectedEncounter.orders || []).find(
                            (o) => o.itemCode === serviceOrderForm.itemCode && (o.status === 'ACTIVE' || o.status === 'AUTHORIZED')
                          );
                          if (existingActive) {
                            setDuplicateWarningOrder({
                              type: serviceOrderForm.orderType,
                              itemCode: serviceOrderForm.itemCode,
                              itemName: serviceOrderForm.itemName,
                              existingOrderNumber: existingActive.orderNumber,
                              orderPayload: { ...serviceOrderForm },
                            });
                            return;
                          }

                          const orderNum = `ORD-202610-${Math.floor(1000 + Math.random() * 9000)}`;
                          const newOrder: ClinicalOrderDisplay = {
                            id: `ord-${Date.now()}`,
                            orderNumber: orderNum,
                            orderType: serviceOrderForm.orderType,
                            status: 'ACTIVE',
                            priority: serviceOrderForm.priority,
                            itemCode: serviceOrderForm.itemCode,
                            itemName: serviceOrderForm.itemName,
                            codingSystem: serviceOrderForm.codingSystem,
                            clinicalIndication: serviceOrderForm.clinicalIndication,
                            orderedAt: new Date().toISOString(),
                            orderingPractitioner: 'Dr. Otieno Odhiambo (MOH/A8794)',
                            specimenType: serviceOrderForm.specimenType,
                          };

                          const updatedList = encountersList.map((enc) => {
                            if (enc.id === selectedEncounter.id) {
                              return { ...enc, orders: [newOrder, ...(enc.orders || [])] };
                            }
                            return enc;
                          });

                          setEncountersList(updatedList);
                          setActionNotice(`Laboratory order ${newOrder.orderNumber} placed. Status: ACTIVE.`);
                          setTimeout(() => setActionNotice(null), 4000);
                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
                      >
                        <FlaskConical className="w-4 h-4" />
                        Place Diagnostic Request
                      </button>
                    </div>
                  </div>
                </div>

                {/* SECTION 3: ORDERS MANAGEMENT TABLE */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-emerald-400" />
                        Clinical Orders Tracking & Lifecycle
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Authorizations • Amendments • Structured Cancellations • Kenya Core FHIR R4 Integration
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      Orders Count: { (selectedEncounter.orders || []).length }
                    </span>
                  </div>

                  {(!selectedEncounter.orders || selectedEncounter.orders.length === 0) ? (
                    <div className="p-8 bg-slate-950/40 border border-slate-800 rounded-xl text-xs text-slate-500 text-center">
                      No clinical orders have been placed for this patient encounter yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedEncounter.orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
                                {ord.orderNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  ord.orderType === 'MEDICATION_REQUEST'
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                }`}
                              >
                                {ord.orderType}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  ord.status === 'AUTHORIZED'
                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                    : ord.status === 'CANCELLED'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 line-through'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}
                              >
                                {ord.status}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                  ord.priority === 'STAT'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                    : ord.priority === 'URGENT'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}
                              >
                                {ord.priority}
                              </span>
                            </div>

                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-400">[{ord.itemCode}]</span>
                              <span>{ord.itemName}</span>
                            </div>

                            {ord.orderType === 'MEDICATION_REQUEST' ? (
                              <div className="text-xs text-slate-400">
                                Posology: <strong className="text-slate-200">{ord.dosage} via {ord.route} ({ord.frequency})</strong> for{' '}
                                <strong className="text-slate-200">{ord.duration}</strong> • Total Qty:{' '}
                                <strong className="text-slate-200">{ord.quantity}</strong>
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400">
                                Diagnostic Protocol: Specimen <strong className="text-slate-200">{ord.specimenType}</strong> • Indication:{' '}
                                <strong className="text-slate-200">{ord.clinicalIndication || 'Standard workup'}</strong>
                              </div>
                            )}

                            {ord.cancellationReason && (
                              <div className="text-xs text-rose-400 bg-rose-500/10 px-3 py-1 rounded border border-rose-500/20">
                                Cancellation Justification: &quot;{ord.cancellationReason}&quot;
                              </div>
                            )}

                            <div className="text-[11px] text-slate-500 flex items-center gap-3">
                              <span>Practitioner: {ord.orderingPractitioner}</span>
                              <span>•</span>
                              <span>Ordered: {new Date(ord.orderedAt).toLocaleTimeString()}</span>
                            </div>
                          </div>

                          {/* Order Actions */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {ord.status === 'ACTIVE' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updatedList = encountersList.map((enc) => {
                                      if (enc.id === selectedEncounter.id) {
                                        const updatedOrders = (enc.orders || []).map((o) => {
                                          if (o.id === ord.id) {
                                            return { ...o, status: 'AUTHORIZED' as const };
                                          }
                                          return o;
                                        });
                                        return { ...enc, orders: updatedOrders };
                                      }
                                      return enc;
                                    });
                                    setEncountersList(updatedList);
                                    setActionNotice(`Order ${ord.orderNumber} authorized and countersigned.`);
                                    setTimeout(() => setActionNotice(null), 4000);
                                  }}
                                  className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                                  title="Clinical verification & authorization"
                                >
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  Authorize
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancellingOrderId(ord.id);
                                    setCancelReason('');
                                  }}
                                  className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                                  title="Cancel order with justification"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  Cancel
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                let fhir: any;
                                if (ord.orderType === 'MEDICATION_REQUEST') {
                                  fhir = {
                                    resourceType: 'MedicationRequest',
                                    id: ord.id,
                                    meta: { profile: ['http://health.go.ke/fhir/StructureDefinition/kenya-medication-request'] },
                                    identifier: [{ system: 'http://health.go.ke/order-id', value: ord.orderNumber }],
                                    status: ord.status.toLowerCase(),
                                    intent: 'order',
                                    priority: ord.priority.toLowerCase(),
                                    medicationCodeableConcept: {
                                      coding: [{ system: 'http://health.go.ke/terminology/keml-2023', code: ord.itemCode, display: ord.itemName }],
                                      text: ord.itemName,
                                    },
                                    subject: { reference: `Patient/${selectedEncounter.patientId}`, display: selectedEncounter.patientName },
                                    encounter: { reference: `Encounter/${selectedEncounter.id}` },
                                    authoredOn: ord.orderedAt,
                                    requester: { display: ord.orderingPractitioner },
                                    dosageInstruction: [{ text: `${ord.dosage || ''} via ${ord.route || ''} ${ord.frequency || ''} for ${ord.duration || ''}` }],
                                    dispenseRequest: { quantity: { value: ord.quantity || 1 } },
                                  };
                                } else {
                                  fhir = {
                                    resourceType: 'ServiceRequest',
                                    id: ord.id,
                                    meta: { profile: ['http://health.go.ke/fhir/StructureDefinition/kenya-service-request'] },
                                    identifier: [{ system: 'http://health.go.ke/order-id', value: ord.orderNumber }],
                                    status: ord.status.toLowerCase(),
                                    intent: 'order',
                                    priority: ord.priority.toLowerCase(),
                                    code: {
                                      coding: [{ system: 'http://loinc.org', code: ord.itemCode, display: ord.itemName }],
                                      text: ord.itemName,
                                    },
                                    subject: { reference: `Patient/${selectedEncounter.patientId}`, display: selectedEncounter.patientName },
                                    encounter: { reference: `Encounter/${selectedEncounter.id}` },
                                    authoredOn: ord.orderedAt,
                                    requester: { display: ord.orderingPractitioner },
                                    specimen: ord.specimenType ? [{ display: ord.specimenType }] : undefined,
                                  };
                                }
                                setFhirExportPayload({
                                  title: `FHIR R4 ${fhir.resourceType} • ${ord.orderNumber}`,
                                  json: JSON.stringify(fhir, null, 2),
                                });
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                            >
                              <FileCode2 className="w-3.5 h-3.5 text-blue-400" />
                              FHIR R4
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* CPOE Order Cancellation Justification Modal */}
      {cancellingOrderId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-rose-500/20 text-rose-400 rounded-lg">
                <XCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Cancel Clinical Order</h3>
                <p className="text-xs text-slate-400">Clinical Safety Audit Requirement</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Kenya medical records regulations mandate that cancelling an active clinical order requires an audit-trailed clinical rationale of at least 10 characters.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clinical Cancellation Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Patient contraindication observed; regimen replaced with alternative..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-rose-500"
              />
              <span className="text-[10px] text-slate-500">Character count: {cancelReason.trim().length}/10</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancellingOrderId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cancelReason.trim().length < 10) {
                    alert('Statutory requirement: Cancellation justification must be at least 10 characters long.');
                    return;
                  }
                  const updatedList = encountersList.map((enc) => {
                    if (enc.id === selectedEncounter.id) {
                      const updatedOrders = (enc.orders || []).map((o) => {
                        if (o.id === cancellingOrderId) {
                          return { ...o, status: 'CANCELLED' as const, cancellationReason: cancelReason };
                        }
                        return o;
                      });
                      return { ...enc, orders: updatedOrders };
                    }
                    return enc;
                  });
                  setEncountersList(updatedList);
                  setCancellingOrderId(null);
                  setCancelReason('');
                  setActionNotice('Order cancelled with audit-trailed clinical rationale.');
                  setTimeout(() => setActionNotice(null), 4000);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Order Warning & Clinician Override Modal */}
      {duplicateWarningOrder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-600 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Accidental Duplicate Order Alert</h3>
                <p className="text-xs text-amber-400">Clinical Safeguard Warning</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-amber-950/40 p-3 rounded-lg border border-amber-600/30 space-y-1">
              <div>An active order for <strong className="text-white">{duplicateWarningOrder.itemName}</strong> ({duplicateWarningOrder.itemCode}) already exists on this patient encounter:</div>
              <div className="font-mono text-amber-300 font-bold">Existing Order: {duplicateWarningOrder.existingOrderNumber}</div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              If this second order is clinically intended (e.g. intentional dose escalation or repeat STAT specimen), you must enter a justification of at least 10 characters to override the duplicate guard.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clinician Override Justification *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Clinical justification: Intentional dose titration due to persistent uncontrolled BP..."
                value={duplicateOverrideReason}
                onChange={(e) => setDuplicateOverrideReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500">Character count: {duplicateOverrideReason.trim().length}/10</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDuplicateWarningOrder(null);
                  setDuplicateOverrideReason('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Abort Duplicate
              </button>
              <button
                type="button"
                onClick={() => {
                  if (duplicateOverrideReason.trim().length < 10) {
                    alert('Override justification must be at least 10 characters long.');
                    return;
                  }
                  const payload = duplicateWarningOrder.orderPayload;
                  const orderNum = `ORD-202610-${Math.floor(1000 + Math.random() * 9000)}`;
                  const newOrder: ClinicalOrderDisplay = {
                    id: `ord-${Date.now()}`,
                    orderNumber: orderNum,
                    orderType: duplicateWarningOrder.type,
                    status: 'ACTIVE',
                    priority: payload.priority || 'ROUTINE',
                    itemCode: duplicateWarningOrder.itemCode,
                    itemName: duplicateWarningOrder.itemName,
                    codingSystem: payload.codingSystem,
                    clinicalIndication: `[OVERRIDE: ${duplicateOverrideReason}] ${payload.clinicalIndication || ''}`,
                    orderedAt: new Date().toISOString(),
                    orderingPractitioner: 'Dr. Otieno Odhiambo (MOH/A8794)',
                    dosage: payload.dosage,
                    route: payload.route,
                    frequency: payload.frequency,
                    duration: payload.duration ? `${payload.duration} days` : undefined,
                    quantity: payload.quantity ? parseInt(payload.quantity) : 1,
                    specimenType: payload.specimenType,
                  };

                  const updatedList = encountersList.map((enc) => {
                    if (enc.id === selectedEncounter.id) {
                      return { ...enc, orders: [newOrder, ...(enc.orders || [])] };
                    }
                    return enc;
                  });

                  setEncountersList(updatedList);
                  setDuplicateWarningOrder(null);
                  setDuplicateOverrideReason('');
                  setActionNotice(`Duplicate override accepted. Order ${newOrder.orderNumber} placed.`);
                  setTimeout(() => setActionNotice(null), 4000);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Override & Place Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FHIR R4 JSON Export Modal */}
      {fhirExportPayload && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
                  <FileCode2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">{fhirExportPayload.title}</h3>
                  <p className="text-xs text-slate-400">Kenya MOH FHIR R4 Interoperability Payload</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFhirExportPayload(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 leading-relaxed">
              {fhirExportPayload.json}
            </pre>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-500">
                Conforms to Kenya Core FHIR IG Profile specification
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(fhirExportPayload.json);
                  setActionNotice('FHIR R4 resource copied to clipboard.');
                  setTimeout(() => setActionNotice(null), 3000);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Copy FHIR JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Encounter Justification Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 max-w-md w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <Unlock className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Reopen Encounter</h3>
                <p className="text-xs text-slate-400">{selectedEncounter.encounterNumber} • {selectedEncounter.patientName}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Clinical safety control: Reopening a finalized encounter requires an audit-trailed justification of at least 10 characters.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Clinical or Administrative Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Patient returned within 1 hour experiencing acute drug nausea and vomiting..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500">Character count: {reopenReason.trim().length}/10</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowReopenModal(false);
                  setReopenReason('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReopenEncounter}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                Confirm Reopening
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
