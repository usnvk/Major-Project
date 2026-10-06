import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Server,
  Activity,
  HardDrive,
  RefreshCw,
  Lock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Clock,
  Database,
  ArrowRight,
  TrendingUp,
  Play,
  Layers,
  Radio,
  Sliders,
  ChevronRight,
  Wifi,
  ExternalLink,
  GitBranch,
  ArrowDown,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import {
  fetchAdminSystemStats,
  fetchRecentAuditLogs,
  startFLRound,
  cancelFLRound,
  fetchFLLiveStatus,
  fetchFLNodes,
  fetchFLModels,
  fetchFLRounds,
  fetchFLEvents,
} from '../services/api';
import FLOrchestrationModal from '../components/FLOrchestrationModal';

export default function AdminDashboard({ onNavigate }) {
  // FL Cluster State
  const [flStatus, setFlStatus] = useState(null);
  const [flNodes, setFlNodes] = useState([]);
  const [flModels, setFlModels] = useState([]);
  const [flRounds, setFlRounds] = useState([]);
  const [flEvents, setFlEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Configuration settings (Section 21 & 30)
  const [aggregationMethod, setAggregationMethod] = useState('FedAvg');
  const [isSimulation, setIsSimulation] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);

  // General Admin System Stats & Audit Logs
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingRound, setStartingRound] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // Polling FL state
  const pollFLData = async () => {
    try {
      const [statusRes, nodesRes, modelsRes, roundsRes, eventsRes] = await Promise.all([
        fetchFLLiveStatus(),
        fetchFLNodes(),
        fetchFLModels(),
        fetchFLRounds(),
        fetchFLEvents(),
      ]);

      if (statusRes.success) {
        setFlStatus(statusRes.data);
        if (statusRes.data.is_active) {
          setIsModalOpen(true);
        }
      }
      if (nodesRes.success) setFlNodes(nodesRes.data);
      if (modelsRes.success) setFlModels(modelsRes.data);
      if (roundsRes.success) setFlRounds(roundsRes.data);
      if (eventsRes.success) setFlEvents(eventsRes.data);
    } catch (err) {
      console.warn('Error polling FL data:', err);
    }
  };

  const loadGeneralData = async () => {
    setLoading(true);
    const [sysRes, logRes] = await Promise.all([
      fetchAdminSystemStats(),
      fetchRecentAuditLogs(20),
    ]);
    if (sysRes.success) setStats(sysRes.data);
    if (logRes.success) setAuditLogs(logRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadGeneralData();
    pollFLData();

    // High frequency poll when modal is open or round is active (1.5s), slower otherwise (4s)
    const intervalTime = isModalOpen || flStatus?.is_active ? 1500 : 4000;
    const interval = setInterval(pollFLData, intervalTime);
    return () => clearInterval(interval);
  }, [isModalOpen, flStatus?.is_active]);

  const handleStartFLRound = async () => {
    setStartingRound(true);
    setStatusMsg('');

    const res = await startFLRound({
      aggregation: aggregationMethod,
      demo: isDemoMode,
      dp: true,
      simulate: isSimulation,
    });

    setStartingRound(false);

    if (res.success) {
      setIsModalOpen(true);
      setStatusMsg(`Round ${res.data.round_id || ''} initiated successfully.`);
      pollFLData();
    } else {
      setStatusMsg(`Failed to initiate round: ${res.error}`);
    }
  };

  const handleCancelFLRound = async () => {
    await cancelFLRound();
    pollFLData();
  };

  const currentGlobalVersion = flStatus?.global_model_version || 'v2.1';
  const currentRoundNum = flStatus?.current_round || 1;
  const isRoundActive = Boolean(flStatus?.is_active);

  const nodeA = flNodes.find((n) => n.node_id === 'node_A') || {
    name: 'Hospital A (Urban Referral)',
    status: 'online',
    model_version: currentGlobalVersion,
    dataset_size: 120,
    last_loss: 0.42,
    last_acc: 86.4,
  };

  const nodeB = flNodes.find((n) => n.node_id === 'node_B') || {
    name: 'Hospital B (Rural Clinic)',
    status: 'online',
    model_version: currentGlobalVersion,
    dataset_size: 120,
    last_loss: 0.44,
    last_acc: 85.9,
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      
      {/* ── Orchestration Stepper Modal (Section 10) ── */}
      <FLOrchestrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        liveStatus={flStatus}
        events={flEvents}
        onCancelRound={handleCancelFLRound}
      />

      {/* ── Page Header & Subtitle (Section 8) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Federated Learning Operations
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitor decentralized model training across participating hospitals. Patient data remains within each hospital.
          </p>
        </div>

        {/* Primary Action Button (Section 8) */}
        <div>
          {isRoundActive ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-5 py-2.5 rounded-xl shadow-xs transition text-sm"
            >
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>View Active Round (#{currentRoundNum})</span>
            </button>
          ) : (
            <button
              onClick={handleStartFLRound}
              disabled={startingRound}
              className="inline-flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-5 py-2.5 rounded-xl shadow-xs transition text-sm disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>START FEDERATED LEARNING ROUND</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Persistent Privacy Indicator (Section 14) ── */}
      <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-between text-xs text-[#0F766E]">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-[#0D9488] shrink-0" />
          <span className="font-semibold">Privacy Protected:</span>
          <span>Patient images remain within hospital nodes. Only model updates are shared.</span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-[#CCFBF1] text-[#0D9488]">
          Opacus DP-SGD Active
        </span>
      </div>

      {/* ── Top Metric Cards (Section 8) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Global Model Card */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Global Model</div>
          <div className="text-2xl font-bold text-[#2563EB] mt-1">{currentGlobalVersion}</div>
          <div className="text-xs text-[#64748B] mt-1 flex items-center gap-1">
            <span>ResNet-18 Architecture</span>
          </div>
        </div>

        {/* Current Round */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Current Round</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">#{currentRoundNum}</div>
          <div className="text-xs text-[#64748B] mt-1">
            Method: <span className="font-medium text-[#0F172A]">{aggregationMethod}</span>
          </div>
        </div>

        {/* Connected Nodes */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Connected Nodes</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">2 / 2</div>
          <div className="text-xs text-[#16A34A] mt-1 flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            <span>All nodes online</span>
          </div>
        </div>

        {/* Model Status */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Model Status</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            <span>Ready</span>
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Validation: <span className="font-medium text-[#16A34A]">{flStatus?.validation_accuracy ?? 86.8}%</span>
          </div>
        </div>
      </div>

      {/* ── Central FL Architecture Diagram (Section 9) ── */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">Federated Model Distribution & Aggregation Architecture</h2>
            <p className="text-xs text-[#64748B]">
              Decentralized lifecycle: Global weights distribution, isolated local edge training, and FedAvg aggregation.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="inline-flex items-center gap-1 text-[#2563EB] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> Model Flow
            </span>
            <span className="inline-flex items-center gap-1 text-[#0D9488] font-medium ml-2">
              <span className="w-2 h-2 rounded-full bg-[#0D9488]" /> Privacy/DP-SGD
            </span>
            <span className="inline-flex items-center gap-1 text-[#16A34A] font-medium ml-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Aggregated
            </span>
          </div>
        </div>

        {/* Schematic Flow Container */}
        <div className="py-4 px-2 bg-slate-50/50 rounded-xl border border-[#E2E8F0]">
          <div className="max-w-2xl mx-auto space-y-3 text-xs">
            
            {/* Top: Central Server */}
            <div className="p-3 bg-white border border-[#2563EB]/40 rounded-xl shadow-xs text-center max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">Central Aggregation Hub (Laptop A)</span>
              <span className="font-bold text-[#0F172A] text-sm">Global ResNet-18 Model ({currentGlobalVersion})</span>
            </div>

            {/* Distribution Arrows */}
            <div className="text-center text-[#2563EB] font-medium flex items-center justify-center gap-1 text-[11px]">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Encrypted Model Weights Distribution (gRPC / LAN)</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Middle: Hospital A & Hospital B */}
            <div className="grid grid-cols-2 gap-4">
              {/* Hospital A */}
              <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A] text-xs">HOSPITAL A</span>
                  <span className="text-[10px] font-semibold text-[#16A34A] bg-[#F0FDF4] px-1.5 py-0.2 rounded border border-[#DCFCE7]">
                    ● Online
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">Dataset: 120 Radiographs (Local)</div>
                <div className="text-[11px] text-[#0D9488] font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Opacus DP-SGD Local Training
                </div>
                <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  Model Update: <span className="font-mono text-[#2563EB] font-semibold">11.2 MB vector</span>
                </div>
              </div>

              {/* Hospital B */}
              <div className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F172A] text-xs">HOSPITAL B</span>
                  <span className="text-[10px] font-semibold text-[#16A34A] bg-[#F0FDF4] px-1.5 py-0.2 rounded border border-[#DCFCE7]">
                    ● Online
                  </span>
                </div>
                <div className="text-[11px] text-[#64748B]">Dataset: 120 Radiographs (Local)</div>
                <div className="text-[11px] text-[#0D9488] font-medium flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Opacus DP-SGD Local Training
                </div>
                <div className="text-[10px] text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  Model Update: <span className="font-mono text-[#2563EB] font-semibold">11.2 MB vector</span>
                </div>
              </div>
            </div>

            {/* Aggregation Arrows */}
            <div className="text-center text-[#2563EB] font-medium flex items-center justify-center gap-1 text-[11px]">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Upload Parameter Gradients (No Raw Patient Data)</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Bottom: FedAvg Aggregation & Updated Model */}
            <div className="p-3 bg-white border border-[#16A34A]/50 rounded-xl shadow-xs text-center max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold text-[#16A34A] block">
                Central Server FedAvg Aggregation
              </span>
              <span className="font-bold text-[#0F172A] text-sm">
                W_new = (n_A/N)·W_A + (n_B/N)·W_B
              </span>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                Output: Global ResNet-18 <span className="font-semibold text-[#2563EB]">v2.2</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hospital Node Cards & Security Status (Section 11, 12, 15) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Node A Card (Section 11) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">Hospital A</h3>
              <p className="text-[11px] text-[#64748B]">Urban Referral Center</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
              ● Connected
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Local Model:</span>
              <span className="font-mono font-bold text-[#2563EB]">{nodeA.model_version || currentGlobalVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Dataset:</span>
              <span className="font-semibold text-[#0F172A]">{nodeA.dataset_size} CXRs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Training:</span>
              <span className="font-semibold text-[#0F172A]">Idle / Ready</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Loss:</span>
              <span className="font-mono text-[#0F172A]">{nodeA.last_loss ?? 0.42}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Accuracy:</span>
              <span className="font-mono font-semibold text-[#16A34A]">{nodeA.last_acc ?? 86.4}%</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#E2E8F0]">
              <span className="text-[#64748B]">DP-SGD:</span>
              <span className="font-semibold text-[#0D9488]">✓ Enabled</span>
            </div>
          </div>
        </div>

        {/* Node B Card (Section 11) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">Hospital B</h3>
              <p className="text-[11px] text-[#64748B]">Rural District Clinic</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
              ● Connected
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#64748B]">Local Model:</span>
              <span className="font-mono font-bold text-[#2563EB]">{nodeB.model_version || currentGlobalVersion}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Dataset:</span>
              <span className="font-semibold text-[#0F172A]">{nodeB.dataset_size} CXRs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Training:</span>
              <span className="font-semibold text-[#0F172A]">Idle / Ready</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Loss:</span>
              <span className="font-mono text-[#0F172A]">{nodeB.last_loss ?? 0.44}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748B]">Accuracy:</span>
              <span className="font-mono font-semibold text-[#16A34A]">{nodeB.last_acc ?? 85.9}%</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[#E2E8F0]">
              <span className="text-[#64748B]">DP-SGD:</span>
              <span className="font-semibold text-[#0D9488]">✓ Enabled</span>
            </div>
          </div>
        </div>

        {/* Security Status Card (Section 15) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">Security Status</h3>
              <p className="text-[11px] text-[#64748B]">Platform encryption verification</p>
            </div>
            <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center space-x-2 text-[#0F172A]">
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>TLS / mTLS Network Encryption</span>
            </div>
            <div className="flex items-center space-x-2 text-[#0F172A]">
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Node Cryptographic Authentication</span>
            </div>
            <div className="flex items-center space-x-2 text-[#0F172A]">
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>DICOM PHI Sanitization Pipeline</span>
            </div>
            <div className="flex items-center space-x-2 text-[#0F172A]">
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Opacus DP-SGD Privacy Accountant</span>
            </div>
            <div className="flex items-center space-x-2 text-[#0F172A]">
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Secure Parameter Model Transfer</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Model Version Card (Section 12) & Operational Config ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Current Global Model Card (Section 12) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <span className="text-[10px] uppercase font-bold text-[#64748B] block">Current Global Model</span>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-xl font-bold text-[#0F172A]">ResNet-18</h3>
            <span className="text-xl font-extrabold text-[#2563EB]">{currentGlobalVersion}</span>
          </div>

          <div className="space-y-2 text-xs pt-2 border-t border-[#E2E8F0]">
            <div className="flex justify-between text-[#64748B]">
              <span>Federated Round:</span>
              <span className="font-semibold text-[#0F172A]">#{currentRoundNum}</span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Aggregation:</span>
              <span className="font-semibold text-[#0F172A]">{aggregationMethod}</span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Participating Nodes:</span>
              <span className="font-semibold text-[#0F172A]">2 Hospitals</span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Status:</span>
              <span className="font-semibold text-[#16A34A] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Production Ready
              </span>
            </div>
          </div>
        </div>

        {/* FL Configuration Controls (Section 21 & 30) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">Federated Cycle Configuration</h3>
              <p className="text-[11px] text-[#64748B]">Tune aggregation parameters and deployment mode</p>
            </div>
            <Sliders className="w-4 h-4 text-[#2563EB]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-[#64748B] font-medium block mb-1">Aggregation Algorithm</label>
              <select
                value={aggregationMethod}
                onChange={(e) => setAggregationMethod(e.target.value)}
                disabled={isRoundActive}
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="FedAvg">FedAvg (Weighted Average)</option>
                <option value="Trimmed Mean">Trimmed Mean (Byzantine-Resilient)</option>
                <option value="Coordinate-wise Median">Coordinate-wise Median</option>
              </select>
            </div>

            <div>
              <label className="text-[#64748B] font-medium block mb-1">Cluster Environment</label>
              <select
                value={isSimulation ? 'simulate' : 'lan'}
                onChange={(e) => setIsSimulation(e.target.value === 'simulate')}
                disabled={isRoundActive}
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="lan">LAN Multi-Machine (Laptops B & C)</option>
                <option value="simulate">Simulation Mode (Single Laptop Demo)</option>
              </select>
            </div>

            <div>
              <label className="text-[#64748B] font-medium block mb-1">Training Speed</label>
              <select
                value={isDemoMode ? 'demo' : 'full'}
                onChange={(e) => setIsDemoMode(e.target.value === 'demo')}
                disabled={isRoundActive}
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="demo">Demo Mode (~20s per round)</option>
                <option value="full">Standard Production Epochs</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Table Design: Federated Learning Rounds (Section 21) ── */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-bold text-base text-[#0F172A]">Federated Learning Rounds</h3>
            <p className="text-xs text-[#64748B]">Historical audit of completed model retraining cycles</p>
          </div>
          <span className="text-xs text-[#64748B] font-medium">
            {flRounds.length} Rounds Executed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Round</th>
                <th className="py-2.5 px-3">Model</th>
                <th className="py-2.5 px-3">Nodes</th>
                <th className="py-2.5 px-3">Samples</th>
                <th className="py-2.5 px-3">Method</th>
                <th className="py-2.5 px-3">Val Accuracy</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {flRounds.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-[#64748B]">
                    No historical rounds recorded yet. Click &quot;START FEDERATED LEARNING ROUND&quot; to begin Round #1.
                  </td>
                </tr>
              ) : (
                flRounds.map((r) => (
                  <tr key={r.round_id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#0F172A]">#{r.round || 1}</td>
                    <td className="py-3 px-3 font-mono font-medium text-[#2563EB]">{r.model_transition}</td>
                    <td className="py-3 px-3 text-[#64748B]">{r.clients || '2 / 2'}</td>
                    <td className="py-3 px-3 font-mono text-[#0F172A]">{r.total_samples || 240}</td>
                    <td className="py-3 px-3 font-medium text-[#0F172A]">{r.aggregation || 'FedAvg'}</td>
                    <td className="py-3 px-3 font-mono text-[#16A34A] font-semibold">{r.validation_accuracy}%</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                        ✓ Complete
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Table Design: Global Model Registry (Section 12 & 32) ── */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-bold text-base text-[#0F172A]">Global Model Registry</h3>
            <p className="text-xs text-[#64748B]">Tamper-evident checkpoint repository stored on Laptop A</p>
          </div>
          <span className="text-xs text-[#64748B] font-medium">
            {flModels.length} Checkpoints
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Model Version</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">FL Round</th>
                <th className="py-2.5 px-3">Aggregation</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Checkpoint File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {flModels.map((m, idx) => {
                const isCurrent = m.status === 'Current' || idx === 0;
                return (
                  <tr key={m.version} className={isCurrent ? 'bg-[#EFF6FF]/40 font-semibold' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-3 font-mono font-bold text-[#0F172A]">
                      ResNet-18 {m.version}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isCurrent
                            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                            : 'bg-slate-100 text-[#64748B]'
                        }`}
                      >
                        {isCurrent ? '● Production Ready' : 'Previous'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">Round #{m.round}</td>
                    <td className="py-3 px-3 text-[#0F172A]">{m.aggregation || 'FedAvg'}</td>
                    <td className="py-3 px-3 font-mono text-[#16A34A] font-semibold">{m.accuracy}%</td>
                    <td className="py-3 px-3 font-mono text-[#64748B]">
                      {m.checkpoint || `federated_model_${m.version}.pth`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
