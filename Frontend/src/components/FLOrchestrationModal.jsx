import React, { useState } from 'react';
import {
  ShieldCheck,
  Server,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Database,
  RefreshCw,
  X,
  AlertTriangle,
  UploadCloud,
  FileCheck,
  Activity,
  Terminal,
} from 'lucide-react';

export default function FLOrchestrationModal({
  isOpen,
  onClose,
  liveStatus,
  events = [],
  onCancelRound,
}) {
  const [showEventLog, setShowEventLog] = useState(false);

  if (!isOpen) return null;

  const stage = liveStatus?.stage || 'idle';
  const roundNum = liveStatus?.current_round || 1;
  const roundId = liveStatus?.round_id || `FL-2026-${String(roundNum).padStart(3, '0')}`;
  const globalVersion = liveStatus?.global_model_version || 'v2.1';
  const aggMethod = liveStatus?.aggregation_method || 'FedAvg';
  const nodes = liveStatus?.nodes || {};
  const nodeA = nodes['node_A'] || {};
  const nodeB = nodes['node_B'] || {};
  const updates = liveStatus?.round_updates || {};
  const updateA = updates['node_A'] || null;
  const updateB = updates['node_B'] || null;

  // Progression index: 1 to 5 (Section 10)
  let activeStep = 1;
  if (stage === 'broadcasting') activeStep = 1;
  else if (stage === 'local_training') activeStep = 2;
  else if (stage === 'receiving_updates' || (updateA && !updateB) || (updateB && !updateA)) activeStep = 3;
  else if (stage === 'aggregating') activeStep = 4;
  else if (stage === 'model_updated' || stage === 'distributing' || stage === 'completed') activeStep = 5;

  const isCompleted = stage === 'completed';

  // Extract latest training progress events for Hospital A and Hospital B
  const trainingEventsA = events.filter((e) => e.payload?.node_id === 'node_A' && e.type === 'LOCAL_TRAINING_PROGRESS');
  const latestProgressA = trainingEventsA[trainingEventsA.length - 1]?.payload || null;

  const trainingEventsB = events.filter((e) => e.payload?.node_id === 'node_B' && e.type === 'LOCAL_TRAINING_PROGRESS');
  const latestProgressB = trainingEventsB[trainingEventsB.length - 1]?.payload || null;

  const batchA = latestProgressA?.batch || (updateA ? 4 : (activeStep >= 2 ? 1 : 0));
  const totalBatchesA = latestProgressA?.total_batches || 4;
  const lossA = latestProgressA?.loss ?? updateA?.loss ?? nodeA.last_loss ?? 0.421;
  const accA = latestProgressA?.accuracy ?? updateA?.accuracy ?? nodeA.last_acc ?? 86.4;

  const batchB = latestProgressB?.batch || (updateB ? 4 : (activeStep >= 2 ? 1 : 0));
  const totalBatchesB = latestProgressB?.total_batches || 4;
  const lossB = latestProgressB?.loss ?? updateB?.loss ?? nodeB.last_loss ?? 0.439;
  const accB = latestProgressB?.accuracy ?? updateB?.accuracy ?? nodeB.last_acc ?? 85.9;

  // DP-SGD epsilon
  const epsA = updateA?.epsilon ?? nodeA.dp_epsilon ?? (0.42 * roundNum).toFixed(2);
  const epsB = updateB?.epsilon ?? nodeB.dp_epsilon ?? (0.42 * roundNum).toFixed(2);

  // Aggregation weights calculation
  const nA = updateA?.num_samples || nodeA.dataset_size || 120;
  const nB = updateB?.num_samples || nodeB.dataset_size || 120;
  const N = nA + nB;
  const wA = (nA / N).toFixed(4);
  const wB = (nB / N).toFixed(4);

  // Model version bump
  const nextVersionNum = parseInt(globalVersion.replace('v', ''), 10) + 1;
  const nextVersion = `v${nextVersionNum || 2.2}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl border border-[#E2E8F0] overflow-hidden transform transition-all my-auto max-h-[92vh] flex flex-col">
        
        {/* ── Top Modal Navigation & Header (Section 10) ── */}
        <div className="bg-white p-5 sm:p-6 flex items-center justify-between border-b border-[#E2E8F0] shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 bg-[#EFF6FF] text-[#2563EB] text-xs font-semibold px-2.5 py-0.5 rounded-full border border-[#DBEAFE]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
              <span>Federated Learning Pipeline</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>Federated Learning — Round #{roundNum}</span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-[#64748B] border border-[#E2E8F0]">
                {roundId}
              </span>
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowEventLog(!showEventLog)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#0F172A] border border-[#E2E8F0] transition"
            >
              <Terminal className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>{showEventLog ? 'Hide Telemetry' : 'Telemetry Log'}</span>
            </button>

            {liveStatus?.is_active && (
              <button
                onClick={onCancelRound}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA] transition"
              >
                Cancel Round
              </button>
            )}

            <button
              onClick={onClose}
              className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-xl hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Privacy Boundary Banner (Section 14 & 2) ── */}
        <div className="bg-[#F0FDFA] px-5 py-2.5 border-b border-[#CCFBF1] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0 text-[#0F766E]">
          <div className="flex items-center space-x-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Raw Patient CXR Images: <b>Never leave hospital edge laptops</b></span>
          </div>

          <div className="text-[11px] font-semibold text-[#0D9488] bg-white px-2.5 py-0.5 rounded border border-[#CCFBF1]">
            ✓ Serialized weight vectors only
          </div>
        </div>

        {/* ── Scrollable Body Area ── */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8FAFC]">
          
          {/* ── 5-Stage Stepper Header (Section 10) ── */}
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { step: 1, label: 'Broadcast Model', icon: Server },
              { step: 2, label: 'Local Training', icon: Cpu },
              { step: 3, label: 'Model Updates', icon: UploadCloud },
              { step: 4, label: 'FedAvg Aggregation', icon: Layers },
              { step: 5, label: 'Global Model Update', icon: CheckCircle2 },
            ].map(({ step, label, icon: Icon }) => {
              const isPast = activeStep > step || isCompleted;
              const isCurrent = activeStep === step && !isCompleted;
              return (
                <div
                  key={step}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-white border-[#2563EB] shadow-xs ring-1 ring-[#2563EB]'
                      : isPast
                      ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A]'
                      : 'bg-white border-[#E2E8F0] text-[#64748B]'
                  }`}
                >
                  <div className="flex items-center justify-center mb-1">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? 'bg-[#2563EB] text-white animate-pulse'
                          : isPast
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-slate-100 text-[#64748B]'
                      }`}
                    >
                      {isPast ? '✓' : step}
                    </div>
                  </div>
                  <div className={`text-[11px] font-semibold truncate ${isCurrent ? 'text-[#2563EB]' : ''}`}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── STEP 1: Global Model Broadcast ── */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                  STEP 1
                </span>
                <h4 className="text-sm font-bold text-[#0F172A]">Broadcast Global Model</h4>
              </div>

              {activeStep > 1 || isCompleted ? (
                <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-[#DCFCE7] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Global Model {globalVersion} Distributed
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE] flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Distributing...
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Central server distributes global ResNet-18 weights to Hospital A and Hospital B over encrypted LAN transport.
            </p>
          </div>

          {/* ── STEP 2: Local Edge Training (Section 10) ── */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                  STEP 2
                </span>
                <h4 className="text-sm font-bold text-[#0F172A]">Independent Edge Training</h4>
              </div>

              {activeStep > 2 || isCompleted ? (
                <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-[#DCFCE7] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Training Completed
                </span>
              ) : activeStep === 2 ? (
                <span className="text-xs font-semibold text-[#F59E0B] bg-[#FFFBEB] px-2.5 py-0.5 rounded-full border border-[#FEF3C7] flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Training in Progress
                </span>
              ) : (
                <span className="text-xs text-[#64748B]">Pending</span>
              )}
            </div>

            {/* Hospital Training Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {/* Hospital A */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0F172A]">HOSPITAL A</span>
                  <span className="text-[11px] font-semibold text-[#16A34A]">
                    {updateA || activeStep > 2 ? '✓ Complete' : activeStep === 2 ? `Batch ${batchA}/${totalBatchesA}` : 'Ready'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#2563EB] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (batchA / totalBatchesA) * 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] block">Dataset</span>
                    <span className="font-semibold text-[#0F172A]">{nA} CXRs</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Loss</span>
                    <span className="font-mono font-semibold text-[#0F172A]">{lossA}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Accuracy</span>
                    <span className="font-mono font-semibold text-[#16A34A]">{accA}%</span>
                  </div>
                </div>
              </div>

              {/* Hospital B */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#0F172A]">HOSPITAL B</span>
                  <span className="text-[11px] font-semibold text-[#16A34A]">
                    {updateB || activeStep > 2 ? '✓ Complete' : activeStep === 2 ? `Batch ${batchB}/${totalBatchesB}` : 'Ready'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0D9488] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (batchB / totalBatchesB) * 100)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] block">Dataset</span>
                    <span className="font-semibold text-[#0F172A]">{nB} CXRs</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Loss</span>
                    <span className="font-mono font-semibold text-[#0F172A]">{lossB}</span>
                  </div>
                  <div>
                    <span className="text-[10px] block">Accuracy</span>
                    <span className="font-mono font-semibold text-[#16A34A]">{accB}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── STEP 3: Waiting for Model Updates (Section 10) ── */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                  STEP 3
                </span>
                <h4 className="text-sm font-bold text-[#0F172A]">Waiting for Model Updates</h4>
              </div>

              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                activeStep >= 4 || isCompleted
                  ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                  : 'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]'
              }`}>
                {activeStep >= 4 || isCompleted ? '✓ 2 / 2 Updates Received' : 'Waiting for Updates'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#0F172A] block">Hospital A Update</span>
                  <span className="text-[11px] text-[#64748B]">Size: {updateA?.size_mb ?? 11.2} MB</span>
                </div>
                <span className="text-[#16A34A] font-bold text-xs">
                  {updateA || activeStep >= 4 ? '✓ Received' : '● Uploading'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#0F172A] block">Hospital B Update</span>
                  <span className="text-[11px] text-[#64748B]">Size: {updateB?.size_mb ?? 11.2} MB</span>
                </div>
                <span className="text-[#16A34A] font-bold text-xs">
                  {updateB || activeStep >= 4 ? '✓ Received' : '● Uploading'}
                </span>
              </div>
            </div>
          </div>

          {/* ── STEP 4: Aggregation (FedAvg) (Section 10) ── */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                  STEP 4
                </span>
                <h4 className="text-sm font-bold text-[#0F172A]">Central Model Aggregation ({aggMethod})</h4>
              </div>

              {activeStep > 4 || isCompleted ? (
                <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-[#DCFCE7]">
                  ✓ Aggregation Complete
                </span>
              ) : activeStep === 4 ? (
                <span className="text-xs font-semibold text-[#F59E0B] bg-[#FFFBEB] px-2.5 py-0.5 rounded-full border border-[#FEF3C7] flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing
                </span>
              ) : (
                <span className="text-xs text-[#64748B]">Pending</span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-[#E2E8F0] text-xs font-mono text-[#0F172A] space-y-1">
              <div className="text-[11px] text-[#64748B]">Weighted Layer Aggregation Formula:</div>
              <div className="font-bold text-[#2563EB]">
                W_global = ({nA}/{N})·W_A + ({nB}/{N})·W_B
              </div>
              <div className="text-[11px] text-[#64748B]">
                Hospital A weight: <b>{wA}</b> | Hospital B weight: <b>{wB}</b> | Total: <b>{N} CXRs</b>
              </div>
            </div>
          </div>

          {/* ── STEP 5: Global Model Updated (Section 10 & 13) ── */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">
                  STEP 5
                </span>
                <h4 className="text-sm font-bold text-[#0F172A]">Global Model Updated</h4>
              </div>

              {isCompleted ? (
                <span className="text-xs font-bold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-[#DCFCE7]">
                  ✓ Round Complete
                </span>
              ) : (
                <span className="text-xs text-[#64748B]">Finalizing</span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[#EFF6FF]/50 border border-[#DBEAFE] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[#64748B] uppercase font-bold block">Model Version Transition</span>
                <div className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <span className="text-[#64748B]">{globalVersion}</span>
                  <ArrowRight className="w-4 h-4 text-[#2563EB]" />
                  <span className="text-[#2563EB]">{nextVersion}</span>
                </div>
              </div>

              <div className="text-right text-xs">
                <span className="text-[#64748B] block">Validation Accuracy</span>
                <span className="font-bold text-[#16A34A] text-sm">
                  {liveStatus?.validation_accuracy ?? 86.8}% (+2.3%)
                </span>
              </div>
            </div>
          </div>

          {/* ── Telemetry Event Log Stream ── */}
          {showEventLog && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-[#64748B] border-b border-[#E2E8F0] pb-2">
                <span className="font-semibold text-[#0F172A]">Live Telemetry Events</span>
                <span>{events.length} Events</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {events.slice(-10).reverse().map((evt) => (
                  <div key={evt.id} className="py-1 border-b border-slate-100 flex justify-between gap-2">
                    <span className="text-[#2563EB] font-semibold">[{evt.type}]</span>
                    <span className="text-[#64748B] truncate max-w-xs">{JSON.stringify(evt.payload || {})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="bg-white p-4 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#64748B]">
            {isCompleted ? '✓ Model ready for local inference at hospitals.' : 'Round progressing across cluster...'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#2563EB] hover:bg-[#1E40AF] text-white transition"
          >
            {isCompleted ? 'Close' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  );
}
