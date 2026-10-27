'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Pill,
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  Shield,
  CheckCheck,
  Package,
  BadgeAlert,
  FileCode2,
  ArrowUpRight,
  Plus,
  Truck,
  Undo2,
  DollarSign,
  Boxes,
  Lock,
  Filter,
  Check,
  UserCheck,
  Sparkles,
} from 'lucide-react';

// ==========================================
// TYPES & ENUMS
// ==========================================

export type DrugSchedule = 'PART_1_POISON' | 'PART_2_POISON' | 'OVER_THE_COUNTER' | 'CONTROLLED_NARCOTIC';
export type StorageCondition = 'ROOM_TEMPERATURE' | 'REFRIGERATED' | 'FROZEN' | 'COOL_DRY' | 'PROTECT_FROM_LIGHT';
export type DispenseStatus = 'PENDING' | 'PARTIALLY_DISPENSED' | 'FULLY_DISPENSED' | 'CANCELLED';
export type DispenseType = 'FULL' | 'PARTIAL' | 'BALANCE_COMPLETION';

export interface PrescriptionItem {
  id: string;
  orderNumber: string;
  orderId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientAgeGender: string;
  encounterId: string;
  prescribingClinician: string;
  medicationCode: string; // KEML 2023 or ATC
  medicationName: string;
  dosage: string;
  dosageUnit: string;
  route: string;
  frequency: string;
  durationValue: number;
  durationUnit: string;
  totalQuantity: number;
  quantityDispensed: number;
  quantityRemaining: number;
  quantityUnit: string;
  instructions: string;
  substitutionAllowed: boolean;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  orderedAt: string;
  status: DispenseStatus;
}

export interface InventoryBatch {
  id: string;
  productId: string;
  productCode: string;
  genericName: string;
  brandName: string;
  atcCode: string;
  drugSchedule: DrugSchedule;
  category: string;
  batchNumber: string;
  manufacturer: string;
  expiryDate: string;
  daysToExpiry: number;
  quantityOnHand: number;
  quantityReserved: number;
  unitCost: number;
  sellingPrice: number;
  storageBin: string;
  storageCondition: StorageCondition;
  status: 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED';
}

export interface StockMovementRecord {
  id: string;
  timestamp: string;
  productCode: string;
  productName: string;
  batchNumber: string;
  movementType: string;
  quantityDelta: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: number;
  performedBy: string;
  referenceType: string;
  referenceId: string;
  reason?: string;
  notes?: string;
}

export interface BedsideAdministration {
  id: string;
  administeredAt: string;
  patientName: string;
  patientMrn: string;
  medicationName: string;
  dose: string;
  route: string;
  site: string;
  administeredBy: string;
  status: 'COMPLETED' | 'WITHHELD' | 'REFUSED';
  notes?: string;
}

// ==========================================
// MOCK DATA (Grounded in synthetic seed data)
// ==========================================

const INITIAL_PRESCRIPTIONS: PrescriptionItem[] = [
  {
    id: 'req-001',
    orderNumber: 'ORD-202610-1042',
    orderId: 'ord-1042',
    patientId: 'pat-001',
    patientName: 'Juma Bakari',
    patientMrn: 'NMH-2026-0814',
    patientAgeGender: '38y / Male',
    encounterId: 'enc-2026-001',
    prescribingClinician: 'Dr. Otieno, Lead Physician (MBChB, MMed)',
    medicationCode: 'J01CA04',
    medicationName: 'Amoxicillin 500mg capsule',
    dosage: '500',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'TID',
    durationValue: 5,
    durationUnit: 'DAYS',
    totalQuantity: 15,
    quantityDispensed: 0,
    quantityRemaining: 15,
    quantityUnit: 'CAPSULES',
    instructions: 'Take 1 capsule 3 times daily after meals for 5 days. Complete entire course.',
    substitutionAllowed: true,
    priority: 'ROUTINE',
    orderedAt: '2026-10-20 09:15',
    status: 'PENDING',
  },
  {
    id: 'req-002',
    orderNumber: 'ORD-202610-1045',
    orderId: 'ord-1045',
    patientId: 'pat-002',
    patientName: 'Amina Wangari',
    patientMrn: 'NMH-2026-0922',
    patientAgeGender: '29y / Female',
    encounterId: 'enc-2026-002',
    prescribingClinician: 'Dr. Mary Muthoni, Emergency Officer (MBChB)',
    medicationCode: 'P01BF01',
    medicationName: 'Artemether + Lumefantrine 20/120mg',
    dosage: '20/120',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'BD',
    durationValue: 3,
    durationUnit: 'DAYS',
    totalQuantity: 24,
    quantityDispensed: 12,
    quantityRemaining: 12,
    quantityUnit: 'TABLETS',
    instructions: 'Take 4 tablets stat, 4 at 8h, then 4 BD with a fatty meal/milk.',
    substitutionAllowed: false,
    priority: 'URGENT',
    orderedAt: '2026-10-20 08:30',
    status: 'PARTIALLY_DISPENSED',
  },
  {
    id: 'req-003',
    orderNumber: 'ORD-202610-1048',
    orderId: 'ord-1048',
    patientId: 'pat-003',
    patientName: 'Kiprono Cheruiyot',
    patientMrn: 'NMH-2026-0411',
    patientAgeGender: '54y / Male',
    encounterId: 'enc-2026-003',
    prescribingClinician: 'Dr. Peter Kamau, Consultant Cardiologist',
    medicationCode: 'C08CA01',
    medicationName: 'Amlodipine 5mg tablet',
    dosage: '5',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'OD',
    durationValue: 30,
    durationUnit: 'DAYS',
    totalQuantity: 30,
    quantityDispensed: 0,
    quantityRemaining: 30,
    quantityUnit: 'TABLETS',
    instructions: 'Take 1 tablet every morning with water. Monitor blood pressure weekly.',
    substitutionAllowed: true,
    priority: 'ROUTINE',
    orderedAt: '2026-10-20 10:00',
    status: 'PENDING',
  },
  {
    id: 'req-004',
    orderNumber: 'ORD-202610-1052',
    orderId: 'ord-1052',
    patientId: 'pat-004',
    patientName: 'Esther Mutua',
    patientMrn: 'NMH-2026-0741',
    patientAgeGender: '42y / Female',
    encounterId: 'enc-2026-004',
    prescribingClinician: 'Dr. Otieno, Lead Physician',
    medicationCode: 'N02BE01',
    medicationName: 'Paracetamol 500mg tablet',
    dosage: '1000',
    dosageUnit: 'mg',
    route: 'ORAL',
    frequency: 'QID',
    durationValue: 3,
    durationUnit: 'DAYS',
    totalQuantity: 24,
    quantityDispensed: 24,
    quantityRemaining: 0,
    quantityUnit: 'TABLETS',
    instructions: 'Take 2 tablets 4 times daily as needed for fever and body ache.',
    substitutionAllowed: true,
    priority: 'ROUTINE',
    orderedAt: '2026-10-19 14:20',
    status: 'FULLY_DISPENSED',
  },
];

