'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FlaskConical,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Search,
  FileText,
  Shield,
  CheckCheck,
  QrCode,
  Layers,
  BarChart3,
  Package,
  FileCheck2,
  BadgeAlert,
  Printer,
  FileCode2,
} from 'lucide-react';

// ==========================================
// TYPES & ENUMS (Aligned with @afyapoa/domain-core)
// ==========================================

export type LabDepartment =
  | 'HEMATOLOGY'
  | 'CLINICAL_CHEMISTRY'
  | 'PARASITOLOGY'
  | 'MICROBIOLOGY'
  | 'URINALYSIS'
  | 'SEROLOGY'
  | 'HISTOPATHOLOGY'
  | 'BLOOD_TRANSFUSION';

export type SpecimenStatus =
  | 'PENDING_COLLECTION'
  | 'COLLECTED'
  | 'IN_TRANSIT'
  | 'RECEIVED_IN_LAB'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED';

export type LabAbnormalFlag =
  | 'NORMAL'
  | 'ABNORMAL'
  | 'LOW'
  | 'HIGH'
  | 'CRITICAL_LOW'
  | 'CRITICAL_HIGH';

export type LabResultStatus =
  | 'PRELIMINARY'
  | 'VERIFIED'
  | 'FINAL'
  | 'CORRECTED'
  | 'AMENDED';

export type DiagnosticReportStatus =
  | 'REGISTERED'
  | 'PARTIAL'
  | 'PRELIMINARY'
  | 'FINAL'
  | 'AMENDED'
  | 'CORRECTED'
  | 'CANCELLED';

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patientName: string;
  patientAgeGender: string;
  mrn: string;
  orderingDoctor: string;
  department: LabDepartment;
  testCode: string;
  testName: string;
  codingSystem: string;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  clinicalIndication: string;
  orderedAt: string;
  status: 'PENDING' | 'COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  suggestedContainer: string;
}

export interface SpecimenItem {
  id: string;
  accessionNumber: string;
  barcode: string;
  orderId: string;
  patientName: string;
  patientId: string;
  testName: string;
  specimenType: string;
  containerType: string;
  volumeMl: number;
  collectionSite: string;
  collectorName: string;
  collectedAt: string;
  receivedAt?: string;
  status: SpecimenStatus;
  rejectionReason?: string;
  rejectionNotes?: string;
}

export interface TestResultItem {
  id: string;
  specimenId: string;
  accessionNumber: string;
  patientName: string;
  testCode: string;
  testName: string;
  department: LabDepartment;
  numericValue?: number;
  textValue?: string;
  unit?: string;
  referenceRangeText: string;
  referenceSource: string;
  referenceSourceVersion: string;
  abnormalFlag: LabAbnormalFlag;
  status: LabResultStatus;
  technologistName: string;
  enteredAt: string;
  verifierName?: string;
  verifiedAt?: string;
  correctedFromId?: string;
  correctionReason?: string;
  notes?: string;
}

export interface DiagnosticReportItem {
  id: string;
  reportNumber: string;
  orderId: string;
  patientName: string;
  patientMrn: string;
  patientAgeGender: string;
  orderingDoctor: string;
  title: string;
  status: DiagnosticReportStatus;
  conclusion: string;
  recommendations?: string;
  authorName: string;
  authorizedByName?: string;
  authorizedAt?: string;
  amendmentReason?: string;
  results: TestResultItem[];
  createdAt: string;
}

export interface ConsumableItem {
  id: string;
  itemCode: string;
  name: string;
  category: string;
  quantityOnHand: number;
  reorderLevel: number;
  unitOfMeasure: string;
  manufacturer: string;
  lotNumber: string;
  expiryDate: string;
}

