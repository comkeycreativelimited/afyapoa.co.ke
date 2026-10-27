'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  DollarSign,
  Receipt,
  QrCode,
  Clock,
  Smartphone,
  ShieldCheck,
  Printer,
} from 'lucide-react';
import {
  Button,
  Badge,
  StatusBadge,
  ClinicalAlert,
  InputField,
  AccessibleTable,
  AccessibleDialog,
} from '@afyapoa/ui';
import { useTranslation } from '../../contexts/I18nContext';
import { useRoleContext } from '../../contexts/RoleContext';

interface InvoiceItem {
  id: string;
  category: 'CONSULTATION' | 'LABORATORY' | 'PHARMACY' | 'PROCEDURE' | 'CONSUMABLE';
  description: string;
  quantity: number;
  unitPriceKes: number;
  totalPriceKes: number;
  shaCovered: boolean;
  shaCoveredKes: number;
  patientPayableKes: number;
}

interface PatientInvoice {
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  encounterId: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  issueDate: string;
  items: InvoiceItem[];
  totalKes: number;
  totalShaCoveredKes: number;
  netPayableKes: number;
  paidKes: number;
  paymentMethod?: 'MPESA' | 'CASH' | 'INSURANCE' | 'SPLIT';
  mpesaRef?: string;
  etimsControlCode?: string;
  etimsQrUrl?: string;
  fiscalizedAt?: string;
}