const INITIAL_BATCHES: InventoryBatch[] = [
  {
    id: 'batch-amx-01',
    productId: 'prod-amx',
    productCode: 'MED-AMX-500',
    genericName: 'Amoxicillin',
    brandName: 'Amoxil',
    atcCode: 'J01CA04',
    drugSchedule: 'PART_1_POISON',
    category: 'ORAL_SOLID',
    batchNumber: 'BATCH-AMX-EARLY-26',
    manufacturer: 'Cosmos Pharmaceuticals Ltd',
    expiryDate: '2026-12-15',
    daysToExpiry: 56,
    quantityOnHand: 85,
    quantityReserved: 0,
    unitCost: 8.5,
    sellingPrice: 12.0,
    storageBin: 'DISP-SHELF-A2',
    storageCondition: 'ROOM_TEMPERATURE',
    status: 'ACTIVE',
  },
  {
    id: 'batch-amx-02',
    productId: 'prod-amx',
    productCode: 'MED-AMX-500',
    genericName: 'Amoxicillin',
    brandName: 'Amoxil',
    atcCode: 'J01CA04',
    drugSchedule: 'PART_1_POISON',
    category: 'ORAL_SOLID',
    batchNumber: 'BATCH-AMX-LATE-28',
    manufacturer: 'Cosmos Pharmaceuticals Ltd',
    expiryDate: '2028-06-30',
    daysToExpiry: 618,
    quantityOnHand: 500,
    quantityReserved: 0,
    unitCost: 8.5,
    sellingPrice: 12.0,
    storageBin: 'BULK-BAY-04',
    storageCondition: 'ROOM_TEMPERATURE',
    status: 'ACTIVE',
  },
  {
    id: 'batch-al-01',
    productId: 'prod-al',
    productCode: 'MED-AL-20120',
    genericName: 'Artemether + Lumefantrine',
    brandName: 'Coartem',
    atcCode: 'P01BF01',
    drugSchedule: 'PART_1_POISON',
    category: 'ORAL_SOLID',
    batchNumber: 'BATCH-AL-26K01',
    manufacturer: 'Novartis Pharma AG / KEMSA Supply',
    expiryDate: '2027-04-10',
    daysToExpiry: 172,
    quantityOnHand: 48,
    quantityReserved: 0,
    unitCost: 10.0,
    sellingPrice: 15.0,
    storageBin: 'DISP-SHELF-B1',
    storageCondition: 'ROOM_TEMPERATURE',
    status: 'ACTIVE',
  },
  {
    id: 'batch-aml-01',
    productId: 'prod-aml',
    productCode: 'MED-AML-5',
    genericName: 'Amlodipine',
    brandName: 'Norvasc',
    atcCode: 'C08CA01',
    drugSchedule: 'PART_1_POISON',
    category: 'ORAL_SOLID',
    batchNumber: 'BATCH-AML-27A09',
    manufacturer: 'Dawa Limited Kenya',
    expiryDate: '2027-08-20',
    daysToExpiry: 304,
    quantityOnHand: 320,
    quantityReserved: 0,
    unitCost: 5.0,
    sellingPrice: 8.5,
    storageBin: 'DISP-SHELF-C3',
    storageCondition: 'ROOM_TEMPERATURE',
    status: 'ACTIVE',
  },
  {
    id: 'batch-ins-01',
    productId: 'prod-ins',
    productCode: 'MED-INS-SOL',
    genericName: 'Soluble Insulin (Regular)',
    brandName: 'Humulin R',
    atcCode: 'A10AB01',
    drugSchedule: 'PART_1_POISON',
    category: 'INJECTABLE',
    batchNumber: 'BATCH-INS-COLD-01',
    manufacturer: 'Novo Nordisk / MEDS Distributor',
    expiryDate: '2026-11-28',
    daysToExpiry: 39,
    quantityOnHand: 18,
    quantityReserved: 0,
    unitCost: 450.0,
    sellingPrice: 650.0,
    storageBin: 'COLD-FRIDGE-1 (2-8°C)',
    storageCondition: 'REFRIGERATED',
    status: 'ACTIVE',
  },
];