export default function LaboratoryPage() {
  // Current active user role toggle for simulation
  const [activeUserRole, setActiveUserRole] = useState<'LAB_TECH' | 'PATHOLOGIST'>('LAB_TECH');
  const [activeTab, setActiveTab] = useState<
    'orders' | 'specimens' | 'worklist' | 'authorization' | 'reports' | 'inventory' | 'metrics'
  >('orders');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [selectedOrderForCollection, setSelectedOrderForCollection] = useState<LabOrder | null>(null);
  const [collectionContainer, setCollectionContainer] = useState('EDTA_TUBE_LAVENDER');
  const [collectionVolume, setCollectionVolume] = useState('4.0');
  const [collectionSite, setCollectionSite] = useState('Left Antecubital Fossa');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedSpecimenForRejection, setSelectedSpecimenForRejection] = useState<SpecimenItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('HEMOLYZED');
  const [rejectionNotes, setRejectionNotes] = useState('Marked 3+ hemolysis visible upon centrifugation');
  const [recollectRequired, setRecollectRequired] = useState(true);

  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedSpecimenForResult, setSelectedSpecimenForResult] = useState<SpecimenItem | null>(null);
  const [resultNumericValue, setResultNumericValue] = useState<string>('6.4');
  const [resultTextValue, setResultTextValue] = useState<string>('');
  const [resultNotes, setResultNotes] = useState<string>('Rerun completed on Sysmex XN-550 to verify critical anemia value');

  const [isAuthorizeModalOpen, setIsAuthorizeModalOpen] = useState(false);
  const [selectedReportForAuth, setSelectedReportForAuth] = useState<DiagnosticReportItem | null>(null);
  const [authSignature, setAuthSignature] = useState('SIG-PATH-OTIENO-2026-NMHG');
  const [authConclusion, setAuthConclusion] = useState(
    'Severe microcytic hypochromic anemia (Hb 6.4 g/dL) secondary to confirmed P. falciparum malaria. Immediate clinical management and transfusion preparedness recommended.',
  );

  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedResultForCorrection, setSelectedResultForCorrection] = useState<TestResultItem | null>(null);
  const [correctionReasonText, setCorrectionReasonText] = useState(
    'Analyzer cuvette recalibration variance adjustment confirmed upon re-run',
  );
  const [correctionNewValue, setCorrectionNewValue] = useState('6.8');

  const [isReportViewModalOpen, setIsReportViewModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<DiagnosticReportItem | null>(null);

  const [isFhirModalOpen, setIsFhirModalOpen] = useState(false);
  const [fhirJsonContent, setFhirJsonContent] = useState<string>('');

  // ==========================================
  // SYNTHETIC MOCK DATA (Kenya Ministry of Health Standards)
  // ==========================================

  const [orders, setOrders] = useState<LabOrder[]>([
    {
      id: 'ord-001',
      orderNumber: 'ORD-202610-00101',
      patientId: 'pat-101',
      patientName: 'Faith Wanjiku Kamau',
      patientAgeGender: '28 Y / Female',
      mrn: 'MRN-2026-8812',
      orderingDoctor: 'Dr. Evans Otieno (Consultant Physician)',
      department: 'HEMATOLOGY',
      testCode: '718-7',
      testName: 'Hemoglobin (Blood)',
      codingSystem: 'LOINC',
      priority: 'STAT',
      clinicalIndication: 'Severe pallor, fatigue, tachycardia, suspected acute malaria complication',
      orderedAt: '2026-10-20 04:30',
      status: 'PENDING',
      suggestedContainer: 'EDTA Vacutainer (Lavender Top)',
    },
    {
      id: 'ord-002',
      orderNumber: 'ORD-202610-00102',
      patientId: 'pat-102',
      patientName: 'Peter Otieno Onyango',
      patientAgeGender: '45 Y / Male',
      mrn: 'MRN-2026-4421',
      orderingDoctor: 'Dr. Evans Otieno',
      department: 'CLINICAL_CHEMISTRY',
      testCode: '2160-0',
      testName: 'Creatinine (Serum/Plasma)',
      codingSystem: 'LOINC',
      priority: 'ROUTINE',
      clinicalIndication: 'Routine hypertension and diabetes renal assessment (eGFR monitoring)',
      orderedAt: '2026-10-20 04:45',
      status: 'PENDING',
      suggestedContainer: 'SST Vacutainer (Gold/Yellow Top)',
    },
    {
      id: 'ord-003',
      orderNumber: 'ORD-202610-00103',
      patientId: 'pat-103',
      patientName: 'Amina Hassan Noor',
      patientAgeGender: '32 Y / Female',
      mrn: 'MRN-2026-9043',
      orderingDoctor: 'Dr. Mary Muthoni',
      department: 'PARASITOLOGY',
      testCode: '57021-8',
      testName: 'Malaria Ag Rapid Diagnostic Test (Pan/Pf)',
      codingSystem: 'LOINC',
      priority: 'STAT',
      clinicalIndication: 'High-grade fever (39.2°C), chills, and rigor for 3 days',
      orderedAt: '2026-10-20 04:55',
      status: 'PENDING',
      suggestedContainer: 'EDTA Whole Blood or Capillary Fingerstick',
    },
  ]);

  const [specimens, setSpecimens] = useState<SpecimenItem[]>([
    {
      id: 'spec-001',
      accessionNumber: 'ACC-202610-00041',
      barcode: 'BC-202610-00041',
      orderId: 'ord-100',
      patientName: 'John Mutua Kilonzo',
      patientId: 'pat-099',
      testName: 'Hemoglobin (Blood)',
      specimenType: 'WHOLE_BLOOD',
      containerType: 'EDTA_TUBE_LAVENDER',
      volumeMl: 4.0,
      collectionSite: 'Left Median Cubital Vein',
      collectorName: 'Kiprop Kiprono (Lab Technologist)',
      collectedAt: '2026-10-20 04:15',
      receivedAt: '2026-10-20 04:25',
      status: 'PROCESSING',
    },
    {
      id: 'spec-002',
      accessionNumber: 'ACC-202610-00042',
      barcode: 'BC-202610-00042',
      orderId: 'ord-101',
      patientName: 'Grace Njeri Mwangi',
      patientId: 'pat-088',
      testName: 'Serum Creatinine',
      specimenType: 'SERUM',
      containerType: 'SST_TUBE_GOLD',
      volumeMl: 5.0,
      collectionSite: 'Right Antecubital Fossa',
      collectorName: 'Nurse Faith (Phlebotomist)',
      collectedAt: '2026-10-20 04:20',
      status: 'COLLECTED',
    },
  ]);

  const [results, setResults] = useState<TestResultItem[]>([
    {
      id: 'res-001',
      specimenId: 'spec-001',
      accessionNumber: 'ACC-202610-00041',
      patientName: 'John Mutua Kilonzo',
      testCode: '718-7',
      testName: 'Hemoglobin (Blood)',
      department: 'HEMATOLOGY',
      numericValue: 6.4,
      unit: 'g/dL',
      referenceRangeText: '13.0 - 18.0 g/dL (Adult Male)',
      referenceSource: 'WHO Guidelines on Hemoglobin Concentrations 2024',
      referenceSourceVersion: 'v3.2.1',
      abnormalFlag: 'CRITICAL_LOW',
      status: 'PRELIMINARY',
      technologistName: 'Kiprop Kiprono',
      enteredAt: '2026-10-20 04:40',
      notes: 'Repeat run performed on Sysmex analyzer to confirm severe anemia',
    },
    {
      id: 'res-002',
      specimenId: 'spec-001',
      accessionNumber: 'ACC-202610-00041',
      patientName: 'John Mutua Kilonzo',
      testCode: '57021-8',
      testName: 'Malaria Ag RDT (Pan/Pf)',
      department: 'PARASITOLOGY',
      textValue: 'Positive (P. falciparum Pf-HRP2)',
      referenceRangeText: 'Negative (Non-Reactive)',
      referenceSource: 'Kenya MOH National Malaria Control Guidelines 2023',
      referenceSourceVersion: 'v2.4',
      abnormalFlag: 'CRITICAL_HIGH',
      status: 'PRELIMINARY',
      technologistName: 'Kiprop Kiprono',
      enteredAt: '2026-10-20 04:42',
      notes: 'Strong positive band visible at Pf test line at 15 minutes',
    },
  ]);

  const [reports, setReports] = useState<DiagnosticReportItem[]>([
    {
      id: 'rep-001',
      reportNumber: 'REP-202610-00012',
      orderId: 'ord-100',
      patientName: 'John Mutua Kilonzo',
      patientMrn: 'MRN-2026-0921',
      patientAgeGender: '34 Y / Male',
      orderingDoctor: 'Dr. Evans Otieno',
      title: 'Complete Hematology & Malaria Parasitology Panel',
      status: 'PRELIMINARY',
      conclusion: 'Severe microcytic anemia with concurrent acute P. falciparum malaria infection.',
      recommendations: 'Stat admission for blood transfusion and parenteral artesunate per Kenya National Guidelines.',
      authorName: 'Kiprop Kiprono (Bench Technologist)',
      createdAt: '2026-10-20 04:45',
      results: results,
    },
  ]);

  const [consumables, setConsumables] = useState<ConsumableItem[]>([
    {
      id: 'con-001',
      itemCode: 'VAC-EDTA-LAV',
      name: 'BD Vacutainer K2 EDTA 4.0mL (Lavender)',
      category: 'BLOOD_COLLECTION_TUBES',
      quantityOnHand: 42,
      reorderLevel: 50,
      unitOfMeasure: 'tubes',
      manufacturer: 'Becton Dickinson',
      lotNumber: 'LOT-2026-A481',
      expiryDate: '2027-06-30',
    },
    {
      id: 'con-002',
      itemCode: 'VAC-SST-GOLD',
      name: 'BD Vacutainer SST II Advance 5.0mL (Gold)',
      category: 'BLOOD_COLLECTION_TUBES',
      quantityOnHand: 180,
      reorderLevel: 50,
      unitOfMeasure: 'tubes',
      manufacturer: 'Becton Dickinson',
      lotNumber: 'LOT-2026-S110',
      expiryDate: '2027-08-31',
    },
    {
      id: 'con-003',
      itemCode: 'RDT-MAL-CASSETTE',
      name: 'SD Bioline Malaria Ag P.f/Pan Test Cassettes',
      category: 'RAPID_DIAGNOSTIC_CASSETTES',
      quantityOnHand: 22,
      reorderLevel: 25,
      unitOfMeasure: 'tests',
      manufacturer: 'Abbott Diagnostics',
      lotNumber: 'LOT-2026-M909',
      expiryDate: '2026-12-31',
    },
    {
      id: 'con-004',
      itemCode: 'NEEDLE-SAFETY-21G',
      name: 'Safety-Lok Blood Collection Set 21G',
      category: 'BLOOD_COLLECTION_NEEDLES',
      quantityOnHand: 310,
      reorderLevel: 100,
      unitOfMeasure: 'pieces',
      manufacturer: 'Becton Dickinson',
      lotNumber: 'LOT-2026-N221',
      expiryDate: '2028-01-31',
    },
  ]);

  // Operational metrics
  const metrics = {
    pendingOrders: orders.filter((o) => o.status === 'PENDING').length,
    activeSpecimens: specimens.filter((s) => s.status !== 'COMPLETED' && s.status !== 'REJECTED').length,
    criticalAlerts: results.filter((r) => r.abnormalFlag === 'CRITICAL_LOW' || r.abnormalFlag === 'CRITICAL_HIGH').length,
    awaitingAuthorization: reports.filter((r) => r.status === 'PRELIMINARY').length,
    finalizedReports: reports.filter((r) => r.status === 'FINAL' || r.status === 'AMENDED').length,
    averageTotalTat: '48 mins',
    lowStockCount: consumables.filter((c) => c.quantityOnHand <= c.reorderLevel).length,
  };

  // ==========================================
  // WORKFLOW HANDLERS
  // ==========================================

  const handleOpenCollectModal = (order: LabOrder) => {
    setSelectedOrderForCollection(order);
    setIsCollectModalOpen(true);
  };

  const handleExecuteCollection = () => {
    if (!selectedOrderForCollection) return;

    const accessionSuffix = String(Math.floor(10000 + Math.random() * 90000));
    const newAccession = `ACC-202610-${accessionSuffix}`;
    const newBarcode = `BC-202610-${accessionSuffix}`;

    const newSpecimen: SpecimenItem = {
      id: `spec-${Date.now()}`,
      accessionNumber: newAccession,
      barcode: newBarcode,
      orderId: selectedOrderForCollection.id,
      patientName: selectedOrderForCollection.patientName,
      patientId: selectedOrderForCollection.patientId,
      testName: selectedOrderForCollection.testName,
      specimenType: selectedOrderForCollection.department === 'HEMATOLOGY' ? 'WHOLE_BLOOD' : 'SERUM',
      containerType: collectionContainer,
      volumeMl: Number(collectionVolume) || 4.0,
      collectionSite: collectionSite,
      collectorName: activeUserRole === 'LAB_TECH' ? 'Kiprop Kiprono (Lab Tech)' : 'Dr. Evans Otieno',
      collectedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'COLLECTED',
    };

    setSpecimens([newSpecimen, ...specimens]);

    // Update order status
    setOrders(
      orders.map((o) => (o.id === selectedOrderForCollection.id ? { ...o, status: 'COLLECTED' } : o)),
    );

    // Deduct consumable
    setConsumables(
      consumables.map((c) => {
        if (c.itemCode.includes('EDTA') && collectionContainer.includes('EDTA')) {
          return { ...c, quantityOnHand: Math.max(0, c.quantityOnHand - 1) };
        }
        if (c.itemCode.includes('SST') && collectionContainer.includes('SST')) {
          return { ...c, quantityOnHand: Math.max(0, c.quantityOnHand - 1) };
        }
        return c;
      }),
    );

    setIsCollectModalOpen(false);
    setSelectedOrderForCollection(null);
  };

  const handleReceiveSpecimenInLab = (specimenId: string) => {
    setSpecimens(
      specimens.map((s) =>
        s.id === specimenId
          ? {
              ...s,
              status: 'RECEIVED_IN_LAB',
              receivedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
            }
          : s,
      ),
    );
  };

  const handleOpenRejectModal = (specimen: SpecimenItem) => {
    setSelectedSpecimenForRejection(specimen);
    setIsRejectModalOpen(true);
  };

  const handleExecuteRejection = () => {
    if (!selectedSpecimenForRejection) return;

    // Mark current specimen as REJECTED
    setSpecimens(
      specimens.map((s) =>
        s.id === selectedSpecimenForRejection.id
          ? {
              ...s,
              status: 'REJECTED',
              rejectionReason,
              rejectionNotes,
            }
          : s,
      ),
    );

    // If recollection required, spawn new specimen with -R suffix
    if (recollectRequired) {
      const recollectionSpecimen: SpecimenItem = {
        id: `spec-recollect-${Date.now()}`,
        accessionNumber: `${selectedSpecimenForRejection.accessionNumber}-R`,
        barcode: `${selectedSpecimenForRejection.barcode}-R`,
        orderId: selectedSpecimenForRejection.orderId,
        patientName: selectedSpecimenForRejection.patientName,
        patientId: selectedSpecimenForRejection.patientId,
        testName: selectedSpecimenForRejection.testName,
        specimenType: selectedSpecimenForRejection.specimenType,
        containerType: selectedSpecimenForRejection.containerType,
        volumeMl: 0,
        collectionSite: 'Pending draw',
        collectorName: 'Awaiting Phlebotomy',
        collectedAt: '',
        status: 'PENDING_COLLECTION',
      };
      setSpecimens((prev) => [recollectionSpecimen, ...prev]);
    }

    setIsRejectModalOpen(false);
    setSelectedSpecimenForRejection(null);
  };

  const handleOpenResultModal = (specimen: SpecimenItem) => {
    setSelectedSpecimenForResult(specimen);
    setIsResultModalOpen(true);
  };

  const handleExecuteResultEntry = () => {
    if (!selectedSpecimenForResult) return;

    const num = Number(resultNumericValue);
    let abnormalFlag: LabAbnormalFlag = 'NORMAL';

    if (selectedSpecimenForResult.testName.toLowerCase().includes('hemoglobin')) {
      if (num <= 7.0) abnormalFlag = 'CRITICAL_LOW';
      else if (num < 13.0) abnormalFlag = 'LOW';
      else if (num > 18.0) abnormalFlag = 'HIGH';
      else abnormalFlag = 'NORMAL';
    } else if (resultTextValue.toLowerCase().includes('positive') || resultTextValue.toLowerCase().includes('reactive')) {
      abnormalFlag = 'CRITICAL_HIGH';
    }

    const newResult: TestResultItem = {
      id: `res-${Date.now()}`,
      specimenId: selectedSpecimenForResult.id,
      accessionNumber: selectedSpecimenForResult.accessionNumber,
      patientName: selectedSpecimenForResult.patientName,
      testCode: selectedSpecimenForResult.testName.includes('Hemoglobin') ? '718-7' : '2160-0',
      testName: selectedSpecimenForResult.testName,
      department: selectedSpecimenForResult.testName.includes('Hemoglobin') ? 'HEMATOLOGY' : 'CLINICAL_CHEMISTRY',
      numericValue: resultNumericValue ? Number(resultNumericValue) : undefined,
      textValue: resultTextValue || undefined,
      unit: selectedSpecimenForResult.testName.includes('Hemoglobin') ? 'g/dL' : 'µmol/L',
      referenceRangeText: selectedSpecimenForResult.testName.includes('Hemoglobin')
        ? '13.0 - 18.0 g/dL (Adult Male)'
        : '62 - 106 µmol/L (Adult)',
      referenceSource: 'WHO Guidelines on Laboratory Reference Standards 2024',
      referenceSourceVersion: 'v3.2.1',
      abnormalFlag,
      status: 'PRELIMINARY',
      technologistName: 'Kiprop Kiprono (Lab Tech)',
      enteredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      notes: resultNotes,
    };

    setResults([newResult, ...results]);

    // Transition specimen to PROCESSING or COMPLETED
    setSpecimens(
      specimens.map((s) => (s.id === selectedSpecimenForResult.id ? { ...s, status: 'PROCESSING' } : s)),
    );

    setIsResultModalOpen(false);
    setSelectedSpecimenForResult(null);
  };

  const handleOpenAuthorizeModal = (report: DiagnosticReportItem) => {
    setSelectedReportForAuth(report);
    setIsAuthorizeModalOpen(true);
  };

  const handleExecuteAuthorization = () => {
    if (!selectedReportForAuth) return;

    setReports(
      reports.map((r) =>
        r.id === selectedReportForAuth.id
          ? {
              ...r,
              status: 'FINAL',
              authorizedByName: 'Dr. Evans Otieno (Consultant Pathologist)',
              authorizedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
              conclusion: authConclusion,
            }
          : r,
      ),
    );

    // Update associated results to FINAL
    setResults(
      results.map((res) => ({
        ...res,
        status: 'FINAL',
        verifierName: 'Dr. Evans Otieno',
        verifiedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      })),
    );

    setIsAuthorizeModalOpen(false);
    setSelectedReportForAuth(null);
  };

  const handleOpenCorrectionModal = (resItem: TestResultItem) => {
    setSelectedResultForCorrection(resItem);
    setIsCorrectionModalOpen(true);
  };

  const handleExecuteCorrection = () => {
    if (!selectedResultForCorrection) return;

    if (!correctionReasonText || correctionReasonText.trim().length < 10) {
      alert('Correction reason must be at least 10 characters long to ensure clinical audit integrity.');
      return;
    }

    // Mark original as CORRECTED
    const updatedOriginal = {
      ...selectedResultForCorrection,
      status: 'CORRECTED' as LabResultStatus,
      correctionReason: correctionReasonText,
    };

    // Insert new revised record
    const num = Number(correctionNewValue);
    let abnormalFlag: LabAbnormalFlag = 'NORMAL';
    if (num <= 7.0) abnormalFlag = 'CRITICAL_LOW';
    else if (num < 13.0) abnormalFlag = 'LOW';
    else abnormalFlag = 'NORMAL';

    const revisedResult: TestResultItem = {
      id: `res-revised-${Date.now()}`,
      specimenId: selectedResultForCorrection.specimenId,
      accessionNumber: selectedResultForCorrection.accessionNumber,
      patientName: selectedResultForCorrection.patientName,
      testCode: selectedResultForCorrection.testCode,
      testName: selectedResultForCorrection.testName,
      department: selectedResultForCorrection.department,
      numericValue: num,
      unit: selectedResultForCorrection.unit,
      referenceRangeText: selectedResultForCorrection.referenceRangeText,
      referenceSource: selectedResultForCorrection.referenceSource,
      referenceSourceVersion: selectedResultForCorrection.referenceSourceVersion,
      abnormalFlag,
      status: 'PRELIMINARY',
      technologistName: 'Kiprop Kiprono (Lab Tech)',
      enteredAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      correctedFromId: selectedResultForCorrection.id,
      correctionReason: correctionReasonText,
      notes: `Corrected result superseded original ${selectedResultForCorrection.id}`,
    };

    setResults(
      results.map((r) => (r.id === selectedResultForCorrection.id ? updatedOriginal : r)).concat(revisedResult),
    );

    setIsCorrectionModalOpen(false);
    setSelectedResultForCorrection(null);
  };

  const handleOpenFhirModal = (type: 'SPECIMEN' | 'REPORT' | 'OBSERVATION', item: any) => {
    let fhirPayload: any = {};

    if (type === 'SPECIMEN') {
      fhirPayload = {
        resourceType: 'Specimen',
        id: item.id,
        meta: { profile: ['http://fhir.afyapoa.co.ke/StructureDefinition/KenyaCoreSpecimen'] },
        identifier: [
          { system: 'http://afyapoa.co.ke/identifier/accession', value: item.accessionNumber },
          { system: 'http://afyapoa.co.ke/identifier/barcode', value: item.barcode },
        ],
        status: item.status.toLowerCase(),
        type: {
          coding: [{ system: 'http://snomed.info/sct', code: '119297000', display: item.specimenType }],
        },
        subject: { reference: `Patient/${item.patientId}`, display: item.patientName },
        collection: {
          collectedDateTime: item.collectedAt,
          collector: { display: item.collectorName },
          quantity: { value: item.volumeMl, unit: 'mL' },
          bodySite: { text: item.collectionSite },
        },
      };
    } else if (type === 'OBSERVATION') {
      fhirPayload = {
        resourceType: 'Observation',
        id: item.id,
        meta: { profile: ['http://fhir.afyapoa.co.ke/StructureDefinition/KenyaCoreObservation'] },
        status: item.status.toLowerCase(),
        category: [
          {
            coding: [
              { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' },
            ],
          },
        ],
        code: {
          coding: [{ system: 'http://loinc.org', code: item.testCode, display: item.testName }],
        },
        subject: { display: item.patientName },
        specimen: { reference: `Specimen/${item.specimenId}` },
        valueQuantity: item.numericValue !== undefined ? { value: item.numericValue, unit: item.unit } : undefined,
        valueString: item.textValue || undefined,
        interpretation: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: item.abnormalFlag === 'CRITICAL_LOW' ? 'LL' : item.abnormalFlag === 'CRITICAL_HIGH' ? 'HH' : 'N',
                display: item.abnormalFlag,
              },
            ],
          },
        ],
        referenceRange: [
          {
            text: `${item.referenceRangeText} [Source: ${item.referenceSource} v${item.referenceSourceVersion}]`,
          },
        ],
      };
    } else {
      fhirPayload = {
        resourceType: 'DiagnosticReport',
        id: item.id,
        meta: { profile: ['http://fhir.afyapoa.co.ke/StructureDefinition/KenyaCoreDiagnosticReport'] },
        identifier: [{ system: 'http://afyapoa.co.ke/identifier/diagnostic-report', value: item.reportNumber }],
        status: item.status.toLowerCase(),
        category: [
          { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0074', code: 'LAB', display: 'Laboratory' }] },
        ],
        code: { text: item.title },
        subject: { display: item.patientName },
        conclusion: item.conclusion,
      };
    }

    setFhirJsonContent(JSON.stringify(fhirPayload, null, 2));
    setIsFhirModalOpen(true);
  };

  // Helper for abnormal flag pill styling
  const renderAbnormalBadge = (flag: LabAbnormalFlag) => {
    switch (flag) {
      case 'CRITICAL_LOW':
      case 'CRITICAL_HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse">
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
            {flag.replace('_', ' ')}
          </span>
        );
      case 'LOW':
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            {flag}
          </span>
        );
      case 'ABNORMAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
            {flag}
          </span>
        );
      case 'NORMAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Back to Platform Overview"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-white text-lg tracking-tight">COMKEY AFYA POA</h1>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                  LIS Module • Milestone 7
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Laboratory Information System & Diagnostic Services • ISO 15189 / KMLTTB Compliant
              </p>
            </div>
          </div>
        </div>

        {/* User Context & Role Switcher */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-lg text-xs">
            <span className="text-slate-400">Active Facility:</span>
            <span className="font-medium text-white">Nairobi Metropolitan Referral Hospital (L5)</span>
          </div>

          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs font-medium">
            <button
              onClick={() => setActiveUserRole('LAB_TECH')}
              className={`px-3 py-1 rounded-md transition ${
                activeUserRole === 'LAB_TECH'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lab Tech View
            </button>
            <button
              onClick={() => setActiveUserRole('PATHOLOGIST')}
              className={`px-3 py-1 rounded-md transition ${
                activeUserRole === 'PATHOLOGIST'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pathologist / Clinician View
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Operational Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Pending Orders</span>
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-white">{metrics.pendingOrders}</div>
            <p className="text-[10px] text-slate-400">Awaiting phlebotomy</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Active Specimens</span>
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold text-white">{metrics.activeSpecimens}</div>
            <p className="text-[10px] text-slate-400">In bench processing</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Critical Flags</span>
              <BadgeAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400">{metrics.criticalAlerts}</div>
            <p className="text-[10px] text-rose-400/80">Immediate alert trigger</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Awaiting Review</span>
              <FileCheck2 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">{metrics.awaitingAuthorization}</div>
            <p className="text-[10px] text-slate-400">Pathologist sign-off</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Finalized Reports</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">{metrics.finalizedReports}</div>
            <p className="text-[10px] text-slate-400">Delivered to clinicians</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Average TAT</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white">{metrics.averageTotalTat}</div>
            <p className="text-[10px] text-slate-400">Target &lt; 60 mins</p>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Low Consumables</span>
              <Package className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">{metrics.lowStockCount}</div>
            <p className="text-[10px] text-amber-400/80">Under reorder level</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            Incoming Orders & Phlebotomy ({orders.filter((o) => o.status === 'PENDING').length})
          </button>

          <button
            onClick={() => setActiveTab('specimens')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'specimens'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Accession & Specimen Tracking ({specimens.length})
          </button>

          <button
            onClick={() => setActiveTab('worklist')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'worklist'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            Bench Worklist & Results ({results.length})
          </button>

          <button
            onClick={() => setActiveTab('authorization')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'authorization'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Pathologist Review & Sign-Off ({reports.filter((r) => r.status === 'PRELIMINARY').length})
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Diagnostic Reports & Delivery
          </button>

          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'inventory'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Package className="w-4 h-4" />
            Consumables Inventory
          </button>

          <button
            onClick={() => setActiveTab('metrics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'metrics'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            TAT & Performance Metrics
          </button>
        </div>

        {/* ========================================== */}
        {/* TAB 1: INCOMING ORDERS & PHLEBOTOMY QUEUE  */}
        {/* ========================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Incoming Laboratory Orders & Phlebotomy Queue</h2>
                <p className="text-xs text-slate-400">
                  Clinical requests from OPD, Triage, and Wards awaiting specimen collection and accessioning.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search patient, MRN, order..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Patient / MRN</th>
                    <th className="py-3 px-4">Test Request</th>
                    <th className="py-3 px-4">Clinical Indication</th>
                    <th className="py-3 px-4">Ordering Doctor</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-emerald-400 font-medium">{order.orderNumber}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{order.patientName}</div>
                        <div className="text-[11px] text-slate-400">
                          {order.mrn} • {order.patientAgeGender}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{order.testName}</div>
                        <div className="text-[11px] text-slate-400">
                          LOINC: {order.testCode} • {order.department}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-xs text-slate-300 truncate" title={order.clinicalIndication}>
                        {order.clinicalIndication}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{order.orderingDoctor}</td>
                      <td className="py-3 px-4">
                        {order.priority === 'STAT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                            <AlertOctagon className="w-3 h-3 text-rose-400" />
                            STAT
                          </span>
                        ) : order.priority === 'URGENT' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            URGENT
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                            ROUTINE
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {order.status === 'PENDING' ? (
                          <button
                            onClick={() => handleOpenCollectModal(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                          >
                            <FlaskConical className="w-3.5 h-3.5" />
                            Collect Specimen
                          </button>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Collected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 2: ACCESSION & SPECIMEN TRACKING       */}
        {/* ========================================== */}
        {activeTab === 'specimens' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Specimen Accession & Tracking Workbench</h2>
                <p className="text-xs text-slate-400">
                  Track specimen barcode lifecycle, laboratory bench receipt, and pre-analytical rejection handling.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Accession / Barcode</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Specimen Details</th>
                    <th className="py-3 px-4">Container & Volume</th>
                    <th className="py-3 px-4">Collected At & By</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {specimens.map((specimen) => (
                    <tr key={specimen.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-mono text-emerald-400 font-bold">{specimen.accessionNumber}</div>
                        <div className="font-mono text-[11px] text-slate-400 flex items-center gap-1">
                          <QrCode className="w-3 h-3 text-slate-500" />
                          {specimen.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{specimen.patientName}</td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200">{specimen.testName}</div>
                        <div className="text-[11px] text-slate-400">{specimen.specimenType}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300">{specimen.containerType.replace(/_/g, ' ')}</div>
                        <div className="text-[11px] text-slate-400">{specimen.volumeMl} mL</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{specimen.collectedAt || 'Pending'}</div>
                        <div className="text-[11px] text-slate-400">{specimen.collectorName}</div>
                      </td>
                      <td className="py-3 px-4">
                        {specimen.status === 'COLLECTED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                            COLLECTED
                          </span>
                        ) : specimen.status === 'RECEIVED_IN_LAB' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            RECEIVED IN LAB
                          </span>
                        ) : specimen.status === 'PROCESSING' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            PROCESSING
                          </span>
                        ) : specimen.status === 'COMPLETED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            COMPLETED
                          </span>
                        ) : specimen.status === 'REJECTED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30" title={specimen.rejectionNotes}>
                            REJECTED: {specimen.rejectionReason}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                            {specimen.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {specimen.status === 'COLLECTED' && (
                          <button
                            onClick={() => handleReceiveSpecimenInLab(specimen.id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition"
                          >
                            Receive in Lab
                          </button>
                        )}
                        {specimen.status !== 'REJECTED' && specimen.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleOpenRejectModal(specimen)}
                            className="px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60 rounded text-xs font-medium transition"
                          >
                            Reject
                          </button>
                        )}
                        {specimen.status === 'RECEIVED_IN_LAB' && (
                          <button
                            onClick={() => handleOpenResultModal(specimen)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
                          >
                            Enter Result
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenFhirModal('SPECIMEN', specimen)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                          title="View KenyaCoreSpecimen FHIR JSON"
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: BENCH WORKLIST & RESULTS ENTRY      */}
        {/* ========================================== */}
        {activeTab === 'worklist' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Departmental Bench Worklist & Results Entry</h2>
                <p className="text-xs text-slate-400">
                  Enter and calibrate analytical results with real-time automated abnormal and critical threshold evaluation.
                </p>
              </div>

              {/* Department Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'HEMATOLOGY', 'CLINICAL_CHEMISTRY', 'PARASITOLOGY', 'URINALYSIS'].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setSelectedDepartment(dept)}
                    className={`px-2.5 py-1 rounded transition text-[11px] font-medium ${
                      selectedDepartment === dept
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {dept.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Accession</th>
                    <th className="py-3 px-4">Patient</th>
                    <th className="py-3 px-4">Test Requested</th>
                    <th className="py-3 px-4">Observed Value</th>
                    <th className="py-3 px-4">Abnormal Indicator</th>
                    <th className="py-3 px-4">Clinical Reference Range</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {results
                    .filter((r) => selectedDepartment === 'ALL' || r.department === selectedDepartment)
                    .map((resItem) => (
                      <tr key={resItem.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-emerald-400 font-semibold">
                          {resItem.accessionNumber}
                        </td>
                        <td className="py-3 px-4 font-medium text-white">{resItem.patientName}</td>
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{resItem.testName}</div>
                          <div className="text-[11px] text-slate-400">
                            LOINC {resItem.testCode} • {resItem.department}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-base font-bold text-white">
                            {resItem.numericValue !== undefined ? `${resItem.numericValue} ${resItem.unit}` : resItem.textValue}
                          </div>
                          {resItem.notes && (
                            <div className="text-[10px] text-slate-400 max-w-xs truncate" title={resItem.notes}>
                              {resItem.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">{renderAbnormalBadge(resItem.abnormalFlag)}</td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-slate-200">{resItem.referenceRangeText}</div>
                          <div className="text-[10px] text-slate-400 truncate" title={`${resItem.referenceSource} (${resItem.referenceSourceVersion})`}>
                            Source: {resItem.referenceSource}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              resItem.status === 'CORRECTED'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : resItem.status === 'FINAL'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {resItem.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            onClick={() => handleOpenCorrectionModal(resItem)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs transition"
                          >
                            Correct / Amend
                          </button>
                          <button
                            onClick={() => handleOpenFhirModal('OBSERVATION', resItem)}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                            title="Export KenyaCoreObservation FHIR"
                          >
                            <FileCode2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 4: TWO-TIER REVIEW & AUTHORIZATION     */}
        {/* ========================================== */}
        {activeTab === 'authorization' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Pathologist Review & Two-Tier Authorization</h2>
                <p className="text-xs text-slate-400">
                  Strict ISO 15189 governance: Technologists enter results; only authorized Pathologists and Clinicians digitally sign final reports.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((report) => (
                <div key={report.id} className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <span className="font-mono text-emerald-400 font-bold">{report.reportNumber}</span>
                      <h3 className="text-sm font-semibold text-white">{report.title}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        report.status === 'FINAL'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : report.status === 'AMENDED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-400">
                      <span>Patient:</span>
                      <span className="font-medium text-white">
                        {report.patientName} ({report.patientAgeGender})
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Ordering Doctor:</span>
                      <span className="text-slate-200">{report.orderingDoctor}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Prepared By:</span>
                      <span className="text-slate-200">{report.authorName}</span>
                    </div>
                  </div>

                  {/* Summary of findings */}
                  <div className="p-3 bg-slate-950/80 border border-slate-800/80 rounded-lg space-y-2 text-xs">
                    <div className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                      Diagnostic Findings & Abnormalities:
                    </div>
                    <ul className="space-y-1 text-slate-300">
                      {report.results.map((r) => (
                        <li key={r.id} className="flex items-center justify-between">
                          <span>
                            {r.testName}:{' '}
                            <strong className="text-white">
                              {r.numericValue !== undefined ? `${r.numericValue} ${r.unit}` : r.textValue}
                            </strong>
                          </span>
                          {renderAbnormalBadge(r.abnormalFlag)}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-slate-400 font-medium">Pathologist Impression & Clinical Recommendations:</span>
                    <p className="text-slate-300 italic">{report.conclusion}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div className="text-[11px] text-slate-400">
                      {report.authorizedByName ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5" />
                          Signed by {report.authorizedByName}
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Awaiting Pathologist Sign-Off
                        </span>
                      )}
                    </div>

                    <div className="space-x-2">
                      <button
                        onClick={() => {
                          setViewingReport(report);
                          setIsReportViewModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        Preview PDF
                      </button>

                      {activeUserRole === 'PATHOLOGIST' && report.status === 'PRELIMINARY' && (
                        <button
                          onClick={() => handleOpenAuthorizeModal(report)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                        >
                          Authorize & Sign
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 5: DIAGNOSTIC REPORTS & CLINICIAN FEED */}
        {/* ========================================== */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Diagnostic Reports & Clinician Delivery</h2>
                <p className="text-xs text-slate-400">
                  Deliver verified lab results to outpatient, inpatient, and external referral systems.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Report Number</th>
                    <th className="py-3 px-4">Patient Details</th>
                    <th className="py-3 px-4">Report Title</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Ordering Clinician</th>
                    <th className="py-3 px-4">Authorized At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{report.reportNumber}</td>
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{report.patientName}</div>
                        <div className="text-[11px] text-slate-400">{report.patientAgeGender}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-200">{report.title}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{report.orderingDoctor}</td>
                      <td className="py-3 px-4 text-slate-300">{report.authorizedAt || 'In Review'}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => {
                            setViewingReport(report);
                            setIsReportViewModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition"
                        >
                          View Report
                        </button>
                        <button
                          onClick={() => handleOpenFhirModal('REPORT', report)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                          title="View KenyaCoreDiagnosticReport FHIR JSON"
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 6: CONSUMABLES INVENTORY               */}
        {/* ========================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-white">Laboratory Consumables & Reagents Stock</h2>
                <p className="text-xs text-slate-400">
                  Track blood collection tubes, rapid diagnostic test cassettes, and automated analyzer reagents with automated decrement upon collection.
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Item Code</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Quantity on Hand</th>
                    <th className="py-3 px-4">Reorder Level</th>
                    <th className="py-3 px-4">Lot # & Expiry</th>
                    <th className="py-3 px-4">Stock Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {consumables.map((item) => {
                    const isLow = item.quantityOnHand <= item.reorderLevel;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-emerald-400 font-bold">{item.itemCode}</td>
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{item.name}</div>
                          <div className="text-[11px] text-slate-400">{item.manufacturer}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{item.category.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4 text-base font-bold text-white">
                          {item.quantityOnHand} {item.unitOfMeasure}
                        </td>
                        <td className="py-3 px-4 text-slate-400">
                          {item.reorderLevel} {item.unitOfMeasure}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          <div>{item.lotNumber}</div>
                          <div className="text-[11px] text-slate-400">Exp: {item.expiryDate}</div>
                        </td>
                        <td className="py-3 px-4">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              REORDER REQUIRED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Adequate Stock
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 7: OPERATIONAL METRICS & TAT ANALYTICS */}
        {/* ========================================== */}
        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-semibold text-white">Turnaround-Time (TAT) & Operational Quality</h2>
              <p className="text-xs text-slate-400">
                Milestone benchmarks from order placement, phlebotomy, accessioning, analysis, to clinical sign-off.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs text-slate-400">Order to Specimen Draw</span>
                <div className="text-2xl font-bold text-white">12 mins</div>
                <p className="text-[11px] text-emerald-400">Target &lt; 20 mins (Achieved)</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs text-slate-400">Draw to Bench Receipt</span>
                <div className="text-2xl font-bold text-white">8 mins</div>
                <p className="text-[11px] text-emerald-400">Target &lt; 15 mins (Achieved)</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs text-slate-400">Receipt to Result Entry</span>
                <div className="text-2xl font-bold text-white">18 mins</div>
                <p className="text-[11px] text-emerald-400">Target &lt; 30 mins (Achieved)</p>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs text-slate-400">Review to Authorization</span>
                <div className="text-2xl font-bold text-white">10 mins</div>
                <p className="text-[11px] text-emerald-400">Target &lt; 15 mins (Achieved)</p>
              </div>
            </div>

            {/* Abnormal Distribution Breakdown */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-white">Abnormal Result Distribution Breakdown</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">NORMAL</div>
                  <div className="text-xl font-bold text-emerald-400">68%</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">LOW</div>
                  <div className="text-xl font-bold text-amber-400">12%</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">HIGH</div>
                  <div className="text-xl font-bold text-amber-400">10%</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">CRITICAL LOW</div>
                  <div className="text-xl font-bold text-rose-400">6%</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">CRITICAL HIGH</div>
                  <div className="text-xl font-bold text-rose-400">4%</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-xs text-slate-400">REJECTION RATE</div>
                  <div className="text-xl font-bold text-sky-400">1.2%</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================== */}
      {/* MODAL: COLLECT SPECIMEN                   */}
      {/* ========================================== */}
      {isCollectModalOpen && selectedOrderForCollection && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FlaskConical className="w-4 h-4" />
                Specimen Collection & Accessioning
              </div>
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="font-semibold text-white">{selectedOrderForCollection.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MRN:</span>
                <span className="font-mono text-slate-300">{selectedOrderForCollection.mrn}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Ordered Test:</span>
                <span className="text-emerald-400 font-medium">{selectedOrderForCollection.testName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Indication:</span>
                <span className="text-slate-300">{selectedOrderForCollection.clinicalIndication}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Container Type:</label>
                <select
                  value={collectionContainer}
                  onChange={(e) => setCollectionContainer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  <option value="EDTA_TUBE_LAVENDER">EDTA Vacutainer 4.0mL (Lavender Top) - Whole Blood</option>
                  <option value="SST_TUBE_GOLD">SST Vacutainer 5.0mL (Gold Top) - Serum Separator</option>
                  <option value="SODIUM_CITRATE_LIGHT_BLUE">Sodium Citrate 3.2% (Light Blue Top) - Coagulation</option>
                  <option value="HEPARIN_TUBE_GREEN">Lithium Heparin (Green Top) - Rapid Plasma</option>
                  <option value="STERILE_URINE_CUP">Sterile Specimen Cup 60mL - Urinalysis</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Volume Collected (mL):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={collectionVolume}
                    onChange={(e) => setCollectionVolume(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Anatomical Collection Site:</label>
                  <input
                    type="text"
                    value={collectionSite}
                    onChange={(e) => setCollectionSite(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Automated Actions on Confirmation:
                </div>
                <p>• Automatically mints accession number `ACC-202610-XXXXX` and barcode `BC-202610-XXXXX`.</p>
                <p>• Deducts 1 collection tube and 1 needle from facility consumable inventory.</p>
                <p>• Records phlebotomist digital audit entry.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsCollectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCollection}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition shadow-sm"
              >
                Confirm Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: REJECT SPECIMEN                     */}
      {/* ========================================== */}
      {isRejectModalOpen && selectedSpecimenForRejection && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <AlertOctagon className="w-4 h-4" />
                Pre-Analytical Specimen Rejection Workflow
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Specimen Accession:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedSpecimenForRejection.accessionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-semibold">{selectedSpecimenForRejection.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Test:</span>
                <span className="text-slate-200">{selectedSpecimenForRejection.testName}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Rejection Reason (ISO 15189 Standard):</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                >
                  <option value="HEMOLYZED">HEMOLYZED - Gross hemolysis observed on separation</option>
                  <option value="CLOTTED">CLOTTED - Fibrin clots detected in anti-coagulated EDTA tube</option>
                  <option value="INSUFFICIENT_VOLUME">INSUFFICIENT_VOLUME - Quantity not sufficient for analysis (QNS)</option>
                  <option value="INCORRECT_CONTAINER">INCORRECT_CONTAINER - Drawn in wrong tube type</option>
                  <option value="LEAKING_CONTAINER">LEAKING_CONTAINER - Specimen leaked in transit</option>
                  <option value="MISLABELED">MISLABELED - Discrepancy between tube label and order requisition</option>
                  <option value="UNREFRIGERATED">UNREFRIGERATED - Cold-chain temperature violation</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Clinical & Technical Rejection Notes:</label>
                <textarea
                  rows={3}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  placeholder="Detail visible pre-analytical error..."
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="recollectCheckbox"
                  checked={recollectRequired}
                  onChange={(e) => setRecollectRequired(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-500"
                />
                <label htmlFor="recollectCheckbox" className="text-slate-300 font-medium">
                  Trigger automatic recollection order (`{selectedSpecimenForRejection.accessionNumber}-R`)
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteRejection}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg transition"
              >
                Confirm Specimen Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: ENTER TEST RESULT                   */}
      {/* ========================================== */}
      {isResultModalOpen && selectedSpecimenForResult && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FlaskConical className="w-4 h-4" />
                Laboratory Analytical Result Entry
              </div>
              <button
                onClick={() => setIsResultModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Specimen Accession:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedSpecimenForResult.accessionNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-semibold">{selectedSpecimenForResult.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Test:</span>
                <span className="text-slate-200">{selectedSpecimenForResult.testName}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Numeric Result Value:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={resultNumericValue}
                    onChange={(e) => setResultNumericValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
                    placeholder="e.g. 6.4"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Textual / Qualitative (if applicable):</label>
                  <input
                    type="text"
                    value={resultTextValue}
                    onChange={(e) => setResultTextValue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"
                    placeholder="e.g. Positive / Negative"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Analytical Notes & Instrument Remarks:</label>
                <textarea
                  rows={2}
                  value={resultNotes}
                  onChange={(e) => setResultNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  placeholder="Notes, rerun details..."
                />
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 text-[11px] space-y-1">
                <div className="text-slate-400 font-semibold">Configured Reference Range (WHO Standard):</div>
                <div className="text-emerald-400 font-mono">13.0 - 18.0 g/dL (Adult Male)</div>
                <div className="text-rose-400 text-[10px]">Critical Threshold: &le; 7.0 g/dL</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsResultModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteResultEntry}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition shadow-sm"
              >
                Save Result & Flag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: AUTHORIZE DIAGNOSTIC REPORT         */}
      {/* ========================================== */}
      {isAuthorizeModalOpen && selectedReportForAuth && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <Shield className="w-4 h-4" />
                Pathologist Clinical Authorization & Digital Sign-off
              </div>
              <button
                onClick={() => setIsAuthorizeModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Report Number:</span>
                <span className="font-mono text-emerald-400 font-bold">{selectedReportForAuth.reportNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Patient:</span>
                <span className="text-white font-semibold">{selectedReportForAuth.patientName}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Final Clinical Impression & Recommendations:</label>
                <textarea
                  rows={3}
                  value={authConclusion}
                  onChange={(e) => setAuthConclusion(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Cryptographic Digital Signature:</label>
                <input
                  type="text"
                  value={authSignature}
                  onChange={(e) => setAuthSignature(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-indigo-300 font-mono"
                />
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Legal Clinical Significance:
                </div>
                <p>• Finalizes the report and marks the underlying clinical order as `COMPLETED`.</p>
                <p>• Dispatches preliminary notifications to the ordering physician.</p>
                <p>• Locks result values; subsequent modifications will require formal amendment audit reasons.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsAuthorizeModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAuthorization}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition shadow-sm"
              >
                Authorize & Sign Final Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: CORRECT / AMEND RESULT              */}
      {/* ========================================== */}
      {isCorrectionModalOpen && selectedResultForCorrection && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Result Correction & Audit Trail Maintenance
              </div>
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Result ID:</span>
                <span className="font-mono text-slate-400">{selectedResultForCorrection.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Original Value:</span>
                <span className="font-bold text-white">
                  {selectedResultForCorrection.numericValue} {selectedResultForCorrection.unit}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">New Corrected Numeric Value:</label>
                <input
                  type="number"
                  step="0.01"
                  value={correctionNewValue}
                  onChange={(e) => setCorrectionNewValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Mandatory Clinical Justification (min 10 characters):
                </label>
                <textarea
                  rows={3}
                  value={correctionReasonText}
                  onChange={(e) => setCorrectionReasonText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white"
                  placeholder="Detail why original result is superseded..."
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteCorrection}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition"
              >
                Save Correction (Immutable Audit)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: OFFICIAL DIAGNOSTIC REPORT PREVIEW  */}
      {/* ========================================== */}
      {isReportViewModalOpen && viewingReport && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Report Header */}
            <div className="flex items-start justify-between pb-4 border-b-2 border-emerald-500/40">
              <div>
                <div className="text-xl font-bold text-white tracking-tight">NAIROBI METROPOLITAN REFERRAL HOSPITAL</div>
                <div className="text-xs text-slate-400">Department of Laboratory Medicine & Pathology • ISO 15189 Accredited</div>
                <div className="text-xs text-slate-500">MOH Facility ID: FID-01-000101-1 • Nairobi, Kenya</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Diagnostic Report</div>
                <div className="text-lg font-mono font-bold text-emerald-400">{viewingReport.reportNumber}</div>
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300">
                  {viewingReport.status}
                </span>
              </div>
            </div>

            {/* Patient & Order Details Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-950 rounded-xl text-xs border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Patient Name</span>
                <span className="font-bold text-white">{viewingReport.patientName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">MRN</span>
                <span className="font-mono text-slate-300">{viewingReport.patientMrn}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Age / Gender</span>
                <span className="text-slate-300">{viewingReport.patientAgeGender}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Ordering Physician</span>
                <span className="text-slate-300">{viewingReport.orderingDoctor}</span>
              </div>
            </div>

            {/* Test Results Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Analytical Results</h4>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Investigation</th>
                    <th className="py-2.5 px-3">Result</th>
                    <th className="py-2.5 px-3">Units</th>
                    <th className="py-2.5 px-3">Flag</th>
                    <th className="py-2.5 px-3">Clinical Reference Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {viewingReport.results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-3 font-medium text-white">{r.testName}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {r.numericValue !== undefined ? r.numericValue : r.textValue}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{r.unit || '-'}</td>
                      <td className="py-2.5 px-3">{renderAbnormalBadge(r.abnormalFlag)}</td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {r.referenceRangeText}
                        <div className="text-[10px] text-slate-500">[{r.referenceSource}]</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Clinical Conclusion */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">Pathologist Interpretation:</span>
              <p className="text-slate-200">{viewingReport.conclusion}</p>
              {viewingReport.recommendations && (
                <div className="pt-2 text-slate-300">
                  <span className="text-slate-400 font-semibold uppercase text-[10px]">Recommendations:</span>
                  <p>{viewingReport.recommendations}</p>
                </div>
              )}
            </div>

            {/* Sign-off footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                <div>Bench Technologist: {viewingReport.authorName}</div>
                <div>Authorized Pathologist: {viewingReport.authorizedByName || 'Pending'}</div>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => setIsReportViewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition flex items-center gap-1.5 inline-flex"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Official PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL: FHIR R4 JSON EXPORT VIEWER          */}
      {/* ========================================== */}
      {isFhirModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <FileCode2 className="w-4 h-4" />
                KenyaCore HL7 FHIR R4 JSON Export
              </div>
              <button
                onClick={() => setIsFhirModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96">
              {fhirJsonContent}
            </pre>

            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(fhirJsonContent);
                  alert('FHIR JSON copied to clipboard!');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setIsFhirModalOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
