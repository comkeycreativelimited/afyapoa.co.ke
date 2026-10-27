'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  Users,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  FileCheck2,
  Building2,
  Server,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { Badge } from '@afyapoa/ui';
import { useTranslation } from '../contexts/I18nContext';
import { useRoleContext, UserRole } from '../contexts/RoleContext';

export default function HomePage() {
  const { t, locale } = useTranslation();
  const { userName, facilityName, facilityLevel, setActiveRole } = useRoleContext();

  const roleWorkspaces = [
    {
      role: 'RECORDS_OFFICER' as UserRole,
      titleKey: 'nav.reception',
      defaultTitle: 'Reception & Registry',
      href: '/patients',
      desc: 'Patient registration, national ID lookup, DHA UPI verification, and triage queue routing.',
      badge: '12 Patients',
      badgeVariant: 'neutral' as const,
      icon: <Users className="w-5 h-5 text-emerald-600" />,
      color: 'border-emerald-200 hover:border-emerald-500',
    },
    {
      role: 'TRIAGE_NURSE' as UserRole,
      titleKey: 'nav.triage',
      defaultTitle: 'Nursing & Triage',
      href: '/triage',
      desc: 'Vitals capture (BP, SpO2, Temp, Glucose), automated BMI & MAP calculation, and SATS acuity.',
      badge: '3 Awaiting',
      badgeVariant: 'warning' as const,
      icon: <Activity className="w-5 h-5 text-amber-600" />,
      color: 'border-amber-200 hover:border-amber-500',
    },
    {
      role: 'CLINICIAN' as UserRole,
      titleKey: 'nav.clinicians',
      defaultTitle: 'Clinicians OPD',
      href: '/encounters',
      desc: 'SOAP clinical charting, ICD-10 & ICD-11 coding, CPOE laboratory & KEML medication orders.',
      badge: '6 Queued',
      badgeVariant: 'info' as const,
      icon: <Stethoscope className="w-5 h-5 text-blue-600" />,
      color: 'border-blue-200 hover:border-blue-500',
    },
    {
      role: 'LAB_TECH' as UserRole,
      titleKey: 'nav.laboratory',
      defaultTitle: 'Laboratory LIS',
      href: '/laboratory',
      desc: 'Specimen collection, bench worklists, panic value alerts, and pathologist verification.',
      badge: '4 Pending',
      badgeVariant: 'neutral' as const,
      icon: <FlaskConical className="w-5 h-5 text-indigo-600" />,
      color: 'border-indigo-200 hover:border-indigo-500',
    },
    {
      role: 'PHARMACIST' as UserRole,
      titleKey: 'nav.pharmacy',
      defaultTitle: 'Pharmacy & Dispensing',
      href: '/pharmacy',
      desc: 'Prescription queue, drug allergy validation, FEFO batch allocation, and English/Swahili labelling.',
      badge: '2 Ready',
      badgeVariant: 'teal' as const,
      icon: <Pill className="w-5 h-5 text-teal-600" />,
      color: 'border-teal-200 hover:border-teal-500',
    },
    {
      role: 'BILLING_CLERK' as UserRole,
      titleKey: 'nav.billing',
      defaultTitle: 'Billing & Cashier',
      href: '/billing',
      desc: 'Encounter invoice consolidation, M-Pesa STK push, cash receipting, and KRA eTIMS fiscal signing.',
      badge: '5 Invoices',
      badgeVariant: 'neutral' as const,
      icon: <CreditCard className="w-5 h-5 text-purple-600" />,
      color: 'border-purple-200 hover:border-purple-500',
    },
    {
      role: 'FINANCE_USER' as UserRole,
      titleKey: 'nav.claims',
      defaultTitle: 'SHA eClaims & Insurance',
      href: '/claims',
      desc: 'Social Health Authority eClaims, PHC capitation, SHIF, ECCIF, and 24-hour statutory SLA timer.',
      badge: '24h SLA Active',
      badgeVariant: 'warning' as const,
      icon: <FileCheck2 className="w-5 h-5 text-cyan-600" />,
      color: 'border-cyan-200 hover:border-cyan-500',
    },
    {
      role: 'FACILITY_ADMIN' as UserRole,
      titleKey: 'nav.facility_admin',
      defaultTitle: 'Facility Administration',
      href: '/facility-admin',
      desc: 'Staff rosters & duty assignments, ward bed occupancy census, and facility security audit trail.',
      badge: '90% Occupancy',
      badgeVariant: 'danger' as const,
      icon: <Building2 className="w-5 h-5 text-rose-600" />,
      color: 'border-rose-200 hover:border-rose-500',
    },
    {
      role: 'SUPER_ADMIN' as UserRole,
      titleKey: 'nav.platform_admin',
      defaultTitle: 'Platform SaaS Admin',
      href: '/platform-admin',
      desc: 'Multi-tenant hospital provisioning, PostgreSQL RLS health, and national gateway adapters.',
      badge: 'Hard RLS Active',
      badgeVariant: 'success' as const,
      icon: <Server className="w-5 h-5 text-emerald-600" />,
      color: 'border-slate-300 hover:border-slate-700',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {facilityLevel} • {facilityName}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t('app.name', 'COMKEY AFYA POA')}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Coherent, sovereign, multi-tenant clinical application designed for Kenyan healthcare facilities.
            WCAG 2.2 AA compliant, fully localized in English & Kiswahili, and optimized for desktop workstations, tablets, and low-bandwidth clinics.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>Signed in as: <strong className="text-white">{userName}</strong></span>
            <span>•</span>
            <span>Active Language: <strong className="text-emerald-400 uppercase">{locale}</strong></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
          <Link
            href="/triage"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <span>Open Triage Queue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/encounters"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
          >
            <span>Clinician Consultations</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Role-Specific Clinical Workspaces Grid */}
      <section aria-label="Role Specific Clinical Workspaces" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Clinical & Administrative Role Workspaces
            </h2>
            <p className="text-xs text-slate-600">
              Select your active clinical role or launch specialized workflow module
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600">
            9 Workspaces Configured
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleWorkspaces.map((ws) => (
            <Link
              key={ws.href}
              href={ws.href}
              onClick={() => setActiveRole(ws.role)}
              className={`p-5 bg-white rounded-xl border shadow-sm transition hover:shadow-md flex flex-col justify-between space-y-4 group ${ws.color}`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 group-hover:bg-slate-100 transition">
                    {ws.icon}
                  </div>
                  <Badge variant={ws.badgeVariant} size="sm">
                    {ws.badge}
                  </Badge>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                    {t(ws.titleKey, ws.defaultTitle)}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {ws.desc}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">
                <span>Enter Workspace</span>
                <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Statutory Regulatory & Standards Alignment */}
      <section aria-label="National Statutory Alignment" className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>National Regulatory & Legal Compliance Verification</span>
          </h2>
          <Badge variant="success" size="sm">100% Certified</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Digital Health Act 2023</div>
            <p className="text-slate-600">
              National HIE interoperability with FHIR R4 semantic parity & CR/FR/HWR lookup.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Social Health Insurance Act 2023</div>
            <p className="text-slate-600">
              Direct eClaims mediation for PHC Capitation, SHIF FFS, and ECCIF Emergency fund.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Data Protection Act 2019</div>
            <p className="text-slate-600">
              Regulation 26 sovereign data localization with cryptographic audit hashing.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900">Tax Procedures Act Sec 23A</div>
            <p className="text-slate-600">
              KRA eTIMS VSCU electronic fiscal signing with real-time QR receipt generation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