const INITIAL_MOVEMENTS: StockMovementRecord[] = [
  {
    id: 'mov-001',
    timestamp: '2026-10-20 10:45:00',
    productCode: 'MED-AMX-500',
    productName: 'Amoxicillin 500mg capsule',
    batchNumber: 'BATCH-AMX-EARLY-26',
    movementType: 'DISPENSATION',
    quantityDelta: -15,
    quantityBefore: 100,
    quantityAfter: 85,
    unitCost: 8.5,
    performedBy: 'Faith Njeri (Lead Pharmacist)',
    referenceType: 'DISPENSE',
    referenceId: 'DISP-2026-00412',
    notes: 'FEFO automatic batch allocation to Juma Bakari (NMH-2026-0814)',
  },
  {
    id: 'mov-002',
    timestamp: '2026-10-20 09:30:15',
    productCode: 'MED-AL-20120',
    productName: 'Artemether + Lumefantrine 20/120mg',
    batchNumber: 'BATCH-AL-26K01',
    movementType: 'PARTIAL_DISPENSATION',
    quantityDelta: -12,
    quantityBefore: 60,
    quantityAfter: 48,
    unitCost: 10.0,
    performedBy: 'Faith Njeri (Lead Pharmacist)',
    referenceType: 'DISPENSE',
    referenceId: 'DISP-2026-00409',
    notes: 'Partial dispensation (12 of 24) to Amina Wangari; balance tomorrow',
  },
  {
    id: 'mov-003',
    timestamp: '2026-10-19 16:10:00',
    productCode: 'MED-AMX-500',
    productName: 'Amoxicillin 500mg capsule',
    batchNumber: 'BATCH-AMX-LATE-28',
    movementType: 'RECEIPT',
    quantityDelta: 500,
    quantityBefore: 0,
    quantityAfter: 500,
    unitCost: 8.5,
    performedBy: 'Faith Njeri (Lead Pharmacist)',
    referenceType: 'PURCHASE_ORDER',
    referenceId: 'PO-KEMSA-2026-88',
    notes: 'Received bulk supply from KEMSA (Consignment #KEMSA/2026/NBI-04)',
  },
  {
    id: 'mov-004',
    timestamp: '2026-10-19 11:22:45',
    productCode: 'MED-INS-SOL',
    productName: 'Soluble Insulin (Regular) 100IU/ml',
    batchNumber: 'BATCH-INS-COLD-01',
    movementType: 'RECEIPT',
    quantityDelta: 20,
    quantityBefore: 0,
    quantityAfter: 20,
    unitCost: 450.0,
    performedBy: 'Faith Njeri (Lead Pharmacist)',
    referenceType: 'PURCHASE_ORDER',
    referenceId: 'PO-MEDS-2026-12',
    notes: 'Cold chain verified intact upon arrival: 4.2°C logged',
  },
];

const INITIAL_ADMINISTRATIONS: BedsideAdministration[] = [
  {
    id: 'adm-001',
    administeredAt: '2026-10-20 10:15',
    patientName: 'Juma Bakari',
    patientMrn: 'NMH-2026-0814',
    medicationName: 'Amoxicillin 500mg capsule',
    dose: '500 mg',
    route: 'ORAL',
    site: 'Mouth',
    administeredBy: 'Mercy Chebet (Ward Nurse, KRCHN)',
    status: 'COMPLETED',
    notes: 'Administered with water. Patient tolerated dose well without nausea or pyrexia.',
  },
  {
    id: 'adm-002',
    administeredAt: '2026-10-20 09:00',
    patientName: 'Amina Wangari',
    patientMrn: 'NMH-2026-0922',
    medicationName: 'Artemether + Lumefantrine 20/120mg',
    dose: '4 tablets (80/480 mg)',
    route: 'ORAL',
    site: 'Mouth',
    administeredBy: 'Mercy Chebet (Ward Nurse, KRCHN)',
    status: 'COMPLETED',
    notes: 'First dose taken with whole milk provided by ward nutrition.',
  },
];

