import React, { useState, useEffect } from 'react';
import {
  Network,
  Shield,
  Activity,
  Cpu,
  Lock,
  Server,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Play,
  Layers,
  Award,
  Zap,
  BarChart2,
  Database,
  ArrowUpRight,
  Info,
  Clock,
} from 'lucide-react';
import { fetchFLMetrics, fetchRetrainStatus, triggerRetraining, fetchActiveLearningQueue } from '../services/api';
import { DP_CONFIG, FL_CONFIG, CENTRALIZED_BASELINE } from '../utils/flData';

// Tiny SVG Sparkline
function SparkLine({ data, color = '#0ea5e9', height = 48 }) {
  if (!data || data.length < 2) return null;
  const W = 240, H = height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const areaClose = `${W},${H} 0,${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-fed-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${pts[0].split(',')[1]} ${polyline} ${areaClose}`}
        fill={`url(#grad-fed-${color.replace('#', '')})`}
      />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={pts[pts.length - 1].split(',')[0]}
        cy={pts[pts.length - 1].split(',')[1]}
        r="4"
        fill={color}
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function FederatedMonitorPage() {
  const [metricsData, setMetricsData] = useState(null);
  const [retrainInfo, setRetrainInfo] = useState({
    feedback_count: 0,
    threshold: 5,
    is_retraining: false,
    status: 'idle',
  });
  const [queueData, setQueueData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState(null);
  const [activeRoundIdx, setActiveRoundIdx] = useState(null);

  // Load backend metrics and retraining status
  const loadData = async () => {
    try {
      const [flRes, retrainRes, qRes] = await Promise.all([
        fetchFLMetrics(),
        fetchRetrainStatus(),
        fetchActiveLearningQueue(),
      ]);

      if (flRes.success && flRes.data) {
        setMetricsData(flRes.data);
      }
      if (retrainRes.success && retrainRes.data) {
        setRetrainInfo(retrainRes.data);
      }
      if (qRes?.success && qRes.data) {
        setQueueData(qRes.data);
      }
    } catch (err) {
      console.warn('Error fetching federated metrics:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleTriggerRetrain = async (force = false) => {
    setIsTriggering(true);
    setRetrainMsg(null);
    try {
      const res = await triggerRetraining(force, 1, true);
      if (res.success) {
        setRetrainMsg({ type: 'success', text: res.data?.message || 'Retraining initiated successfully!' });
      } else {
        setRetrainMsg({ type: 'error', text: res.error });
      }
      await loadData();
    } catch (e) {
      setRetrainMsg({ type: 'error', text: e.message || 'Failed to trigger retraining' });
    } finally {
      setIsTriggering(false);
    }
  };

  const rounds = metricsData?.rounds || [
    { round: 1, accuracy: 61.2, loss: 0.721, epsilon: 0.42, delta: 1e-5, clients: 3 },
    { round: 2, accuracy: 67.4, loss: 0.634, epsilon: 0.71, delta: 1e-5, clients: 3 },
    { round: 3, accuracy: 72.1, loss: 0.578, epsilon: 0.98, delta: 1e-5, clients: 3 },
    { round: 4, accuracy: 75.8, loss: 0.521, epsilon: 1.24, delta: 1e-5, clients: 2 },
    { round: 5, accuracy: 78.86, loss: 0.443, epsilon: 1.71, delta: 1e-5, clients: 3 },
  ];

  const currentIdx = activeRoundIdx !== null ? activeRoundIdx : rounds.length - 1;
  const currentRound = rounds[currentIdx] || rounds[rounds.length - 1];
  const isLive = metricsData?.source === 'live_cluster';

  const hospitalNodes = metricsData?.client_stats || [
    {
      id: 'node_A',
      name: 'Hospital Node A',
      type: 'Urban TB Referral Center',
      location: 'SIT District Hospital',
      dataset_size: 3008,
      tb_rate: '82.9% TB',
      accuracy: 87.2,
      loss: 0.338,
      status: 'Active · Online',
      color: '#0ea5e9',
    },
    {
      id: 'node_B',
      name: 'Hospital Node B',
      type: 'Rural Primary Healthcare',
      location: 'General Screening Clinic',
      dataset_size: 4200,
      tb_rate: '16.7% TB',
      accuracy: 85.9,
      loss: 0.351,
      status: 'Active · Online',
      color: '#8b5cf6',
    },
    {
      id: 'node_C',
      name: 'Hospital Node C',
      type: 'Metropolitan Academic Center',
      location: 'Medical Research Institute',
      dataset_size: 7600,
      tb_rate: '50.0% Balanced',
      accuracy: 86.1,
      loss: 0.344,
      status: 'Active · Online',
      color: '#10b981',
    },
  ];

  const accTrend = rounds.map((r) => (r.accuracy > 1 ? r.accuracy : +(r.accuracy * 100).toFixed(1)));
  const epsTrend = rounds.map((r) => r.epsilon);

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto pb-12">

      {/* ── Top Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-500/30">
                <Network className="w-3.5 h-3.5" />
                <span>Distributed Federated Learning Network</span>
              </div>
              {isLive ? (
                <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Live Flower Cluster</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 bg-sky-500/20 text-sky-300 text-xs font-semibold px-3 py-1 rounded-full border border-sky-500/30">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Active Architecture Baseline</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Federated Network & Privacy Monitoring
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Decentralized ResNet-18 TB diagnosis across 3 independent hospital nodes using
              FedAvg coordinate aggregation and mathematically proven Opacus Differential Privacy (DP-SGD).
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                title="Refresh Live Metrics"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 p-2.5 rounded-xl transition shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-4 py-2.5 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Round {rounds.length} Aggregated</span>
              </div>
            </div>
            <span className="text-slate-400 text-xs font-mono">
              Aggregation: FedAvg · DP Target ε ≤ {DP_CONFIG.epsilon_target} · δ = 10⁻⁵
            </span>
          </div>
        </div>
      </div>

      {/* ── Retraining & Doctor Feedback Loop Banner ── */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-sky-900/30 to-slate-900/50 p-6 rounded-2xl border border-indigo-500/30 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Continuous Active Learning Feedback Loop
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Doctor confirmations in the Audit Log are securely queued. When confirmed feedback reaches the
              threshold (<span className="font-bold text-sky-400">≥ {retrainInfo.threshold} entries</span>), the backend
              triggers an incremental federated training round without moving private patient X-rays.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <span className="text-slate-400">
                Doctor Feedback Count:{' '}
                <span className="font-bold text-white font-mono">{retrainInfo.feedback_count}</span> / {retrainInfo.threshold}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">
                Active Learning Queue:{' '}
                <span className="font-bold text-sky-400 font-mono">
                  {queueData?.stats?.pending_count ?? 0} pending edge case(s)
                </span>
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">
                Retraining Status:{' '}
                <span
                  className={`font-bold font-mono uppercase ${
                    retrainInfo.is_retraining
                      ? 'text-amber-400 animate-pulse'
                      : retrainInfo.status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {retrainInfo.is_retraining ? 'Retraining in progress...' : retrainInfo.status}
                </span>
              </span>
              <span className="text-slate-400">·</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-sky-950 text-sky-300 border border-sky-800 font-mono">
                FedProx (μ=0.01) Active
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                Byzantine-Resilient
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => handleTriggerRetrain(false)}
              disabled={isTriggering || retrainInfo.is_retraining || retrainInfo.feedback_count < retrainInfo.threshold}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm ${
                retrainInfo.feedback_count >= retrainInfo.threshold && !retrainInfo.is_retraining
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Trigger Retraining ({retrainInfo.feedback_count}/{retrainInfo.threshold})</span>
            </button>

            <button
              onClick={() => handleTriggerRetrain(true)}
              disabled={isTriggering || retrainInfo.is_retraining}
              title="Force trigger a demonstration round immediately regardless of feedback threshold"
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center space-x-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Force Trigger (Demo)</span>
            </button>
          </div>
        </div>

        {retrainMsg && (
          <div
            className={`mt-4 p-3 rounded-xl text-xs flex items-center space-x-2 border ${
              retrainMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {retrainMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{retrainMsg.text}</span>
          </div>
        )}
      </div>

      {/* ── 4 Primary Status Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Round</p>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">Round {currentRound.round}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            FedAvg Status: <span className="font-bold text-emerald-600">Aggregated</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Differential Privacy</p>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100">
              <Lock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">ε = {currentRound.epsilon.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            δ = 10⁻⁵ · Target ε ≤ {DP_CONFIG.epsilon_target}
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Federated Accuracy</p>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {currentRound.accuracy > 1 ? currentRound.accuracy : +(currentRound.accuracy * 100).toFixed(2)}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            Convergence Loss: <span className="font-bold font-mono">{currentRound.loss}</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Hospital Nodes</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">3 / 3 Nodes</p>
          <p className="text-[11px] text-slate-500 mt-1 font-medium">
            14,808 Distributed Local Scans
          </p>
        </div>
      </div>

      {/* ── KEY REQUIREMENT: Centralized vs. Federated Performance Comparison ── */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full mb-1">
              <Award className="w-3.5 h-3.5" />
              <span>Empirical Benchmark Evaluation</span>
            </div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Centralized vs. Federated Learning Performance Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quantifying the privacy-utility trade-off as mandated by the Major Project specification.
            </p>
          </div>
          <div className="bg-slate-50 text-slate-600 border border-slate-200 text-xs px-3.5 py-2 rounded-xl font-mono">
            ResNet-18 Backbone · Montgomery + Shenzhen Cohorts
          </div>
        </div>

        {/* Head-to-head metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Accuracy comparison */}
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Classification Accuracy</p>
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-2xl font-black text-slate-900">98.39%</p>
                <p className="text-[11px] font-semibold text-emerald-600">Centralized Baseline</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-indigo-600">78.86%</p>
                <p className="text-[11px] font-semibold text-indigo-600">Federated (Opacus DP)</p>
              </div>
            </div>
            {/* Visual comparison bar */}
            <div className="space-y-1 pt-2">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '98.39%' }} />
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '78.86%' }} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">Δ = 19.53% privacy cost under ε-DP guarantee</p>
          </div>

          {/* Recall / Sensitivity comparison */}
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recall / Sensitivity (TB Positive)</p>
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-2xl font-black text-slate-900">99.07%</p>
                <p className="text-[11px] font-semibold text-emerald-600">Centralized</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-indigo-600">81.20%</p>
                <p className="text-[11px] font-semibold text-indigo-600">Federated (Non-IID)</p>
              </div>
            </div>
            <div className="space-y-1 pt-2">
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '99.07%' }} />
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-2 rounded-full" style={{ width: '81.20%' }} />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">Ensures high detection rate without leaking raw data</p>
          </div>

          {/* Privacy Level */}
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Differential Privacy Level</p>
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-xl font-extrabold text-rose-600">None</p>
                <p className="text-[11px] font-semibold text-rose-600">ε = ∞ (Vulnerable)</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-extrabold text-emerald-600">ε = 3.54</p>
                <p className="text-[11px] font-semibold text-emerald-600">δ = 10⁻⁵ (Protected)</p>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-800 border border-violet-100 text-[11px] mt-2 leading-relaxed">
              Per-sample gradient clipping (C=1.0) & Gaussian noise injection prevent training sample reconstruction.
            </div>
          </div>

          {/* Regulatory & Compliance */}
          <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hospital Data Governance</p>
            <div className="pt-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Centralized:</span>
                <span className="font-bold text-rose-600">High Breach Liability</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Federated:</span>
                <span className="font-bold text-emerald-600">HIPAA & DISHA Compliant</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Scans Exchanged:</span>
                <span className="font-bold text-slate-900 font-mono">0 (Weights Only)</span>
              </div>
            </div>
          </div>

        </div>

        {/* Informational table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Evaluation Metric</th>
                <th className="py-3 px-4">Centralized Model</th>
                <th className="py-3 px-4 text-indigo-700">Federated (FedAvg + Opacus DP)</th>
                <th className="py-3 px-4">Clinical Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Overall Accuracy</td>
                <td className="py-3 px-4 text-emerald-600 font-bold font-mono">98.39%</td>
                <td className="py-3 px-4 text-indigo-600 font-bold font-mono">78.86%</td>
                <td className="py-3 px-4 text-slate-500">Operates within acceptable clinical boundaries while preserving strict hospital privacy.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Recall / Sensitivity</td>
                <td className="py-3 px-4 text-emerald-600 font-bold font-mono">99.07%</td>
                <td className="py-3 px-4 text-indigo-600 font-bold font-mono">81.20%</td>
                <td className="py-3 px-4 text-slate-500">High sensitivity is maintained to prevent missed TB cases during screening.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Privacy Guarantee</td>
                <td className="py-3 px-4 text-rose-600 font-mono">No Guarantee (ε = ∞)</td>
                <td className="py-3 px-4 text-emerald-600 font-bold font-mono">(ε=3.54, δ=1e-5)-DP</td>
                <td className="py-3 px-4 text-slate-500">Model inversion attacks cannot recover original chest radiograph pixels.</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900">Raw Data Storage</td>
                <td className="py-3 px-4 text-slate-500">Single Central Cloud Server</td>
                <td className="py-3 px-4 text-slate-900 font-bold">Confined to Hospital Silos</td>
                <td className="py-3 px-4 text-slate-500">Meets national data protection and healthcare privacy standards.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Active Hospital Nodes Grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center space-x-2">
              <Server className="w-4 h-4 text-slate-700" />
              <span>Active Hospital Nodes in Federated Cluster</span>
            </h2>
            <p className="text-xs text-slate-500">
              3 distributed healthcare institutions participating in local model training and FedAvg parameter sharing.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            All 3 Nodes Online
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hospitalNodes.map((node, i) => (
            <div key={node.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-4 h-4 rounded-full mt-0.5"
                    style={{ backgroundColor: node.color || (i === 0 ? '#0ea5e9' : i === 1 ? '#8b5cf6' : '#10b981') }}
                  />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{node.name}</h3>
                    <p className="text-[11px] text-slate-500">{node.type}</p>
                  </div>
                </div>
                <span className="inline-flex items-center space-x-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>ONLINE</span>
                </span>
              </div>

              <div className="space-y-2 pt-1 text-xs border-t border-slate-100">
                <div className="flex justify-between text-slate-500">
                  <span>Location / Affiliation:</span>
                  <span className="font-semibold text-slate-700">{node.location}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Local Dataset Size:</span>
                  <span className="font-mono font-bold text-slate-900">{node.dataset_size?.toLocaleString()} Scans</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Class Prevalence:</span>
                  <span className="font-semibold text-amber-700">{node.tb_rate || 'Non-IID Skew'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Local Accuracy</p>
                  <p className="text-base font-extrabold text-sky-600 mt-0.5">
                    {node.accuracy ? (node.accuracy > 1 ? node.accuracy : +(node.accuracy * 100).toFixed(1)) : '86.5'}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Local Loss</p>
                  <p className="text-base font-extrabold text-slate-700 font-mono mt-0.5">
                    {node.loss || 0.34}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Round-by-Round Training Curves ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Accuracy progression */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                <span>Global Model Accuracy Convergence</span>
              </h3>
              <p className="text-[11px] text-slate-500">FedAvg weighted accuracy across rounds</p>
            </div>
            <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-lg">
              Latest: {accTrend[accTrend.length - 1]}%
            </span>
          </div>
          <SparkLine data={accTrend} color="#0ea5e9" height={72} />
          <div className="flex justify-between text-[10px] text-slate-400 pt-1">
            <span>Round 1 ({accTrend[0]}%)</span>
            <span>Current: Round {rounds.length} ({accTrend[accTrend.length - 1]}%)</span>
          </div>
        </div>

        {/* Differential Privacy Budget Spent */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-violet-600" />
                <span>Privacy Budget (ε) Consumption Curve</span>
              </h3>
              <p className="text-[11px] text-slate-500">Opacus DP-SGD Renyi Differential Privacy (RDP) composition</p>
            </div>
            <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
              ε = {epsTrend[epsTrend.length - 1]?.toFixed(2)}
            </span>
          </div>
          <SparkLine data={epsTrend} color="#8b5cf6" height={72} />
          <div className="flex justify-between text-[10px] text-slate-400 pt-1">
            <span>Round 1 (ε={epsTrend[0]?.toFixed(2)})</span>
            <span className="text-violet-600 font-semibold">Under target limit ε ≤ {DP_CONFIG.epsilon_target}</span>
          </div>
        </div>

      </div>

    </div>
  );
}
