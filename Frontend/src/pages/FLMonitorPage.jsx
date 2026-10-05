import React, { useState, useEffect } from 'react';
import {
  FL_ROUND_METRICS,
  CLIENT_STATS,
  CENTRALIZED_BASELINE,
  DP_CONFIG,
  FL_CONFIG,
} from '../utils/flData';
import { fetchFLMetrics } from '../services/api';
import {
  Activity,
  Shield,
  Users,
  Cpu,
  TrendingUp,
  Lock,
  CheckCircle2,
  AlertCircle,
  Info,
  BarChart2,
  Zap,
  Server,
  RefreshCw,
} from 'lucide-react';

// ─── Tiny SVG Line Chart ────────────────────────────────────────────────────
function SparkLine({ data, color = '#0ea5e9', height = 56 }) {
  const W = 280, H = height;
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
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${pts[0].split(',')[1]} ${polyline} ${areaClose}`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Last point dot */}
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1].split(',')[0]}
          cy={pts[pts.length - 1].split(',')[1]}
          r="4"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

// ─── Round-by-round Bar Chart ────────────────────────────────────────────────
function AccuracyBarChart({ data }) {
  const max = 100;
  const W = 560, H = 140, pad = { left: 36, right: 8, top: 12, bottom: 24 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const barW = innerW / data.length - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Y-axis gridlines */}
      {[0, 25, 50, 75, 100].map((v) => {
        const y = pad.top + innerH - (v / max) * innerH;
        return (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      {/* Centralized baseline */}
      {(() => {
        const by = pad.top + innerH - (CENTRALIZED_BASELINE.accuracy / max) * innerH;
        return (
          <line x1={pad.left} x2={W - pad.right} y1={by} y2={by}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 3" opacity="0.8" />
        );
      })()}
      {/* Bars */}
      {data.map((d, i) => {
        const barH = (d.accuracy / max) * innerH;
        const x = pad.left + i * (innerW / data.length) + 2;
        const y = pad.top + innerH - barH;
        const isLast = i === data.length - 1;
        return (
          <g key={d.round}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={isLast ? '#0ea5e9' : '#bae6fd'} rx="3"
            />
            <text x={x + barW / 2} y={H - pad.bottom + 12} textAnchor="middle" fontSize="9" fill="#64748b">
              R{d.round}
            </text>
            {isLast && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="#0284c7" fontWeight="600">
                {d.accuracy}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Privacy Budget Chart ────────────────────────────────────────────────────
function EpsilonChart({ data }) {
  const maxEps = DP_CONFIG.epsilon_target;
  const W = 560, H = 110, pad = { left: 36, right: 8, top: 12, bottom: 24 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const pts = data.map((d, i) => {
    const x = pad.left + (i / (data.length - 1)) * innerW;
    const y = pad.top + innerH - (d.epsilon / maxEps) * innerH;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 1, 2, 3].map((v) => {
        const y = pad.top + innerH - (v / maxEps) * innerH;
        return (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
            <text x={pad.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      {/* Target ε line */}
      {(() => {
        const ty = pad.top + innerH - (maxEps / maxEps) * innerH;
        return (
          <line x1={pad.left} x2={W - pad.right} y1={ty} y2={ty}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.8" />
        );
      })()}
      {/* Area fill */}
      <polygon
        points={`${pad.left},${pad.top + innerH} ${polyline} ${W - pad.right},${pad.top + innerH}`}
        fill="url(#grad-8b5cf6)" opacity="0.5"
      />
      <defs>
        <linearGradient id="grad-8b5cf6" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline points={polyline} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Round labels */}
      {data.map((d, i) => {
        const x = pad.left + (i / (data.length - 1)) * innerW;
        return (
          <text key={d.round} x={x} y={H - pad.bottom + 12} textAnchor="middle" fontSize="9" fill="#64748b">
            R{d.round}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Main FL Monitor Page ────────────────────────────────────────────────────
export default function FLMonitorPage() {
  const [flRounds, setFlRounds] = useState(FL_ROUND_METRICS);
  const [clientData, setClientData] = useState(CLIENT_STATS);
  const [isLive, setIsLive] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeRound, setActiveRound] = useState(FL_ROUND_METRICS.length - 1);

  const loadMetrics = async () => {
    try {
      const res = await fetchFLMetrics();
      if (res.success && res.data && res.data.rounds && res.data.rounds.length > 0) {
        setFlRounds(res.data.rounds);
        setIsLive(res.data.source === 'live_cluster');
        if (res.data.client_stats && res.data.client_stats.length > 0) {
          setClientData(res.data.client_stats.map((cs, i) => ({
            id: cs.id || `client-${i+1}`,
            label: cs.name || cs.id,
            samples: cs.dataset_size || 400,
            accuracy: cs.accuracy ? (cs.accuracy > 1 ? cs.accuracy : +(cs.accuracy * 100).toFixed(1)) : 85.0,
            loss: cs.loss || 0.35,
            status: cs.status || 'active',
            lastRound: res.data.rounds.length,
            color: i === 0 ? '#0ea5e9' : i === 1 ? '#8b5cf6' : '#10b981',
          })));
        }
      }
    } catch (e) {
      // Keep benchmark defaults
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await loadMetrics();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  useEffect(() => {
    loadMetrics();
    const timer = setInterval(loadMetrics, 10000);
    return () => clearInterval(timer);
  }, []);

  const safeIdx = Math.min(Math.max(activeRound, 0), flRounds.length - 1);
  const round = flRounds[safeIdx] || flRounds[0];
  const accData = flRounds.map((r) => (r.accuracy > 1 ? r.accuracy : +(r.accuracy * 100).toFixed(1)));
  const lossData = flRounds.map((r) => r.loss);
  const epsData = flRounds.map((r) => r.epsilon);

  const privacyBudgetPct = Math.min((round.epsilon / DP_CONFIG.epsilon_target) * 100, 100);
  const budgetColor =
    privacyBudgetPct < 60 ? '#10b981' : privacyBudgetPct < 85 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full border border-indigo-500/30">
                <Shield className="w-3.5 h-3.5" />
                <span>Privacy-Preserving Federated Learning</span>
              </div>
              {isLive ? (
                <div className="inline-flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Live Flower Cluster</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 bg-sky-500/20 text-sky-300 text-xs font-semibold px-3 py-1 rounded-full border border-sky-500/30">
                  <Activity className="w-3 h-3" />
                  <span>Benchmark Baseline</span>
                </div>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              FL Training Monitor
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Real-time dashboard for Federated Averaging across 3 hospital clients using
              Opacus Differential Privacy (DP-SGD) and the Flower framework.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleManualRefresh}
                title="Refresh Metrics"
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 p-2 rounded-xl transition"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <div className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Rounds: {flRounds.length}/{FL_CONFIG.total_rounds}</span>
              </div>
            </div>
            <span className="text-slate-400 text-xs font-mono">Strategy: {FL_CONFIG.strategy} · {FL_CONFIG.privacy}</span>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Global Accuracy',
            value: `${flRounds[flRounds.length - 1]?.accuracy || 0}%`,
            sub: `Centralized baseline: ${CENTRALIZED_BASELINE.accuracy}%`,
            icon: TrendingUp,
            color: 'sky',
          },
          {
            label: 'Privacy Budget (ε)',
            value: round.epsilon.toFixed(2),
            sub: `δ = ${round.delta.toExponential(0)} · Target ε ≤ ${DP_CONFIG.epsilon_target}`,
            icon: Lock,
            color: 'violet',
          },
          {
            label: 'FL Rounds Completed',
            value: `${flRounds.length}`,
            sub: `${FL_CONFIG.local_epochs} local epochs · batch ${FL_CONFIG.batch_size}`,
            icon: Activity,
            color: 'emerald',
          },
          {
            label: 'Participating Clients',
            value: `${FL_CONFIG.clients_per_round}`,
            sub: `${clientData.reduce((a, c) => a + (c.samples || 0), 0)} total training samples`,
            icon: Users,
            color: 'amber',
          },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <div className={`w-9 h-9 rounded-xl bg-${color}-50 text-${color}-600 flex items-center justify-center border border-${color}-100`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-extrabold text-slate-900">{value}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-medium leading-relaxed">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Accuracy per Round */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                <span>Global Model Accuracy per Round</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">FedAvg aggregated accuracy after each communication round</p>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold">
              <span className="inline-block w-3 h-1 rounded bg-sky-400" />
              <span className="text-slate-500">Federated</span>
              <span className="inline-block w-3 h-1 rounded bg-amber-400 ml-2" style={{ borderTop: '2px dashed #f59e0b', background: 'transparent' }} />
              <span className="text-slate-500">Baseline</span>
            </div>
          </div>
          <AccuracyBarChart data={flRounds} />
          <p className="text-[10px] text-slate-400 text-center">
            Accuracy gap vs. centralized: <span className="font-bold text-amber-600">
              {(CENTRALIZED_BASELINE.accuracy - (flRounds[flRounds.length - 1]?.accuracy || 0)).toFixed(1)}%
            </span> — within acceptable FL privacy-utility trade-off
          </p>
        </div>

        {/* Privacy Budget (ε) per Round */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Shield className="w-4 h-4 text-violet-600" />
                <span>Privacy Budget (ε) per Round</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">ε accumulates with each round — lower is more private</p>
            </div>
            <div className="flex items-center space-x-1.5 text-[10px] font-semibold">
              <span className="inline-block w-3 h-1 rounded bg-violet-500" />
              <span className="text-slate-500">ε spent</span>
              <span className="text-red-500 ml-2">— target ε={DP_CONFIG.epsilon_target}</span>
            </div>
          </div>
          <EpsilonChart data={flRounds} />
          {/* Budget progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-semibold text-slate-500">
              <span>Privacy Budget Used</span>
              <span style={{ color: budgetColor }}>{privacyBudgetPct.toFixed(1)}% of ε={DP_CONFIG.epsilon_target}</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{ width: `${privacyBudgetPct}%`, backgroundColor: budgetColor }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              Current: ε={round.epsilon.toFixed(2)}, δ=10⁻⁵ · Mechanism: {DP_CONFIG.mechanism} · Noise σ={DP_CONFIG.noise_multiplier}
            </p>
          </div>
        </div>
      </div>

      {/* ── Sparklines Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-500" />
            <span>Accuracy Trend</span>
          </p>
          <SparkLine data={accData} color="#0ea5e9" />
          <p className="text-[10px] text-slate-400 mt-1">
            {accData[0]}% → <span className="font-bold text-sky-600">{accData[accData.length - 1]}%</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-rose-500" />
            <span>Loss Trend</span>
          </p>
          <SparkLine data={lossData} color="#ef4444" />
          <p className="text-[10px] text-slate-400 mt-1">
            {lossData[0]} → <span className="font-bold text-rose-600">{lossData[lossData.length - 1]}</span>
          </p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-violet-500" />
            <span>ε Budget Consumed</span>
          </p>
          <SparkLine data={epsData} color="#8b5cf6" />
          <p className="text-[10px] text-slate-400 mt-1">
            {epsData[0]} → <span className="font-bold text-violet-600">{epsData[epsData.length - 1]}</span> / {DP_CONFIG.epsilon_target}
          </p>
        </div>
      </div>

      {/* ── Client Status + Round Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Client cards */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Server className="w-4 h-4 text-slate-600" />
            <span>Federated Client Status — Round {flRounds.length}</span>
          </h3>
          {clientData.map((c) => (
            <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{c.label}</p>
                    <p className="text-[10px] text-slate-500">{c.samples} training samples · Round {c.lastRound}</p>
                  </div>
                </div>
                <span className="inline-flex items-center space-x-1 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{c.status.toUpperCase()}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-slate-400 mb-1 font-semibold">LOCAL ACCURACY</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full">
                    <div className="h-1.5 rounded-full" style={{ width: `${c.accuracy}%`, backgroundColor: c.color }} />
                  </div>
                  <p className="text-xs font-bold mt-1" style={{ color: c.color }}>{c.accuracy}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 mb-1 font-semibold">LOCAL LOSS</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full">
                    <div className="h-1.5 rounded-full bg-slate-400" style={{ width: `${c.loss * 100}%` }} />
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-1">{c.loss}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Round selector + detail */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Round Detail</span>
          </h3>

          {/* Round picker */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[10px] text-slate-400 font-semibold mb-2">SELECT ROUND</p>
            <div className="grid grid-cols-5 gap-1.5">
              {flRounds.map((r, i) => (
                <button
                  key={r.round}
                  onClick={() => setActiveRound(i)}
                  className={`text-xs font-bold py-1.5 rounded-lg transition-all ${
                    safeIdx === i
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  R{r.round}
                </button>
              ))}
            </div>
          </div>

          {/* Selected round metrics */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <p className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-2">
              Round {round.round} Metrics
            </p>
            {[
              { label: 'Accuracy', value: `${round.accuracy}%`, color: 'text-sky-600' },
              { label: 'Loss', value: round.loss, color: 'text-rose-600' },
              { label: 'Privacy ε', value: round.epsilon.toFixed(2), color: 'text-violet-600' },
              { label: 'Privacy δ', value: round.delta.toExponential(0), color: 'text-violet-500' },
              { label: 'Clients', value: `${round.clients} / ${FL_CONFIG.clients_per_round}`, color: 'text-emerald-600' },
              { label: 'Duration', value: `${round.duration_s || 40}s`, color: 'text-slate-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className={`font-bold font-mono ${color}`}>{value}</span>
              </div>
            ))}
          </div>

          {/* FL Config */}
          <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl text-[10px] space-y-1.5 font-mono">
            <p className="text-slate-400 font-sans text-[11px] font-bold mb-2 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>FL Configuration</span>
            </p>
            {Object.entries(FL_CONFIG).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-slate-500">{k}:</span>
                <span className="text-sky-400 text-right">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-indigo-900">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p>
            <strong>How Federated Learning Works:</strong> Each hospital client (A, B, C) trains the
            ResNet-18 model locally on their own patient X-rays — <em>no raw data ever leaves the hospital</em>.
            Only encrypted model weight gradients are sent to the central Flower server, which runs FedAvg
            to create a better global model. Opacus DP-SGD adds calibrated Gaussian noise to the gradients,
            providing a mathematical privacy guarantee (ε={FL_ROUND_METRICS[FL_ROUND_METRICS.length-1].epsilon.toFixed(2)}, δ=10⁻⁵).
          </p>
          <p className="text-indigo-600 font-semibold">
            ⚠ These metrics are simulated for demonstration. Connect the backend /fl-metrics endpoint to
            display live values from your Flower server logs.
          </p>
        </div>
      </div>

    </div>
  );
}
