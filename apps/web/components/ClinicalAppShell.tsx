'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Globe,
  Search,
  Menu,
  X,
  ChevronDown,
  Wifi,
  WifiOff,
  UserCheck,
} from 'lucide-react';
import {
  SkipLink,
  PatientContextBanner,
  OfflineIndicator,
  AccessibleDialog,
} from '@afyapoa/ui';
import { useTranslation } from '../contexts/I18nContext';
import { usePatientContext } from '../contexts/PatientContext';
import { useRoleContext, UserRole, ROLE_DEFINITIONS } from '../contexts/RoleContext';

interface NavItem {
  nameKey: string;
  defaultName: string;
  href: string;
  icon: React.ReactNode;
  badge?: number | string;
  role: UserRole;
}

export const ClinicalAppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, setLocale, t } = useTranslation();
  const { activePatient, clearPatientContext, allPatients, selectPatientById } = usePatientContext();
  const {
    activeRole,
    setActiveRole,
    userName,
    facilityName,
    facilityLevel,
    isOnline,
    setIsOnline,
    isSyncing,
    pendingSyncCount,
    triggerSync,
  } = useRoleContext();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setRoleMenuOpen(false);
  }, [pathname]);

  // Global keyboard shortcut '/' to open patient search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setPatientSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems: NavItem[] = [
    {
      nameKey: 'nav.reception',
      defaultName: 'Reception & Registry',
      href: '/patients',
      icon: <Users className="w-4 h-4" aria-hidden="true" />,
      badge: 12,
      role: 'RECORDS_OFFICER',
    },
    {
      nameKey: 'nav.triage',
      defaultName: 'Nursing & Triage',
      href: '/triage',
      icon: <Activity className="w-4 h-4" aria-hidden="true" />,
      badge: 3,
      role: 'TRIAGE_NURSE',
    },
    {
      nameKey: 'nav.clinicians',
      defaultName: 'Clinicians OPD',
      href: '/encounters',
      icon: <Stethoscope className="w-4 h-4" aria-hidden="true" />,
      badge: 6,
      role: 'CLINICIAN',
    },
    {
      nameKey: 'nav.laboratory',
      defaultName: 'Laboratory LIS',
      href: '/laboratory',
      icon: <FlaskConical className="w-4 h-4" aria-hidden="true" />,
      badge: 4,
      role: 'LAB_TECH',
    },
    {
      nameKey: 'nav.pharmacy',
      defaultName: 'Pharmacy',
      href: '/pharmacy',
      icon: <Pill className="w-4 h-4" aria-hidden="true" />,
      badge: 2,
      role: 'PHARMACIST',
    },
    {
      nameKey: 'nav.billing',
      defaultName: 'Billing & Cashier',
      href: '/billing',
      icon: <CreditCard className="w-4 h-4" aria-hidden="true" />,
      badge: 5,
      role: 'BILLING_CLERK',
    },
    {
      nameKey: 'nav.claims',
      defaultName: 'SHA eClaims',
      href: '/claims',
      icon: <FileCheck2 className="w-4 h-4" aria-hidden="true" />,
      badge: '24h',
      role: 'FINANCE_USER',
    },
    {
      nameKey: 'nav.facility_admin',
      defaultName: 'Facility Admin',
      href: '/facility-admin',
      icon: <Building2 className="w-4 h-4" aria-hidden="true" />,
      role: 'FACILITY_ADMIN',
    },
    {
      nameKey: 'nav.platform_admin',
      defaultName: 'Platform SaaS',
      href: '/platform-admin',
      icon: <Server className="w-4 h-4" aria-hidden="true" />,
      role: 'SUPER_ADMIN',
    },
  ];

  const filteredPatients = allPatients.filter(
    (p) =>
      p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.nationalId && p.nationalId.includes(searchQuery)) ||
      (p.upi && p.upi.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans">
      <SkipLink targetId="main-content">Skip to clinical content</SkipLink>

      {/* Top Clinical Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-2">
            {/* Left: Mobile hamburger & Brand */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle clinical module navigation menu"
                className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link
                href="/"
                aria-label="COMKEY AFYA POA Dashboard"
                title="COMKEY AFYA POA Dashboard"
                className="flex items-center gap-2 text-white hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
              >
                <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                  <Activity className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="font-bold text-sm tracking-tight hidden sm:inline">
                  COMKEY AFYA POA
                </span>
              </Link>

              <span className="text-slate-600 hidden md:inline">|</span>

              <div className="hidden md:flex flex-col text-xs leading-tight">
                <span className="font-semibold text-slate-200 truncate max-w-[220px]">
                  {facilityName}
                </span>
                <span className="text-[11px] text-emerald-400 font-medium">{facilityLevel}</span>
              </div>
            </div>

            {/* Mobile / Tablet Quick Patient Search Trigger */}
            <button
              type="button"
              onClick={() => setPatientSearchOpen(true)}
              className="lg:hidden p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              title="Quick patient lookup (Press /)"
              aria-label="Quick patient lookup"
            >
              <Search className="w-4 h-4" aria-hidden="true" />
            </button>

            {/* Desktop Workstation: Global Quick Patient Search Bar */}
            <div className="hidden lg:flex flex-1 max-w-xs xl:max-w-md mx-2">
              <button
                type="button"
                onClick={() => setPatientSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                title="Quick patient lookup (Press /)"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
                  <span className="truncate text-slate-200 font-medium">
                    {activePatient
                      ? `${activePatient.fullName} (${activePatient.mrn})`
                      : t('common.search', 'Quick patient lookup...')}
                  </span>
                </div>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-300 bg-slate-900 rounded border border-slate-700">
                  /
                </kbd>
              </button>
            </div>

            {/* Right: Network, Locale & Role Controls */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Network / Low-Bandwidth Sync Status */}
              <div className="flex items-center shrink-0">
                <OfflineIndicator
                  isOnline={isOnline}
                  isSyncing={isSyncing}
                  pendingSyncCount={pendingSyncCount}
                  onTriggerSync={triggerSync}
                  t={t}
                />
              </div>

              {/* Offline Simulation Toggle (Accessible clinical test control) */}
              <button
                type="button"
                onClick={() => setIsOnline(!isOnline)}
                title={isOnline ? 'Simulate Low-Bandwidth / Offline Facility' : 'Restore Online Connectivity'}
                aria-label={isOnline ? 'Simulate offline mode' : 'Restore online mode'}
                className="shrink-0 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
              </button>

              {/* Language Switcher */}
              <button
                type="button"
                onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                title="Switch interface language"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>{locale === 'en' ? 'Kiswahili' : 'English'}</span>
              </button>

              {/* Role Switcher Menu */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  aria-expanded={roleMenuOpen}
                  aria-haspopup="true"
                  title="Switch active clinical role"
                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="hidden xl:inline truncate max-w-[150px]">{userName}</span>
                  <span className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {activeRole}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                </button>

                {roleMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Clinical Role Switcher"
                    className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-1"
                  >
                    <div className="px-3 py-1.5 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-900">Active Practitioner</p>
                      <p className="text-xs text-slate-500 truncate">{userName}</p>
                    </div>

                    <div className="py-1">
                      {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => {
                        const info = ROLE_DEFINITIONS[r];
                        const isCurrent = activeRole === r;
                        return (
                          <button
                            key={r}
                            role="menuitem"
                            type="button"
                            onClick={() => {
                              setActiveRole(r);
                              setRoleMenuOpen(false);
                              router.push(info.defaultPath);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none ${
                              isCurrent ? 'bg-emerald-50 text-emerald-900 font-bold' : 'text-slate-700'
                            }`}
                          >
                            <div>
                              <div>{locale === 'sw' ? info.titleSw : info.titleEn}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r}</div>
                            </div>
                            {isCurrent && (
                              <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Role Navigation Bar */}
        <nav
          aria-label="Clinical Role Workspaces"
          className="bg-slate-950 border-t border-slate-800 text-xs"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      isActive
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    {item.icon}
                    <span>{t(item.nameKey, item.defaultName)}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? 'bg-emerald-800 text-emerald-100'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation Menu"
            className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 py-3 space-y-1.5 animate-in slide-in-from-top-2"
          >
            <div className="pb-2 border-b border-slate-800">
              <OfflineIndicator
                isOnline={isOnline}
                isSyncing={isSyncing}
                pendingSyncCount={pendingSyncCount}
                onTriggerSync={triggerSync}
                t={t}
              />
            </div>
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{t(item.nameKey, item.defaultName)}</span>
                  </div>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Patient Context Banner (Sticky Identity & Encounter Status) */}
      <PatientContextBanner
        patient={activePatient}
        onClearContext={clearPatientContext}
        onSwitchPatient={() => setPatientSearchOpen(true)}
        t={t}
      />

      {/* Main Clinical Content Area */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus-visible:outline-none">
        {children}
      </main>

      {/* Quick Patient Search Dialog */}
      <AccessibleDialog
        isOpen={patientSearchOpen}
        onClose={() => setPatientSearchOpen(false)}
        title={t('patient.search_select', 'Search Patient Registry')}
        description="Lookup active encounters by Full Name, MRN, National ID, or Verified DHA UPI."
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Amina, MRN-202610-0012, or 29881234..."
              aria-label="Search patient query"
              className="w-full px-4 py-2.5 pl-10 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" aria-hidden="true" />
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Patient Search Results"
            className="space-y-2 max-h-72 overflow-y-auto divide-y divide-slate-100"
          >
            {filteredPatients.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">
                No matching patients found in local registry.
              </p>
            ) : (
              filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    selectPatientById(p.id);
                    setPatientSearchOpen(false);
                  }}
                  className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition flex items-center justify-between group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 group-hover:text-emerald-700">
                        {p.fullName}
                      </span>
                      <span className="text-xs font-mono text-slate-500 px-1.5 py-0.2 bg-slate-100 rounded">
                        {p.mrn}
                      </span>
                      {p.isExternallyVerified && (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          DHA UPI
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {p.gender} • {p.age} yrs • ID: {p.nationalId || 'N/A'} • {p.county}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-600 group-hover:underline">
                      Select Patient →
                    </span>
                    {p.allergies && p.allergies.length > 0 && (
                      <div className="text-[10px] text-red-600 font-bold">
                        {p.allergies.length} Allergies
                      </div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </AccessibleDialog>
    </div>
  );
};
