'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole =
  | 'RECORDS_OFFICER' // Reception & Registry
  | 'TRIAGE_NURSE' // Nursing & Triage
  | 'CLINICIAN' // Doctors & Clinical Officers
  | 'LAB_TECH' // Laboratory Technologists
  | 'PHARMACIST' // Pharmacy & Dispensing
  | 'BILLING_CLERK' // Billing Cashier
  | 'FINANCE_USER' // Claims Officer / Finance
  | 'FACILITY_ADMIN' // Hospital Administrator
  | 'SUPER_ADMIN'; // Platform Operator

export interface RoleInfo {
  role: UserRole;
  titleEn: string;
  titleSw: string;
  defaultPath: string;
  badgeColor: string;
  permissions: string[];
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleInfo> = {
  RECORDS_OFFICER: {
    role: 'RECORDS_OFFICER',
    titleEn: 'Reception / Records Officer',
    titleSw: 'Afisa wa Mapokezi na Kumbukumbu',
    defaultPath: '/patients',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    permissions: ['patient:register', 'patient:read', 'patient:write', 'encounter:create'],
  },
  TRIAGE_NURSE: {
    role: 'TRIAGE_NURSE',
    titleEn: 'Nursing & Triage Officer',
    titleSw: 'Muuguzi wa Uchunguzi wa Awali',
    defaultPath: '/triage',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    permissions: ['triage:write', 'patient:read', 'allergy:manage', 'encounter:read'],
  },
  CLINICIAN: {
    role: 'CLINICIAN',
    titleEn: 'Clinician / Medical Officer',
    titleSw: 'Daktari / Mganga wa Kliniki',
    defaultPath: '/encounters',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
    permissions: [
      'clinical:note:write',
      'clinical:note:sign',
      'clinical:order:write',
      'allergy:manage',
      'encounter:update',
    ],
  },
  LAB_TECH: {
    role: 'LAB_TECH',
    titleEn: 'Laboratory Technologist',
    titleSw: 'Mtaalamu wa Maabara',
    defaultPath: '/laboratory',
    badgeColor: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    permissions: ['laboratory:worklist:read', 'laboratory:result:write', 'laboratory:verify'],
  },
  PHARMACIST: {
    role: 'PHARMACIST',
    titleEn: 'Pharmacist / Dispensing Tech',
    titleSw: 'Mfamasia / Mhudumu wa Dawa',
    defaultPath: '/pharmacy',
    badgeColor: 'bg-teal-100 text-teal-900 border-teal-300',
    permissions: ['pharmacy:prescription:read', 'pharmacy:dispense', 'inventory:deduct'],
  },
  BILLING_CLERK: {
    role: 'BILLING_CLERK',
    titleEn: 'Billing Clerk / Cashier',
    titleSw: 'Mhasibu wa Hazina na Malipo',
    defaultPath: '/billing',
    badgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
    permissions: ['billing:invoice:create', 'billing:payment:process', 'etims:sign'],
  },
  FINANCE_USER: {
    role: 'FINANCE_USER',
    titleEn: 'Claims Officer / Health Insurance',
    titleSw: 'Afisa wa Madai ya Bima (SHA)',
    defaultPath: '/claims',
    badgeColor: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    permissions: ['claims:sha:submit', 'claims:preauth:verify', 'claims:reconcile'],
  },
  FACILITY_ADMIN: {
    role: 'FACILITY_ADMIN',
    titleEn: 'Facility Administrator',
    titleSw: 'Msimamizi wa Hospitali',
    defaultPath: '/facility-admin',
    badgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
    permissions: ['facility:manage', 'roster:assign', 'audit:read', 'reports:export'],
  },
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    titleEn: 'Platform SaaS Super-Admin',
    titleSw: 'Msimamizi Mkuu wa Mfumo',
    defaultPath: '/platform-admin',
    badgeColor: 'bg-slate-800 text-emerald-400 border-slate-700',
    permissions: ['tenant:read', 'tenant:write', 'system:health', 'audit:export'],
  },
};

interface RoleContextType {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  activeRoleInfo: RoleInfo;
  userName: string;
  facilityName: string;
  facilityLevel: string;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  isSyncing: boolean;
  pendingSyncCount: number;
  triggerSync: () => void;
  hasPermission: (permission: string) => boolean;
}

const RoleContext = createContext<RoleContextType>({
  activeRole: 'CLINICIAN',
  setActiveRole: () => {},
  activeRoleInfo: ROLE_DEFINITIONS.CLINICIAN,
  userName: 'Dr. Wanjiru Karanja (MBChB, MMed)',
  facilityName: 'Nairobi Metropolitan Referral Hospital',
  facilityLevel: 'Level 5 Referral',
  isOnline: true,
  setIsOnline: () => {},
  isSyncing: false,
  pendingSyncCount: 0,
  triggerSync: () => {},
  hasPermission: () => true,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRoleState] = useState<UserRole>('CLINICIAN');
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(2);

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem('afyapoa_active_role') as UserRole;
      if (savedRole && ROLE_DEFINITIONS[savedRole]) {
        setActiveRoleState(savedRole);
      }
    } catch {
      // Ignore
    }
  }, []);

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    try {
      localStorage.setItem('afyapoa_active_role', role);
    } catch {
      // Ignore
    }
  };

  const activeRoleInfo = ROLE_DEFINITIONS[activeRole];

  const triggerSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setPendingSyncCount(0);
    }, 1500);
  };

  const hasPermission = (permission: string): boolean => {
    if (activeRole === 'SUPER_ADMIN') return true;
    return activeRoleInfo.permissions.includes(permission);
  };

  // Dynamic user name based on role
  let userName = 'Dr. Wanjiru Karanja (MBChB, MMed)';
  if (activeRole === 'RECORDS_OFFICER') userName = 'Grace Mwiti (HRIO)';
  else if (activeRole === 'TRIAGE_NURSE') userName = 'Sister Beatrice Otieno (KRCHN)';
  else if (activeRole === 'LAB_TECH') userName = 'Kevin Kiprop (BSc MLS, KMLTTB)';
  else if (activeRole === 'PHARMACIST') userName = 'Pharm. Samuel Mutua (BPharm, PPB)';
  else if (activeRole === 'BILLING_CLERK') userName = 'Lucy Nyambura (Revenue Cashier)';
  else if (activeRole === 'FINANCE_USER') userName = 'Jackson Omondi (SHA Claims Officer)';
  else if (activeRole === 'FACILITY_ADMIN') userName = 'Eng. Patrick Koech (Hospital Director)';
  else if (activeRole === 'SUPER_ADMIN') userName = 'Platform System Engineer (COMKEY)';

  return (
    <RoleContext.Provider
      value={{
        activeRole,
        setActiveRole,
        activeRoleInfo,
        userName,
        facilityName: 'Nairobi Metropolitan Referral Hospital',
        facilityLevel: 'Level 5 Referral',
        isOnline,
        setIsOnline,
        isSyncing,
        pendingSyncCount,
        triggerSync,
        hasPermission,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
};

export const useRoleContext = () => useContext(RoleContext);
