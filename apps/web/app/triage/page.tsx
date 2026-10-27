'use client';

import React, { useState } from 'react';
import {
  Activity,
  HeartPulse,
  Scale,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Button,
  Badge,
  ClinicalAlert,
  InputField,
  SelectField,
  TextareaField,
} from '@afyapoa/ui';
import { useTranslation } from '../../contexts/I18nContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useRoleContext } from '../../contexts/RoleContext';

interface TriageQueuePatient {
  id: string;
  mrn: string;
  fullName: string;
  age: number;
  gender: string;
  arrivalTime: string;
  waitTimeMins: number;
  chiefComplaint: string;
  assignedPriority?: 'RESUSCITATION' | 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT';
  vitalsCaptured: boolean;
  vitals?: {
    systolicBp?: number;
    diastolicBp?: number;
    heartRate?: number;
    respiratoryRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    bloodGlucose?: number;
    weightKg?: number;
    heightCm?: number;
    bmi?: number;
    avpu: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
  };
}

export default function TriagePage() {
  const { t } = useTranslation();
  const { activePatient, selectPatientById, updateActivePatient } = usePatientContext();
  const { userName } = useRoleContext();

  const [triageQueue, setTriageQueue] = useState<TriageQueuePatient[]>([
    {
      id: 'p-103',
      mrn: 'MRN-202610-0099',
      fullName: 'EMERGENCY TRAUMA UNKNOWN-MALE-A8K2Z',
      age: 30,
      gender: 'MALE',
      arrivalTime: '14:10',
      waitTimeMins: 15,
      chiefComplaint: 'Pedestrian vs Boda-Boda accident, blunt chest trauma, altered consciousness',
      assignedPriority: 'RESUSCITATION',
      vitalsCaptured: true,
      vitals: {
        systolicBp: 85,
        diastolicBp: 50,
        heartRate: 128,
        respiratoryRate: 28,
        temperature: 36.1,
        oxygenSaturation: 89,
        avpu: 'PAIN',
      },
    },
    {
      id: 'p-101',
      mrn: 'MRN-202610-0012',
      fullName: 'Amina Fatuma Bakari',
      age: 31,
      gender: 'FEMALE',
      arrivalTime: '14:00',
      waitTimeMins: 25,
      chiefComplaint: 'High fever for 3 days, chills, joint pains, nausea',
      assignedPriority: 'URGENT',
      vitalsCaptured: true,
      vitals: {
        systolicBp: 118,
        diastolicBp: 76,
        heartRate: 98,
        respiratoryRate: 18,
        temperature: 38.9,
        oxygenSaturation: 97,
        weightKg: 64,
        heightCm: 165,
        bmi: 23.5,
        bloodGlucose: 5.8,
        avpu: 'ALERT',
      },
    },
    {
      id: 'p-102',
      mrn: 'MRN-202610-0015',
      fullName: 'David Kiprono Kipkorir',
      age: 34,
      gender: 'MALE',
      arrivalTime: '13:45',
      waitTimeMins: 40,
      chiefComplaint: 'Productive cough for 2 weeks, night sweats, weight loss',
      assignedPriority: 'SEMI_URGENT',
      vitalsCaptured: false,
    },
    {
      id: 'p-104',
      mrn: 'MRN-202610-0044',
      fullName: 'Faith Wangari Mwangi',
      age: 38,
      gender: 'FEMALE',
      arrivalTime: '13:30',
      waitTimeMins: 55,
      chiefComplaint: 'Routine antenatal visit (28 weeks), mild bilateral ankle swelling',
      assignedPriority: 'NON_URGENT',
      vitalsCaptured: false,
    },
  ]);

  // Form State
  const [systolicBp, setSystolicBp] = useState<string>('');
  const [diastolicBp, setDiastolicBp] = useState<string>('');
  const [heartRate, setHeartRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('');
  const [bloodGlucose, setBloodGlucose] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [avpu, setAvpu] = useState<'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE'>('ALERT');
  const [triageCategory, setTriageCategory] = useState<
    'RESUSCITATION' | 'EMERGENCY' | 'URGENT' | 'SEMI_URGENT' | 'NON_URGENT'
  >('URGENT');
  const [nursingNotes, setNursingNotes] = useState<string>('');
  const [newAllergen, setNewAllergen] = useState<string>('');
  const [allergySeverity, setAllergySeverity] = useState<'MILD' | 'MODERATE' | 'SEVERE'>('MODERATE');
  const [allergyReaction, setAllergyReaction] = useState<string>('');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Auto-calculated BMI
  const weightNum = parseFloat(weightKg);
  const heightNum = parseFloat(heightCm) / 100; // in meters
  const calculatedBmi =
    weightNum && heightNum > 0 ? (weightNum / (heightNum * heightNum)).toFixed(1) : null;

  // Mean Arterial Pressure (MAP) = Diastolic + 1/3 (Systolic - Diastolic)
  const sysNum = parseInt(systolicBp, 10);
  const diaNum = parseInt(diastolicBp, 10);
  const calculatedMap =
    sysNum && diaNum ? Math.round(diaNum + (sysNum - diaNum) / 3) : null;

  // Selected patient to triage
  const currentTriagePatient =
    triageQueue.find((p) => p.id === activePatient?.id) || triageQueue[0];

  const handleSelectPatientToTriage = (patient: TriageQueuePatient) => {
    selectPatientById(patient.id);
    if (patient.vitals) {
      setSystolicBp(patient.vitals.systolicBp?.toString() || '');
      setDiastolicBp(patient.vitals.diastolicBp?.toString() || '');
      setHeartRate(patient.vitals.heartRate?.toString() || '');
      setRespiratoryRate(patient.vitals.respiratoryRate?.toString() || '');
      setTemperature(patient.vitals.temperature?.toString() || '');
      setOxygenSaturation(patient.vitals.oxygenSaturation?.toString() || '');
      setBloodGlucose(patient.vitals.bloodGlucose?.toString() || '');
      setWeightKg(patient.vitals.weightKg?.toString() || '');
      setHeightCm(patient.vitals.heightCm?.toString() || '');
      setAvpu(patient.vitals.avpu || 'ALERT');
    } else {
      setSystolicBp('');
      setDiastolicBp('');
      setHeartRate('');
      setRespiratoryRate('');
      setTemperature('');
      setOxygenSaturation('');
      setBloodGlucose('');
      setWeightKg('');
      setHeightCm('');
      setAvpu('ALERT');
    }
    if (patient.assignedPriority) {
      setTriageCategory(patient.assignedPriority);
    }
  };

  const handleSaveVitals = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTriagePatient) return;

    const updatedVitals = {
      systolicBp: systolicBp ? parseInt(systolicBp, 10) : undefined,
      diastolicBp: diastolicBp ? parseInt(diastolicBp, 10) : undefined,
      heartRate: heartRate ? parseInt(heartRate, 10) : undefined,
      respiratoryRate: respiratoryRate ? parseInt(respiratoryRate, 10) : undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      oxygenSaturation: oxygenSaturation ? parseInt(oxygenSaturation, 10) : undefined,
      bloodGlucose: bloodGlucose ? parseFloat(bloodGlucose) : undefined,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      heightCm: heightCm ? parseFloat(heightCm) : undefined,
      bmi: calculatedBmi ? parseFloat(calculatedBmi) : undefined,
      avpu,
    };

    setTriageQueue((prev) =>
      prev.map((p) =>
        p.id === currentTriagePatient.id
          ? {
              ...p,
              vitalsCaptured: true,
              assignedPriority: triageCategory,
              vitals: updatedVitals,
            }
          : p,
      ),
    );

    updateActivePatient({
      triageAcuity: triageCategory,
    });

    setSaveSuccess(
      `Vitals and ${triageCategory} acuity saved for ${currentTriagePatient.fullName}. Patient queued for Clinician OPD.`,
    );

    setTimeout(() => {
      setSaveSuccess(null);
    }, 4000);
  };

  const handleAddAllergy = () => {
    if (!newAllergen || !activePatient) return;
    const currentAllergies = activePatient.allergies || [];
    const updated = [
      ...currentAllergies,
      {
        allergen: newAllergen,
        severity: allergySeverity,
        reaction: allergyReaction || 'Clinical sensitivity recorded',
      },
    ];
    updateActivePatient({ allergies: updated });
    setNewAllergen('');
    setAllergyReaction('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-600 rounded-lg border border-amber-500/20">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('nav.triage', 'Nursing Assessment & Clinical Triage')}
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Kenya National Triage Protocol • South African Triage Scale (SATS) • Acuity Early Warning
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="warning" size="md" icon={<Clock className="w-3.5 h-3.5 text-amber-700" />}>
            {triageQueue.filter((p) => !p.vitalsCaptured).length} Awaiting Vitals
          </Badge>
          <Badge variant="danger" size="md" icon={<AlertOctagon className="w-3.5 h-3.5 text-red-700" />}>
            {triageQueue.filter((p) => p.assignedPriority === 'RESUSCITATION').length} Resuscitation
          </Badge>
        </div>
      </div>

      {saveSuccess && (
        <ClinicalAlert
          severity="success"
          title="Triage Assessment Saved"
          message={saveSuccess}
          onDismiss={() => setSaveSuccess(null)}
        />
      )}

      {/* Main Grid: Queue & Assessment Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Triage Waiting Queue (5 cols) */}
        <section
          aria-label="Triage Queue List"
          className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Arrived Patients Queue</h2>
              <p className="text-xs text-slate-500">Sorted by arrival time & urgency</p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
              {triageQueue.length} Patients
            </span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Patient Queue List"
            className="divide-y divide-slate-100 overflow-y-auto max-h-[620px]"
          >
            {triageQueue.map((patient) => {
              const isSelected = patient.id === currentTriagePatient?.id;
              return (
                <div
                  key={patient.id}
                  onClick={() => handleSelectPatientToTriage(patient)}
                  className={`p-4 transition cursor-pointer flex flex-col space-y-2 hover:bg-slate-50 ${
                    isSelected ? 'bg-amber-50/60 border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{patient.fullName}</span>
                        <span className="font-mono text-xs text-slate-500">{patient.mrn}</span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {patient.gender} • {patient.age} yrs • Arrived: {patient.arrivalTime} ({patient.waitTimeMins}m ago)
                      </div>
                    </div>

                    {patient.assignedPriority && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${
                          patient.assignedPriority === 'RESUSCITATION'
                            ? 'bg-red-100 text-red-800 border-red-300 animate-pulse'
                            : patient.assignedPriority === 'EMERGENCY'
                            ? 'bg-orange-100 text-orange-800 border-orange-300'
                            : patient.assignedPriority === 'URGENT'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : patient.assignedPriority === 'SEMI_URGENT'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}
                      >
                        {patient.assignedPriority}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-700 italic bg-slate-50 p-2 rounded border border-slate-100">
                    "{patient.chiefComplaint}"
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        patient.vitalsCaptured ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {patient.vitalsCaptured ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Vitals Recorded</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Vitals Pending</span>
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectPatientToTriage(patient);
                      }}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded px-1"
                    >
                      <span>Assess</span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Active Clinical Assessment & Vitals Entry (7 cols) */}
        <section
          aria-label="Active Triage Vitals and Acuity Form"
          className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-6"
        >
          {/* Active Patient Identity Heading */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                Assessing Patient
              </span>
              <h2 className="text-base font-bold text-slate-900">
                {currentTriagePatient ? currentTriagePatient.fullName : 'No Patient Selected'}
              </h2>
              <p className="text-xs text-slate-500">
                MRN: {currentTriagePatient?.mrn} • Complaint: {currentTriagePatient?.chiefComplaint}
              </p>
            </div>
            {currentTriagePatient?.assignedPriority === 'RESUSCITATION' && (
              <span className="px-3 py-1 rounded-md bg-red-600 text-white text-xs font-bold animate-pulse flex items-center gap-1">
                <AlertOctagon className="w-4 h-4" />
                RESUSCITATION
              </span>
            )}
          </div>

          <form onSubmit={handleSaveVitals} className="space-y-6">
            {/* Vitals Form Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>Objective Vital Signs (Physiological Measurements)</span>
                </h3>
                {calculatedMap && (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    MAP: {calculatedMap} mmHg
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <InputField
                  label="Systolic BP (mmHg)"
                  id="systolicBp"
                  type="number"
                  placeholder="e.g. 120"
                  value={systolicBp}
                  onChange={(e) => setSystolicBp(e.target.value)}
                  error={
                    sysNum && sysNum > 160
                      ? 'Severe Hypertension'
                      : sysNum && sysNum < 90
                      ? 'Hypotension Alert'
                      : undefined
                  }
                  helperText="Normal: 90 - 130"
                  required
                />

                <InputField
                  label="Diastolic BP (mmHg)"
                  id="diastolicBp"
                  type="number"
                  placeholder="e.g. 80"
                  value={diastolicBp}
                  onChange={(e) => setDiastolicBp(e.target.value)}
                  error={diaNum && diaNum > 100 ? 'Severe Diastolic Alert' : undefined}
                  helperText="Normal: 60 - 85"
                  required
                />

                <InputField
                  label="Heart Rate (bpm)"
                  id="heartRate"
                  type="number"
                  placeholder="e.g. 72"
                  value={heartRate}
                  onChange={(e) => setHeartRate(e.target.value)}
                  error={
                    parseInt(heartRate, 10) > 120
                      ? 'Tachycardia Warning'
                      : parseInt(heartRate, 10) < 50
                      ? 'Bradycardia Warning'
                      : undefined
                  }
                  helperText="Normal: 60 - 100"
                  required
                />

                <InputField
                  label="Respiratory Rate (bpm)"
                  id="respiratoryRate"
                  type="number"
                  placeholder="e.g. 16"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  error={parseInt(respiratoryRate, 10) > 24 ? 'Tachypnea Alert' : undefined}
                  helperText="Normal: 12 - 20"
                  required
                />

                <InputField
                  label="Temperature (°C)"
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 36.8"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  error={parseFloat(temperature) >= 38.3 ? 'High Fever Alert' : undefined}
                  helperText="Normal: 36.5 - 37.5"
                  required
                />

                <InputField
                  label="Oxygen Saturation (SpO2 %)"
                  id="oxygenSaturation"
                  type="number"
                  placeholder="e.g. 98"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(e.target.value)}
                  error={
                    parseInt(oxygenSaturation, 10) < 92
                      ? 'Hypoxia! Oxygen required'
                      : undefined
                  }
                  helperText="Normal: 95% - 100%"
                  required
                />

                <InputField
                  label="Weight (kg)"
                  id="weightKg"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 65.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />

                <InputField
                  label="Height (cm)"
                  id="heightCm"
                  type="number"
                  placeholder="e.g. 170"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                />

                <InputField
                  label="Blood Glucose (mmol/L)"
                  id="bloodGlucose"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 5.5"
                  value={bloodGlucose}
                  onChange={(e) => setBloodGlucose(e.target.value)}
                  error={
                    parseFloat(bloodGlucose) < 3.5
                      ? 'Hypoglycemia Alert'
                      : parseFloat(bloodGlucose) > 11.1
                      ? 'Hyperglycemia Warning'
                      : undefined
                  }
                  helperText="Fasting: 3.9 - 6.1"
                />
              </div>

              {/* Real-time BMI Display */}
              {calculatedBmi && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                    <span>Calculated Body Mass Index:</span>
                    <strong className="text-slate-900 font-mono text-sm">{calculatedBmi} kg/m²</strong>
                  </div>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      parseFloat(calculatedBmi) < 18.5
                        ? 'bg-blue-100 text-blue-800'
                        : parseFloat(calculatedBmi) < 25
                        ? 'bg-emerald-100 text-emerald-800'
                        : parseFloat(calculatedBmi) < 30
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {parseFloat(calculatedBmi) < 18.5
                      ? 'Underweight'
                      : parseFloat(calculatedBmi) < 25
                      ? 'Normal Weight'
                      : parseFloat(calculatedBmi) < 30
                      ? 'Overweight'
                      : 'Obesity Class'}
                  </span>
                </div>
              )}
            </div>

            {/* AVPU & Acuity Classification */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                <span>Neurological Status & Triage Acuity Assignment</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  label="Consciousness Level (AVPU Scale)"
                  id="avpu"
                  value={avpu}
                  onChange={(e) => setAvpu(e.target.value as any)}
                  options={[
                    { value: 'ALERT', label: 'Alert (Fully responsive)' },
                    { value: 'VOICE', label: 'Voice (Responds to verbal stimulus)' },
                    { value: 'PAIN', label: 'Pain (Responds only to painful stimulus)' },
                    { value: 'UNRESPONSIVE', label: 'Unresponsive (Coma / GCS < 8)' },
                  ]}
                  required
                />

                <SelectField
                  label="Acuity Priority Category"
                  id="triageCategory"
                  value={triageCategory}
                  onChange={(e) => setTriageCategory(e.target.value as any)}
                  options={[
                    { value: 'RESUSCITATION', label: 'Resuscitation (Red) - Immediate Life Threat' },
                    { value: 'EMERGENCY', label: 'Emergency (Orange) - Severe Injury (<15 mins)' },
                    { value: 'URGENT', label: 'Urgent (Yellow) - Potentially Serious (<30 mins)' },
                    { value: 'SEMI_URGENT', label: 'Semi-Urgent (Green) - Minor Illness (<60 mins)' },
                    { value: 'NON_URGENT', label: 'Non-Urgent (Blue) - Routine / Chronic (<120 mins)' },
                  ]}
                  required
                />
              </div>

              <TextareaField
                label="Nursing Triage Clinical Summary"
                id="nursingNotes"
                placeholder="Document patient physical appearance, respiratory effort, pallor, or critical notes..."
                value={nursingNotes}
                onChange={(e) => setNursingNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Allergy Documentation Section */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-600" aria-hidden="true" />
                  <span>Allergies & Adverse Drug Reactions</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  {activePatient?.allergies?.length || 0} Documented
                </span>
              </div>

              {activePatient?.allergies && activePatient.allergies.length > 0 ? (
                <div className="space-y-1.5">
                  {activePatient.allergies.map((allergy, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-red-900">{allergy.allergen}</span>
                        <span className="text-slate-600 ml-2">— {allergy.reaction}</span>
                      </div>
                      <Badge variant="danger" size="sm">
                        {allergy.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No drug or food allergies documented yet.</p>
              )}

              {/* Add New Allergy Inline Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa, Latex"
                  value={newAllergen}
                  onChange={(e) => setNewAllergen(e.target.value)}
                  aria-label="Allergen name"
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
                <select
                  value={allergySeverity}
                  onChange={(e) => setAllergySeverity(e.target.value as any)}
                  aria-label="Allergy severity"
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <option value="MILD">Mild (Rash, itching)</option>
                  <option value="MODERATE">Moderate (Urticaria, vomiting)</option>
                  <option value="SEVERE">Severe (Anaphylaxis, airway compromise)</option>
                </select>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reaction description"
                    value={allergyReaction}
                    onChange={(e) => setAllergyReaction(e.target.value)}
                    aria-label="Reaction description"
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddAllergy}
                    disabled={!newAllergen}
                    className="h-8 shrink-0 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Logged as: <strong>{userName}</strong>
              </span>
              <div className="flex gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Complete Assessment & Route Patient
                </Button>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
