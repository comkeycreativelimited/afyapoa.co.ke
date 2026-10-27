import React from 'react';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  X,
  Activity,
  HeartPulse,
} from 'lucide-react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { cn } from './utils.js';

export interface PatientContextData {
  id: string;
  mrn: string;
  fullName: string;
  dob: string;
  age: number | string;
  gender: string;
  nationalId?: string;
  county: string;
  isExternallyVerified: boolean;
  upi?: string | null;
  dhaCrid?: string | null;
  shaContract?: string | null;
  shaScheme?: string | null;
  allergies?: Array<{ allergen: string; severity: 'MILD' | 'MODERATE' | 'SEVERE'; reaction?: string }>;
  bloodGroup?: string;
  activeEncounterId?: string | null;
  encounterType?: string | null;
  triageAcuity?: 'RESUSCITATION' | 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT' | null;
}

export interface PatientContextBannerProps {
  patient: PatientContextData | null;
  onClearContext?: () => void;
  onSwitchPatient?: () => void;
  className?: string;
  t?: (key: string, defaultText?: string) => string;
}

export const PatientContextBanner: React.FC<PatientContextBannerProps> = ({
  patient,
  onClearContext,
  onSwitchPatient,
  className,
  t = (_, d) => d || '',
}) => {
  if (!patient) {
    return (
      <aside
        aria-label="Patient Context"
        className={cn(
          'bg-slate-800/90 text-slate-300 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between text-xs',
          className,
        )}
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <span className="font-medium text-slate-300">
            {t('patient.no_active', 'No patient selected in active clinical session.')}
          </span>
          <span className="text-slate-400 hidden sm:inline">
            {t('patient.select_prompt', 'Select a patient from Reception or Triage to begin documentation.')}
          </span>
        </div>
        {onSwitchPatient && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-slate-700 hover:bg-slate-600 border-slate-600 text-white"
            onClick={onSwitchPatient}
          >
            {t('patient.search_select', 'Search Patient')}
          </Button>
        )}
      </aside>
    );
  }

  const hasSevereAllergies = patient.allergies?.some((a) => a.severity === 'SEVERE');
  const allergyCount = patient.allergies?.length || 0;

  return (
    <section
      aria-label="Active Patient Identity & Encounter Context"
      className={cn(
        'bg-slate-900 text-white border-b border-slate-700 shadow-md transition-all',
        hasSevereAllergies ? 'border-t-4 border-t-red-600' : 'border-t-4 border-t-emerald-600',
        className,
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Patient Demographic Identity */}
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400 shrink-0 border border-slate-700">
              <User className="w-5 h-5" aria-hidden="true" />
            </div>

            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  {patient.fullName}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                  {patient.mrn}
                </span>

                {patient.isExternallyVerified ? (
                  <Badge
                    variant="info"
                    size="sm"
                    icon={<ShieldCheck className="w-3 h-3 text-blue-600" />}
                    title={`DHA Verified UPI: ${patient.upi || 'N/A'}`}
                  >
                    DHA UPI Verified
                  </Badge>
                ) : (
                  <Badge
                    variant="warning"
                    size="sm"
                    icon={<ShieldAlert className="w-3 h-3 text-amber-600" />}
                    title="Local facility identity only. Requires DHA registry lookup."
                  >
                    Local Only (Unverified)
                  </Badge>
                )}

                {patient.bloodGroup && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Blood: {patient.bloodGroup}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                <span>
                  {t('patient.gender', 'Sex')}: <strong>{patient.gender}</strong>
                </span>
                <span>
                  {t('patient.age', 'Age')}: <strong>{patient.age} yrs</strong> ({patient.dob})
                </span>
                {patient.nationalId && (
                  <span>
                    ID: <strong>{patient.nationalId}</strong>
                  </span>
                )}
                <span>
                  County: <strong>{patient.county}</strong>
                </span>
                {patient.shaScheme && (
                  <span className="text-emerald-400 font-medium">
                    SHA: <strong>{patient.shaScheme}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Alerts & Encounter Meta */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            {/* Allergies Indicator */}
            {allergyCount > 0 ? (
              <div
                role="alert"
                aria-label={`Allergy Warning: ${allergyCount} documented allergies`}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border',
                  hasSevereAllergies
                    ? 'bg-red-950/80 text-red-200 border-red-500 animate-pulse'
                    : 'bg-amber-950/80 text-amber-200 border-amber-500',
                )}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {allergyCount} ALLERG{allergyCount > 1 ? 'IES' : 'Y'}:{' '}
                  {patient.allergies?.map((a) => a.allergen).join(', ')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-slate-400 px-2 py-1 bg-slate-800/60 rounded border border-slate-700">
                <HeartPulse className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span>NKDA (No Known Drug Allergies)</span>
              </div>
            )}

            {/* Encounter Badge */}
            {patient.activeEncounterId && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 rounded border border-slate-700 text-xs text-slate-300">
                <Activity className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                <span>
                  Enc: <strong className="font-mono text-indigo-300">{patient.activeEncounterId}</strong>
                </span>
                {patient.triageAcuity && (
                  <span
                    className={cn(
                      'ml-1 px-1.5 py-0.2 rounded font-bold uppercase text-[10px]',
                      patient.triageAcuity === 'RESUSCITATION' && 'bg-red-600 text-white',
                      patient.triageAcuity === 'EMERGENCY' && 'bg-orange-500 text-white',
                      patient.triageAcuity === 'URGENT' && 'bg-amber-500 text-slate-900',
                      patient.triageAcuity === 'SEMI_URGENT' && 'bg-emerald-600 text-white',
                      patient.triageAcuity === 'NON_URGENT' && 'bg-blue-600 text-white',
                    )}
                  >
                    {patient.triageAcuity}
                  </span>
                )}
              </div>
            )}

            {/* Context Actions */}
            <div className="flex items-center gap-1 ml-auto">
              {onSwitchPatient && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600"
                  onClick={onSwitchPatient}
                  title="Switch to another patient"
                >
                  {t('common.switch', 'Switch')}
                </Button>
              )}

              {onClearContext && (
                <button
                  type="button"
                  onClick={onClearContext}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  title="Clear patient context"
                  aria-label="Clear active patient context"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
