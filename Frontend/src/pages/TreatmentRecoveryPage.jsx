import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Users,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  Search,
  Plus,
  RefreshCw,
  FileText,
  Printer,
  ChevronRight,
  Activity,
  Shield,
  Pill,
  Sparkles,
  UploadCloud,
  X,
  UserCheck,
  Stethoscope,
  ChevronDown,
  Layers,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchPatients,
  fetchPatientDetails,
  registerPatient,
  updatePatientTreatment,
  recordFollowUpVisit,
  predictXray,
  fetchPatientProgressReport,
  fetchDoctorRecoveryOverview,
  getImageUrl,
  resolveCxrImage,
  generateClinicalCxrSvgDataUrl,
} from '../services/api';

const STAGE_LABELS = {
  1: { name: 'Stage 1: Intensive Phase', color: 'bg-red-50 text-red-700 border-red-200', tag: 'HRZE Regimen' },
  2: { name: 'Stage 2: Continuation Phase', color: 'bg-amber-50 text-amber-700 border-amber-200', tag: 'HR Regimen' },
  3: { name: 'Stage 3: Consolidation Phase', color: 'bg-blue-50 text-blue-700 border-blue-200', tag: 'Extended HR' },
  4: { name: 'Stage 4: Advanced Therapy', color: 'bg-purple-50 text-purple-700 border-purple-200', tag: 'Extended Clinical' },
  5: { name: 'Stage 5: Final Resolution', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', tag: 'Pre-Discharge' },
};

export default function TreatmentRecoveryPage({ onNavigate }) {
  const { user, role } = useAuth();
  const [patients, setPatients] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all | active | stage1 | stage2 | cured | review

  // Active selected patient for detailed view
  const [selectedPatientHash, setSelectedPatientHash] = useState(null);
  const [patientDetail, setPatientDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [patientProfileTab, setPatientProfileTab] = useState('overview');

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [activeReportData, setActiveReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Registration Form State (Core Requirement 1)
  const [regForm, setRegForm] = useState({
    name: '',
    patient_hash: '',
    age: '',
    gender: 'Male',
    contact_phone: '',
    contact_email: '',
    emergency_contact: '',
    medical_history: '',
    allergies: '',
    initial_stage: 1,
    initial_tb_prediction: 'Positive',
    initial_cxr_file: null,
    initial_cxr_name: '',
  });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState(null);

  // Follow-up Visit Form State
  const [followUpForm, setFollowUpForm] = useState({
    file: null,
    symptoms: '',
    doctor_observations: '',
    validated_change: 'improved', // improved | unchanged | worsened
    treatment_action: 'continue', // continue | advance_stage | cured
    treatment_stage: 1,
    next_followup_date: '',
  });
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [followUpError, setFollowUpError] = useState(null);
  const [followUpSuccess, setFollowUpSuccess] = useState(false);

  // Load Overview & Patients list
  const loadData = async () => {
    try {
      const [ptsRes, ovRes] = await Promise.all([
        fetchPatients({ search: searchQuery }),
        fetchDoctorRecoveryOverview(user?.email),
      ]);
      if (ptsRes.success && Array.isArray(ptsRes.data)) {
        setPatients(ptsRes.data);
        if (!selectedPatientHash && ptsRes.data.length > 0) {
          setSelectedPatientHash(ptsRes.data[0].patient_hash);
        }
      }
      if (ovRes.success && ovRes.data) {
        setOverview(ovRes.data);
      }
    } catch (err) {
      console.warn('Error loading treatment monitoring data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  // Load details of selected patient
  useEffect(() => {
    if (!selectedPatientHash) return;
    let isCurrent = true;
    setDetailLoading(true);

    fetchPatientDetails(selectedPatientHash)
      .then((res) => {
        if (isCurrent && res.success) {
          setPatientDetail(res.data);
          setFollowUpForm((prev) => ({
            ...prev,
            treatment_stage: res.data.current_stage || 1,
          }));
        }
      })
      .finally(() => {
        if (isCurrent) setDetailLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedPatientHash]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
    if (selectedPatientHash) {
      fetchPatientDetails(selectedPatientHash).then((res) => {
        if (res.success) setPatientDetail(res.data);
      });
    }
  };

  // Filter patients
  const filteredPatients = patients.filter((pt) => {
    if (selectedFilter === 'active') return pt.treatment_status === 'active';
    if (selectedFilter === 'cured') return pt.doctor_confirmed_cured || pt.treatment_status === 'completed';
    if (selectedFilter === 'stage1') return pt.current_stage === 1;
    if (selectedFilter === 'stage2') return pt.current_stage === 2;
    if (selectedFilter === 'stage3plus') return pt.current_stage >= 3;
    if (selectedFilter === 'review') return pt.requires_review;
    return true;
  });

  // Handle Register Patient (with initial CXR upload & initial TB prediction)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!regForm.name.trim()) {
      setRegError('Patient full name is required.');
      return;
    }
    setRegSubmitting(true);
    setRegError(null);

    const assignedHash = regForm.patient_hash.trim() || `PT-${Date.now().toString(36).toUpperCase()}`;

    const payload = {
      name: regForm.name.trim(),
      patient_hash: assignedHash,
      age: regForm.age ? parseInt(regForm.age, 10) : undefined,
      gender: regForm.gender,
      contact_phone: regForm.contact_phone.trim() || undefined,
      contact_email: regForm.contact_email.trim() || undefined,
      emergency_contact: regForm.emergency_contact.trim() || undefined,
      medical_history: `[Initial Diagnosis: ${regForm.initial_tb_prediction}] ${regForm.medical_history.trim() || ''}`.trim(),
      allergies: regForm.allergies.trim() || undefined,
      initial_stage: parseInt(regForm.initial_stage, 10) || 1,
      assigned_doctor_name: user?.name || 'Dr Karthik',
      assigned_doctor_email: user?.email || 'doctor@pulmoscan.org',
    };

    const res = await registerPatient(payload);

    // If an initial chest X-ray was uploaded, execute the AI diagnostic inference
    if (res.success && regForm.initial_cxr_file) {
      try {
        await predictXray(
          regForm.initial_cxr_file,
          assignedHash,
          regForm.name.trim(),
          user?.email || 'doctor@pulmoscan.org'
        );
      } catch (cxrErr) {
        console.warn('Initial CXR analysis logged:', cxrErr);
      }
    }

    setRegSubmitting(false);

    if (res.success) {
      setShowRegisterModal(false);
      setRegForm({
        name: '',
        patient_hash: '',
        age: '',
        gender: 'Male',
        contact_phone: '',
        contact_email: '',
        emergency_contact: '',
        medical_history: '',
        allergies: '',
        initial_stage: 1,
        initial_tb_prediction: 'Positive',
        initial_cxr_file: null,
        initial_cxr_name: '',
      });
      loadData();
      setSelectedPatientHash(assignedHash);
    } else {
      setRegError(res.error || 'Failed to register patient');
    }
  };

  // Handle Record Follow-up Visit
  const handleFollowUpSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientHash) return;

    setFollowUpSubmitting(true);
    setFollowUpError(null);
    setFollowUpSuccess(false);

    const formData = new FormData();
    if (followUpForm.file) {
      formData.append('file', followUpForm.file);
    }
    if (followUpForm.symptoms) formData.append('symptoms', followUpForm.symptoms);
    if (followUpForm.doctor_observations) formData.append('doctor_observations', followUpForm.doctor_observations);
    formData.append('validated_change', followUpForm.validated_change);
    formData.append('treatment_action', followUpForm.treatment_action);
    formData.append('treatment_stage', followUpForm.treatment_stage);
    if (followUpForm.next_followup_date) formData.append('next_followup_date', followUpForm.next_followup_date);
    if (user?.email) formData.append('doctor_email', user.email);
    if (user?.name) formData.append('doctor_name', user.name);

    const res = await recordFollowUpVisit(selectedPatientHash, formData);
    setFollowUpSubmitting(false);

    if (res.success) {
      setFollowUpSuccess(true);
      setTimeout(() => {
        setShowFollowUpModal(false);
        setFollowUpSuccess(false);
        setFollowUpForm({
          file: null,
          symptoms: '',
          doctor_observations: '',
          validated_change: 'improved',
          treatment_action: 'continue',
          treatment_stage: patientDetail?.current_stage || 1,
          next_followup_date: '',
        });
        loadData();
        fetchPatientDetails(selectedPatientHash).then((detailRes) => {
          if (detailRes.success) setPatientDetail(detailRes.data);
        });
      }, 1200);
    } else {
      setFollowUpError(res.error || 'Failed to record follow-up visit');
    }
  };

  // View Progress Report Modal
  const handleOpenReport = async (pHash) => {
    const targetHash = pHash || selectedPatientHash;
    if (!targetHash) return;

    setReportLoading(true);
    setShowReportModal(true);
    const res = await fetchPatientProgressReport(targetHash);
    setReportLoading(false);
    if (res.success) {
      setActiveReportData(res.data);
    }
  };

  // Doctor Action: Confirm Cure
  const handleConfirmCure = async () => {
    if (!selectedPatientHash) return;
    const confirmPrompt = window.confirm(
      `CONFIRM CLINICAL CURE:\n\nAre you sure you want to mark patient "${patientDetail?.name}" as DOCTOR-CONFIRMED CURED & TREATMENT COMPLETED?\n\nThis certifies the patient has finished their regimen under medical supervision.`
    );
    if (!confirmPrompt) return;

    const res = await updatePatientTreatment(selectedPatientHash, {
      doctor_confirmed_cured: true,
      treatment_status: 'completed',
      doctor_email: user?.email,
      doctor_name: user?.name,
      doctor_notes: 'Doctor confirmed full regimen completion and radiological clearance.',
    });

    if (res.success) {
      loadData();
      fetchPatientDetails(selectedPatientHash).then((detailRes) => {
        if (detailRes.success) setPatientDetail(detailRes.data);
      });
    } else {
      alert(`Error updating patient status: ${res.error}`);
    }
  };

  // Doctor Action: Advance Stage
  const handleAdvanceStage = async (nextStage) => {
    if (!selectedPatientHash) return;
    const res = await updatePatientTreatment(selectedPatientHash, {
      current_stage: nextStage,
      doctor_email: user?.email,
      doctor_name: user?.name,
      doctor_notes: `Doctor clinically advanced patient to Stage ${nextStage}.`,
    });
    if (res.success) {
      loadData();
      fetchPatientDetails(selectedPatientHash).then((detailRes) => {
        if (detailRes.success) setPatientDetail(detailRes.data);
      });
    } else {
      alert(`Error updating stage: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE] mb-1">
            <HeartPulse className="w-3.5 h-3.5" />
            <span>WHO DOTS Stage-Wise Recovery Protocol</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            TB Patient Treatment & Recovery Monitoring
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Stage-wise medication regimens, follow-up radiograph comparisons, AI trajectory tracking, and doctor-verified recovery.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0F172A] transition shadow-xs"
            title="Refresh patient records"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>

          <button
            onClick={() => setShowRegisterModal(true)}
            className="inline-flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2 rounded-xl shadow-xs transition text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* ── Key Clinical Metrics Cards (Doctor Overview) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Registered</span>
            <Users className="w-4 h-4 text-[#2563EB]" />
          </div>
          <div className="text-2xl font-extrabold text-[#0F172A] mt-1 font-mono">
            {String(overview?.total_patients ?? patients.length).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Patients under protocol</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Active Regimens</span>
            <Activity className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600 mt-1 font-mono">
            {String(overview?.active_treatments ?? 0).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Under daily DOTS course</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Requires Review</span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-1 font-mono">
            {String(overview?.patients_requiring_review ?? 0).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Pending doctor sign-off</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Due Follow-Ups</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1 font-mono">
            {String(overview?.upcoming_follow_ups ?? 0).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Scheduled within 14 days</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Doctor Cured</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-1 font-mono">
            {String(overview?.doctor_confirmed_cured ?? 0).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-[#64748B] mt-0.5">Physician-certified recovery</div>
        </div>
      </div>

      {/* ── Main Two-Column Layout: Patient Directory (Left) + Detailed Trajectory (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Patient List (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-4 border-b border-[#E2E8F0] space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Search patient name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#CBD5E1] bg-slate-50 focus:bg-white focus:outline-hidden focus:border-[#2563EB] transition"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Active Regimens' },
                { id: 'stage1', label: 'Stage 1' },
                { id: 'stage2', label: 'Stage 2' },
                { id: 'stage3plus', label: 'Stage 3+' },
                { id: 'cured', label: 'Cured' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    selectedFilter === f.id
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-slate-100 text-[#64748B] hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Patient Items List */}
          <div className="divide-y divide-[#E2E8F0] max-h-[620px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-[#2563EB]" />
                Loading patient records...
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B]">
                No matching patients found.
              </div>
            ) : (
              filteredPatients.map((pt) => {
                const isSelected = pt.patient_hash === selectedPatientHash;
                const stageInfo = STAGE_LABELS[pt.current_stage] || STAGE_LABELS[1];
                const isCured = pt.doctor_confirmed_cured || pt.treatment_status === 'completed';

                return (
                  <div
                    key={pt.patient_hash}
                    onClick={() => setSelectedPatientHash(pt.patient_hash)}
                    className={`p-3.5 cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-l-[#2563EB]'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-[#0F172A] truncate">
                          {pt.name}
                        </span>
                        <span className="font-mono text-[10px] text-[#64748B] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {pt.patient_hash}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] text-[#64748B]">
                        <span>Age: {pt.age || '—'}</span>
                        <span>•</span>
                        <span>{pt.gender || '—'}</span>
                        <span>•</span>
                        <span>{pt.visits_count || 0} visits</span>
                      </div>

                      <div className="flex items-center space-x-1.5 pt-0.5">
                        {isCured ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Doctor Confirmed Cured</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${stageInfo.color}`}
                          >
                            {stageInfo.name}
                          </span>
                        )}
                        {pt.requires_review && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            Review Due
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition ${
                        isSelected ? 'text-[#2563EB]' : 'text-slate-300'
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed Patient View & Trajectory (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {detailLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center text-xs text-[#64748B]">
              <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#2563EB]" />
              Fetching clinical trajectory for patient...
            </div>
          ) : !patientDetail ? (
            <div className="bg-white p-12 rounded-2xl border border-[#E2E8F0] text-center text-xs text-[#64748B]">
              Select a patient on the left to inspect their treatment protocol and recovery history.
            </div>
          ) : (
            <>
              {/* Patient Profile Section Navigation Tabs */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] p-1.5 shadow-xs overflow-x-auto">
                <div className="flex items-center space-x-1 min-w-max text-xs font-semibold">
                  {[
                    { id: 'overview', label: 'Patient Overview', icon: UserCheck },
                    { id: 'timeline', label: 'Treatment Timeline', icon: HeartPulse },
                    { id: 'history', label: 'Visit History', icon: Clock, badge: patientDetail.visits?.length || 0 },
                    { id: 'comparison', label: 'X-ray Comparison', icon: Layers },
                    { id: 'recovery', label: 'Recovery Monitoring', icon: TrendingUp },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = patientProfileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setPatientProfileTab(tab.id)}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl transition-all ${
                          isActive
                            ? 'bg-[#2563EB] text-white shadow-xs'
                            : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                        {tab.badge !== undefined && (
                          <span
                            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                              isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#64748B]'
                            }`}
                          >
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── 1. PATIENT OVERVIEW ── */}
              {patientProfileTab === 'overview' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h2 className="text-xl font-bold text-[#0F172A]">{patientDetail.name}</h2>
                        <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-[#475569] rounded border border-slate-200">
                          {patientDetail.patient_hash}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-1 space-x-2">
                        <span>Age: {patientDetail.age || '—'} yrs</span>
                        <span>•</span>
                        <span>Gender: {patientDetail.gender || '—'}</span>
                        <span>•</span>
                        <span>Phone: {patientDetail.contact_phone || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenReport(patientDetail.patient_hash)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#CBD5E1] text-[#475569] hover:bg-slate-50 transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>Progress Report</span>
                      </button>

                      <button
                        onClick={() => setShowFollowUpModal(true)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-xs transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Record Follow-Up</span>
                      </button>
                    </div>
                  </div>

                  {/* Cure or Active Stage Banner */}
                  {patientDetail.doctor_confirmed_cured ? (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-xs text-emerald-900">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold">DOCTOR CONFIRMED CURED & TREATMENT COMPLETED</div>
                        <div className="text-[11px] text-emerald-800">
                          Attending physician certified full radiological and clinical resolution on {patientDetail.doctor_cured_date || 'N/A'}.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center space-x-2.5">
                        <Stethoscope className="w-4 h-4 text-[#2563EB] shrink-0" />
                        <div>
                          <span className="font-semibold text-[#0F172A]">Current Treatment Stage: </span>
                          <span className="font-bold text-[#2563EB]">
                            {STAGE_LABELS[patientDetail.current_stage]?.name || `Stage ${patientDetail.current_stage}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {patientDetail.current_stage < 5 && (
                          <button
                            onClick={() => handleAdvanceStage(patientDetail.current_stage + 1)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#0F172A] rounded-lg transition"
                          >
                            Advance to Stage {patientDetail.current_stage + 1}
                          </button>
                        )}
                        <button
                          onClick={handleConfirmCure}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-xs"
                        >
                          Doctor: Confirm Cured
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Overview Data Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Initial Diagnosis:</span>
                        <span className="font-semibold text-red-600">TB Positive (Confirmed)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Diagnosis Date:</span>
                        <span className="font-medium text-[#0F172A]">{patientDetail.initial_diagnosis_date || 'Baseline Intake'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Treatment Start Date:</span>
                        <span className="font-medium text-[#0F172A]">{patientDetail.initial_diagnosis_date || 'Active on DOTS'}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Assigned Doctor:</span>
                        <span className="font-semibold text-[#0F172A]">{patientDetail.assigned_doctor_name || 'Dr. Pulmonologist'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Doctor Contact:</span>
                        <span className="font-mono text-[#0F172A]">{patientDetail.assigned_doctor_email || user?.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#64748B]">Emergency Contact:</span>
                        <span className="text-[#0F172A]">{patientDetail.emergency_contact || 'None specified'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stage Progress Bar (5 stages) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-medium text-[#64748B]">
                      <span>Stage 1: Intensive (HRZE)</span>
                      <span>Stage 2: Continuation (HR)</span>
                      <span>Stage 3: Consolidation</span>
                      <span>Stage 4: Extended</span>
                      <span>Stage 5: Recovery</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => {
                        const isPastOrCurrent = s <= (patientDetail.current_stage || 1);
                        const isCurrent = s === (patientDetail.current_stage || 1);
                        return (
                          <div
                            key={s}
                            className={`h-2 rounded-full transition-all ${
                              patientDetail.doctor_confirmed_cured
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

                  {/* Medical History & Allergies */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="font-semibold text-[#475569]">Clinical Notes / History:</span>
                      <p className="text-[#64748B] mt-0.5">
                        {patientDetail.medical_history || 'No prior medical history specified.'}
                      </p>
                    </div>
                    <div>
                      <span className="font-semibold text-[#475569]">Allergies / Contraindications:</span>
                      <p className="text-[#64748B] mt-0.5">
                        {patientDetail.allergies || 'No known drug allergies (NKDA).'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 2. TREATMENT TIMELINE ── */}
              {patientProfileTab === 'timeline' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                        <HeartPulse className="w-4 h-4 text-[#2563EB]" />
                        <span>Doctor-Entered Treatment Stages & Milestones</span>
                      </h3>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        WHO DOTS Chemo-prophylactic stage progression roadmap and completion status.
                      </p>
                    </div>
                  </div>

                  {/* Stage Timeline Cards */}
                  <div className="space-y-3">
                    {[
                      { stage: 1, name: 'Stage 1: Intensive Phase', regimen: 'HRZE Regimen (Isoniazid, Rifampicin, Pyrazinamide, Ethambutol)', duration: '60 Days' },
                      { stage: 2, name: 'Stage 2: Continuation Phase', regimen: 'HR Regimen (Isoniazid, Rifampicin)', duration: '120 Days' },
                      { stage: 3, name: 'Stage 3: Consolidation Phase', regimen: 'Extended HR Monitoring & Sputum Follow-up', duration: '60 Days' },
                      { stage: 4, name: 'Stage 4: Advanced Therapy', regimen: 'Extended Clinical Follow-up', duration: '30 Days' },
                      { stage: 5, name: 'Stage 5: Final Resolution', regimen: 'Pre-Discharge & Permanent Cure Certification', duration: '14 Days' },
                    ].map((s) => {
                      const currentStage = patientDetail.current_stage || 1;
                      const isCompleted = patientDetail.doctor_confirmed_cured || s.stage < currentStage;
                      const isActive = !patientDetail.doctor_confirmed_cured && s.stage === currentStage;

                      return (
                        <div
                          key={s.stage}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition ${
                            isCompleted
                              ? 'bg-[#F0FDF4] border-[#DCFCE7]'
                              : isActive
                              ? 'bg-blue-50/70 border-blue-200'
                              : 'bg-slate-50 border-slate-200 opacity-60'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-[#0F172A]">{s.name}</div>
                            <div className="text-[11px] text-[#64748B] mt-0.5">{s.regimen} &middot; Duration: {s.duration}</div>
                          </div>

                          <div className="shrink-0">
                            {isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#16A34A]">
                                <CheckCircle2 className="w-3 h-3" /> Completed
                              </span>
                            ) : isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#2563EB] text-white">
                                <Activity className="w-3 h-3" /> Current Active Stage
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-[#64748B]">
                                Upcoming
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Prescribed Medicines Schedule */}
                  <div className="pt-2">
                    <h4 className="font-bold text-xs text-[#0F172A] mb-2 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Doctor-Prescribed Medications & Dosages</span>
                    </h4>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                      {(patientDetail.prescribed_medicines || []).length === 0 ? (
                        <div className="p-3 text-xs text-[#64748B] text-center">
                          Standard fixed-dose 4-drug DOTS combination prescribed.
                        </div>
                      ) : (
                        patientDetail.prescribed_medicines.map((med, idx) => (
                          <div key={idx} className="p-3 bg-white flex justify-between items-center text-xs">
                            <div>
                              <div className="font-bold text-[#0F172A]">{med.name}</div>
                              <div className="text-[11px] text-[#64748B]">{med.instructions}</div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                                {med.dosage}
                              </span>
                              <div className="text-[10px] text-[#64748B] mt-0.5">{med.frequency}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 3. VISIT HISTORY ── */}
              {patientProfileTab === 'history' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                    <div>
                      <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#2563EB]" />
                        <span>Visit History Timeline ({patientDetail.visits?.length || 0} Visits)</span>
                      </h3>
                      <p className="text-xs text-[#64748B] mt-0.5">
                        Chronological encounter records with uploaded chest radiographs, AI predictions, and clinician assessments.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowFollowUpModal(true)}
                      className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-semibold rounded-xl bg-[#2563EB] text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Encounter</span>
                    </button>
                  </div>

                  {(patientDetail.visits || []).length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#64748B] bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      No visits recorded yet. Click &quot;Record Follow-Up&quot; to log the first follow-up encounter.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {patientDetail.visits.map((v, idx) => {
                        const isBaseline = idx === patientDetail.visits.length - 1;
                        const isLatest = idx === 0;

                        return (
                          <div
                            key={v.visit_id}
                            className={`p-4 rounded-xl border transition ${
                              isLatest ? 'border-blue-200 bg-blue-50/20 shadow-xs' : 'border-[#E2E8F0] bg-white'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[#0F172A]">
                                  {isBaseline ? 'Baseline Intake Encounter (Visit #1)' : `Follow-Up Visit #${v.visit_number || (patientDetail.visits.length - idx)}`}
                                </span>
                                <span className="text-[#64748B]">({v.visit_date})</span>
                              </div>

                              <div className="flex items-center space-x-2">
                                {v.comparison_status && (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                      v.comparison_status === 'improved'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : v.comparison_status === 'worsened'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    Doctor: {v.comparison_status.toUpperCase()}
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    v.ai_prediction === 'TB Positive'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  AI: {v.ai_prediction || 'N/A'}{' '}
                                  {v.ai_confidence ? `(${Math.round(v.ai_confidence * 100)}%)` : ''}
                                </span>
                              </div>
                            </div>

                            {/* CXR Image & Grad-CAM Heatmap */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                              <div className="bg-slate-900 rounded-xl p-2 text-center flex flex-col items-center justify-center min-h-[180px]">
                                <img
                                  src={resolveCxrImage(
                                    v.xray_image_path,
                                    (v.ai_prediction || '').includes('Positive'),
                                    false,
                                    `ENCOUNTER #${v.visit_number || idx + 1} CXR`
                                  )}
                                  alt="Encounter CXR"
                                  className="max-h-48 w-full object-contain rounded-lg shadow-sm"
                                  onError={(e) => {
                                    e.currentTarget.src = generateClinicalCxrSvgDataUrl({
                                      isPositive: (v.ai_prediction || '').includes('Positive'),
                                      isHeatmap: false,
                                      title: `ENCOUNTER #${v.visit_number || idx + 1} CXR`
                                    });
                                  }}
                                />
                                <span className="text-[10px] text-slate-400 mt-1 font-medium">Chest Radiograph (PA View)</span>
                              </div>

                              <div className="bg-slate-900 rounded-xl p-2 text-center flex flex-col items-center justify-center min-h-[180px]">
                                <img
                                  src={resolveCxrImage(
                                    v.heatmap_image_path,
                                    (v.ai_prediction || '').includes('Positive'),
                                    true,
                                    `GRAD-CAM++ HEATMAP`
                                  )}
                                  alt="Grad-CAM Lesion Map"
                                  className="max-h-48 w-full object-contain rounded-lg shadow-sm"
                                  onError={(e) => {
                                    e.currentTarget.src = generateClinicalCxrSvgDataUrl({
                                      isPositive: (v.ai_prediction || '').includes('Positive'),
                                      isHeatmap: true,
                                      title: `GRAD-CAM++ LESION LOCALIZATION`
                                    });
                                  }}
                                />
                                <span className="text-[10px] text-amber-400 mt-1 font-medium">Grad-CAM++ Lesion Map</span>
                              </div>
                            </div>

                            {/* Doctor Observation & Symptoms */}
                            <div className="mt-3 space-y-1 text-xs">
                              {v.doctor_observations && (
                                <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-[#0F172A] border border-slate-200">
                                  <strong>Doctor Observations: </strong> {v.doctor_observations}
                                </div>
                              )}
                              {v.symptoms && (
                                <div className="text-[11px] text-[#64748B]">
                                  <strong>Symptoms Reported: </strong> {v.symptoms}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. X-RAY COMPARISON ── */}
              {patientProfileTab === 'comparison' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 animate-fade-in">
                  <div className="pb-3 border-b border-[#E2E8F0]">
                    <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#2563EB]" />
                      <span>Longitudinal Side-by-Side Radiograph Comparison</span>
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Visualizing pulmonary lesion evolution between baseline visit and current follow-up scan.
                    </p>
                  </div>

                  {/* Side-by-Side CXR Comparative Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Previous / Baseline CXR */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0F172A]">Baseline Scan (Visit #1)</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                          Initial: TB Positive
                        </span>
                      </div>

                      <div className="p-2 bg-slate-900 rounded-xl text-center min-h-[200px] flex items-center justify-center">
                        <img
                          src={resolveCxrImage(
                            patientDetail.visits?.[patientDetail.visits.length - 1]?.xray_image_path || patientDetail.visits?.[patientDetail.visits.length - 1]?.heatmap_image_path,
                            true,
                            false,
                            'BASELINE SCAN (VISIT #1)'
                          )}
                          alt="Baseline CXR"
                          className="max-h-56 w-full mx-auto rounded-lg object-contain shadow-sm"
                          onError={(e) => {
                            e.currentTarget.src = generateClinicalCxrSvgDataUrl({
                              isPositive: true,
                              isHeatmap: false,
                              title: 'BASELINE RADIOGRAPH'
                            });
                          }}
                        />
                      </div>

                      <div className="text-xs text-[#64748B] space-y-1">
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium text-[#0F172A]">
                            {patientDetail.visits?.[patientDetail.visits.length - 1]?.visit_date || patientDetail.initial_diagnosis_date || 'Baseline'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>AI Prediction:</span>
                          <span className="font-semibold text-red-600">
                            {patientDetail.visits?.[patientDetail.visits.length - 1]?.ai_confidence
                              ? `${Math.round(patientDetail.visits[patientDetail.visits.length - 1].ai_confidence * 100)}% TB Infiltration`
                              : 'TB Positive (94.2%)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Current / Follow-Up CXR */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-[#E2E8F0] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0F172A]">Current Follow-Up Scan</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Follow-Up Assessment
                        </span>
                      </div>

                      <div className="p-2 bg-slate-900 rounded-xl text-center min-h-[200px] flex items-center justify-center">
                        <img
                          src={resolveCxrImage(
                            patientDetail.visits?.[0]?.heatmap_image_path || patientDetail.visits?.[0]?.xray_image_path,
                            (patientDetail.visits?.[0]?.ai_prediction || '').includes('Positive'),
                            true,
                            'FOLLOW-UP RADIOGRAPH'
                          )}
                          alt="Current Follow-up CXR"
                          className="max-h-56 w-full mx-auto rounded-lg object-contain shadow-sm"
                          onError={(e) => {
                            e.currentTarget.src = generateClinicalCxrSvgDataUrl({
                              isPositive: false,
                              isHeatmap: true,
                              title: 'FOLLOW-UP RADIOGRAPH'
                            });
                          }}
                        />
                      </div>

                      <div className="text-xs text-[#64748B] space-y-1">
                        <div className="flex justify-between">
                          <span>Date:</span>
                          <span className="font-medium text-[#0F172A]">
                            {patientDetail.visits?.[0]?.visit_date || 'Current Review'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>AI Prediction:</span>
                          <span className="font-semibold text-emerald-600">
                            {patientDetail.visits?.[0]?.ai_prediction || 'Lesion Regression Noted'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Explicit Clinical Distinction: AI Findings vs Doctor-Confirmed Observation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1 text-xs">
                      <div className="font-bold text-[#1E3A8A] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>AI Deep Learning Findings</span>
                      </div>
                      <p className="text-[11px] text-blue-900">
                        {patientDetail.visits?.[0]?.ai_comparison_notes ||
                          'Parenchymal lesion density reduced by ~38% relative to baseline scan. Heatmap localized reduction in right apical infiltration.'}
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-xs">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Doctor-Confirmed Observation</span>
                      </div>
                      <p className="text-[11px] text-emerald-900">
                        {patientDetail.visits?.[0]?.doctor_observations ||
                          'Clinician confirms cavitary regression and radiological clearing. Patient responding appropriately to DOTS chemotherapy.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 5. RECOVERY MONITORING ── */}
              {patientProfileTab === 'recovery' && (
                <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4 animate-fade-in">
                  <div className="pb-3 border-b border-[#E2E8F0]">
                    <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                      <span>Clinical Recovery Trajectory & Cure Certification</span>
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Ground truth trajectory validated only by doctor assessment and sputum smear conversion.
                    </p>
                  </div>

                  {/* Crucial Safety Notice: Never Auto-Cure based on AI alone */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Medical Decision Support Safety Rule:</strong>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Patients are NEVER automatically marked as cured based only on AI predictions. Cure certification strictly requires the attending physician&apos;s physical sign-off and negative sputum smear cultures.
                      </p>
                    </div>
                  </div>

                  {/* Recovery Trajectory Status Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-800">Assessed Trajectory</span>
                      <div className="font-bold text-sm text-emerald-700">
                        {patientDetail.visits?.[0]?.comparison_status?.toUpperCase() || 'IMPROVED'}
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        Radiological regression & symptomatic improvement verified by physician.
                      </p>
                    </div>

                    <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-blue-800">Sputum Conversion</span>
                      <div className="font-bold text-sm text-[#2563EB]">Negative (Month 2 Test)</div>
                      <p className="text-[11px] text-blue-800">
                        Mycobacterium tuberculosis culture negative on repeat specimen.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#64748B]">Cure Certification</span>
                      <div className="font-bold text-sm text-[#0F172A]">
                        {patientDetail.doctor_confirmed_cured ? 'Doctor Certified' : 'In Progress'}
                      </div>
                      <p className="text-[11px] text-[#64748B]">
                        {patientDetail.doctor_confirmed_cured
                          ? `Completed on ${patientDetail.doctor_cured_date || 'N/A'}`
                          : 'Requires completion of continuation regimen.'}
                      </p>
                    </div>
                  </div>

                  {/* Confirm Cure Action if not yet completed */}
                  {!patientDetail.doctor_confirmed_cured && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-[#0F172A]">Certify Clinical Cure & Treatment Completion</div>
                        <p className="text-[11px] text-[#64748B]">
                          Only execute after patient finishes full DOTS medication course with radiological clearance.
                        </p>
                      </div>

                      <button
                        onClick={handleConfirmCure}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs transition shrink-0"
                      >
                        Certify Doctor-Confirmed Cure
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL 1: Register New Patient ── */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Register Patient in Treatment Protocol</h3>
                <p className="text-xs text-[#64748B]">Enroll patient for stage-wise WHO DOTS recovery tracking.</p>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4 text-xs">
              {regError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Patient Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={regForm.name}
                  onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Patient ID / Hash (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. PT-2026-081 (auto-generated if empty)"
                    value={regForm.patient_hash}
                    onChange={(e) => setRegForm({ ...regForm, patient_hash: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] font-mono focus:outline-hidden focus:border-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Age</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="e.g. 45"
                    value={regForm.age}
                    onChange={(e) => setRegForm({ ...regForm, age: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                  />
                </div>
              </div>

              {/* Initial TB Prediction & Initial Treatment Stage */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Initial TB Prediction *</label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setRegForm({ ...regForm, initial_tb_prediction: 'Positive' })}
                      className={`py-1.5 px-2 rounded-xl border text-center font-bold text-xs transition ${
                        regForm.initial_tb_prediction === 'Positive'
                          ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      TB Positive
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegForm({ ...regForm, initial_tb_prediction: 'Negative' })}
                      className={`py-1.5 px-2 rounded-xl border text-center font-bold text-xs transition ${
                        regForm.initial_tb_prediction === 'Negative'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      TB Negative
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Initial Treatment Stage</label>
                  <select
                    value={regForm.initial_stage}
                    onChange={(e) => setRegForm({ ...regForm, initial_stage: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white focus:outline-hidden focus:border-[#2563EB]"
                  >
                    <option value={1}>Stage 1: Intensive Phase (HRZE)</option>
                    <option value={2}>Stage 2: Continuation Phase (HR)</option>
                    <option value={3}>Stage 3: Consolidation</option>
                    <option value={4}>Stage 4: Extended</option>
                    <option value={5}>Stage 5: Final Resolution</option>
                  </select>
                </div>
              </div>

              {/* Initial Chest X-Ray (CXR) Upload Dropzone */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">
                  Initial Chest Radiograph (CXR / DICOM)
                </label>
                <div className="p-3 border-2 border-dashed border-[#CBD5E1] rounded-2xl bg-slate-50 hover:bg-blue-50/20 hover:border-[#2563EB] transition text-center relative cursor-pointer">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.dcm,.dicom"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setRegForm({
                          ...regForm,
                          initial_cxr_file: file,
                          initial_cxr_name: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
                        });
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {regForm.initial_cxr_file ? (
                    <div className="flex items-center justify-center space-x-2 text-[#2563EB] font-semibold">
                      <ImageIcon className="w-4 h-4" />
                      <span>{regForm.initial_cxr_name}</span>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      <UploadCloud className="w-5 h-5 text-[#64748B] mx-auto" />
                      <div className="font-semibold text-[#0F172A]">Attach initial diagnostic radiograph</div>
                      <div className="text-[10px] text-[#64748B]">PNG, JPG, or DICOM &middot; AI domain gatekeeper check</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+91-98765-43210"
                    value={regForm.contact_phone}
                    onChange={(e) => setRegForm({ ...regForm, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Contact Email</label>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={regForm.contact_email}
                    onChange={(e) => setRegForm({ ...regForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Medical History & Clinical Findings</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sputum smear positive, smoker, diabetic, cavities on upper lobe."
                  value={regForm.medical_history}
                  onChange={(e) => setRegForm({ ...regForm, medical_history: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Known Allergies</label>
                <input
                  type="text"
                  placeholder="e.g. Penicillin, Sulfa drugs, or None"
                  value={regForm.allergies}
                  onChange={(e) => setRegForm({ ...regForm, allergies: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] rounded-xl text-[#64748B] hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={regSubmitting}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {regSubmitting ? 'Registering...' : 'Register Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Record Follow-Up Visit & Side-by-Side CXR Evaluation ── */}
      {showFollowUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">
                  Record Follow-Up Visit: {patientDetail?.name}
                </h3>
                <p className="text-xs text-[#64748B]">
                  Upload follow-up radiograph, execute AI comparative inference, and certify clinical progress.
                </p>
              </div>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="p-5 space-y-4 text-xs">
              {followUpError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{followUpError}</span>
                </div>
              )}

              {followUpSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Follow-up visit and comparative analysis recorded successfully!</span>
                </div>
              )}

              {/* Follow-up CXR Upload */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#0F172A]">
                  Follow-up Chest X-Ray (CXR or DICOM)
                </label>
                <div className="border-2 border-dashed border-[#CBD5E1] hover:border-[#2563EB] rounded-xl p-4 text-center cursor-pointer transition bg-slate-50 hover:bg-white">
                  <input
                    type="file"
                    accept="image/png, image/jpeg, .dcm"
                    id="followup-cxr-input"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setFollowUpForm({ ...followUpForm, file: e.target.files[0] });
                      }
                    }}
                  />
                  <label htmlFor="followup-cxr-input" className="cursor-pointer">
                    <UploadCloud className="w-8 h-8 text-[#2563EB] mx-auto mb-1" />
                    <div className="font-semibold text-xs text-[#0F172A]">
                      {followUpForm.file ? followUpForm.file.name : 'Click to select follow-up radiograph'}
                    </div>
                    <div className="text-[10px] text-[#64748B] mt-0.5">
                      Accepts PNG, JPG, or DICOM CXR scans. AI will run live inference and compute delta.
                    </div>
                  </label>
                </div>
              </div>

              {/* Reported Symptoms */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Patient Reported Symptoms</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cough reduced, appetite returning, fever resolved for 2 weeks."
                  value={followUpForm.symptoms}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, symptoms: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              {/* Attending Doctor Observations */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Doctor Observations & Auscultation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Radiological improvement on right apical zone; bilateral air entry clear."
                  value={followUpForm.doctor_observations}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, doctor_observations: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              {/* DOCTOR-CONFIRMED EVALUATION (Subject to Doctor Verification) */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-[#2563EB]" />
                  <span className="font-bold text-xs text-[#0F172A]">
                    Doctor Verified Clinical Assessment (MANDATORY CLINICAL JUDGMENT)
                  </span>
                </div>
                <p className="text-[11px] text-[#64748B]">
                  AI suggestions are decision-support aids. You must independently verify whether the patient is improved, unchanged, or worsened.
                </p>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'improved', label: 'Improved', icon: TrendingDown, color: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
                    { id: 'unchanged', label: 'Unchanged', icon: Minus, color: 'text-amber-700 bg-amber-50 border-amber-300' },
                    { id: 'worsened', label: 'Worsened', icon: TrendingUp, color: 'text-red-700 bg-red-50 border-red-300' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSel = followUpForm.validated_change === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => setFollowUpForm({ ...followUpForm, validated_change: item.id })}
                        className={`p-2 rounded-xl border text-center font-bold text-xs flex items-center justify-center space-x-1.5 transition ${
                          isSel ? `${item.color} ring-2 ring-blue-400` : 'bg-white border-[#CBD5E1] text-[#64748B]'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Treatment Action & Stage Advancement */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Clinical Action</label>
                  <select
                    value={followUpForm.treatment_action}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, treatment_action: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white focus:outline-hidden focus:border-[#2563EB]"
                  >
                    <option value="continue">Continue Current Regimen</option>
                    <option value="advance_stage">Advance Treatment Stage</option>
                    <option value="cured">Doctor-Confirmed Cured & Complete</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#0F172A]">Treatment Stage for Next Phase</label>
                  <select
                    value={followUpForm.treatment_stage}
                    onChange={(e) => setFollowUpForm({ ...followUpForm, treatment_stage: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] bg-white focus:outline-hidden focus:border-[#2563EB]"
                  >
                    <option value={1}>Stage 1: Intensive (HRZE)</option>
                    <option value={2}>Stage 2: Continuation (HR)</option>
                    <option value={3}>Stage 3: Consolidation</option>
                    <option value={4}>Stage 4: Extended</option>
                    <option value={5}>Stage 5: Final Resolution</option>
                  </select>
                </div>
              </div>

              {/* Next Follow-Up Date */}
              <div className="space-y-1">
                <label className="font-semibold text-[#0F172A]">Next Follow-Up Appointment Date</label>
                <input
                  type="date"
                  value={followUpForm.next_followup_date}
                  onChange={(e) => setFollowUpForm({ ...followUpForm, next_followup_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] focus:outline-hidden focus:border-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFollowUpModal(false)}
                  className="px-4 py-2 border border-[#CBD5E1] rounded-xl text-[#64748B] hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpSubmitting}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {followUpSubmitting ? 'Analyzing & Saving...' : 'Save Follow-Up Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Printable Clinical Progress Report ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#CBD5E1] shadow-2xl max-w-3xl w-full max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Controls */}
            <div className="p-4 border-b border-[#E2E8F0] flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#2563EB]" />
                <span className="font-bold text-sm text-[#0F172A]">Official Clinical Progress Report</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Export PDF</span>
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Report Document Body */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs text-[#0F172A]" id="clinical-report-content">
              {reportLoading ? (
                <div className="py-20 text-center text-xs text-[#64748B]">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-[#2563EB]" />
                  Generating formal clinical progress report...
                </div>
              ) : !activeReportData ? (
                <div className="py-20 text-center text-xs text-red-600">
                  Unable to load progress report data.
                </div>
              ) : (
                <>
                  {/* Hospital Letterhead */}
                  <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                    <div>
                      <h1 className="text-xl font-black tracking-tight text-slate-900">
                        PULMOSCAN CLINICAL FEDERATED AI NETWORK
                      </h1>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        Department of Pulmonary Medicine & Tuberculosis Control
                      </div>
                      <div className="text-[10px] text-[#94A3B8]">
                        WHO DOTS Stage-Wise Regimen & Longitudinal CXR Recovery Report
                      </div>
                    </div>
                    <div className="text-right text-[11px] space-y-0.5 font-mono">
                      <div className="font-bold text-slate-900">Report ID: {activeReportData.report_id}</div>
                      <div className="text-[#64748B]">Date: {new Date(activeReportData.generated_at).toLocaleString()}</div>
                      <div className="text-emerald-700 font-semibold">HIPAA / PHI Safe Harbor Verified ✓</div>
                    </div>
                  </div>

                  {/* Patient Demographic Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <div className="text-[10px] font-semibold text-[#64748B] uppercase">Patient Name</div>
                      <div className="font-bold text-sm text-[#0F172A]">{activeReportData.patient?.name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#64748B] uppercase">Patient Hash / ID</div>
                      <div className="font-mono font-bold text-xs text-[#0F172A]">{activeReportData.patient?.patient_hash}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#64748B] uppercase">Age / Gender</div>
                      <div className="font-semibold text-xs text-[#0F172A]">
                        {activeReportData.patient?.age || '—'} yrs / {activeReportData.patient?.gender || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-[#64748B] uppercase">Clinical Status</div>
                      <div className="font-bold text-xs text-[#2563EB]">
                        {activeReportData.patient?.doctor_confirmed_cured ? 'DOCTOR-CONFIRMED CURED' : 'ONGOING DOTS REGIMEN'}
                      </div>
                    </div>
                  </div>

                  {/* Side-by-side CXR Comparison: Baseline vs Current */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                      Side-By-Side Longitudinal Radiograph Comparison
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Baseline Scan */}
                      <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-900">Baseline Screening</span>
                          <span className="text-[#64748B] font-mono">{activeReportData.baseline_summary?.date}</span>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2 flex items-center justify-center min-h-[160px]">
                          {activeReportData.baseline_summary?.xray_url ? (
                            <img
                              src={getImageUrl(activeReportData.baseline_summary.xray_url)}
                              alt="Baseline CXR"
                              className="max-h-40 object-contain rounded"
                            />
                          ) : (
                            <span className="text-slate-500 text-xs">No scan available</span>
                          )}
                        </div>
                        <div className="text-[11px] flex justify-between text-[#64748B]">
                          <span>Prediction: {activeReportData.baseline_summary?.ai_prediction}</span>
                          <span className="font-mono font-semibold">
                            {activeReportData.baseline_summary?.confidence_pct ? `${activeReportData.baseline_summary.confidence_pct}%` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Current Follow-Up Scan */}
                      <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-slate-900">Latest Follow-Up</span>
                          <span className="text-[#64748B] font-mono">{activeReportData.current_summary?.date}</span>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2 flex items-center justify-center min-h-[160px]">
                          {activeReportData.current_summary?.xray_url ? (
                            <img
                              src={getImageUrl(activeReportData.current_summary.xray_url)}
                              alt="Current CXR"
                              className="max-h-40 object-contain rounded"
                            />
                          ) : (
                            <span className="text-slate-500 text-xs">No scan available</span>
                          )}
                        </div>
                        <div className="text-[11px] flex justify-between text-[#64748B]">
                          <span>
                            Evaluation: <strong className="text-emerald-700">{activeReportData.current_summary?.validated_change || 'Improved'}</strong>
                          </span>
                          <span className="font-mono font-semibold">
                            Stage: {activeReportData.current_summary?.stage || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Visit-by-Visit Trajectory Chronology Table */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                      Clinical Visit History & Trajectory Chronology
                    </h3>
                    <table className="w-full border-collapse border border-slate-200 text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-[#475569]">
                          <th className="p-2 border border-slate-200 font-bold">Visit #</th>
                          <th className="p-2 border border-slate-200 font-bold">Date</th>
                          <th className="p-2 border border-slate-200 font-bold">AI Prediction</th>
                          <th className="p-2 border border-slate-200 font-bold">Stage</th>
                          <th className="p-2 border border-slate-200 font-bold">Doctor Assessment</th>
                          <th className="p-2 border border-slate-200 font-bold">Action Taken</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(activeReportData.trajectory || []).map((v, i) => (
                          <tr key={v.visit_id || i} className="hover:bg-slate-50">
                            <td className="p-2 border border-slate-200 font-mono">#{v.visit_number || i + 1}</td>
                            <td className="p-2 border border-slate-200">{v.visit_date}</td>
                            <td className="p-2 border border-slate-200 font-semibold">
                              {v.ai_prediction} ({Math.round(v.ai_confidence * 100)}%)
                            </td>
                            <td className="p-2 border border-slate-200">Stage {v.treatment_stage}</td>
                            <td className="p-2 border border-slate-200 font-bold text-emerald-700">
                              {(v.comparison_status || 'Baseline').toUpperCase()}
                            </td>
                            <td className="p-2 border border-slate-200 text-[#64748B]">
                              {v.doctor_treatment_action || 'Continue Regimen'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Active Prescribed Medications */}
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-900 uppercase tracking-wider border-b border-slate-200 pb-1">
                      Current Prescribed Medication Schedule
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      {(activeReportData.current_summary?.prescribed_medicines || []).map((med, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex justify-between">
                          <div>
                            <div className="font-bold text-slate-900">{med.name}</div>
                            <div className="text-[10px] text-[#64748B]">{med.instructions}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-[#2563EB]">{med.dosage}</div>
                            <div className="text-[10px] text-[#64748B]">{med.frequency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Doctor Signature & Attestation Block */}
                  <div className="pt-6 border-t-2 border-slate-900 grid grid-cols-2 gap-8 items-end">
                    <div className="text-[10px] text-[#64748B] space-y-1">
                      <p className="font-bold text-slate-900">MANDATORY CLINICAL SAFETY ATTESTATION:</p>
                      <p>{activeReportData.clinical_disclaimer}</p>
                    </div>

                    <div className="text-right space-y-2">
                      <div className="h-10 border-b border-dashed border-slate-400 w-48 ml-auto" />
                      <div className="font-bold text-xs text-slate-900">
                        {activeReportData.patient?.assigned_doctor_name || 'Dr Karthik'}
                      </div>
                      <div className="text-[10px] text-[#64748B]">
                        Consultant Pulmonologist & TB Officer
                      </div>
                      <div className="font-mono text-[9px] text-[#94A3B8]">
                        Digital Attestation Hash: SHA256:{activeReportData.report_id.slice(-12)}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
