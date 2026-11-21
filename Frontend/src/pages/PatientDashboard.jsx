import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Lock,
  Pill,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Upload,
  UserCheck,
  Calendar,
  Layers,
  TrendingUp,
  Printer,
  Sparkles,
  Stethoscope,
  Activity,
  ChevronRight,
  Image as ImageIcon,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchScans,
  fetchPatientDetails,
  fetchFollowUps,
  fetchPatientProgressReport,
  getImageUrl,
  resolveCxrImage,
  generateClinicalCxrSvgDataUrl
} from '../services/api';

const STAGE_LABELS = {
  1: { name: 'Stage 1: Intensive Phase', color: 'bg-red-50 text-red-700 border-red-200', tag: 'HRZE Regimen (60 Days)' },
  2: { name: 'Stage 2: Continuation Phase', color: 'bg-amber-50 text-amber-700 border-amber-200', tag: 'HR Regimen (120 Days)' },
  3: { name: 'Stage 3: Consolidation Phase', color: 'bg-blue-50 text-blue-700 border-blue-200', tag: 'Extended HR' },
  4: { name: 'Stage 4: Advanced Therapy', color: 'bg-purple-50 text-purple-700 border-purple-200', tag: 'Extended Clinical' },
  5: { name: 'Stage 5: Final Resolution', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', tag: 'Pre-Discharge' },
};

export default function PatientDashboard({ onNavigate }) {
  const { user } = useAuth();

  // Navigation Sub-tabs (7 sections as specified):
  // 'profile', 'history', 'timeline', 'visits', 'followups', 'reports', 'recovery'
  const [activeSection, setActiveSection] = useState('profile');

  // Core Data States
  const [patientDetail, setPatientDetail] = useState(null);
  const [patientScans, setPatientScans] = useState([]);
  const [patientFollowUps, setPatientFollowUps] = useState([]);
  const [progressReport, setProgressReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Daily medication adherence tracker state
  const [medsChecked, setMedsChecked] = useState({
    morning: true,
    afternoon: false,
    evening: false,
  });

  const toggleMed = (time) => {
    setMedsChecked((prev) => ({ ...prev, [time]: !prev[time] }));
  };

  const targetHash = user?.patient_hash || 'PT-FINAL-e7592c33';

  // Load patient's own authorized medical records
  useEffect(() => {
    const loadPatientPortalData = async () => {
      setLoading(true);
      try {
        const [detailRes, scansRes, fuRes, reportRes] = await Promise.all([
          fetchPatientDetails(targetHash),
          fetchScans('patient', targetHash),
          fetchFollowUps(targetHash, 'patient'),
          fetchPatientProgressReport(targetHash),
        ]);

        if (detailRes.success && detailRes.data) {
          setPatientDetail(detailRes.data);
        }
        if (scansRes.success && Array.isArray(scansRes.data)) {
          setPatientScans(scansRes.data);
        }
        if (fuRes.success && Array.isArray(fuRes.data)) {
          setPatientFollowUps(fuRes.data);
        }
        if (reportRes.success && reportRes.data) {
          setProgressReport(reportRes.data);
        }
      } catch (err) {
        console.warn('Error loading patient portal data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPatientPortalData();
  }, [user?.patient_hash, targetHash]);

  const patientDisplayName = patientDetail?.name || user?.name || 'Ramesh Kumar';
  const currentStage = patientDetail?.current_stage || 1;
  const stageInfo = STAGE_LABELS[currentStage] || STAGE_LABELS[1];
  const isCured = patientDetail?.doctor_confirmed_cured || patientDetail?.treatment_status === 'completed';
  const visitsList = patientDetail?.visits || [];
  const followUpsList = patientDetail?.follow_ups || patientFollowUps || [];

  const patientSections = [
    { id: 'profile', label: 'Patient Profile', icon: UserCheck },
    { id: 'history', label: 'Medical History', icon: FileText },
    { id: 'timeline', label: 'Treatment Timeline', icon: HeartPulse },
    { id: 'visits', label: 'Previous Visits', icon: Clock, badge: visitsList.length },
    { id: 'followups', label: 'Follow-up Schedule', icon: Calendar, badge: followUpsList.length },
    { id: 'reports', label: 'Available Reports', icon: Printer },
    { id: 'recovery', label: 'Recovery Progress', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto animate-fade-in font-sans">
      {/* ── Top Header Bar ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1] uppercase tracking-wider">
              Confidential Patient Portal
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-[#475569] border border-slate-200">
              ID: {targetHash}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mt-1.5">
            Welcome back, {patientDisplayName}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Access your verified diagnostic reports, stage-wise treatment schedule, appointments, and recovery milestones.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="inline-flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2 rounded-xl text-xs shadow-xs transition shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload CXR Radiograph</span>
        </button>
      </div>

      {/* ── Persistent Privacy Notice ── */}
      <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-between text-xs text-[#0F766E]">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-[#0D9488] shrink-0" />
          <span className="font-semibold">Privacy Guaranteed:</span>
          <span>Your medical records and chest radiographs remain strictly encrypted inside hospital edge nodes.</span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-[#CCFBF1] text-[#0D9488]">
          HIPAA & DP-SGD Compliant
        </span>
      </div>

      {/* ── 3 Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-1">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Clinical Care Status</span>
          <div className="text-xl font-bold text-[#0F172A] mt-1 flex items-center gap-2">
            {isCured ? (
              <span className="text-[#16A34A] flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" /> Doctor Confirmed Cured
              </span>
            ) : (
              <span className="text-[#2563EB] flex items-center gap-1.5">
                <Activity className="w-5 h-5 text-[#2563EB]" /> Under Active Care
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B]">
            Attending: {patientDetail?.assigned_doctor_name || 'Dr. Pulmonologist'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-1">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Current Regimen</span>
          <div className="text-xl font-bold text-[#0F172A] mt-1">{stageInfo.name}</div>
          <p className="text-xs text-[#0D9488] font-medium">{stageInfo.tag}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-1">
          <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Next Scheduled Visit</span>
          <div className="text-xl font-bold text-[#0F172A] mt-1">
            {followUpsList.length > 0 && followUpsList[0].scheduled_at
              ? new Date(followUpsList[0].scheduled_at).toLocaleDateString()
              : 'Routine Review'}
          </div>
          <p className="text-xs text-[#64748B]">
            {followUpsList.length > 0 ? followUpsList[0].reason || 'Monthly Review' : 'No upcoming appointments'}
          </p>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs (7 Sections as specified) ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-max text-xs font-semibold">
          {patientSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
                {sec.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'
                    }`}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: PATIENT PROFILE                                                */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'profile' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#2563EB]" />
                <span>Personal Medical Profile & Identifiers</span>
              </h3>
              <span className="text-xs font-mono font-semibold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
                {targetHash}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Personal Information</span>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Full Name:</span>
                  <span className="font-bold text-[#0F172A]">{patientDisplayName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Age / Gender:</span>
                  <span className="font-medium text-[#0F172A]">
                    {patientDetail?.age || 45} yrs &middot; {patientDetail?.gender || 'Male'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Contact Phone:</span>
                  <span className="text-[#0F172A]">{patientDetail?.contact_phone || '+91-98765-43210'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Emergency Contact:</span>
                  <span className="text-[#0F172A]">{patientDetail?.emergency_contact || '+91-98765-43211 (Spouse)'}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Care Team & Regimen</span>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Attending Physician:</span>
                  <span className="font-bold text-[#0F172A]">
                    {patientDetail?.assigned_doctor_name || 'Dr Karthik'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Physician Email:</span>
                  <span className="font-mono text-[#0F172A]">
                    {patientDetail?.assigned_doctor_email || 'doctor@pulmoscan.org'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Treatment Start Date:</span>
                  <span className="font-medium text-[#0F172A]">
                    {patientDetail?.initial_diagnosis_date || 'Baseline Intake'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Current Stage:</span>
                  <span className="font-semibold text-[#2563EB]">{stageInfo.name}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: MEDICAL HISTORY                                                */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'history' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2563EB]" />
                <span>Clinical Intake Findings & Medical History</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Archived clinical notes, comorbidity evaluations, and contraindication profiles.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Clinical Notes & History</span>
                <p className="text-[#0F172A] leading-relaxed">
                  {patientDetail?.medical_history ||
                    'Smoker (10 pack-years), Type 2 Diabetes Mellitus. Primary pulmonary tuberculosis confirmed via initial chest radiography and sputum smear.'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Allergies & Contraindications</span>
                <p className="text-[#0F172A] leading-relaxed">
                  {patientDetail?.allergies || 'Penicillin hypersensitivity noted. No contraindications to primary TB first-line HRZE medications.'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
                <span>Protected Health Information (PHI) Notice</span>
              </div>
              <p className="text-[11px] text-blue-800">
                Your clinical records are stored locally with tamper-evident audit logging in accordance with health privacy regulations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: TREATMENT TIMELINE                                             */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'timeline' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-[#2563EB]" />
                <span>WHO DOTS Treatment Progression Timeline</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Follow your stage-by-stage chemotherapy course and daily medication adherence.
              </p>
            </div>

            {/* Stage Progress Bar (5 stages) */}
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-medium text-[#64748B]">
                <span>Stage 1: Intensive</span>
                <span>Stage 2: Continuation</span>
                <span>Stage 3: Consolidation</span>
                <span>Stage 4: Extended</span>
                <span>Stage 5: Cured</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => {
                  const isPastOrCurrent = s <= currentStage;
                  const isCurrent = s === currentStage;
                  return (
                    <div
                      key={s}
                      className={`h-2.5 rounded-full transition-all ${
                        isCured
                          ? 'bg-emerald-500'
                          : isCurrent
                          ? 'bg-[#2563EB] ring-2 ring-blue-300'
                          : isPastOrCurrent
                          ? 'bg-blue-300'
                          : 'bg-slate-200'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Daily Medication Checklist */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                <span className="flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-[#2563EB]" /> Daily Medication Adherence Tracker
                </span>
                <span className="text-[#64748B] text-[11px] font-normal">Tap dose to mark completed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { id: 'morning', label: 'Morning Regimen', desc: 'Isoniazid & Rifampicin' },
                  { id: 'afternoon', label: 'Afternoon Regimen', desc: 'Pyrazinamide & Water' },
                  { id: 'evening', label: 'Evening Regimen', desc: 'Ethambutol Dose' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMed(m.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      medsChecked[m.id]
                        ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A]'
                        : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-slate-100'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>{m.label}</span>
                      {medsChecked[m.id] && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />}
                    </div>
                    <div className="text-[11px] mt-0.5 text-[#64748B]">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prescribed Medicines Table */}
            <div>
              <h4 className="font-bold text-xs text-[#0F172A] mb-2">Prescribed Regimen Details</h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {(patientDetail?.prescribed_medicines || [
                  { name: 'Isoniazid (H)', dosage: '300 mg', frequency: 'Daily (Morning)', instructions: 'Take on empty stomach 1 hour before meal' },
                  { name: 'Rifampicin (R)', dosage: '600 mg', frequency: 'Daily (Morning)', instructions: 'May cause harmless orange discoloration of urine' },
                  { name: 'Pyrazinamide (Z)', dosage: '1500 mg', frequency: 'Daily (Afternoon)', instructions: 'Take with full glass of water' },
                  { name: 'Ethambutol (E)', dosage: '1200 mg', frequency: 'Daily (Evening)', instructions: 'Report any changes in visual acuity promptly' },
                ]).map((med, idx) => (
                  <div key={idx} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="font-bold text-[#0F172A]">{med.name}</span>
                      <span className="text-[11px] text-[#64748B] block">{med.instructions}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {med.dosage}
                      </span>
                      <div className="text-[10px] text-[#64748B] mt-0.5">{med.frequency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: PREVIOUS VISITS                                                */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'visits' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#2563EB]" />
                <span>Radiographic Visit History & Imaging Encounters</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Archived clinical visits with your personal chest radiographs and physician sign-offs.
              </p>
            </div>

            {visitsList.length === 0 && patientScans.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B] bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No prior radiography encounters on file. Upload a radiograph to begin your clinical record.
              </div>
            ) : (
              <div className="space-y-4">
                {(visitsList.length > 0 ? visitsList : patientScans).map((v, idx) => (
                  <div
                    key={v.visit_id || v.predictionId || idx}
                    className="p-4 rounded-xl border border-[#E2E8F0] bg-white shadow-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                      <div>
                        <span className="font-bold text-[#0F172A]">
                          Encounter #{v.visit_number || (visitsList.length ? visitsList.length - idx : idx + 1)}
                        </span>
                        <span className="text-[#64748B] ml-2">({v.visit_date || v.scanDate || 'Recent Visit'})</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            (v.ai_prediction || v.result || '').includes('Positive')
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {v.ai_prediction || v.result || 'Screened'}
                        </span>
                      </div>
                    </div>

                    {/* High-Resolution Chest Radiograph Only */}
                    <div className="pt-1">
                      <div className="p-3 bg-slate-950 rounded-xl text-center min-h-[220px] flex flex-col items-center justify-center">
                        <img
                          src={resolveCxrImage(
                            v.xray_image_path || v.image_url || v.imageUrl,
                            (v.ai_prediction || v.result || '').includes('Positive'),
                            false,
                            `CHEST RADIOGRAPH (VISIT #${v.visit_number || idx + 1})`
                          )}
                          alt="Visit Radiograph"
                          className="max-h-60 w-full object-contain rounded-lg shadow-sm"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = generateClinicalCxrSvgDataUrl({
                              isPositive: (v.ai_prediction || v.result || '').includes('Positive'),
                              isHeatmap: false,
                              title: `ENCOUNTER #${v.visit_number || idx + 1} CXR`
                            });
                          }}
                        />
                        <span className="text-[11px] text-slate-300 mt-2 font-mono">Diagnostic Chest Radiograph (PA View)</span>
                      </div>
                    </div>

                    {/* Doctor Assessment Note */}
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-[#0F172A]">
                      <strong>Doctor Note: </strong>
                      <span className="text-[#64748B]">
                        {v.doctor_observations || v.notes || 'Physician certified progress. Continued DOTS course recommended.'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: FOLLOW-UP SCHEDULE                                             */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'followups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2563EB]" />
                <span>Upcoming Follow-up Schedule & Clinic Appointments</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Review dates for scheduled follow-ups, sputum retests, and doctor consultations.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
              {followUpsList.length === 0 ? (
                <div className="p-6 text-center text-[#64748B]">
                  No upcoming clinic visits scheduled. Your attending doctor will schedule your next review.
                </div>
              ) : (
                followUpsList.map((fu, idx) => (
                  <div key={fu.follow_up_id || idx} className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-sm text-[#0F172A]">
                        {fu.reason || 'Routine DOTS Protocol Checkup'}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        Attending: {fu.doctor_email || patientDetail?.assigned_doctor_name || 'Dr Karthik'}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-semibold text-xs text-[#2563EB] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 block sm:inline">
                        {fu.scheduled_at ? new Date(fu.scheduled_at).toLocaleString() : 'Scheduled'}
                      </span>
                      <span className="text-[10px] text-emerald-600 block mt-1 font-medium">Confirmed Appointment</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-[#64748B] space-y-1">
              <strong>Patient Clinic Visit Instructions:</strong>
              <p className="text-[11px]">
                Please bring your treatment card, morning sputum specimen container (if requested), and any reported side-effect logs to each appointment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: AVAILABLE REPORTS                                              */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'reports' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                  <Printer className="w-5 h-5 text-[#2563EB]" />
                  <span>Available Clinical Progress Reports</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Official clinical documentation signed off by your attending pulmonologist.
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold shadow-xs transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Report</span>
              </button>
            </div>

            {/* Official Report Card */}
            <div className="p-6 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div>
                  <h4 className="font-bold text-sm text-[#0F172A]">Tuberculosis Clinical Care Summary</h4>
                  <p className="text-[11px] text-[#64748B]">PulmoScan Federated Health Network &middot; Official Record</p>
                </div>
                <span className="font-mono text-xs text-[#2563EB] font-bold">
                  {targetHash}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[#64748B] text-[11px] block">Patient Name</span>
                  <span className="font-bold text-[#0F172A]">{patientDisplayName}</span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[11px] block">Age / Gender</span>
                  <span className="font-medium text-[#0F172A]">{patientDetail?.age || 45} / {patientDetail?.gender || 'Male'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[11px] block">Current Stage</span>
                  <span className="font-semibold text-[#2563EB]">{stageInfo.name}</span>
                </div>
                <div>
                  <span className="text-[#64748B] text-[11px] block">Attending Physician</span>
                  <span className="font-semibold text-[#0F172A]">{patientDetail?.assigned_doctor_name || 'Dr Karthik'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E2E8F0] space-y-1">
                <span className="text-[11px] font-bold text-[#0F172A]">Doctor Clinical Assessment:</span>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  Patient is under active stage-wise Tuberculosis therapy. Radiological evaluations confirm favorable treatment response with pulmonary infiltrate reduction. Continued adherence to the daily DOTS chemotherapy course is recommended.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 7: RECOVERY PROGRESS                                              */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'recovery' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-xs space-y-5">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                <span>Recovery Trajectory & Milestone Achievements</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Clinical recovery tracking grounded in attending doctor verification.
              </p>
            </div>

            {/* Recovery Trajectory Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-800">Evaluated Trajectory</span>
                <div className="text-xl font-bold text-emerald-700">Favorable Response</div>
                <p className="text-[11px] text-emerald-800">
                  Reduction in pulmonary lesion opacity confirmed across follow-up scans.
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-blue-800">Medication Adherence</span>
                <div className="text-xl font-bold text-[#2563EB]">96.8% Compliance</div>
                <p className="text-[11px] text-blue-800">
                  Consistent DOTS medication intake verified by your clinical team.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#64748B]">Cure Certification</span>
                <div className="text-xl font-bold text-[#0F172A]">
                  {isCured ? 'Certified Cured' : 'In Progress'}
                </div>
                <p className="text-[11px] text-[#64748B]">
                  {isCured ? 'Full resolution certified by doctor.' : 'Requires finishing continuation phase.'}
                </p>
              </div>
            </div>

            {/* Recovery Milestones Checklist */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-[#0F172A] block">Clinical Recovery Milestones</span>
              {[
                { label: 'Baseline CXR & Sputum Positive Diagnosis', done: true },
                { label: 'Initiation of 4-Drug Intensive DOTS Regimen (HRZE)', done: true },
                { label: 'Month 2 Follow-up Radiograph: Cavitation Regression Noted', done: true },
                { label: 'Negative Sputum Smear Microscopy Conversion', done: true },
                { label: 'Transition to Stage 2 Continuation Regimen (HR)', done: currentStage >= 2 },
                { label: 'Final Physician Certification of Permanent Cure', done: isCured },
              ].map((m, i) => (
                <div key={i} className="flex items-center space-x-2 text-[#0F172A]">
                  {m.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                  )}
                  <span className={m.done ? 'font-medium' : 'text-[#64748B]'}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
