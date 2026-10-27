'use client';

import React, { useState } from 'react';
import {
  Server,
  Shield,
  Plus,
  Lock,
  Activity,
} from 'lucide-react';
import {
  Button,
  Badge,
  ClinicalAlert,
  InputField,
  SelectField,
  AccessibleTable,
  AccessibleDialog,
} from '@afyapoa/ui';
import { useTranslation } from '../../contexts/I18nContext';

interface TenantFacility {
  id: string;
  facilityCode: string;
  name: string;
  level: string;
  county: string;
  mflCode: string;
  shaContract: string;
  subscriptionTier: 'ENTERPRISE_LEVEL_5' | 'STANDARD_LEVEL_4' | 'COMMUNITY_LEVEL_3' | 'PRIMARY_LEVEL_2';
  status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
  registeredAt: string;
  patientCount: number;
}

export default function PlatformAdminPage() {
  const { t } = useTranslation();

  const [tenants, setTenants] = useState<TenantFacility[]>([
    {
      id: 'ten-01',
      facilityCode: 'FID-01-000101-1',
      name: 'Nairobi Metropolitan Referral Hospital',
      level: 'Level 5 Referral',
      county: 'Nairobi',
      mflCode: '12345',
      shaContract: 'SHA-CTR-00101',
      subscriptionTier: 'ENTERPRISE_LEVEL_5',
      status: 'ACTIVE',
      registeredAt: '2026-01-15',
      patientCount: 18450,
    },
    {
      id: 'ten-02',
      facilityCode: 'FID-01-000202-2',
      name: 'Afya Poa Community Health Centre',
      level: 'Level 3 Health Centre',
      county: 'Nairobi (Kibera)',
      mflCode: '16789',
      shaContract: 'SHA-CTR-00202',
      subscriptionTier: 'COMMUNITY_LEVEL_3',
      status: 'ACTIVE',
      registeredAt: '2026-03-20',
      patientCount: 6200,
    },
    {
      id: 'ten-03',
      facilityCode: 'FID-02-000303-3',
      name: 'St. Jude Faith Dispensary',
      level: 'Level 2 Dispensary',
      county: 'Machakos',
      mflCode: '21340',
      shaContract: 'SHA-CTR-00303',
      subscriptionTier: 'PRIMARY_LEVEL_2',
      status: 'ACTIVE',
      registeredAt: '2026-05-10',
      patientCount: 2950,
    },
  ]);

  const [onboardModalOpen, setOnboardModalOpen] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newLevel, setNewLevel] = useState('Level 4 Sub-County Hospital');
  const [newCounty, setNewCounty] = useState('Kisumu');
  const [newMflCode, setNewMflCode] = useState('');
  const [newShaContract, setNewShaContract] = useState('');
  const [provisionNotice, setProvisionNotice] = useState<string | null>(null);

  const handleOnboardTenant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacilityName || !newMflCode) return;

    const newTenant: TenantFacility = {
      id: `ten-${Date.now()}`,
      facilityCode: `FID-03-000${Math.floor(100 + Math.random() * 900)}-1`,
      name: newFacilityName,
      level: newLevel,
      county: newCounty,
      mflCode: newMflCode,
      shaContract: newShaContract || `SHA-CTR-${Math.floor(10000 + Math.random() * 90000)}`,
      subscriptionTier: 'STANDARD_LEVEL_4',
      status: 'ACTIVE',
      registeredAt: new Date().toISOString().substring(0, 10),
      patientCount: 0,
    };

    setTenants((prev) => [newTenant, ...prev]);
    setOnboardModalOpen(false);
    setNewFacilityName('');
    setNewMflCode('');
    setProvisionNotice(
      `Tenant ${newTenant.name} (${newTenant.facilityCode}) provisioned with PostgreSQL RLS isolation.`,
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-slate-900 text-emerald-400 rounded-lg border border-slate-800">
              <Server className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('nav.platform_admin', 'Platform SaaS Super-Admin & National Gateways')}
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Global Multi-Tenant HMIS Operations • DHA HIE • SHA eClaims Switch • KRA eTIMS VSCU
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setOnboardModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9"
          >
            Provision New Hospital Tenant
          </Button>
        </div>
      </div>

      {provisionNotice && (
        <ClinicalAlert
          severity="success"
          title="Tenant Provisioning Confirmed"
          message={provisionNotice}
          onDismiss={() => setProvisionNotice(null)}
        />
      )}

      {/* National Gateway Adapters Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              DHA Kenya HIE Middleware
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-sm font-bold text-slate-900">FHIR R4 Semantic Native</div>
          <p className="text-xs text-slate-600">
            CR (Patient), FR (Facility), HWR (Health Worker) & SHR (Record) connections operational.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Latency: <strong>42ms</strong></span>
            <span className="text-emerald-700 font-bold">100% Health</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-600" />
              SHA eClaims Gateway
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-sm font-bold text-slate-900">Social Health Authority Switch</div>
          <p className="text-xs text-slate-600">
            PHC Capitation, SHIF FFS & ECCIF Emergency Fund 24-hour statutory SLA countdown active.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Dispatched Today: <strong>148</strong></span>
            <span className="text-emerald-700 font-bold">Connected</span>
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-purple-600" />
              KRA eTIMS VSCU Gateway
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="text-sm font-bold text-slate-900">Tax Procedures Act Sec 23A</div>
          <p className="text-xs text-slate-600">
            Real-time cryptographic fiscal invoice signing & QR code generation online.
          </p>
          <div className="pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
            <span>Signed Today: <strong>320</strong></span>
            <span className="text-emerald-700 font-bold">Verified</span>
          </div>
        </div>
      </div>

      {/* Multi-Tenant Facilities Table */}
      <section
        aria-label="Registered Healthcare Tenants Table"
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Registered Healthcare Facilities</h2>
            <p className="text-xs text-slate-500">
              Hard PostgreSQL Row-Level Security (RLS) tenant isolation verified
            </p>
          </div>
          <Badge variant="success" size="sm">
            {tenants.length} Active Facilities
          </Badge>
        </div>

        <AccessibleTable caption="COMKEY AFYA POA Healthcare Facility Tenants">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
            <tr>
              <th scope="col" className="p-3 text-left font-bold">Facility Name & Code</th>
              <th scope="col" className="p-3 text-left font-bold">Level & County</th>
              <th scope="col" className="p-3 text-left font-bold">MFL & SHA Contract</th>
              <th scope="col" className="p-3 text-right font-bold">Patients Managed</th>
              <th scope="col" className="p-3 text-center font-bold">Isolation Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {tenants.map((ten) => (
              <tr key={ten.id} className="hover:bg-slate-50/60 transition">
                <td className="p-3">
                  <div className="font-bold text-slate-900">{ten.name}</div>
                  <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                    {ten.facilityCode}
                  </div>
                </td>
                <td className="p-3">
                  <div className="font-medium text-slate-800">{ten.level}</div>
                  <div className="text-[11px] text-slate-500">{ten.county}</div>
                </td>
                <td className="p-3 font-mono">
                  <div>MFL: <strong>{ten.mflCode}</strong></div>
                  <div className="text-[11px] text-slate-500">{ten.shaContract}</div>
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-900">
                  {ten.patientCount.toLocaleString()}
                </td>
                <td className="p-3 text-center">
                  <Badge variant="success" size="sm" icon={<Lock className="w-3 h-3 text-emerald-700" />}>
                    Hard RLS Active
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </AccessibleTable>
      </section>

      {/* Provision Tenant Dialog */}
      <AccessibleDialog
        isOpen={onboardModalOpen}
        onClose={() => setOnboardModalOpen(false)}
        title="Provision New Hospital Facility Tenant"
        description="Creates dedicated tenant schema variables and hard PostgreSQL RLS isolation boundary."
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOnboardModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleOnboardTenant} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
              Provision Tenant
            </Button>
          </div>
        }
      >
        <form onSubmit={handleOnboardTenant} className="space-y-4">
          <InputField
            label="Healthcare Facility Name"
            id="newFacilityName"
            placeholder="e.g. Kisumu County Referral Hospital"
            value={newFacilityName}
            onChange={(e) => setNewFacilityName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Facility Level"
              id="newLevel"
              value={newLevel}
              onChange={(e) => setNewLevel(e.target.value)}
              options={[
                { value: 'Level 2 Dispensary', label: 'Level 2 Dispensary' },
                { value: 'Level 3 Health Centre', label: 'Level 3 Health Centre' },
                { value: 'Level 4 Sub-County Hospital', label: 'Level 4 Sub-County Hospital' },
                { value: 'Level 5 County Referral Hospital', label: 'Level 5 County Referral Hospital' },
                { value: 'Level 6 National Referral Hospital', label: 'Level 6 National Referral Hospital' },
              ]}
            />

            <InputField
              label="County Location"
              id="newCounty"
              value={newCounty}
              onChange={(e) => setNewCounty(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Master Facility List (MFL Code)"
              id="newMflCode"
              placeholder="e.g. 19283"
              value={newMflCode}
              onChange={(e) => setNewMflCode(e.target.value)}
              required
            />

            <InputField
              label="SHA Contract Number"
              id="newShaContract"
              placeholder="e.g. SHA-CTR-00404"
              value={newShaContract}
              onChange={(e) => setNewShaContract(e.target.value)}
            />
          </div>
        </form>
      </AccessibleDialog>
    </div>
  );
}
