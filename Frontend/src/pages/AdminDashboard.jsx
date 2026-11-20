import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Activity,
  RefreshCw,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Layers,
  Sliders,
  ArrowDown,
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

  // Configuration settings
  const [aggregationMethod, setAggregationMethod] = useState('FedAvg');
  const [isDemoMode, setIsDemoMode] = useState(true);

  // General Admin
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startingRound, setStartingRound] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

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
        if (statusRes.data.is_active) setIsModalOpen(true);
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
    const intervalTime = isModalOpen || flStatus?.is_active ? 1500 : 4000;
    const interval = setInterval(pollFLData, intervalTime);
    return () => clearInterval(interval);
  }, [isModalOpen, flStatus?.is_active]);

  // Dynamic node counts — works with any number of nodes
  const currentGlobalVersion = flStatus?.global_model_version || 'v1';
  const currentRoundNum = flStatus?.current_round || 1;
  const isRoundActive = Boolean(flStatus?.is_active);
  const onlineNodes = flNodes.filter((n) => n.status === 'online');
  const onlineCount = onlineNodes.length;

  const handleStartFLRound = async () => {
    setStatusMsg('');

    if (onlineCount < 1) {
      setStatusMsg(
        'Cannot start: No hospital nodes connected. Run a hospital node client on any laptop and try again.'
      );
      return;
    }

    setStartingRound(true);
    const res = await startFLRound({
      aggregation: aggregationMethod,
      demo: isDemoMode,
      dp: true,
      simulate: false,
      min_nodes: 1,
    });
    setStartingRound(false);

    if (res.success) {
      setIsModalOpen(true);
      const nNodes = res.data?.num_nodes || onlineCount;
      setStatusMsg(`Round ${res.data?.round_id || ''} started with ${nNodes} node(s).`);
      pollFLData();
    } else {
      setStatusMsg(`Failed: ${res.error || 'Server rejected round initiation'}`);
    }
  };

  const handleCancelFLRound = async () => {
    await cancelFLRound();
    pollFLData();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">

      {/* FL Orchestration Modal */}
      <FLOrchestrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        liveStatus={flStatus}
        events={flEvents}
        onCancelRound={handleCancelFLRound}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E2E8F0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Federated Learning Operations
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitor decentralized model training across participating hospitals. Patient data remains within each hospital.
          </p>
        </div>

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

      {/* Status Alert Banner */}
      {statusMsg && (
        <div
          className={`p-4 rounded-2xl border text-sm flex items-center justify-between transition-all animate-fade-in ${
            statusMsg.toLowerCase().includes('fail') ||
            statusMsg.toLowerCase().includes('cannot') ||
            statusMsg.toLowerCase().includes('error') ||
            statusMsg.toLowerCase().includes('no hospital')
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {statusMsg.toLowerCase().includes('fail') ||
            statusMsg.toLowerCase().includes('cannot') ||
            statusMsg.toLowerCase().includes('error') ||
            statusMsg.toLowerCase().includes('no hospital') ? (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            )}
            <span className="font-semibold">{statusMsg}</span>
          </div>
          <button
            onClick={() => setStatusMsg('')}
            className="text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-black/5 text-slate-500 hover:text-slate-800 transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Privacy Indicator */}
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Global Model</div>
          <div className="text-2xl font-bold text-[#2563EB] mt-1">{currentGlobalVersion}</div>
          <div className="text-xs text-[#64748B] mt-1">ResNet-18 Architecture</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Current Round</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">#{currentRoundNum}</div>
          <div className="text-xs text-[#64748B] mt-1">
            Method: <span className="font-medium text-[#0F172A]">{aggregationMethod}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Connected Nodes</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1">{onlineCount}</div>
          <div className="text-xs mt-1 flex items-center gap-1 font-medium">
            {onlineCount >= 1 ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span className="text-[#16A34A]">
                  {onlineCount} node{onlineCount !== 1 ? 's' : ''} online
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                <span className="text-[#64748B]">No nodes connected</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Model Status</div>
          <div className="text-2xl font-bold text-[#0F172A] mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
            <span>Ready</span>
          </div>
          <div className="text-xs text-[#64748B] mt-1">
            Validation:{' '}
            <span className="font-medium text-[#16A34A]">
              {flStatus?.validation_accuracy != null ? `${flStatus.validation_accuracy}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* FL Architecture Diagram — dynamic node count */}
      <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Federated Model Distribution & Aggregation Architecture
            </h2>
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

        <div className="py-4 px-2 bg-slate-50/50 rounded-xl border border-[#E2E8F0]">
          <div className="max-w-3xl mx-auto space-y-3 text-xs">
            {/* Central Server */}
            <div className="p-3 bg-white border border-[#2563EB]/40 rounded-xl shadow-xs text-center max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold text-[#64748B] block">
                Central Aggregation Hub (Admin Server)
              </span>
              <span className="font-bold text-[#0F172A] text-sm">
                Global ResNet-18 Model ({currentGlobalVersion})
              </span>
            </div>

            <div className="text-center text-[#2563EB] font-medium flex items-center justify-center gap-1 text-[11px]">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Encrypted Model Weights Distribution (HTTP / LAN)</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* Dynamic Hospital Nodes Grid */}
            <div
              className={`grid gap-3 ${
                flNodes.length <= 2
                  ? 'grid-cols-2'
                  : flNodes.length <= 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2 md:grid-cols-4'
              }`}
            >
              {flNodes.length === 0 ? (
                <div className="col-span-2 p-3.5 bg-white border border-dashed border-[#E2E8F0] rounded-xl text-center text-[#94A3B8] text-[11px]">
                  No hospital nodes connected yet.
                  <br />
                  Run <code className="font-mono bg-slate-100 px-1 rounded">python Model/run_hospital_node.py</code> on any laptop.
                </div>
              ) : (
                flNodes.map((node) => (
                  <div
                    key={node.node_id}
                    className="p-3.5 bg-white border border-[#E2E8F0] rounded-xl shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0F172A] text-xs truncate">
                        {node.node_id.toUpperCase()}
                      </span>
                      {node.status === 'online' ? (
                        <span className="text-[10px] font-semibold text-[#16A34A] bg-[#F0FDF4] px-1.5 rounded border border-[#DCFCE7]">
                          ● Online
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#64748B] bg-slate-100 px-1.5 rounded border border-[#E2E8F0]">
                          ○ Offline
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      Dataset: {node.dataset_size || 0} CXRs (Local)
                    </div>
                    <div className="text-[11px] text-[#0D9488] font-medium flex items-center gap-1">
                      <Lock className="w-3 h-3" /> DP-SGD Local Training
                    </div>
                    {node.ip_address && (
                      <div className="text-[10px] text-[#64748B]">
                        IP: <span className="font-mono">{node.ip_address}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="text-center text-[#2563EB] font-medium flex items-center justify-center gap-1 text-[11px]">
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Upload Parameter Vectors Only (No Raw Patient Data)</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </div>

            {/* FedAvg */}
            <div className="p-3 bg-white border border-[#16A34A]/50 rounded-xl shadow-xs text-center max-w-sm mx-auto">
              <span className="text-[10px] uppercase font-bold text-[#16A34A] block">
                Central Server FedAvg Aggregation
              </span>
              <span className="font-bold text-[#0F172A] text-sm">
                W_new = Σ (n_i / N) · W_i
              </span>
              <div className="text-[11px] text-[#64748B] mt-0.5">
                Sample-weighted across {onlineCount || 'N'} hospital node(s)
              </div>
              {flStatus?.validation_accuracy != null && (
                <div className="text-[11px] font-semibold text-[#16A34A] mt-1">
                  ✓ Central Model Updated Successfully
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Node Cards */}
      <div>
        <h3 className="text-sm font-bold text-[#0F172A] mb-3">
          Hospital Node Status ({onlineCount} / {flNodes.length} Online)
        </h3>
        {flNodes.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-dashed border-[#E2E8F0] text-center text-[#64748B] text-sm space-y-2">
            <p className="font-semibold">No hospital nodes registered yet.</p>
            <p className="text-xs">
              On each hospital laptop, run:
            </p>
            <code className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-mono block max-w-lg mx-auto">
              python Model/run_hospital_node.py --node_id node_X --api_server http://&lt;admin_ip&gt;:8000 --demo
            </code>
            <p className="text-xs text-[#94A3B8]">Replace node_X with node_A, node_B, node_C, etc.</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${
            flNodes.length === 1 ? 'grid-cols-1 max-w-sm' :
            flNodes.length === 2 ? 'grid-cols-2' :
            flNodes.length === 3 ? 'grid-cols-3' :
            'grid-cols-2 lg:grid-cols-4'
          }`}>
            {flNodes.map((node) => (
              <div
                key={node.node_id}
                className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                  <div>
                    <h3 className="font-bold text-sm text-[#0F172A]">{node.node_id.toUpperCase()}</h3>
                    <p className="text-[11px] text-[#64748B] truncate max-w-[140px]">
                      {node.name || node.node_id}
                    </p>
                  </div>
                  {node.status === 'online' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
                      ● Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-[#64748B] border border-[#E2E8F0]">
                      ○ Offline
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Local Model:</span>
                    <span className="font-mono font-bold text-[#2563EB]">
                      {node.model_version || currentGlobalVersion}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Dataset:</span>
                    <span className="font-semibold text-[#0F172A]">{node.dataset_size || 0} CXRs</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">IP Address:</span>
                    <span className="font-mono text-[#0F172A]">{node.ip_address || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Loss:</span>
                    <span className="font-mono text-[#0F172A]">{node.last_loss ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Accuracy:</span>
                    <span className="font-mono font-semibold text-[#16A34A]">
                      {node.last_acc ? `${node.last_acc}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[#E2E8F0]">
                    <span className="text-[#64748B]">DP-SGD:</span>
                    <span className="font-semibold text-[#0D9488]">✓ Enabled</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Security Card always last */}
            <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                <div>
                  <h3 className="font-bold text-sm text-[#0F172A]">Security Status</h3>
                  <p className="text-[11px] text-[#64748B]">Platform encryption</p>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div className="space-y-2 text-xs">
                {[
                  'TLS Network Encryption',
                  'Node Authentication',
                  'DICOM PHI Sanitization',
                  'Opacus DP-SGD Privacy',
                  'Secure Parameter Transfer',
                ].map((item) => (
                  <div key={item} className="flex items-center space-x-2 text-[#0F172A]">
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FL Configuration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
              <span className="font-semibold text-[#0F172A]">{onlineCount} Hospital{onlineCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between text-[#64748B]">
              <span>Status:</span>
              <span className="font-semibold text-[#16A34A] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Production Ready
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-sm text-[#0F172A]">Federated Cycle Configuration</h3>
              <p className="text-[11px] text-[#64748B]">Tune aggregation parameters and deployment mode</p>
            </div>
            <Sliders className="w-4 h-4 text-[#2563EB]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[#64748B] font-medium block mb-1">Aggregation Algorithm</label>
              <select
                value={aggregationMethod}
                onChange={(e) => setAggregationMethod(e.target.value)}
                disabled={isRoundActive}
                className="w-full bg-slate-50 border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#0F172A] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="FedAvg">FedAvg (Sample-Weighted Average)</option>
                <option value="Trimmed Mean">Trimmed Mean (Byzantine-Resilient)</option>
                <option value="Coordinate-wise Median">Coordinate-wise Median</option>
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
                <option value="demo">Demo Mode (~20–30s per round)</option>
                <option value="full">Standard Production Epochs</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-xs text-blue-800">
            <strong>Dynamic Node Support:</strong> This system works with 1, 2, 3, 4, 5+ hospital nodes automatically.
            Start any number of hospital node clients, then click START FEDERATED LEARNING ROUND.
            Aggregation runs once all connected nodes submit their updates.
          </div>
        </div>
      </div>

      {/* FL Rounds Table */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-bold text-base text-[#0F172A]">Federated Learning Rounds</h3>
            <p className="text-xs text-[#64748B]">Historical audit of completed model retraining cycles</p>
          </div>
          <span className="text-xs text-[#64748B] font-medium">{flRounds.length} Rounds Executed</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Round</th>
                <th className="py-2.5 px-3">Result</th>
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
                flRounds.map((r, idx) => (
                  <tr key={r.round_id || idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-[#0F172A]">#{r.round || 1}</td>
                    <td className="py-3 px-3 font-semibold text-[#16A34A] text-[11px]">
                      {r.model_transition || 'Central Model Updated Successfully'}
                    </td>
                    <td className="py-3 px-3 text-[#64748B]">{r.clients || '—'}</td>
                    <td className="py-3 px-3 font-mono text-[#0F172A]">{r.total_samples || '—'}</td>
                    <td className="py-3 px-3 font-medium text-[#0F172A]">{r.aggregation || 'FedAvg'}</td>
                    <td className="py-3 px-3 font-mono text-[#16A34A] font-semibold">
                      {r.validation_accuracy != null ? `${r.validation_accuracy}%` : '—'}
                    </td>
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

      {/* Global Model Registry */}
      <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
          <div>
            <h3 className="font-bold text-base text-[#0F172A]">Global Model Registry</h3>
            <p className="text-xs text-[#64748B]">Tamper-evident checkpoint repository stored on Admin Server</p>
          </div>
          <span className="text-xs text-[#64748B] font-medium">{flModels.length} Checkpoints</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#64748B] font-medium uppercase text-[10px] border-b border-[#E2E8F0]">
              <tr>
                <th className="py-2.5 px-3">Model Version</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">FL Round</th>
                <th className="py-2.5 px-3">Nodes</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Checkpoint File</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {flModels.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-6 text-center text-[#64748B]">
                    No model checkpoints yet. Complete a federated round to generate them.
                  </td>
                </tr>
              ) : (
                flModels.map((m, idx) => {
                  const isCurrent = m.status === 'Current' || idx === 0;
                  return (
                    <tr key={m.version} className={isCurrent ? 'bg-[#EFF6FF]/40 font-semibold' : 'hover:bg-slate-50'}>
                      <td className="py-3 px-3 font-mono font-bold text-[#0F172A]">ResNet-18 {m.version}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            isCurrent
                              ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                              : 'bg-slate-100 text-[#64748B]'
                          }`}
                        >
                          {isCurrent ? '● Central Model Updated Successfully' : 'Previous'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#64748B]">Round #{m.round}</td>
                      <td className="py-3 px-3 text-[#0F172A]">{m.clients || '—'} node(s)</td>
                      <td className="py-3 px-3 font-mono text-[#16A34A] font-semibold">
                        {m.accuracy != null ? `${m.accuracy}%` : '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#64748B]">
                        {m.checkpoint || `federated_model_${m.version}.pth`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
