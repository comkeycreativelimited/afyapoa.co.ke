'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  UserPlus,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  GitMerge,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Eye,
  Activity,
  ArrowRight,
} from 'lucide-react';
import { usePatientContext } from '../../contexts/PatientContext';

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  phoneMasked: string;
  county: string;
  identityStatus: 'LOCAL_ONLY' | 'PENDING_VERIFICATION' | 'VERIFIED_EXTERNAL' | 'RECONCILED' | 'MERGED';
  isExternallyVerified: boolean;
  upi?: string | null;
  dhaCrid?: string | null;
  reconciledIntoPatientId?: string | null;
  emergencyContact?: { name: string; relationship: string; phone: string } | null;
}

export default function PatientsPage() {
  const router = useRouter();
  const { selectPatientById, addNewPatient } = usePatientContext();

  const [activeTab, setActiveTab] = useState<'search' | 'register' | 'emergency' | 'reconcile'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'name' | 'nationalId' | 'phone' | 'upi'>('name');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Mock initial patients representing local vs externally verified
  const [patientList, setPatientList] = useState<Patient[]>([
    {
      id: 'p-101',
      mrn: 'MRN-202610-0012',
      firstName: 'Amina',
      middleName: 'Fatuma',
      lastName: 'Bakari',
      dateOfBirth: '1995-07-24',
      gender: 'FEMALE',
      phoneMasked: '+2547****5678',
      county: 'Mombasa',
      identityStatus: 'VERIFIED_EXTERNAL',
      isExternallyVerified: true,
      upi: 'UPI-KEN-2026-12345678',
      dhaCrid: 'CRID-KE-DHA-12345678',
      emergencyContact: {
        name: 'Hassan Bakari',
        relationship: 'SPOUSE',
        phone: '+254722998877',
      },
    },
    {
      id: 'p-102',
      mrn: 'MRN-202610-0015',
      firstName: 'David',
      middleName: 'Kiprono',
      lastName: 'Kipkorir',
      dateOfBirth: '1992-09-18',
      gender: 'MALE',
      phoneMasked: '+2547****2233',
      county: 'Nakuru',
      identityStatus: 'LOCAL_ONLY',
      isExternallyVerified: false,
      upi: null,
      dhaCrid: null,
      emergencyContact: {
        name: 'Grace Kipkorir',
        relationship: 'SISTER',
        phone: '+254733112233',
      },
    },
    {
      id: 'p-103',
      mrn: 'MRN-202610-0099',
      firstName: 'EMERGENCY',
      middleName: 'TRAUMA',
      lastName: 'UNKNOWN-MALE-A8K2Z',
      dateOfBirth: '1996-01-01',
      gender: 'MALE',
      phoneMasked: 'Unregistered',
      county: 'Nairobi',
      identityStatus: 'LOCAL_ONLY',
      isExternallyVerified: false,
      upi: null,
      dhaCrid: null,
    },
  ]);

  // Form states
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE' as const,
    phone: '',
    nationalId: '',
    county: 'Nairobi',
    subCounty: '',
    emergencyName: '',
    emergencyPhone: '',
    consentAccepted: true,
  });

  const [emergencyData, setEmergencyData] = useState({
    gender: 'MALE' as const,
    estimatedAge: 30,
    triageNotes: '',
  });

  const [reconcileData, setReconcileData] = useState({
    targetMrn: 'MRN-202610-0012',
    sourceMrn: 'MRN-202610-0099',
    reason: '',
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleRegister = (e: FormEvent) => {
    e.preventDefault();
    const newMrn = `MRN-202610-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPat: Patient = {
      id: `p-${Date.now()}`,
      mrn: newMrn,
      firstName: formData.firstName,
      middleName: formData.middleName || null,
      lastName: formData.lastName,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      phoneMasked: formData.phone ? `+2547****${formData.phone.slice(-4)}` : 'Unregistered',
      county: formData.county,
      identityStatus: 'LOCAL_ONLY',
      isExternallyVerified: false,
      emergencyContact: formData.emergencyName
        ? {
            name: formData.emergencyName,
            relationship: 'NEXT_OF_KIN',
            phone: formData.emergencyPhone,
          }
        : null,
    };

    setPatientList([newPat, ...patientList]);
    addNewPatient({
      id: newPat.id,
      mrn: newPat.mrn,
      fullName: `${newPat.firstName} ${newPat.middleName ? newPat.middleName + ' ' : ''}${newPat.lastName}`,
      dob: newPat.dateOfBirth,
      age: new Date().getFullYear() - parseInt(newPat.dateOfBirth.slice(0, 4) || '2000', 10),
      gender: newPat.gender,
      nationalId: formData.nationalId || undefined,
      county: newPat.county,
      isExternallyVerified: false,
      upi: null,
      dhaCrid: null,
      shaContract: 'SHA-CTR-00101',
      shaScheme: 'SHIF Standard',
      allergies: [],
    });
    setNotification({
      type: 'success',
      message: `Patient ${formData.firstName} ${formData.lastName} registered successfully with MRN ${newMrn}. Identity marked as LOCAL_ONLY pending DHA verification.`,
    });
    setActiveTab('search');
  };

  const handleEmergencyIntake = (e: FormEvent) => {
    e.preventDefault();
    const shortCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newMrn = `MRN-202610-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPat: Patient = {
      id: `p-${Date.now()}`,
      mrn: newMrn,
      firstName: 'EMERGENCY',
      middleName: 'TRAUMA',
      lastName: `UNKNOWN-${emergencyData.gender}-${shortCode}`,
      dateOfBirth: `${new Date().getFullYear() - emergencyData.estimatedAge}-01-01`,
      gender: emergencyData.gender,
      phoneMasked: 'Unregistered',
      county: 'Nairobi',
      identityStatus: 'LOCAL_ONLY',
      isExternallyVerified: false,
    };

    setPatientList([newPat, ...patientList]);
    addNewPatient({
      id: newPat.id,
      mrn: newPat.mrn,
      fullName: `${newPat.firstName} ${newPat.middleName ? newPat.middleName + ' ' : ''}${newPat.lastName}`,
      dob: newPat.dateOfBirth,
      age: emergencyData.estimatedAge,
      gender: newPat.gender,
      nationalId: undefined,
      county: 'Nairobi',
      isExternallyVerified: false,
      upi: null,
      dhaCrid: null,
      shaContract: 'SHA-CTR-00101',
      shaScheme: 'ECCIF Emergency Fund',
      allergies: [],
      triageAcuity: 'RESUSCITATION' as const,
    });
    setNotification({
      type: 'success',
      message: `Emergency patient registered with temporary MRN ${newMrn} and alias ${newPat.lastName}.`,
    });
    setActiveTab('search');
  };

  const handleVerifyDha = async (patientId: string) => {
    setIsVerifying(true);
    setVerifyMessage('Querying Kenya Digital Health Agency Client Registry...');

    // Simulate Client Registry API call
    setTimeout(() => {
      setPatientList((prev) =>
        prev.map((p) => {
          if (p.id === patientId) {
            return {
              ...p,
              identityStatus: 'VERIFIED_EXTERNAL',
              isExternallyVerified: true,
              upi: 'UPI-KEN-2026-12345678',
              dhaCrid: 'CRID-KE-DHA-12345678',
            };
          }
          return p;
        }),
      );
      if (selectedPatient && selectedPatient.id === patientId) {
        setSelectedPatient({
          ...selectedPatient,
          identityStatus: 'VERIFIED_EXTERNAL',
          isExternallyVerified: true,
          upi: 'UPI-KEN-2026-12345678',
          dhaCrid: 'CRID-KE-DHA-12345678',
        });
      }
      setIsVerifying(false);
      setVerifyMessage('Identity successfully verified against DHA Client Registry! Assigned UPI: UPI-KEN-2026-12345678');
    }, 1200);
  };

  const handleReconcile = (e: FormEvent) => {
    e.preventDefault();
    setPatientList((prev) =>
      prev.map((p) => {
        if (p.mrn === reconcileData.sourceMrn) {
          return {
            ...p,
            identityStatus: 'MERGED',
            reconciledIntoPatientId: reconcileData.targetMrn,
          };
        }
        if (p.mrn === reconcileData.targetMrn) {
          return {
            ...p,
            identityStatus: 'RECONCILED',
          };
        }
        return p;
      }),
    );

    setNotification({
      type: 'success',
      message: `Safe non-destructive reconciliation complete: Record ${reconcileData.sourceMrn} merged into survivor ${reconcileData.targetMrn}. Historical provenance preserved.`,
    });
    setActiveTab('search');
  };

  const filteredPatients = patientList.filter((p) => {
    if (!searchQuery.trim()) return true;
    const term = searchQuery.toLowerCase();
    if (searchType === 'name') {
      return (
        p.firstName.toLowerCase().includes(term) ||
        p.lastName.toLowerCase().includes(term) ||
        p.mrn.toLowerCase().includes(term)
      );
    }
    if (searchType === 'phone') {
      return p.phoneMasked.includes(term);
    }
    if (searchType === 'upi') {
      return p.upi?.toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto w-full space-y-8">
        {/* Top Navbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              aria-label="Back to Dashboard"
              title="Back to Dashboard"
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-400" />
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  Patient Registration & Identity Management
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Kenya DHA HIE Client Registry Integration • DPA 2019 Sovereign Isolation • Field Encryption
              </p>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60">
            <button
              onClick={() => {
                setActiveTab('search');
                setSelectedPatient(null);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'search'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              Patient Search
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'register'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              New Registration
            </button>
            <button
              onClick={() => setActiveTab('emergency')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'emergency'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Emergency Intake
            </button>
            <button
              onClick={() => setActiveTab('reconcile')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'reconcile'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitMerge className="w-4 h-4" />
              Reconciliation
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notification && (
          <div
            className={`p-4 rounded-xl flex items-center justify-between border ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/40 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span className="text-sm">{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-xs font-semibold underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: PATIENT SEARCH & DIRECTORY */}
        {activeTab === 'search' && (
          <div className="space-y-6">
            {/* Search Filters Card */}
            <div className="p-5 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, MRN, National ID, or mobile number..."
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="patient-search-type" className="text-xs text-slate-400 whitespace-nowrap">Search By:</label>
                  <select
                    id="patient-search-type"
                    aria-label="Search By"
                    value={searchType}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setSearchType(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg text-xs text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="name">Name / MRN</option>
                    <option value="nationalId">National ID (Blind Index)</option>
                    <option value="phone">Kenyan Phone (Blind Index)</option>
                    <option value="upi">DHA UPI</option>
                  </select>
                </div>
              </div>

              {/* Status Badge Legend */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <span className="text-slate-400 font-medium">Identity Provenance Legend:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  VERIFIED_EXTERNAL (DHA UPI)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  LOCAL_ONLY (Facility Unverified)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  <GitMerge className="w-3.5 h-3.5" />
                  RECONCILED (Survivor Record)
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/60 font-medium">
                  MERGED (Deprecated Duplicate)
                </span>
              </div>
            </div>

            {/* Patient Table */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-4">MRN</th>
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Gender & Age</th>
                    <th className="py-3 px-4">Contact (Masked)</th>
                    <th className="py-3 px-4">Identity Status</th>
                    <th className="py-3 px-4">DHA UPI / CRID</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/50 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-emerald-400 text-xs">
                        {p.mrn}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        {p.firstName} {p.middleName ? `${p.middleName} ` : ''}{p.lastName}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 text-xs">
                        {p.gender} • {new Date().getFullYear() - parseInt(p.dateOfBirth.slice(0, 4))} yrs
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-xs">
                        {p.phoneMasked}
                      </td>
                      <td className="py-3.5 px-4">
                        {p.identityStatus === 'VERIFIED_EXTERNAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verified External
                          </span>
                        )}
                        {p.identityStatus === 'LOCAL_ONLY' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" />
                            Local Only
                          </span>
                        )}
                        {p.identityStatus === 'RECONCILED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <GitMerge className="w-3.5 h-3.5" />
                            Reconciled
                          </span>
                        )}
                        {p.identityStatus === 'MERGED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-400 border border-slate-600/60">
                            Merged ({p.reconciledIntoPatientId})
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                        {p.upi ? (
                          <span className="text-emerald-300 font-medium">{p.upi}</span>
                        ) : (
                          <span className="text-slate-500 italic">Not resolved</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatient(p);
                            selectPatientById(p.id);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            selectPatientById(p.id);
                            router.push('/triage');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition shadow-sm"
                        >
                          <Activity className="w-3.5 h-3.5" />
                          Triage →
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No patient records found matching query criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Selected Patient Drawer / Detail Modal */}
            {selectedPatient && (
              <div className="p-6 bg-slate-800 border border-slate-700 rounded-xl space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-700">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Patient Demographic & Identity Record: {selectedPatient.firstName} {selectedPatient.lastName}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">MRN: {selectedPatient.mrn}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close Drawer
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Demographics Card */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Demographics</h4>
                    <div className="text-xs space-y-1">
                      <p><span className="text-slate-500">Full Name:</span> {selectedPatient.firstName} {selectedPatient.middleName || ''} {selectedPatient.lastName}</p>
                      <p><span className="text-slate-500">Date of Birth:</span> {selectedPatient.dateOfBirth}</p>
                      <p><span className="text-slate-500">Gender:</span> {selectedPatient.gender}</p>
                      <p><span className="text-slate-500">County:</span> {selectedPatient.county}</p>
                    </div>
                  </div>

                  {/* Contact Card */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Next of Kin & Contact</h4>
                    <div className="text-xs space-y-1">
                      <p><span className="text-slate-500">Mobile (Encrypted):</span> {selectedPatient.phoneMasked}</p>
                      {selectedPatient.emergencyContact ? (
                        <>
                          <p><span className="text-slate-500">Emergency Contact:</span> {selectedPatient.emergencyContact.name}</p>
                          <p><span className="text-slate-500">Relationship:</span> {selectedPatient.emergencyContact.relationship}</p>
                          <p><span className="text-slate-500">Emergency Phone:</span> {selectedPatient.emergencyContact.phone}</p>
                        </>
                      ) : (
                        <p className="text-slate-500 italic">No emergency contact provided.</p>
                      )}
                    </div>
                  </div>

                  {/* DHA Resolution Card */}
                  <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Client Registry Status</h4>
                    <div className="text-xs space-y-1">
                      <p>
                        <span className="text-slate-500">Status:</span>{' '}
                        <span className={selectedPatient.isExternallyVerified ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                          {selectedPatient.identityStatus}
                        </span>
                      </p>
                      <p><span className="text-slate-500">DHA UPI:</span> {selectedPatient.upi || 'Awaiting Sync'}</p>
                      <p><span className="text-slate-500">CRID:</span> {selectedPatient.dhaCrid || 'Awaiting Sync'}</p>
                    </div>

                    {!selectedPatient.isExternallyVerified && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleVerifyDha(selectedPatient.id)}
                          disabled={isVerifying}
                          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                          {isVerifying ? 'Resolving UPI...' : 'Verify with Client Registry (Mock)'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {verifyMessage && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded text-xs text-emerald-300">
                    {verifyMessage}
                  </div>
                )}

                {/* Clinical Workflow Fast-Routing Actions */}
                <div className="pt-4 border-t border-slate-700 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      selectPatientById(selectedPatient.id);
                      router.push('/triage');
                    }}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Check-In & Send to Triage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      selectPatientById(selectedPatient.id);
                      router.push('/encounters');
                    }}
                    className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                  >
                    <span>Clinician Consultation</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NEW REGISTRATION */}
        {activeTab === 'register' && (
          <div className="p-6 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Register New Patient Intake</h2>
              <p className="text-xs text-slate-400 mt-1">
                Field validation applies Kenyan National ID and mobile phone rules. Sensitive PII fields are encrypted at rest with AES-256-GCM.
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Middle Name</label>
                  <input
                    type="text"
                    value={formData.middleName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, middleName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Last Name / Surname *</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="reg-gender" className="block text-xs font-medium text-slate-300 mb-1">Gender *</label>
                  <select
                    id="reg-gender"
                    aria-label="Gender"
                    value={formData.gender}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kenyan Mobile (e.g. 0712345678) *</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0712345678"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Kenyan National ID (6-9 digits)</label>
                  <input
                    type="text"
                    value={formData.nationalId}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, nationalId: e.target.value })}
                    placeholder="34567890"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">County of Residence</label>
                  <input
                    type="text"
                    value={formData.county}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, county: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Sub-County</label>
                  <input
                    type="text"
                    value={formData.subCounty}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, subCounty: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                  />
                </div>
              </div>

              {/* Next of Kin */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Emergency Next of Kin</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Emergency Contact Full Name</label>
                    <input
                      type="text"
                      value={formData.emergencyName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, emergencyName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Emergency Contact Phone Number</label>
                    <input
                      type="text"
                      value={formData.emergencyPhone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                      placeholder="+2547XXXXXXXX"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Statutory Consent */}
              <div className="flex items-start gap-3 p-4 bg-slate-900/80 border border-slate-800 rounded-lg">
                <input
                  type="checkbox"
                  id="consent"
                  checked={formData.consentAccepted}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, consentAccepted: e.target.checked })}
                  className="mt-1 w-4 h-4 text-emerald-600 rounded bg-slate-800 border-slate-700"
                />
                <label htmlFor="consent" className="text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-white">Statutory Privacy Notice (DPA 2019 Sec 30):</span> Patient has been provided with the data processing privacy notice and has granted consent for clinical processing and emergency referral data sharing under Kenya Data Protection Act 2019 policy version <code className="text-emerald-400 font-mono">KE-DPA-2019-V1</code>.
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Register Patient (Generate MRN)
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: EMERGENCY TRAUMA INTAKE */}
        {activeTab === 'emergency' && (
          <div className="p-6 bg-slate-800/60 border border-amber-500/30 rounded-xl space-y-6">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-bold text-white">Fast Emergency Trauma Intake</h2>
                <p className="text-xs text-amber-300/80 mt-0.5">
                  Used for unconscious, trauma, or unidentified arrivals at A&E. Generates immediate temporary Medical Record Number without blocking clinical orders.
                </p>
              </div>
            </div>

            <form onSubmit={handleEmergencyIntake} className="space-y-4 max-w-xl">
              <div>
                <label htmlFor="emergency-gender" className="block text-xs font-medium text-slate-300 mb-1">Observed Gender *</label>
                <select
                  id="emergency-gender"
                  aria-label="Observed Gender"
                  value={emergencyData.gender}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setEmergencyData({ ...emergencyData, gender: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="UNKNOWN">Unknown / Indeterminate</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Estimated Age in Years</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={emergencyData.estimatedAge}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmergencyData({ ...emergencyData, estimatedAge: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Urgent Triage & Injury Notes</label>
                <textarea
                  rows={3}
                  value={emergencyData.triageNotes}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setEmergencyData({ ...emergencyData, triageNotes: e.target.value })}
                  placeholder="e.g. Unconscious pedestrian admitted from road traffic collision along Mombasa Road..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Submit Emergency Arrival
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: RECONCILIATION */}
        {activeTab === 'reconcile' && (
          <div className="p-6 bg-slate-800/60 border border-purple-500/30 rounded-xl space-y-6">
            <div className="flex items-center gap-3 text-purple-400">
              <GitMerge className="w-6 h-6" />
              <div>
                <h2 className="text-lg font-bold text-white">Safe, Non-Destructive Patient Reconciliation</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Merge duplicate patient records with authorized Records Officer review. The duplicate record is deprecated as <code className="text-purple-300">MERGED</code> and pointed to the survivor record without losing historical encounter data.
                </p>
              </div>
            </div>

            <form onSubmit={handleReconcile} className="space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Survivor Record (MRN) *</label>
                <input
                  type="text"
                  required
                  value={reconcileData.targetMrn}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setReconcileData({ ...reconcileData, targetMrn: e.target.value })}
                  placeholder="MRN-202610-0012"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
                <span className="text-[11px] text-slate-500">The verified master record that will remain ACTIVE.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Source Duplicate Record to Merge (MRN) *</label>
                <input
                  type="text"
                  required
                  value={reconcileData.sourceMrn}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setReconcileData({ ...reconcileData, sourceMrn: e.target.value })}
                  placeholder="MRN-202610-0099"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
                <span className="text-[11px] text-slate-500">The duplicate record that will be set to MERGED status.</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Administrative & Clinical Justification *</label>
                <textarea
                  rows={3}
                  required
                  value={reconcileData.reason}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setReconcileData({ ...reconcileData, reason: e.target.value })}
                  placeholder="e.g. Relatives produced original Kenya National ID confirming emergency patient UNKNOWN-MALE-A8K2Z is patient Amina Bakari..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                >
                  Confirm Safe Merge
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
