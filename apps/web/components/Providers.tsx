'use client';

import React from 'react';
import { I18nProvider } from '../contexts/I18nContext';
import { PatientProvider } from '../contexts/PatientContext';
import { RoleProvider } from '../contexts/RoleContext';
import { ClinicalAppShell } from './ClinicalAppShell';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <PatientProvider>
        <RoleProvider>
          <ClinicalAppShell>{children}</ClinicalAppShell>
        </RoleProvider>
      </PatientProvider>
    </I18nProvider>
  );
}