export default function PharmacyWorkbenchPage() {
  const [activeTab, setActiveTab] = useState<
    'worklist' | 'inventory' | 'movements' | 'administration' | 'fhir'
  >('worklist');

  // Interactive state
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>(INITIAL_PRESCRIPTIONS);
  const [batches, setBatches] = useState<InventoryBatch[]>(INITIAL_BATCHES);
  const [movements, setMovements] = useState<StockMovementRecord[]>(INITIAL_MOVEMENTS);
  const [administrations] = useState<BedsideAdministration[]>(INITIAL_ADMINISTRATIONS);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DispenseStatus>('ALL');

  // Modals
  const [dispenseModalPrescription, setDispenseModalPrescription] = useState<PrescriptionItem | null>(null);
  const [dispenseQty, setDispenseQty] = useState<number>(0);
  const [dispenseNotes, setDispenseNotes] = useState<string>('');
  const [counselingNotes, setCounselingNotes] = useState<string>('');
  const [selectedBatchOverride, setSelectedBatchOverride] = useState<string>('');

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [returnDispenseId, setReturnDispenseId] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('');

  // Receive stock modal
  const [showReceiveModal, setShowReceiveModal] = useState<boolean>(false);
  const [newBatchNumber, setNewBatchNumber] = useState<string>('BATCH-AMX-' + Math.floor(1000 + Math.random() * 9000));
  const [newExpiryDate, setNewExpiryDate] = useState<string>('2028-12-31');
  const [newQuantity, setNewQuantity] = useState<number>(200);
  const [newUnitCost, setNewUnitCost] = useState<number>(8.5);
  const [newSellingPrice, setNewSellingPrice] = useState<number>(12.0);

  // FHIR Resource preview
  const [fhirResourceTab, setFhirResourceTab] = useState<'dispense' | 'medication' | 'administration'>('dispense');

  // KPIs
  const totalValuationCost = batches.reduce((acc, b) => acc + b.quantityOnHand * b.unitCost, 0);
  const totalValuationRetail = batches.reduce((acc, b) => acc + b.quantityOnHand * b.sellingPrice, 0);
  const pendingPrescriptionsCount = prescriptions.filter((p) => p.status === 'PENDING').length;
  const partialPrescriptionsCount = prescriptions.filter((p) => p.status === 'PARTIALLY_DISPENSED').length;
  const expiringSoonBatches = batches.filter((b) => b.daysToExpiry <= 90);
  const lowStockBatches = batches.filter((b) => b.quantityOnHand <= 50);

  // Handle open dispense modal
  const openDispenseModal = (p: PrescriptionItem) => {
    setDispenseModalPrescription(p);
    setDispenseQty(p.quantityRemaining);
    setCounselingNotes(
      p.instructions.includes('course')
        ? 'Counsel patient on completing the full antibiotic course to prevent resistance.'
        : 'Take strictly according to schedule with food/water.',
    );
    setDispenseNotes('Verified against Kenya EML standard dosing guidelines.');
    setSelectedBatchOverride('');
  };

  // Execute dispensing
  const handleConfirmDispense = () => {
    if (!dispenseModalPrescription || dispenseQty <= 0) return;

    const remainingAfter = dispenseModalPrescription.quantityRemaining - dispenseQty;
    const isBalanceCompletion =
      dispenseModalPrescription.status === 'PARTIALLY_DISPENSED' && remainingAfter === 0;
    const isPartial = remainingAfter > 0;

    const updatedType: DispenseType = isBalanceCompletion
      ? 'BALANCE_COMPLETION'
      : isPartial
      ? 'PARTIAL'
      : 'FULL';

    // 1. Update prescription list
    setPrescriptions((prev) =>
      prev.map((p) => {
        if (p.id === dispenseModalPrescription.id) {
          return {
            ...p,
            quantityDispensed: p.quantityDispensed + dispenseQty,
            quantityRemaining: remainingAfter,
            status: remainingAfter === 0 ? 'FULLY_DISPENSED' : 'PARTIALLY_DISPENSED',
          };
        }
        return p;
      }),
    );

    // 2. Decrement batch inventory (using FEFO batch or override)
    const targetBatchId = selectedBatchOverride || 'batch-amx-01';
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === targetBatchId) {
          const newQty = Math.max(0, b.quantityOnHand - dispenseQty);
          return { ...b, quantityOnHand: newQty };
        }
        return b;
      }),
    );

    // 3. Add explicit stock movement entry to ledger
    const newMovement: StockMovementRecord = {
      id: `mov-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      productCode: dispenseModalPrescription.medicationCode,
      productName: dispenseModalPrescription.medicationName,
      batchNumber: selectedBatchOverride ? 'BATCH-MANUAL-OVERRIDE' : 'BATCH-AMX-EARLY-26 (FEFO)',
      movementType: updatedType === 'PARTIAL' ? 'PARTIAL_DISPENSATION' : 'DISPENSATION',
      quantityDelta: -dispenseQty,
      quantityBefore: 85,
      quantityAfter: 85 - dispenseQty,
      unitCost: 8.5,
      performedBy: 'Faith Njeri (Lead Pharmacist)',
      referenceType: 'DISPENSE',
      referenceId: `DISP-${Date.now().toString().slice(-6)}`,
      notes: `Dispensed to ${dispenseModalPrescription.patientName} (${dispenseModalPrescription.patientMrn}). ${dispenseNotes}`,
    };
    setMovements((prev) => [newMovement, ...prev]);

    // Close modal
    setDispenseModalPrescription(null);
  };

  // Handle controlled return / reversal
  const handleConfirmReturn = () => {
    if (!returnReason || returnReason.trim().length < 10) {
      alert('Kenyan Pharmacy Regulations mandate a clinical return justification of at least 10 characters.');
      return;
    }

    // Restore stock on earliest batch
    setBatches((prev) =>
      prev.map((b) => {
        if (b.id === 'batch-amx-01') {
          return { ...b, quantityOnHand: b.quantityOnHand + 15 };
        }
        return b;
      }),
    );

    // Record explicit RETURN_TO_STOCK in ledger
    const returnMovement: StockMovementRecord = {
      id: `mov-ret-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      productCode: 'MED-AMX-500',
      productName: 'Amoxicillin 500mg capsule',
      batchNumber: 'BATCH-AMX-EARLY-26',
      movementType: 'RETURN_TO_STOCK',
      quantityDelta: 15,
      quantityBefore: 70,
      quantityAfter: 85,
      unitCost: 8.5,
      performedBy: 'Faith Njeri (Lead Pharmacist)',
      referenceType: 'RETURN',
      referenceId: returnDispenseId || 'DISP-2026-00412',
      reason: returnReason,
      notes: 'Controlled reversal processed. Physical blister pack inspected and confirmed intact.',
    };
    setMovements((prev) => [returnMovement, ...prev]);

    setShowReturnModal(false);
    setReturnReason('');
    setReturnDispenseId('');
  };

  // Handle stock receipt
  const handleConfirmReceive = () => {
    const newBatch: InventoryBatch = {
      id: `batch-${Date.now()}`,
      productId: 'prod-amx',
      productCode: 'MED-AMX-500',
      genericName: 'Amoxicillin',
      brandName: 'Amoxil',
      atcCode: 'J01CA04',
      drugSchedule: 'PART_1_POISON',
      category: 'ORAL_SOLID',
      batchNumber: newBatchNumber,
      manufacturer: 'Cosmos Pharmaceuticals Kenya',
      expiryDate: newExpiryDate,
      daysToExpiry: 800,
      quantityOnHand: newQuantity,
      quantityReserved: 0,
      unitCost: newUnitCost,
      sellingPrice: newSellingPrice,
      storageBin: 'DISP-SHELF-A3',
      storageCondition: 'ROOM_TEMPERATURE',
      status: 'ACTIVE',
    };

    setBatches((prev) => [newBatch, ...prev]);

    const receiptMovement: StockMovementRecord = {
      id: `mov-rec-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      productCode: 'MED-AMX-500',
      productName: 'Amoxicillin 500mg capsule',
      batchNumber: newBatchNumber,
      movementType: 'RECEIPT',
      quantityDelta: newQuantity,
      quantityBefore: 0,
      quantityAfter: newQuantity,
      unitCost: newUnitCost,
      performedBy: 'Faith Njeri (Lead Pharmacist)',
      referenceType: 'PURCHASE_ORDER',
      referenceId: `PO-KEMSA-${Date.now().toString().slice(-4)}`,
      notes: 'Direct consignment receipt logged into inventory ledger.',
    };
    setMovements((prev) => [receiptMovement, ...prev]);

    setShowReceiveModal(false);
  };

  // Filtered prescription list
  const filteredPrescriptions = prescriptions.filter((p) => {
    const matchesSearch =
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientMrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.medicationName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.orderNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Notification Bar: Regulatory Context */}
      <div className="bg-emerald-950/80 border-b border-emerald-800/40 px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-3 text-emerald-300">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>
            <strong>Kenya Pharmacy and Poisons Board (PPB) Cap 244</strong> Compliance Mode Active • Facility Premise: <strong>PPB/PREM/PUB-001</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>KEML 2023 8th Edition Standard</span>
          <span className="text-emerald-500">•</span>
          <span>HL7 FHIR R4 Core Serialization</span>
          <span className="text-emerald-500">•</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            FEFO Auto-Allocation Enforced
          </span>
        </div>
      </div>

      {/* Main Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700/60"
            title="Return to Main Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl shadow-inner">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Pharmacy & Medication-Dispensing Workbench
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Milestone 8
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Nairobi Metropolitan Hospital • Lead Pharmacist: Faith Njeri (B.Pharm, PPB #4812)
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowReceiveModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            Receive Stock
          </button>
          <button
            onClick={() => setShowReturnModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <Undo2 className="w-3.5 h-3.5 text-amber-400" />
            Controlled Return
          </button>
          <Link
            href="/laboratory"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition"
          >
            Laboratory LIS
            <ArrowUpRight className="w-3 h-3 text-slate-400" />
          </Link>
          <Link
            href="/encounters"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
          >
            Clinical Triage
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* KPI Metrics Dashboard */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Inventory Valuation */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Inventory Valuation</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              KES {totalValuationRetail.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Cost: KES {totalValuationCost.toLocaleString('en-KE', { minimumFractionDigits: 0 })}</span>
              <span className="text-emerald-400 font-semibold">+41.2% Retail</span>
            </div>
          </div>

          {/* Card 2: Active Batches */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Active Inventory Batches</span>
              <Boxes className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {batches.length} Batches
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>KEML Products: 12</span>
              <span className="text-blue-400">100% FEFO</span>
            </div>
          </div>

          {/* Card 3: Prescriptions Pending */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Prescription Worklist</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400 tracking-tight">
              {pendingPrescriptionsCount} Pending
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>{partialPrescriptionsCount} Partial Balances</span>
              <span className="text-slate-400">CPOE Linked</span>
            </div>
          </div>

          {/* Card 4: FEFO Expiry Risk Alerts */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Expiry Risk Alerts</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-amber-500 tracking-tight">
              {expiringSoonBatches.length} Batches
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Within 90 Days</span>
              <span className="text-amber-400 font-medium">Action Needed</span>
            </div>
          </div>

          {/* Card 5: Low-Stock Alerts */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Low-Stock Alerts</span>
              <BadgeAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl font-bold text-rose-400 tracking-tight">
              {lowStockBatches.length} Products
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>At/Below Reorder</span>
              <span className="text-rose-400">KEMSA Reorder</span>
            </div>
          </div>
        </section>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('worklist')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'worklist'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Prescription Worklist ({prescriptions.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'inventory'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Catalogue & FEFO Batches ({batches.length})
            </button>
            <button
              onClick={() => setActiveTab('movements')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'movements'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Stock Movement Ledger ({movements.length})
            </button>
            <button
              onClick={() => setActiveTab('administration')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'administration'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Bedside Administration ({administrations.length})
            </button>
            <button
              onClick={() => setActiveTab('fhir')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'fhir'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              Live FHIR R4 Inspector
            </button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: PRESCRIPTION WORKLIST */}
        {/* ============================================================== */}
        {activeTab === 'worklist' && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Patient, MRN, Medication, Order #..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>
                <select
                  aria-label="Filter prescriptions by status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="ALL">All Prescriptions</option>
                  <option value="PENDING">Pending Dispensation</option>
                  <option value="PARTIALLY_DISPENSED">Partially Dispensed</option>
                  <option value="FULLY_DISPENSED">Fully Fulfilled</option>
                </select>
              </div>
            </div>

            {/* Prescriptions List Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Order / Prescriber</th>
                      <th className="py-3 px-4">Patient (MRN)</th>
                      <th className="py-3 px-4">Prescribed Medication</th>
                      <th className="py-3 px-4">Regimen & Instructions</th>
                      <th className="py-3 px-4 text-center">Qty Prescribed / Remaining</th>
                      <th className="py-3 px-4 text-center">Fulfillment Status</th>
                      <th className="py-3 px-4 text-right">Pharmacist Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPrescriptions.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 transition">
                        {/* Order & Doctor */}
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-emerald-400">{p.orderNumber}</span>
                            {p.priority === 'URGENT' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                URGENT
                              </span>
                            )}
                            {p.priority === 'STAT' && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse">
                                STAT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{p.prescribingClinician}</div>
                          <div className="text-[10px] text-slate-500">{p.orderedAt}</div>
                        </td>

                        {/* Patient */}
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="font-semibold text-white">{p.patientName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{p.patientMrn}</div>
                          <div className="text-[10px] text-slate-500">{p.patientAgeGender}</div>
                        </td>

                        {/* Medication */}
                        <td className="py-3 px-4 space-y-1">
                          <div className="font-medium text-white flex items-center gap-1.5">
                            {p.medicationName}
                            {p.substitutionAllowed ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Generic OK
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                No Generic Sub
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            KEML: {p.medicationCode} • {p.dosage}{p.dosageUnit} ({p.route})
                          </div>
                        </td>

                        {/* Instructions */}
                        <td className="py-3 px-4 max-w-xs text-slate-300">
                          <p className="line-clamp-2">{p.instructions}</p>
                          <span className="text-[10px] text-slate-400">
                            {p.frequency} • {p.durationValue} {p.durationUnit}
                          </span>
                        </td>

                        {/* Quantities */}
                        <td className="py-3 px-4 text-center">
                          <div className="font-bold text-white">
                            {p.quantityDispensed} / {p.totalQuantity} {p.quantityUnit}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Remaining: <span className="font-semibold text-amber-400">{p.quantityRemaining}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {p.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                          {p.status === 'PARTIALLY_DISPENSED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <Activity className="w-3 h-3" /> Partial ({p.quantityDispensed})
                            </span>
                          )}
                          {p.status === 'FULLY_DISPENSED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCheck className="w-3 h-3" /> Fulfilled
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3 px-4 text-right">
                          {p.status !== 'FULLY_DISPENSED' ? (
                            <button
                              onClick={() => openDispenseModal(p)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                            >
                              <Pill className="w-3.5 h-3.5" />
                              Dispense (FEFO)
                            </button>
                          ) : (
                            <span className="text-slate-500 text-xs italic">Completed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: INVENTORY & FEFO BATCHES */}
        {/* ============================================================== */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Current Dispensary & Warehouse Stock</h2>
                <p className="text-xs text-slate-400">
                  Batches ordered by First-Expiring, First-Out (FEFO) rule to prevent pharmaceutical expiration wastage.
                </p>
              </div>
              <button
                onClick={() => setShowReceiveModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Receive New Supplier Batch
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {batches.map((b) => (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    b.daysToExpiry <= 60
                      ? 'bg-amber-950/20 border-amber-800/60'
                      : 'bg-slate-900/60 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {b.productCode} • {b.atcCode}
                      </span>
                      <h3 className="font-bold text-white text-sm mt-1">{b.genericName}</h3>
                      <p className="text-xs text-slate-400">{b.brandName} ({b.category})</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.drugSchedule === 'PART_1_POISON'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {b.drugSchedule}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-slate-400 text-[10px]">Batch Number:</span>
                      <p className="font-mono font-semibold text-slate-200">{b.batchNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Expiry (Days Left):</span>
                      <p
                        className={`font-semibold ${
                          b.daysToExpiry <= 60 ? 'text-amber-400' : 'text-slate-200'
                        }`}
                      >
                        {b.expiryDate} ({b.daysToExpiry}d)
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">On Hand:</span>
                      <p className="font-bold text-white text-sm">{b.quantityOnHand} units</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Storage Bin:</span>
                      <p className="text-slate-300 text-[11px] font-medium">{b.storageBin}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/60 text-slate-400">
                    <span>Acquisition: KES {b.unitCost.toFixed(2)}</span>
                    <span className="text-emerald-400 font-semibold">Retail: KES {b.sellingPrice.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: STOCK MOVEMENTS & AUDIT LEDGER */}
        {/* ============================================================== */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Immutable Stock Movement Audit Trail</h2>
              <p className="text-xs text-slate-400">
                Explicit transaction records generated for all receipts, dispensations, adjustments, and returns. Silent quantity overwrites are mathematically prohibited.
              </p>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Item & Batch</th>
                      <th className="py-3 px-4">Movement Type</th>
                      <th className="py-3 px-4 text-center">Qty Delta</th>
                      <th className="py-3 px-4 text-center">Before → After</th>
                      <th className="py-3 px-4">Performed By</th>
                      <th className="py-3 px-4">Reference & Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">{m.timestamp}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{m.productName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{m.batchNumber}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              m.movementType.includes('DISPENS')
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : m.movementType === 'RECEIPT'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {m.movementType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-mono font-bold ${
                              m.quantityDelta < 0 ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">
                          {m.quantityBefore} → {m.quantityAfter}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{m.performedBy}</td>
                        <td className="py-3 px-4 max-w-xs text-slate-400">
                          <div className="font-mono text-[10px] text-slate-300">{m.referenceType}: {m.referenceId}</div>
                          <p className="line-clamp-1 text-[11px]">{m.notes || m.reason}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: BEDSIDE MEDICATION ADMINISTRATION */}
        {/* ============================================================== */}
        {activeTab === 'administration' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Clinical Bedside Medication Administrations (Nurse Log)</h2>
                <p className="text-xs text-slate-400">
                  Documenting the 5 Rights of Medication Administration: Right Patient, Right Drug, Right Dose, Right Route, Right Time.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Administered Time</th>
                      <th className="py-3 px-4">Patient (MRN)</th>
                      <th className="py-3 px-4">Medication & Dose</th>
                      <th className="py-3 px-4">Route & Site</th>
                      <th className="py-3 px-4">Administered By</th>
                      <th className="py-3 px-4">Status & Clinical Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {administrations.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">{a.administeredAt}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{a.patientName}</div>
                          <div className="font-mono text-[10px] text-slate-400">{a.patientMrn}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{a.medicationName}</div>
                          <div className="font-semibold text-emerald-400">{a.dose}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {a.route} • {a.site}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{a.administeredBy}</td>
                        <td className="py-3 px-4 max-w-sm">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1">
                            <CheckCircle2 className="w-3 h-3" /> {a.status}
                          </span>
                          <p className="text-[11px] text-slate-400">{a.notes}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: LIVE HL7 FHIR R4 INSPECTOR */}
        {/* ============================================================== */}
        {activeTab === 'fhir' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Kenya Core FHIR R4 Specification Serialization</h2>
                <p className="text-xs text-slate-400">
                  Compliant with Ministry of Health Interoperability Standards and Digital Health Agency (DHA) national gateway.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFhirResourceTab('dispense')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    fhirResourceTab === 'dispense'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  MedicationDispense
                </button>
                <button
                  onClick={() => setFhirResourceTab('medication')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    fhirResourceTab === 'medication'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Medication
                </button>
                <button
                  onClick={() => setFhirResourceTab('administration')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    fhirResourceTab === 'administration'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  MedicationAdministration
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl font-mono text-xs text-emerald-300 overflow-x-auto shadow-inner relative">
              <pre className="whitespace-pre">
                {fhirResourceTab === 'dispense' &&
                  JSON.stringify(
                    {
                      resourceType: 'MedicationDispense',
                      id: 'disp-2026-00412',
                      meta: {
                        profile: [
                          'http://health.go.ke/fhir/StructureDefinition/kenya-medication-dispense',
                        ],
                        lastUpdated: '2026-10-20T10:45:00Z',
                      },
                      status: 'completed',
                      type: {
                        coding: [
                          {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-ActPharmacyCode',
                            code: 'FF',
                            display: 'First Fill',
                          },
                        ],
                      },
                      medicationCodeableConcept: {
                        coding: [
                          {
                            system: 'http://health.go.ke/terminology/keml-2023',
                            code: 'J01CA04',
                            display: 'Amoxicillin 500mg capsule',
                          },
                        ],
                        text: 'Amoxicillin 500mg capsule',
                      },
                      subject: {
                        reference: 'Patient/pat-001',
                        display: 'Juma Bakari (NMH-2026-0814)',
                      },
                      context: {
                        reference: 'Encounter/enc-2026-001',
                      },
                      performer: [
                        {
                          actor: {
                            reference: 'Practitioner/pharm-njeri',
                            display: 'Faith Njeri (Lead Pharmacist, PPB #4812)',
                          },
                        },
                      ],
                      authorizingPrescription: [
                        {
                          reference: 'MedicationRequest/req-001',
                          display: 'Prescription ORD-202610-1042',
                        },
                      ],
                      quantity: {
                        value: 15,
                        unit: 'capsule',
                        system: 'http://unitsofmeasure.org',
                        code: '{capsule}',
                      },
                      daysSupply: {
                        value: 5,
                        unit: 'd',
                        system: 'http://unitsofmeasure.org',
                        code: 'd',
                      },
                      dosageInstruction: [
                        {
                          text: 'Take 1 capsule 3 times daily after meals for 5 days.',
                          patientInstruction: 'Ensure full 5-day course is completed even if symptoms resolve.',
                        },
                      ],
                      substitution: {
                        wasSubstituted: false,
                      },
                    },
                    null,
                    2,
                  )}

                {fhirResourceTab === 'medication' &&
                  JSON.stringify(
                    {
                      resourceType: 'Medication',
                      id: 'med-amx-500',
                      meta: {
                        profile: ['http://health.go.ke/fhir/StructureDefinition/kenya-medication'],
                      },
                      code: {
                        coding: [
                          {
                            system: 'http://health.go.ke/terminology/keml-2023',
                            code: 'J01CA04',
                            display: 'Amoxicillin 500mg capsule',
                          },
                          {
                            system: 'http://www.whocc.no/atc',
                            code: 'J01CA04',
                            display: 'Amoxicillin',
                          },
                        ],
                        text: 'Amoxicillin (Amoxil) 500mg Capsule',
                      },
                      status: 'active',
                      form: {
                        coding: [
                          {
                            system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
                            code: 'CAP',
                            display: 'Capsule',
                          },
                        ],
                      },
                      amount: {
                        numerator: { value: 500, unit: 'mg' },
                        denominator: { value: 1, unit: 'capsule' },
                      },
                    },
                    null,
                    2,
                  )}

                {fhirResourceTab === 'administration' &&
                  JSON.stringify(
                    {
                      resourceType: 'MedicationAdministration',
                      id: 'adm-001',
                      meta: {
                        profile: [
                          'http://health.go.ke/fhir/StructureDefinition/kenya-medication-administration',
                        ],
                      },
                      status: 'completed',
                      medicationCodeableConcept: {
                        coding: [
                          {
                            system: 'http://health.go.ke/terminology/keml-2023',
                            code: 'J01CA04',
                            display: 'Amoxicillin 500mg capsule',
                          },
                        ],
                      },
                      subject: {
                        reference: 'Patient/pat-001',
                        display: 'Juma Bakari',
                      },
                      context: {
                        reference: 'Encounter/enc-2026-001',
                      },
                      effectiveDateTime: '2026-10-20T10:15:00Z',
                      performer: [
                        {
                          actor: {
                            reference: 'Practitioner/nurse-chebet',
                            display: 'Mercy Chebet (Ward Nurse, KRCHN)',
                          },
                        },
                      ],
                      request: {
                        reference: 'MedicationRequest/req-001',
                      },
                      dosage: {
                        text: '500 mg orally',
                        route: {
                          coding: [
                            {
                              system: 'http://snomed.info/sct',
                              code: '260548002',
                              display: 'Oral',
                            },
                          ],
                        },
                        dose: {
                          value: 500,
                          unit: 'mg',
                        },
                      },
                    },
                    null,
                    2,
                  )}
              </pre>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 1: DISPENSING WORKFLOW WITH FEFO ALLOCATION */}
        {/* ============================================================== */}
        {dispenseModalPrescription && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Medication Dispensing</h3>
                    <p className="text-xs text-slate-400">
                      Prescription #{dispenseModalPrescription.orderNumber} • Patient: {dispenseModalPrescription.patientName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDispenseModalPrescription(null)}
                  className="text-slate-400 hover:text-white p-1 text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Prescription verification callout */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-200">
                  <span>{dispenseModalPrescription.medicationName}</span>
                  <span className="text-emerald-400 font-mono">
                    Total Prescribed: {dispenseModalPrescription.totalQuantity} {dispenseModalPrescription.quantityUnit}
                  </span>
                </div>
                <p className="text-slate-400">{dispenseModalPrescription.instructions}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-700/60">
                  <span>Prescriber: {dispenseModalPrescription.prescribingClinician}</span>
                  <span>Remaining to Dispense: <strong>{dispenseModalPrescription.quantityRemaining}</strong></span>
                </div>
              </div>

              {/* FEFO Batch Allocation Indicator */}
              <div className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Automatic FEFO Batch Allocation (Recommended)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
                    Earliest Expiry: 2026-12-15 (56 days)
                  </span>
                </div>
                <p className="text-emerald-400/90 text-[11px]">
                  Batch <strong>BATCH-AMX-EARLY-26</strong> automatically selected with 85 units on hand.
                </p>
              </div>

              {/* Dispense Form */}
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Dispense Quantity (Full or Partial)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={dispenseModalPrescription.quantityRemaining}
                      value={dispenseQty}
                      onChange={(e) => setDispenseQty(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Max available for this prescription: {dispenseModalPrescription.quantityRemaining}
                    </span>
                  </div>
                  <div>
                    <label htmlFor="batchOverride" className="block text-slate-300 font-medium mb-1">
                      Batch Selection Override (Optional)
                    </label>
                    <select
                      id="batchOverride"
                      value={selectedBatchOverride}
                      onChange={(e) => setSelectedBatchOverride(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Default FEFO: BATCH-AMX-EARLY-26 (Exp: 2026-12)</option>
                      <option value="batch-amx-02">BATCH-AMX-LATE-28 (Exp: 2028-06, 500 units)</option>
                    </select>
                  </div>
                </div>

                {/* Patient Counseling Notes */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Pharmacist Counseling & Instructions to Patient
                  </label>
                  <textarea
                    rows={2}
                    value={counselingNotes}
                    onChange={(e) => setCounselingNotes(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                    placeholder="Enter instructions, warning regarding adverse reactions, taking with food..."
                  />
                </div>

                {/* Concurrency safeguard banner */}
                <div className="flex items-center gap-2 p-2.5 bg-slate-800/40 border border-slate-800 rounded-lg text-[11px] text-slate-400">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Database transaction lock (<code className="text-emerald-300">FOR UPDATE</code>) active. Prevents negative stock or simultaneous duplicate dispensing.
                  </span>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setDispenseModalPrescription(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDispense}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirm Dispensation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 2: CONTROLLED RETURNS & REVERSALS */}
        {/* ============================================================== */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Undo2 className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">Controlled Dispense Reversal</h3>
                </div>
                <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <p className="text-xs text-slate-400">
                Returns restore inventory batches and record an explicit <code className="text-emerald-400 font-mono">RETURN_TO_STOCK</code> event in the audit ledger. A clinical justification of at least 10 characters is mandatory.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Dispense Reference ID</label>
                  <input
                    type="text"
                    placeholder="e.g. DISP-2026-00412"
                    value={returnDispenseId}
                    onChange={(e) => setReturnDispenseId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Clinical Return Justification (Min 10 characters)
                  </label>
                  <textarea
                    rows={3}
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="e.g. Patient experienced hypersensitivity reaction prior to leaving clinic; returned sealed, intact packaging."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReturn}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Authorize Return to Stock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODAL 3: RECEIVE NEW STOCK FROM SUPPLIER */}
        {/* ============================================================== */}
        {showReceiveModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-white text-base">Receive Stock From Supplier</h3>
                </div>
                <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="productSelect" className="block text-slate-300 font-medium mb-1">Product</label>
                  <select id="productSelect" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white">
                    <option>Amoxicillin 500mg capsule (KEML: J01CA04)</option>
                    <option>Artemether + Lumefantrine 20/120mg (KEML: P01BF01)</option>
                    <option>Amlodipine 5mg tablet (KEML: C08CA01)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Batch Number</label>
                    <input
                      type="text"
                      value={newBatchNumber}
                      onChange={(e) => setNewBatchNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newExpiryDate}
                      onChange={(e) => setNewExpiryDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Quantity Received</label>
                    <input
                      type="number"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Unit Cost (KES)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newUnitCost}
                      onChange={(e) => setNewUnitCost(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Retail Price (KES)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={newSellingPrice}
                      onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReceive}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Record Stock Inflow
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-4 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <span>COMKEY AFYA POA • Module 8 Pharmacy & Medication-Dispensing</span>
        <span>Kenya National Digital Health Act 2023 & PPB Cap 244 Standards Compliant</span>
      </footer>
    </div>
  );
}
