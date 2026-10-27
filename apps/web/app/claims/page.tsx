'use client';

import React, { useState } from 'react';
import {
  FileCheck2,
  Clock,
  AlertTriangle,
  Send,
} from 'lucide-react';
import {
  Button,
  Badge,
  StatusBadge,
  ClinicalAlert,
  AccessibleTable,
  AccessibleDialog,
} from '@afyapoa/ui';
import { useTranslation } from '../../contexts/I18nContext';

interface ShaClaim {
  id: string;
  claimNumber: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  shaMemberNumber: string;
  fundType: 'PHC' | 'SHIF' | 'ECCIF' | 'PRIVATE_INSURANCE';
  insurerName?: string;
  encounterId: string;
  diagnosisIcd11: string;
  diagnosisDescription: string;
  totalClaimAmountKes: number;
  approvedAmountKes?: number;
  status:
    | 'DRAFT'
    | 'VALIDATED'
    | 'QUEUED'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'APPROVED'
    | 'QUERIED'
    | 'REJECTED';
  preAuthCode?: string;
  dischargeTimestamp: string;
  hoursRemainingSla: number;
  queryReason?: string;
}

export default function ClaimsPage() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'SUBMITTED' | 'QUERIED'>('ALL');
  const [claimsList, setClaimsList] = useState<ShaClaim[]>([
    {
      id: 'cl-01',
      claimNumber: 'CLM-SHA-202610-0089',
      patientId: 'p-101',
      patientName: 'Amina Fatuma Bakari',
      patientMrn: 'MRN-202610-0012',
      shaMemberNumber: 'SHA-KE-1995-123456',
      fundType: 'SHIF',
      encounterId: 'ENC-202610-0089',
      diagnosisIcd11: '1F40.0',
      diagnosisDescription: 'Plasmodium falciparum malaria without complications',
      totalClaimAmountKes: 2600,
      status: 'QUEUED',
      preAuthCode: 'SHA-PA-2026-9901',
      dischargeTimestamp: '2026-10-26 14:15',
      hoursRemainingSla: 22,
    },
    {
      id: 'cl-02',
      claimNumber: 'CLM-SHA-202610-0099',
      patientId: 'p-103',
      patientName: 'EMERGENCY TRAUMA UNKNOWN-MALE-A8K2Z',
      patientMrn: 'MRN-202610-0099',
      shaMemberNumber: 'ECCIF-EMERGENCY-AUTH',
      fundType: 'ECCIF',
      encounterId: 'ENC-202610-0099',
      diagnosisIcd11: 'NA07.0',
      diagnosisDescription: 'Blunt chest trauma with multiple rib fractures and contusion',
      totalClaimAmountKes: 18500,
      status: 'VALIDATED',
      preAuthCode: 'ECCIF-AUTH-9902',
      dischargeTimestamp: '2026-10-26 14:10',
      hoursRemainingSla: 18,
    },
    {
      id: 'cl-03',
      claimNumber: 'CLM-SHA-202610-0071',
      patientId: 'p-102',
      patientName: 'David Kiprono Kipkorir',
      patientMrn: 'MRN-202610-0015',
      shaMemberNumber: 'SHA-KE-1992-778899',
      fundType: 'PHC',
      encounterId: 'ENC-202610-0092',
      diagnosisIcd11: '1B10.0',
      diagnosisDescription: 'Respiratory tuberculosis confirmed by sputum GeneXpert assay',
      totalClaimAmountKes: 3000,
      approvedAmountKes: 3000,
      status: 'APPROVED',
      dischargeTimestamp: '2026-10-26 12:00',
      hoursRemainingSla: 0,
    },
    {
      id: 'cl-04',
      claimNumber: 'CLM-SHA-202610-0062',
      patientId: 'p-104',
      patientName: 'Faith Wangari Mwangi',
      patientMrn: 'MRN-202610-0044',
      shaMemberNumber: 'SHA-KE-1988-554433',
      fundType: 'SHIF',
      encounterId: 'ENC-202610-0104',
      diagnosisIcd11: 'QA42.1',
      diagnosisDescription: 'Routine antenatal care and obstetric ultrasound (Second Trimester)',
      totalClaimAmountKes: 4500,
      status: 'QUERIED',
      preAuthCode: 'SHA-PA-2026-8812',
      dischargeTimestamp: '2026-10-26 09:30',
      hoursRemainingSla: 19,
      queryReason: 'Adjudicator note: Please attach obstetric ultrasound report and verified sonographer license.',
    },
  ]);

  const [selectedClaim, setSelectedClaim] = useState<ShaClaim | null>(claimsList[0] || null);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [actionAlert, setActionAlert] = useState<string | null>(null);

  const filteredClaims = claimsList.filter((c) => {
    if (activeTab === 'PENDING') return c.status === 'VALIDATED' || c.status === 'QUEUED';
    if (activeTab === 'SUBMITTED') return c.status === 'SUBMITTED' || c.status === 'APPROVED';
    if (activeTab === 'QUERIED') return c.status === 'QUERIED' || c.status === 'REJECTED';
    return true;
  });

  const handleDispatchBatch = () => {
    setIsSubmittingBatch(true);
    setTimeout(() => {
      setIsSubmittingBatch(false);
      setClaimsList((prev) =>
        prev.map((c) =>
          c.status === 'QUEUED' || c.status === 'VALIDATED'
            ? { ...c, status: 'SUBMITTED' }
            : c,
        ),
      );
      setActionAlert('Active batch of 2 claims dispatched to SHA Claims Gateway successfully.');
    }, 2000);
  };

  const handleResolveQuery = () => {
    if (!selectedClaim) return;
    setClaimsList((prev) =>
      prev.map((c) =>
        c.id === selectedClaim.id
          ? {
              ...c,
              status: 'SUBMITTED',
              queryReason: undefined,
            }
          : c,
      ),
    );
    setQueryModalOpen(false);
    setActionAlert(`Query answered for ${selectedClaim.claimNumber}. Re-submitted to SHA.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-cyan-500/10 text-cyan-600 rounded-lg border border-cyan-500/20">
              <FileCheck2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('nav.claims', 'Social Health Authority (SHA) eClaims & Health Insurance')}
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Social Health Insurance Act 2023 • PHC Capitation • SHIF FFS • ECCIF Critical Care • 24h SLA
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            isLoading={isSubmittingBatch}
            onClick={handleDispatchBatch}
            leftIcon={<Send className="w-3.5 h-3.5" />}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9"
          >
            Dispatch SHA Batch (
            {claimsList.filter((c) => c.status === 'QUEUED' || c.status === 'VALIDATED').length})
          </Button>
        </div>
      </div>

      {actionAlert && (
        <ClinicalAlert
          severity="success"
          title="SHA Gateway Status"
          message={actionAlert}
          onDismiss={() => setActionAlert(null)}
        />
      )}

      {/* SLA Statutory 24-Hour Countdown Alert Banner */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-amber-900">
        <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs space-y-1">
          <div className="font-bold text-amber-950 flex items-center gap-2">
            <span>Kenyan Social Health Insurance Regulation 24-Hour Statutory Claim SLA</span>
            <Badge variant="warning" size="sm">Mandatory</Badge>
          </div>
          <p className="text-amber-800 leading-relaxed">
            All clinical encounters and hospital discharges must be validated and transmitted to the SHA eClaims switch
            within 24 hours of encounter completion to prevent automatic payment rejection.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'ALL'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          All Claims ({claimsList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PENDING')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'PENDING'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Pending Dispatch ({claimsList.filter((c) => c.status === 'VALIDATED' || c.status === 'QUEUED').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('QUERIED')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'QUERIED'
              ? 'border-red-600 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Queried / Queries Required ({claimsList.filter((c) => c.status === 'QUERIED').length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('SUBMITTED')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'SUBMITTED'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Dispatched & Approved ({claimsList.filter((c) => c.status === 'SUBMITTED' || c.status === 'APPROVED').length})
        </button>
      </div>

      {/* Main Claims Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <AccessibleTable caption="SHA Electronic Claims Management Registry">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
            <tr>
              <th scope="col" className="p-3 text-left font-bold">Claim ID & Patient</th>
              <th scope="col" className="p-3 text-left font-bold">SHA Fund Pillar</th>
              <th scope="col" className="p-3 text-left font-bold">Diagnosis (ICD-11)</th>
              <th scope="col" className="p-3 text-right font-bold">Amount (KES)</th>
              <th scope="col" className="p-3 text-center font-bold">24h SLA</th>
              <th scope="col" className="p-3 text-center font-bold">Status</th>
              <th scope="col" className="p-3 text-center font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredClaims.map((claim) => (
              <tr key={claim.id} className="hover:bg-slate-50/60 transition">
                <td className="p-3">
                  <div className="font-bold text-slate-900">{claim.patientName}</div>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {claim.claimNumber} • {claim.patientMrn}
                  </div>
                  <div className="text-slate-600 text-[10px] font-medium">Mem: {claim.shaMemberNumber}</div>
                </td>

                <td className="p-3">
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                      claim.fundType === 'ECCIF'
                        ? 'bg-red-50 text-red-800 border-red-300'
                        : claim.fundType === 'SHIF'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {claim.fundType}
                  </span>
                  {claim.preAuthCode && (
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                      PA: {claim.preAuthCode}
                    </div>
                  )}
                </td>

                <td className="p-3">
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1 rounded">
                    {claim.diagnosisIcd11}
                  </span>
                  <div className="text-slate-600 text-[11px] truncate max-w-[200px] mt-0.5">
                    {claim.diagnosisDescription}
                  </div>
                </td>

                <td className="p-3 text-right font-mono font-bold text-slate-900">
                  KES {claim.totalClaimAmountKes.toLocaleString()}
                </td>

                <td className="p-3 text-center">
                  {claim.hoursRemainingSla > 0 ? (
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded ${
                        claim.hoursRemainingSla < 6
                          ? 'bg-red-100 text-red-800 animate-pulse'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {claim.hoursRemainingSla}h left
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold text-[11px]">SLA Met</span>
                  )}
                </td>

                <td className="p-3 text-center">
                  <StatusBadge status={claim.status} />
                </td>

                <td className="p-3 text-center">
                  {claim.status === 'QUERIED' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      className="text-xs h-7 px-2.5 font-bold"
                      onClick={() => {
                        setSelectedClaim(claim);
                        setQueryModalOpen(true);
                      }}
                    >
                      Resolve Query
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2"
                      onClick={() => setSelectedClaim(claim)}
                    >
                      View
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AccessibleTable>
      </div>

      {/* Query Resolution Dialog */}
      <AccessibleDialog
        isOpen={queryModalOpen}
        onClose={() => setQueryModalOpen(false)}
        title={`Resolve SHA Adjudicator Query (${selectedClaim?.claimNumber})`}
        description={selectedClaim?.queryReason}
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setQueryModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleResolveQuery} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
              Submit Query Response & Evidence
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>SHA Adjudication Query Note</span>
            </div>
            <p>{selectedClaim?.queryReason}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="resolutionNote" className="block text-xs font-semibold text-slate-800">
              Clinical & Administrative Clarification
            </label>
            <textarea
              id="resolutionNote"
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Attached verified ultrasound report signed by Dr. Karanja..."
              className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <span>Supporting document attached: </span>
            <strong className="text-slate-900 font-mono">SONO_SCAN_20261026_US.PDF (1.2 MB)</strong>
          </div>
        </div>
      </AccessibleDialog>
    </div>
  );
}