export default function BillingPage() {
  const { t } = useTranslation();
  const { userName, facilityName } = useRoleContext();

  // Shift state
  const [shiftCollected] = useState(48650);

  // Invoices mock
  const [invoices, setInvoices] = useState<PatientInvoice[]>([
    {
      invoiceNumber: 'INV-202610-0412',
      patientId: 'p-101',
      patientName: 'Amina Fatuma Bakari',
      patientMrn: 'MRN-202610-0012',
      encounterId: 'ENC-202610-0089',
      status: 'PENDING',
      issueDate: '2026-10-26 14:15',
      items: [
        {
          id: 'item-1',
          category: 'CONSULTATION',
          description: 'Outpatient General Clinician Consultation (Level 5)',
          quantity: 1,
          unitPriceKes: 500,
          totalPriceKes: 500,
          shaCovered: true,
          shaCoveredKes: 500,
          patientPayableKes: 0,
        },
        {
          id: 'item-2',
          category: 'LABORATORY',
          description: 'Full Blood Count / Haemogram (FBC) & Malaria Giemsa Stain',
          quantity: 1,
          unitPriceKes: 1200,
          totalPriceKes: 1200,
          shaCovered: true,
          shaCoveredKes: 1000,
          patientPayableKes: 200,
        },
        {
          id: 'item-3',
          category: 'PHARMACY',
          description: 'Amoxicillin + Clavulanic Acid (Augmentin 625mg) 14 tabs',
          quantity: 1,
          unitPriceKes: 1400,
          totalPriceKes: 1400,
          shaCovered: true,
          shaCoveredKes: 1100,
          patientPayableKes: 300,
        },
        {
          id: 'item-4',
          category: 'PHARMACY',
          description: 'Paracetamol Tablets 500mg (20 tablets)',
          quantity: 1,
          unitPriceKes: 150,
          totalPriceKes: 150,
          shaCovered: false,
          shaCoveredKes: 0,
          patientPayableKes: 150,
        },
      ],
      totalKes: 3250,
      totalShaCoveredKes: 2600,
      netPayableKes: 650,
      paidKes: 0,
    },
    {
      invoiceNumber: 'INV-202610-0409',
      patientId: 'p-102',
      patientName: 'David Kiprono Kipkorir',
      patientMrn: 'MRN-202610-0015',
      encounterId: 'ENC-202610-0092',
      status: 'PAID',
      issueDate: '2026-10-26 13:50',
      items: [
        {
          id: 'item-10',
          category: 'CONSULTATION',
          description: 'Outpatient Clinical Consultation',
          quantity: 1,
          unitPriceKes: 500,
          totalPriceKes: 500,
          shaCovered: true,
          shaCoveredKes: 500,
          patientPayableKes: 0,
        },
        {
          id: 'item-11',
          category: 'LABORATORY',
          description: 'GeneXpert MTB/RIF Sputum Assay (National TB Program)',
          quantity: 1,
          unitPriceKes: 2500,
          totalPriceKes: 2500,
          shaCovered: true,
          shaCoveredKes: 2500,
          patientPayableKes: 0,
        },
      ],
      totalKes: 3000,
      totalShaCoveredKes: 3000,
      netPayableKes: 0,
      paidKes: 0,
      paymentMethod: 'INSURANCE',
      mpesaRef: 'SHA-PHC-100409',
      etimsControlCode: 'KRA-ETIMS-00101-2026-898124',
      fiscalizedAt: '2026-10-26 13:55:12',
    },
  ]);

  // Selected invoice
  const [selectedInvoice, setSelectedInvoice] = useState<PatientInvoice>(invoices[0]!);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'MPESA' | 'CASH' | 'INSURANCE'>('MPESA');
  const [phoneNumber, setPhoneNumber] = useState('254712345678');
  const [cashTendered, setCashTendered] = useState<string>('1000');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentReceiptOpen, setPaymentReceiptOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleProcessPayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      const mpesaRef = `QBK${Math.floor(100000 + Math.random() * 900000)}KE`;
      const etimsControlCode = `KRA-ETIMS-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const updated = {
        ...selectedInvoice,
        status: 'PAID' as const,
        paidKes: selectedInvoice.netPayableKes,
        paymentMethod: paymentMode,
        mpesaRef,
        etimsControlCode,
        fiscalizedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      };

      setInvoices((prev) => prev.map((inv) => (inv.invoiceNumber === updated.invoiceNumber ? updated : inv)));
      setSelectedInvoice(updated);
      setPaymentModalOpen(false);
      setPaymentReceiptOpen(true);
      setSuccessNotice(`Payment of KES ${updated.netPayableKes} processed & eTIMS fiscalized successfully!`);
    }, 1800);
  };

  const cashChange =
    parseFloat(cashTendered) > selectedInvoice.netPayableKes
      ? (parseFloat(cashTendered) - selectedInvoice.netPayableKes).toFixed(2)
      : '0.00';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Shift Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-purple-500/10 text-purple-600 rounded-lg border border-purple-500/20">
              <CreditCard className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('nav.billing', 'Patient Billing, Cashier & eTIMS Receipting')}
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            KRA eTIMS Fiscal Compliance (Sec 23A) • M-Pesa C2B / STK Integration • SHA Tariffs Co-Pay
          </p>
        </div>

        {/* Shift Status Cards */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
            <div className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span>Shift Status:</span>
            </div>
            <div className="font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>OPEN (Cashier: {userName})</span>
            </div>
          </div>

          <div className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm text-xs">
            <div className="text-slate-500">Total Shift Receipts:</div>
            <div className="font-bold text-slate-900 font-mono text-sm mt-0.5">
              KES {shiftCollected.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {successNotice && (
        <ClinicalAlert
          severity="success"
          title="Payment & Fiscalization Confirmed"
          message={successNotice}
          onDismiss={() => setSuccessNotice(null)}
        />
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Invoices List (5 cols) */}
        <section
          aria-label="Pending and Recent Invoices"
          className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Encounter Invoices</h2>
              <p className="text-xs text-slate-500">Consolidated clinician, lab, and pharmacy fees</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {invoices.length} Invoices
            </span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Invoices Registry List"
            className="divide-y divide-slate-100 overflow-y-auto max-h-[600px]"
          >
            {invoices.map((inv) => {
              const isSelected = inv.invoiceNumber === selectedInvoice.invoiceNumber;
              return (
                <div
                  key={inv.invoiceNumber}
                  onClick={() => setSelectedInvoice(inv)}
                  className={`p-4 transition cursor-pointer flex flex-col space-y-2 hover:bg-slate-50 ${
                    isSelected ? 'bg-purple-50/60 border-l-4 border-l-purple-600' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{inv.patientName}</span>
                        <span className="font-mono text-xs text-slate-500">{inv.patientMrn}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Inv: <strong className="font-mono">{inv.invoiceNumber}</strong> • {inv.issueDate}
                      </div>
                    </div>

                    <StatusBadge status={inv.status} />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <div>
                      <span className="text-slate-500">Total: </span>
                      <span className="font-mono font-bold text-slate-700">
                        KES {inv.totalKes.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Payable: </span>
                      <span className="font-mono font-bold text-purple-700 text-sm">
                        KES {inv.netPayableKes.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Invoice Details, Itemization & Payment Actions (7 cols) */}
        <section
          aria-label="Invoice Details and Payment Settlement"
          className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">{selectedInvoice.invoiceNumber}</h2>
                <StatusBadge status={selectedInvoice.status} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Patient: <strong>{selectedInvoice.patientName}</strong> ({selectedInvoice.patientMrn}) •
                Encounter: <span className="font-mono">{selectedInvoice.encounterId}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedInvoice.status === 'PAID' ? (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Printer className="w-3.5 h-3.5" />}
                  onClick={() => setPaymentReceiptOpen(true)}
                  className="text-xs h-8"
                >
                  View Receipt
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<DollarSign className="w-3.5 h-3.5" />}
                  onClick={() => setPaymentModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 px-4"
                >
                  Collect KES {selectedInvoice.netPayableKes.toLocaleString()}
                </Button>
              )}
            </div>
          </div>

          {/* Itemized Services Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-purple-600" aria-hidden="true" />
              <span>Itemized Medical Services & Tariffs</span>
            </h3>

            <AccessibleTable caption="Itemized Invoice Breakdown">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th scope="col" className="p-3 text-left font-bold text-slate-700">Service Description</th>
                  <th scope="col" className="p-3 text-center font-bold text-slate-700">Qty</th>
                  <th scope="col" className="p-3 text-right font-bold text-slate-700">Gross (KES)</th>
                  <th scope="col" className="p-3 text-right font-bold text-slate-700">SHA Benefit</th>
                  <th scope="col" className="p-3 text-right font-bold text-slate-700">Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selectedInvoice.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <div className="font-semibold text-slate-900">{item.description}</div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">{item.quantity}</td>
                    <td className="p-3 text-right font-mono text-slate-700">
                      {item.totalPriceKes.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-700 font-medium">
                      -{item.shaCoveredKes.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-purple-700">
                      {item.patientPayableKes.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AccessibleTable>
          </div>

          {/* Calculation Summary Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Gross Total Tariff Amount:</span>
              <span className="font-mono font-semibold">KES {selectedInvoice.totalKes.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Social Health Authority (SHA) Scheme Subsidy:</span>
              <span className="font-mono font-bold">
                -KES {selectedInvoice.totalShaCoveredKes.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
              <span>Net Patient Co-Pay Payable:</span>
              <span className="font-mono text-purple-700 text-base">
                KES {selectedInvoice.netPayableKes.toLocaleString()}
              </span>
            </div>
          </div>

          {/* eTIMS Compliance Verification Badge */}
          {selectedInvoice.etimsControlCode && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1 text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-2">
                  <span>KRA eTIMS Fiscal Electronic Receipt Verified</span>
                  <Badge variant="success" size="sm">Section 23A Compliant</Badge>
                </div>
                <div className="text-emerald-800 font-mono">
                  Control Code: <strong>{selectedInvoice.etimsControlCode}</strong>
                </div>
                <div className="text-slate-600 text-[11px]">
                  Fiscal Signature generated at {selectedInvoice.fiscalizedAt}. Non-repudiation verified.
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Collect Payment Dialog */}
      <AccessibleDialog
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Settle Invoice & Process Fiscal Payment"
        description={`Amount Due: KES ${selectedInvoice.netPayableKes.toLocaleString()} for ${selectedInvoice.patientName}`}
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={isProcessingPayment}
              onClick={handleProcessPayment}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              {paymentMode === 'MPESA' ? 'Trigger M-Pesa STK Push' : 'Confirm Cash Receipt'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('MPESA')}
              className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition ${
                paymentMode === 'MPESA'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>M-Pesa STK</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('CASH')}
              className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition ${
                paymentMode === 'CASH'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-5 h-5 text-slate-700" />
              <span>Cash</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('INSURANCE')}
              className={`p-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition ${
                paymentMode === 'INSURANCE'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Insurance Co-Pay</span>
            </button>
          </div>

          {paymentMode === 'MPESA' && (
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <InputField
                label="M-Pesa Mobile Number"
                id="phoneNumber"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                helperText="A prompt will be sent to the patient's handset to enter PIN."
                required
              />
            </div>
          )}

          {paymentMode === 'CASH' && (
            <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <InputField
                label="Cash Amount Tendered (KES)"
                id="cashTendered"
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                required
              />
              <div className="flex justify-between items-center text-xs font-bold p-2 bg-emerald-50 rounded border border-emerald-200 text-emerald-900">
                <span>Calculated Change to Return:</span>
                <span className="text-sm font-mono font-extrabold">KES {cashChange}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-700 shrink-0" />
            <span>
              Invoice will automatically be cryptographically signed by the KRA eTIMS VSCU module upon confirmation.
            </span>
          </div>
        </div>
      </AccessibleDialog>

      {/* Official Fiscal Receipt Dialog */}
      <AccessibleDialog
        isOpen={paymentReceiptOpen}
        onClose={() => setPaymentReceiptOpen(false)}
        title="Official Fiscal Tax Invoice Receipt (KRA eTIMS)"
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              leftIcon={<Printer className="w-3.5 h-3.5" />}
              onClick={() => window.print()}
            >
              Print Receipt
            </Button>
            <Button variant="primary" onClick={() => setPaymentReceiptOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="p-4 bg-white border border-slate-300 rounded-lg text-slate-800 space-y-4 font-mono text-xs">
          <div className="text-center pb-3 border-b border-dashed border-slate-300 space-y-1">
            <div className="font-bold text-sm text-slate-900">{facilityName}</div>
            <div>P.O. BOX 1001-00100 NAIROBI • TEL: +254 20 890000</div>
            <div>KRA PIN: P051234567Z • MFL CODE: 12345</div>
            <div className="font-bold uppercase pt-1 text-slate-900">ELECTRONIC FISCAL TAX INVOICE</div>
          </div>

          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
            <div>INVOICE NO: {selectedInvoice.invoiceNumber}</div>
            <div>RECEIPT DATE: {selectedInvoice.fiscalizedAt || '2026-10-26 14:20:00'}</div>
            <div>CASHIER: {userName}</div>
            <div>PATIENT: {selectedInvoice.patientName} ({selectedInvoice.patientMrn})</div>
            <div>PAYMENT MODE: {selectedInvoice.paymentMethod} (REF: {selectedInvoice.mpesaRef})</div>
          </div>

          <div className="space-y-1 border-b border-dashed border-slate-300 pb-2">
            {selectedInvoice.items.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span className="truncate max-w-[200px]">{item.description}</span>
                <span>KES {item.patientPayableKes.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 font-bold text-slate-900 text-sm">
            <div className="flex justify-between">
              <span>TOTAL PAID:</span>
              <span>KES {selectedInvoice.netPayableKes.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 text-center border-t border-dashed border-slate-300 space-y-1">
            <div className="text-[10px] text-slate-500">eTIMS CONTROL CODE:</div>
            <div className="font-bold text-[11px] text-slate-900">{selectedInvoice.etimsControlCode}</div>
            <div className="p-3 bg-slate-100 rounded inline-block my-2 border border-slate-200">
              <QrCode className="w-20 h-20 text-slate-800 mx-auto" />
              <div className="text-[9px] text-slate-500 mt-1">Scan to verify at kra.go.ke</div>
            </div>
            <div className="text-[10px] text-slate-500">
              Thank you for trusting us with your health. Afya Poa!
            </div>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  );
}
