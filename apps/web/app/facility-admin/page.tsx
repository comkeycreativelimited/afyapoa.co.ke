'use client';

import React, { useState } from 'react';
import {
  Building2,
  Users,
  Bed,
  TrendingUp,
  Clock,
  Plus,
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
import { useRoleContext } from '../../contexts/RoleContext';

interface StaffRosterEntry {
  id: string;
  staffName: string;
  cadre: string;
  councilRegistration: string;
  department: string;
  shift: 'MORNING (07:00-15:00)' | 'EVENING (14:00-22:00)' | 'NIGHT (21:00-08:00)' | 'ON_CALL';
  status: 'ACTIVE_DUTY' | 'ON_LEAVE' | 'RESTING';
}

interface WardBedStatus {
  id: string;
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercent: number;
  acuityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
}

export default function FacilityAdminPage() {
  const { t } = useTranslation();
  const { facilityName, facilityLevel } = useRoleContext();

  const [activeTab, setActiveTab] = useState<'ROSTER' | 'CENSUS' | 'KPIS' | 'AUDIT'>('ROSTER');

  const [staffRoster, setStaffRoster] = useState<StaffRosterEntry[]>([
    {
      id: 'st-01',
      staffName: 'Dr. Wanjiru Karanja',
      cadre: 'Medical Officer / Clinician',
      councilRegistration: 'KMPDC-A98124',
      department: 'Outpatient Clinic (OPD)',
      shift: 'MORNING (07:00-15:00)',
      status: 'ACTIVE_DUTY',
    },
    {
      id: 'st-02',
      staffName: 'Sister Beatrice Otieno',
      cadre: 'Nursing Officer / Triage Specialist',
      councilRegistration: 'NCK-RN-55120',
      department: 'Emergency & Triage Unit',
      shift: 'MORNING (07:00-15:00)',
      status: 'ACTIVE_DUTY',
    },
    {
      id: 'st-03',
      staffName: 'Kevin Kiprop',
      cadre: 'Medical Laboratory Technologist',
      councilRegistration: 'KMLTTB-TECH-4419',
      department: 'Main Laboratory LIS',
      shift: 'MORNING (07:00-15:00)',
      status: 'ACTIVE_DUTY',
    },
    {
      id: 'st-04',
      staffName: 'Pharm. Samuel Mutua',
      cadre: 'Pharmacist',
      councilRegistration: 'PPB-PHARM-8891',
      department: 'Main Pharmacy & Inpatient Dispensary',
      shift: 'MORNING (07:00-15:00)',
      status: 'ACTIVE_DUTY',
    },
    {
      id: 'st-05',
      staffName: 'Dr. Omondi George',
      cadre: 'Surgeon / Theatre Lead',
      councilRegistration: 'KMPDC-S1209',
      department: 'Major Operating Theatre',
      shift: 'ON_CALL',
      status: 'ACTIVE_DUTY',
    },
  ]);

  const wardBeds: WardBedStatus[] = [
    {
      id: 'w-1',
      wardName: 'Male Medical & Surgical Ward',
      totalBeds: 40,
      occupiedBeds: 36,
      availableBeds: 4,
      occupancyPercent: 90,
      acuityLevel: 'HIGH',
    },
    {
      id: 'w-2',
      wardName: 'Female Medical & Gynaecology Ward',
      totalBeds: 40,
      occupiedBeds: 34,
      availableBeds: 6,
      occupancyPercent: 85,
      acuityLevel: 'MODERATE',
    },
    {
      id: 'w-3',
      wardName: 'Pediatric Care Unit',
      totalBeds: 25,
      occupiedBeds: 15,
      availableBeds: 10,
      occupancyPercent: 60,
      acuityLevel: 'LOW',
    },
    {
      id: 'w-4',
      wardName: 'Maternity & Labour Ward',
      totalBeds: 30,
      occupiedBeds: 28,
      availableBeds: 2,
      occupancyPercent: 93,
      acuityLevel: 'HIGH',
    },
    {
      id: 'w-5',
      wardName: 'Intensive Care Unit (ICU / HDU)',
      totalBeds: 8,
      occupiedBeds: 8,
      availableBeds: 0,
      occupancyPercent: 100,
      acuityLevel: 'CRITICAL',
    },
  ];

  const totalFacilityBeds = wardBeds.reduce((acc, w) => acc + w.totalBeds, 0);
  const totalOccupiedBeds = wardBeds.reduce((acc, w) => acc + w.occupiedBeds, 0);
  const totalOccupancyPercent = Math.round((totalOccupiedBeds / totalFacilityBeds) * 100);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newDepartment, setNewDepartment] = useState('Outpatient Clinic (OPD)');
  const [newShift, setNewShift] = useState<'MORNING (07:00-15:00)' | 'EVENING (14:00-22:00)' | 'NIGHT (21:00-08:00)' | 'ON_CALL'>('MORNING (07:00-15:00)');
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName) return;

    const newEntry: StaffRosterEntry = {
      id: `st-${Date.now()}`,
      staffName: newStaffName,
      cadre: 'Clinical Staff Member',
      councilRegistration: 'KMPDC-VERIFIED-2026',
      department: newDepartment,
      shift: newShift,
      status: 'ACTIVE_DUTY',
    };

    setStaffRoster((prev) => [newEntry, ...prev]);
    setAssignModalOpen(false);
    setNewStaffName('');
    setAdminNotice(`Staff duty assignment created for ${newEntry.staffName} in ${newEntry.department}.`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500/10 text-rose-600 rounded-lg border border-rose-500/20">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {t('nav.facility_admin', 'Facility Administration & Operational Command')}
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {facilityName} • {facilityLevel} • Hospital Roster & Bed Census Management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setAssignModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9"
          >
            New Staff Assignment
          </Button>
        </div>
      </div>

      {adminNotice && (
        <ClinicalAlert
          severity="success"
          title="Administrative Action Complete"
          message={adminNotice}
          onDismiss={() => setAdminNotice(null)}
        />
      )}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Overall Bed Occupancy</span>
            <Bed className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {totalOccupancyPercent}%
          </div>
          <div className="text-[11px] text-slate-500">
            {totalOccupiedBeds} occupied / {totalFacilityBeds} total beds
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Active Duty Staff</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {staffRoster.filter((s) => s.status === 'ACTIVE_DUTY').length}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            100% critical shifts covered
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>Avg Triage Waiting Time</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            18.5 mins
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            Within &lt; 20 min statutory target
          </div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs font-semibold text-slate-500 flex items-center justify-between">
            <span>SHA Claim Approval Rate</span>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            98.4%
          </div>
          <div className="text-[11px] text-slate-500">
            KES 4.2M settled this cycle
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('ROSTER')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'ROSTER'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Staff Duty Rosters ({staffRoster.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CENSUS')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'CENSUS'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Inpatient Wards & Bed Occupancy
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('AUDIT')}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === 'AUDIT'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Facility Security & Access Audit Trail
        </button>
      </div>

      {/* Tab: Staff Duty Rosters */}
      {activeTab === 'ROSTER' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <AccessibleTable caption="Healthcare Practitioner Shift & Roster Assignments">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-xs">
              <tr>
                <th scope="col" className="p-3 text-left font-bold">Practitioner Name</th>
                <th scope="col" className="p-3 text-left font-bold">Professional Cadre</th>
                <th scope="col" className="p-3 text-left font-bold">Department</th>
                <th scope="col" className="p-3 text-left font-bold">Active Shift</th>
                <th scope="col" className="p-3 text-center font-bold">Duty Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {staffRoster.map((staff) => (
                <tr key={staff.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{staff.staffName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Reg: {staff.councilRegistration}
                    </div>
                  </td>
                  <td className="p-3 text-slate-700">{staff.cadre}</td>
                  <td className="p-3 font-medium text-slate-900">{staff.department}</td>
                  <td className="p-3 font-mono font-semibold text-slate-800">{staff.shift}</td>
                  <td className="p-3 text-center">
                    <Badge variant="success" size="sm">
                      {staff.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </AccessibleTable>
        </div>
      )}

      {/* Tab: Inpatient Wards & Bed Occupancy */}
      {activeTab === 'CENSUS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wardBeds.map((ward) => (
              <div
                key={ward.id}
                className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-sm text-slate-900">{ward.wardName}</h3>
                  <Badge
                    variant={
                      ward.acuityLevel === 'CRITICAL'
                        ? 'danger'
                        : ward.acuityLevel === 'HIGH'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="sm"
                  >
                    {ward.acuityLevel} ACUITY
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Occupancy:</span>
                    <span className="font-mono font-bold text-slate-900">{ward.occupancyPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        ward.occupancyPercent >= 90
                          ? 'bg-red-600'
                          : ward.occupancyPercent >= 75
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${ward.occupancyPercent}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
                  <div className="p-2 bg-slate-50 rounded">
                    <div className="text-slate-500">Occupied Beds:</div>
                    <div className="font-bold font-mono text-slate-900 text-sm">
                      {ward.occupiedBeds} / {ward.totalBeds}
                    </div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded">
                    <div className="text-slate-500">Available Beds:</div>
                    <div
                      className={`font-bold font-mono text-sm ${
                        ward.availableBeds === 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {ward.availableBeds} beds
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Audit Trail */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Facility Security & Privacy Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Cryptographically hashed audit records under Kenyan Data Protection Act 2019
              </p>
            </div>
            <Badge variant="info" size="sm">Immutable Ledger</Badge>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-400">2026-10-26 14:15:22 | </span>
                <span className="font-bold text-emerald-800">AUTHZ_CLINICAL_ACCESS</span>
                <span className="text-slate-600"> — Dr. Wanjiru Karanja accessed Encounter ENC-202610-0089</span>
              </div>
              <span className="text-[10px] text-slate-400">SHA256: 7e551e...8312</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-400">2026-10-26 14:10:05 | </span>
                <span className="font-bold text-red-800">EMERGENCY_OVERRIDE_ACTIVE</span>
                <span className="text-slate-600"> — Sister Beatrice Otieno admitted Emergency Trauma Patient p-103</span>
              </div>
              <span className="text-[10px] text-slate-400">SHA256: 280115...58b9</span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-400">2026-10-26 13:55:12 | </span>
                <span className="font-bold text-purple-800">ETIMS_INVOICE_FISCALIZED</span>
                <span className="text-slate-600"> — Lucy Nyambura signed fiscal receipt INV-202610-0409</span>
              </div>
              <span className="text-[10px] text-slate-400">SHA256: 57ceb1...26a0</span>
            </div>
          </div>
        </div>
      )}

      {/* New Assignment Dialog */}
      <AccessibleDialog
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Create Practitioner Duty Assignment"
        description="Assign verified clinical practitioner to department shift roster."
        maxWidth="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateAssignment} className="bg-emerald-600 hover:bg-emerald-700 font-bold">
              Save Assignment
            </Button>
          </div>
        }
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          <InputField
            label="Staff Full Name & Title"
            id="newStaffName"
            placeholder="e.g. Dr. Jane Mutheu (CO)"
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            required
          />

          <SelectField
            label="Clinical Department"
            id="newDepartment"
            value={newDepartment}
            onChange={(e) => setNewDepartment(e.target.value)}
            options={[
              { value: 'Outpatient Clinic (OPD)', label: 'Outpatient Clinic (OPD)' },
              { value: 'Emergency & Triage Unit', label: 'Emergency & Triage Unit' },
              { value: 'Main Laboratory LIS', label: 'Main Laboratory LIS' },
              { value: 'Main Pharmacy', label: 'Main Pharmacy' },
              { value: 'Male Medical Ward', label: 'Male Medical Ward' },
              { value: 'Maternity Ward', label: 'Maternity Ward' },
              { value: 'Major Operating Theatre', label: 'Major Operating Theatre' },
            ]}
          />

          <SelectField
            label="Duty Shift"
            id="newShift"
            value={newShift}
            onChange={(e) => setNewShift(e.target.value as any)}
            options={[
              { value: 'MORNING (07:00-15:00)', label: 'Morning (07:00 - 15:00)' },
              { value: 'EVENING (14:00-22:00)', label: 'Evening (14:00 - 22:00)' },
              { value: 'NIGHT (21:00-08:00)', label: 'Night (21:00 - 08:00)' },
              { value: 'ON_CALL', label: 'On-Call (24 Hours Emergency)' },
            ]}
          />
        </form>
      </AccessibleDialog>
    </div>
  );
}
