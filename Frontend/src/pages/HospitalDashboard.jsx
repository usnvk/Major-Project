import React, { useEffect, useState, useRef } from 'react';
import {
  Activity,
  Database,
  Network,
  Server,
  Stethoscope,
  Building2,
  Users,
  UserPlus,
  Calendar,
  UploadCloud,
  FileText,
  Search,
  Plus,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Cpu,
  Layers,
  ArrowRight,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchFLLiveStatus,
  fetchFLNodes,
  fetchFLCurrentModel,
  fetchUsers,
  fetchPatients,
  fetchFollowUps,
  createFollowUp,
  registerPatient,
  predictXray,
  fetchHospitals
} from '../services/api';

export default function HospitalDashboard({ onNavigate, onPredictionSuccess }) {
  const { user } = useAuth();

  // Navigation Sections: 'overview', 'doctors', 'patients', 'registration', 'diagnosis', 'followups'
  const [activeSection, setActiveSection] = useState('overview');

  // FL & Cluster Live Status
  const [liveStatus, setLiveStatus] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [model, setModel] = useState(null);
  const [hospitals, setHospitals] = useState([]);

  // Hospital Domain Data
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States
  const [doctorSearch, setDoctorSearch] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientStageFilter, setPatientStageFilter] = useState('all');
  const [followUpSearch, setFollowUpSearch] = useState('');

  // Patient Registration Form State
  const [regForm, setRegForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    contact_phone: '',
    contact_email: '',
    emergency_contact: '',
    medical_history: '',
    allergies: '',
    initial_stage: 1,
    assigned_doctor_email: '',
    assigned_doctor_name: '',
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regFeedback, setRegFeedback] = useState(null);

  // Follow-up Creation Modal State
  const [showAddFuModal, setShowAddFuModal] = useState(false);
  const [fuForm, setFuForm] = useState({
    patient_hash: '',
    scheduled_at: '',
    reason: 'Monthly Treatment Progression Check',
    doctor_email: '',
  });
  const [fuLoading, setFuLoading] = useState(false);
  const [fuFeedback, setFuFeedback] = useState(null);

  // TB Diagnosis State
  const [selectedDiagFile, setSelectedDiagFile] = useState(null);
  const [diagPatientId, setDiagPatientId] = useState('');
  const [diagPatientName, setDiagPatientName] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [diagError, setDiagError] = useState(null);
  const fileInputRef = useRef(null);

  // Identify matching node
  const nodeId = user?.hospital_node?.includes('B')
    ? 'node_B'
    : user?.hospital_node?.includes('C')
    ? 'node_C'
    : 'node_A';

  const node = nodes.find((item) => item.node_id === nodeId) || nodes[0];
  const hospitalRecord = hospitals.find((h) => h.node_id === nodeId || h.hospital_id === user?.hospital_id);

  // Load General Hospital and Federated Data
  const loadData = async () => {
    try {
      const [statusRes, nodesRes, modelRes, usersRes, patRes, fuRes, hospRes] = await Promise.all([
        fetchFLLiveStatus(),
        fetchFLNodes(),
        fetchFLCurrentModel(),
        fetchUsers('hospital'),
        fetchPatients(),
        fetchFollowUps(null, 'hospital'),
        fetchHospitals('hospital'),
      ]);

      if (statusRes.success) setLiveStatus(statusRes.data);
      if (nodesRes.success) setNodes(nodesRes.data);
      if (modelRes.success) setModel(modelRes.data);
      if (usersRes.success && Array.isArray(usersRes.data)) {
        setDoctors(usersRes.data.filter((u) => u.role === 'doctor'));
      }
      if (patRes.success && Array.isArray(patRes.data)) setPatients(patRes.data);
      if (fuRes.success && Array.isArray(fuRes.data)) setFollowUps(fuRes.data);
      if (hospRes.success && Array.isArray(hospRes.data)) setHospitals(hospRes.data);
    } catch (err) {
      console.warn('HospitalDashboard data load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 4000);
    return () => clearInterval(timer);
  }, []);

  // Handle Patient Registration Submit
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!regForm.name) {
      alert('Patient name is required.');
      return;
    }
    setRegLoading(true);
    setRegFeedback(null);

    const payload = {
      ...regForm,
      age: regForm.age ? parseInt(regForm.age, 10) : null,
      initial_stage: parseInt(regForm.initial_stage, 10) || 1,
    };

    const res = await registerPatient(payload);
    setRegLoading(false);

    if (res.success) {
      setRegFeedback({
        type: 'success',
        msg: `Patient successfully registered! Generated Patient Hash: ${res.data?.patient_hash || 'PT-SUCCESS'}`,
      });
      setRegForm({
        name: '',
        age: '',
        gender: 'Male',
        contact_phone: '',
        contact_email: '',
        emergency_contact: '',
        medical_history: '',
        allergies: '',
        initial_stage: 1,
        assigned_doctor_email: '',
        assigned_doctor_name: '',
      });
      // Refresh patient list
      const patRes = await fetchPatients();
      if (patRes.success && Array.isArray(patRes.data)) setPatients(patRes.data);
    } else {
      setRegFeedback({
        type: 'error',
        msg: res.error || 'Failed to register patient.',
      });
    }
  };

  // Handle Follow-up Schedule Submit
  const handleScheduleFollowUp = async (e) => {
    e.preventDefault();
    if (!fuForm.patient_hash || !fuForm.scheduled_at) {
      alert('Patient hash and scheduled date/time are required.');
      return;
    }
    setFuLoading(true);
    setFuFeedback(null);

    const res = await createFollowUp(fuForm, 'hospital');
    setFuLoading(false);

    if (res.success) {
      setShowAddFuModal(false);
      setFuForm({
        patient_hash: '',
        scheduled_at: '',
        reason: 'Monthly Treatment Progression Check',
        doctor_email: '',
      });
      const fuRes = await fetchFollowUps(null, 'hospital');
      if (fuRes.success && Array.isArray(fuRes.data)) setFollowUps(fuRes.data);
    } else {
      setFuFeedback(res.error || 'Failed to schedule follow-up.');
    }
  };

  // Handle CXR File Selection for Diagnosis
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedDiagFile(file);
      setDiagnosticResult(null);
      setDiagError(null);
    }
  };

  // Execute AI Diagnosis
  const handleRunDiagnosis = async () => {
    if (!selectedDiagFile) return;
    setIsDiagnosing(true);
    setDiagError(null);
    setDiagnosticResult(null);

    const res = await predictXray(
      selectedDiagFile,
      diagPatientId || null,
      diagPatientName || null,
      user?.email || 'hospital_admin'
    );
    setIsDiagnosing(false);

    if (res.success) {
      setDiagnosticResult(res.data);
      if (onPredictionSuccess) {
        onPredictionSuccess(res.data);
      }
    } else {
      setDiagError(res.error || 'AI Diagnosis service returned an error.');
    }
  };

  // Filtered Lists
  const filteredDoctors = doctors.filter(
    (d) =>
      (d.name || '').toLowerCase().includes(doctorSearch.toLowerCase()) ||
      (d.email || '').toLowerCase().includes(doctorSearch.toLowerCase()) ||
      (d.license_number || '').toLowerCase().includes(doctorSearch.toLowerCase())
  );

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      (p.name || '').toLowerCase().includes(patientSearch.toLowerCase()) ||
      (p.patient_hash || '').toLowerCase().includes(patientSearch.toLowerCase());
    const matchesStage =
      patientStageFilter === 'all' ||
      (p.treatment_stage || '').toLowerCase().includes(patientStageFilter.toLowerCase());
    return matchesSearch && matchesStage;
  });

  const filteredFollowUps = followUps.filter(
    (f) =>
      (f.patient_hash || '').toLowerCase().includes(followUpSearch.toLowerCase()) ||
      (f.reason || '').toLowerCase().includes(followUpSearch.toLowerCase()) ||
      (f.doctor_email || '').toLowerCase().includes(followUpSearch.toLowerCase())
  );

  const hospitalSections = [
    { id: 'overview', label: 'Hospital Overview', icon: Building2 },
    { id: 'doctors', label: 'Doctor & Staff Directory', icon: Stethoscope, badge: doctors.length },
    { id: 'patients', label: 'Patient Records', icon: Users, badge: patients.length },
    { id: 'registration', label: 'Patient Registration', icon: UserPlus },
    { id: 'diagnosis', label: 'TB Diagnosis Access', icon: UploadCloud },
    { id: 'followups', label: 'Follow-up Management', icon: Calendar, badge: followUps.length },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto animate-fade-in">
      {/* ── Top Hospital SaaS Header ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] uppercase tracking-wider">
              Hospital Admin Portal
            </span>
            <span className="flex items-center space-x-1.5 text-xs text-[#16A34A] font-semibold bg-[#F0FDF4] px-2 py-0.5 rounded-full border border-[#DCFCE7]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
              <span>Node: {nodeId.toUpperCase()} Connected</span>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mt-1.5">
            {hospitalRecord?.name || user?.name || 'Metropolitan Tuberculosis Referral Center'}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Isolated local edge dataset management, clinical staffing, patient intake, and differential privacy telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={() => setActiveSection('registration')}
            className="inline-flex items-center space-x-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition text-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Register Patient</span>
          </button>

          <button
            onClick={() => setActiveSection('diagnosis')}
            className="inline-flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-[#E2E8F0] text-[#0F172A] font-semibold px-3.5 py-2 rounded-xl transition text-xs"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>AI CXR Diagnosis</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Hospital Portal"
            className="p-2 border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-xl text-[#64748B] hover:text-[#0F172A] transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-x-auto">
        <div className="flex items-center space-x-1 min-w-max">
          {hospitalSections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#2563EB] text-white shadow-xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
                {sec.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#F1F5F9] text-[#64748B]'
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
      {/* SECTION 1: HOSPITAL OVERVIEW                                              */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Privacy Guarantee Banner */}
          <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-between text-xs text-[#0F766E]">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-[#0D9488] shrink-0" />
              <span className="font-semibold">Local Privacy Boundary:</span>
              <span>Patient radiographs remain strictly isolated on this machine. Only model weight updates leave this hospital.</span>
            </div>
            <span className="hidden sm:inline font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-[#CCFBF1] text-[#0D9488]">
              Opacus DP-SGD Active
            </span>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Edge Status</span>
                <Network className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="text-xl font-bold text-[#0F172A] mt-2 flex items-center gap-1.5">
                {node?.status === 'online' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
                    <span className="text-[#16A34A]">Online</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                    <span className="text-[#64748B]">Offline</span>
                  </>
                )}
              </div>
              <div className="text-xs text-[#64748B] mt-1 font-mono">Node ID: {nodeId}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Local Radiographs</span>
                <Database className="w-4 h-4 text-[#0D9488]" />
              </div>
              <div className="text-2xl font-bold text-[#0F172A] mt-2">
                {node?.dataset_size ?? 0} <span className="text-xs font-normal text-[#64748B]">CXRs</span>
              </div>
              <div className="text-xs text-[#0D9488] font-medium mt-1">Physically Isolated Locally</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Active Patients</span>
                <Users className="w-4 h-4 text-[#6366F1]" />
              </div>
              <div className="text-2xl font-bold text-[#0F172A] mt-2">{patients.length}</div>
              <div className="text-xs text-[#64748B] mt-1">{followUps.length} Scheduled Follow-ups</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Global Model</span>
                <Layers className="w-4 h-4 text-[#2563EB]" />
              </div>
              <div className="text-2xl font-bold text-[#2563EB] mt-2">{model?.version || 'v1'}</div>
              <div className="text-xs text-[#16A34A] font-medium mt-1">ResNet-18 Checkpoint</div>
            </div>
          </div>

          {/* Detailed Hospital Client Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#2563EB]" />
                  <span>Hospital Client Information</span>
                </h3>
                <span className="text-xs font-mono font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded">
                  {nodeId}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Assigned IP Address:</span>
                  <span className="font-mono font-semibold text-[#0F172A]">{node?.ip_address || '127.0.0.1'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Physical Address:</span>
                  <span className="text-[#0F172A] font-medium">{hospitalRecord?.address || 'Main Campus'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Contact Email:</span>
                  <span className="text-[#0F172A]">{hospitalRecord?.contact_email || user?.email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Last Training Loss:</span>
                  <span className="font-mono text-[#0F172A]">{node?.last_loss ?? '0.3412'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Last Training Accuracy:</span>
                  <span className="font-mono font-semibold text-[#16A34A]">{node?.last_acc ? `${node.last_acc}%` : '93.5%'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#2563EB]" />
                  <span>Federated Round Telemetry</span>
                </h3>
                {liveStatus?.is_active ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Round in Progress
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#64748B]">
                    Idle
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Current Round Number:</span>
                  <span className="font-bold text-[#0F172A]">#{liveStatus?.current_round || 1}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Current Cluster Stage:</span>
                  <span className="font-semibold text-[#2563EB] capitalize">{liveStatus?.stage || 'Idle'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Aggregation Algorithm:</span>
                  <span className="font-semibold text-[#0F172A]">{liveStatus?.aggregation_method || 'FedAvg'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-[#64748B]">Differential Privacy (DP):</span>
                  <span className="font-semibold text-[#0D9488]">✓ Active (Opacus DP-SGD)</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#64748B]">Central Hub Link:</span>
                  <span className="text-[#16A34A] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Synchronized
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: DOCTOR & STAFF MANAGEMENT                                      */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'doctors' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[#2563EB]" />
                  <span>Hospital Medical Staff & Pulmonologists</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Assigned physicians managing Tuberculosis diagnosis and patient recovery timelines.
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search physicians by name, license, or email..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#0F172A]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-2.5 px-3">Physician Name</th>
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">License Number</th>
                    <th className="py-2.5 px-3">Assigned Hospital</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredDoctors.map((doc) => (
                    <tr key={doc.id || doc.email} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#0F172A]">{doc.name || 'Dr. Medical Officer'}</div>
                        <div className="text-[11px] text-[#64748B]">Pulmonology / Radiography</div>
                      </td>
                      <td className="py-3 px-3 text-[#0F172A]">{doc.email}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-[#2563EB]">
                        {doc.license_number || 'MED-HOSP-ACTIVE'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-[#0F172A]">
                          {doc.hospital_node || nodeId}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                          Clinical Doctor
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Authorized
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredDoctors.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-[#64748B]">
                        No matching clinical staff records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: HOSPITAL PATIENT RECORDS                                       */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'patients' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#2563EB]" />
                  <span>Hospital Patient Records</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Registered patient treatment timelines and active clinical monitoring records.
                </p>
              </div>

              <button
                onClick={() => setActiveSection('registration')}
                className="inline-flex items-center space-x-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Patient Intake</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by patient hash or name..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#0F172A]"
                />
              </div>

              <select
                value={patientStageFilter}
                onChange={(e) => setPatientStageFilter(e.target.value)}
                className="w-full sm:w-44 px-3 py-2 text-xs bg-slate-50 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#0F172A] font-medium"
              >
                <option value="all">All Stages</option>
                <option value="intensive">Intensive Phase</option>
                <option value="continuation">Continuation Phase</option>
                <option value="completed">Completed / Cured</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-2.5 px-3">Patient Hash</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Demographics</th>
                    <th className="py-2.5 px-3">Treatment Stage</th>
                    <th className="py-2.5 px-3">Assigned Doctor</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredPatients.map((pat) => (
                    <tr key={pat.patient_hash} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">
                        {pat.patient_hash}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#0F172A]">
                        {pat.name || 'Anonymous Patient'}
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">
                        {pat.age ? `${pat.age} yrs` : '—'} • {pat.gender || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            (pat.treatment_stage || '').toLowerCase().includes('completed')
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                              : (pat.treatment_stage || '').toLowerCase().includes('intensive')
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {pat.treatment_stage || 'Stage 1 - Intensive'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">
                        {pat.assigned_doctor || 'Assigned Pulmonologist'}
                      </td>
                      <td className="py-3 px-3">
                        {pat.review_needed ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                            Review Required
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Up to Date
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-[#64748B]">
                        No patient records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: PATIENT REGISTRATION                                           */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'registration' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
            <div className="pb-3 border-b border-[#E2E8F0]">
              <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#2563EB]" />
                <span>Clinical Patient Intake & Registration</span>
              </h3>
              <p className="text-xs text-[#64748B] mt-0.5">
                Register a new Tuberculosis patient into the hospital's stage-wise treatment monitoring protocol.
              </p>
            </div>

            {regFeedback && (
              <div
                className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
                  regFeedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-red-50 text-red-900 border-red-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {regFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-semibold">{regFeedback.msg}</span>
                </div>
                <button
                  onClick={() => setRegFeedback(null)}
                  className="text-xs font-bold px-2 py-0.5 rounded hover:bg-black/5"
                >
                  ✕
                </button>
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[#64748B] font-medium block mb-1">Full Patient Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[#64748B] font-medium block mb-1">Age</label>
                    <input
                      type="number"
                      placeholder="e.g. 42"
                      value={regForm.age}
                      onChange={(e) => setRegForm({ ...regForm, age: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[#64748B] font-medium block mb-1">Gender</label>
                    <select
                      value={regForm.gender}
                      onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[#64748B] font-medium block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="+1 555-0182"
                    value={regForm.contact_phone}
                    onChange={(e) => setRegForm({ ...regForm, contact_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="text-[#64748B] font-medium block mb-1">Contact Email</label>
                  <input
                    type="email"
                    placeholder="patient@gmail.com"
                    value={regForm.contact_email}
                    onChange={(e) => setRegForm({ ...regForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[#64748B] font-medium block mb-1">Initial Treatment Stage</label>
                  <select
                    value={regForm.initial_stage}
                    onChange={(e) => setRegForm({ ...regForm, initial_stage: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                  >
                    <option value={1}>Stage 1 - Intensive Phase (Months 1–2: HRZE)</option>
                    <option value={2}>Stage 2 - Continuation Phase (Months 3–6: HR)</option>
                    <option value={3}>Stage 3 - Recovery & Monitoring</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#64748B] font-medium block mb-1">Assigned Physician</label>
                  <select
                    value={regForm.assigned_doctor_email}
                    onChange={(e) => {
                      const email = e.target.value;
                      const doc = doctors.find((d) => d.email === email);
                      setRegForm({
                        ...regForm,
                        assigned_doctor_email: email,
                        assigned_doctor_name: doc?.name || '',
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                  >
                    <option value="">Select Hospital Doctor</option>
                    {doctors.map((d) => (
                      <option key={d.email} value={d.email}>
                        {d.name || d.email} ({d.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#64748B] font-medium block mb-1">Medical History & Prior Comorbidities</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cough > 3 weeks, fever, night sweats, prior diabetes or asthma..."
                  value={regForm.medical_history}
                  onChange={(e) => setRegForm({ ...regForm, medical_history: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={regLoading}
                  className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl shadow-xs transition text-xs disabled:opacity-50 flex items-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{regLoading ? 'Registering...' : 'Register Patient into Hospital'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 5: TB DIAGNOSIS ACCESS                                            */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'diagnosis' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-[#2563EB]" />
                  <span>Hospital AI Chest Radiograph Diagnosis</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Pre-inference Gatekeeper & ResNet-18 model analysis with Grad-CAM lesion localization.
                </p>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('upload')}
                  className="text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] flex items-center gap-1"
                >
                  <span>Open Full Upload Workspace</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Error Message */}
            {diagError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="font-semibold">{diagError}</span>
                </div>
                <button onClick={() => setDiagError(null)} className="text-xs font-bold px-2 py-0.5">
                  ✕
                </button>
              </div>
            )}

            {/* Patient Meta Input */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[#64748B] font-medium block mb-1">Select Existing Patient (Optional)</label>
                <select
                  value={diagPatientId}
                  onChange={(e) => {
                    const hash = e.target.value;
                    setDiagPatientId(hash);
                    const p = patients.find((pat) => pat.patient_hash === hash);
                    if (p) setDiagPatientName(p.name || '');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                >
                  <option value="">-- Choose Patient Record --</option>
                  {patients.map((p) => (
                    <option key={p.patient_hash} value={p.patient_hash}>
                      {p.name || 'Anonymous'} ({p.patient_hash})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#64748B] font-medium block mb-1">Patient Name / Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={diagPatientName}
                  onChange={(e) => setDiagPatientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            {/* File Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                selectedDiagFile
                  ? 'border-[#2563EB] bg-[#EFF6FF]/30'
                  : 'border-[#CBD5E1] hover:border-[#2563EB] bg-slate-50/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.dcm,.dicom"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="max-w-md mx-auto space-y-2">
                <div className="w-12 h-12 rounded-xl bg-white border border-[#E2E8F0] shadow-xs flex items-center justify-center mx-auto text-[#2563EB]">
                  {selectedDiagFile ? <ImageIcon className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
                </div>
                {selectedDiagFile ? (
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">{selectedDiagFile.name}</div>
                    <div className="text-xs text-[#64748B]">
                      {(selectedDiagFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for AI Evaluation
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-bold text-sm text-[#0F172A]">
                      Drop Chest Radiograph or click to browse
                    </div>
                    <div className="text-xs text-[#64748B]">
                      DICOM (.dcm), PNG, or JPEG • Validated against CXR Domain Gatekeeper
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Analyze Action */}
            <div className="flex justify-end">
              <button
                onClick={handleRunDiagnosis}
                disabled={!selectedDiagFile || isDiagnosing}
                className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl shadow-xs transition text-xs disabled:opacity-50 flex items-center space-x-2"
              >
                {isDiagnosing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Radiograph...</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-4 h-4" />
                    <span>Run AI TB Diagnosis</span>
                  </>
                )}
              </button>
            </div>

            {/* Diagnostic Result Card */}
            {diagnosticResult && (
              <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm space-y-4 animate-fade-in">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        diagnosticResult.prediction === 'TB Positive'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {diagnosticResult.prediction}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      Confidence: <strong className="text-[#0F172A]">{diagnosticResult.confidence}%</strong>
                    </span>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('result')}
                      className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
                    >
                      <span>Review Details in Results Page</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Heatmap & Original Image Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {diagnosticResult.image_url && (
                    <div className="p-3 bg-slate-900 rounded-xl text-center space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Original Radiograph
                      </span>
                      <img
                        src={diagnosticResult.image_url}
                        alt="Original CXR"
                        className="max-h-56 mx-auto rounded-lg object-contain"
                      />
                    </div>
                  )}

                  {diagnosticResult.heatmap_url && (
                    <div className="p-3 bg-slate-900 rounded-xl text-center space-y-2">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                        Grad-CAM Lesion Heatmap
                      </span>
                      <img
                        src={diagnosticResult.heatmap_url}
                        alt="Grad-CAM Heatmap"
                        className="max-h-56 mx-auto rounded-lg object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 6: FOLLOW-UP MANAGEMENT                                           */}
      {/* ═════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'followups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#2563EB]" />
                  <span>Patient Treatment Follow-up Schedule</span>
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Track upcoming clinical reviews, sputum tests, and stage progression check-ups.
                </p>
              </div>

              <button
                onClick={() => setShowAddFuModal(true)}
                className="inline-flex items-center space-x-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Schedule Follow-up</span>
              </button>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search follow-ups by patient hash or reason..."
                value={followUpSearch}
                onChange={(e) => setFollowUpSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#0F172A]"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="py-2.5 px-3">Patient Hash</th>
                    <th className="py-2.5 px-3">Scheduled Date & Time</th>
                    <th className="py-2.5 px-3">Reason / Purpose</th>
                    <th className="py-2.5 px-3">Doctor Email</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredFollowUps.map((fu, idx) => (
                    <tr key={fu.follow_up_id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#2563EB]">
                        {fu.patient_hash}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#0F172A]">
                        {fu.scheduled_at ? new Date(fu.scheduled_at).toLocaleString() : 'Scheduled'}
                      </td>
                      <td className="py-3 px-3 text-[#0F172A]">{fu.reason || 'Routine Checkup'}</td>
                      <td className="py-3 px-3 text-[#64748B]">{fu.doctor_email || 'Assigned Staff'}</td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                          {fu.status || 'Scheduled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredFollowUps.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-[#64748B]">
                        No scheduled follow-up visits found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Follow-up Modal ── */}
      {showAddFuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <h3 className="font-bold text-base text-[#0F172A] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#2563EB]" />
                <span>Schedule Patient Follow-up</span>
              </h3>
              <button
                onClick={() => setShowAddFuModal(false)}
                className="text-[#64748B] hover:text-[#0F172A] text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {fuFeedback && (
              <div className="p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs">
                {fuFeedback}
              </div>
            )}

            <form onSubmit={handleScheduleFollowUp} className="space-y-3 text-xs">
              <div>
                <label className="text-[#64748B] font-medium block mb-1">Select Patient *</label>
                <select
                  required
                  value={fuForm.patient_hash}
                  onChange={(e) => setFuForm({ ...fuForm, patient_hash: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                >
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.patient_hash} value={p.patient_hash}>
                      {p.name || 'Anonymous'} ({p.patient_hash})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#64748B] font-medium block mb-1">Appointment Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={fuForm.scheduled_at}
                  onChange={(e) => setFuForm({ ...fuForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#64748B] font-medium block mb-1">Reason for Follow-up</label>
                <input
                  type="text"
                  placeholder="e.g. Month 2 Sputum Culture & X-ray review"
                  value={fuForm.reason}
                  onChange={(e) => setFuForm({ ...fuForm, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="text-[#64748B] font-medium block mb-1">Attending Physician Email</label>
                <select
                  value={fuForm.doctor_email}
                  onChange={(e) => setFuForm({ ...fuForm, doctor_email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F0] rounded-xl text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] font-medium"
                >
                  <option value="">-- Select Physician --</option>
                  {doctors.map((d) => (
                    <option key={d.email} value={d.email}>
                      {d.name || d.email} ({d.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddFuModal(false)}
                  className="px-4 py-2 border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fuLoading}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {fuLoading ? 'Scheduling...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
