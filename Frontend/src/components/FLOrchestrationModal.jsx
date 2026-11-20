import React, { useState } from 'react';
import {
  Server,
  Cpu,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  RefreshCw,
  X,
  UploadCloud,
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
  const globalVersion = liveStatus?.global_model_version || 'v1';
  const aggMethod = liveStatus?.aggregation_method || 'FedAvg';
  const nodes = liveStatus?.nodes || {};
  const updates = liveStatus?.round_updates || {};
  const participants = liveStatus?.round_participants || Object.keys(nodes);

  // Determine active step
  let activeStep = 1;
  if (stage === 'broadcasting') activeStep = 1;
  else if (stage === 'local_training') activeStep = 2;
  else if (stage === 'receiving_updates' || (Object.keys(updates).length > 0 && Object.keys(updates).length < participants.length)) activeStep = 3;
  else if (stage === 'aggregating') activeStep = 4;
  else if (stage === 'completed' || stage === 'model_updated' || stage === 'distributing') activeStep = 5;

  const isCompleted = stage === 'completed';
  const receivedCount = Object.keys(updates).length;
  const totalExpected = participants.length || 1;

  // Per-node training progress from events
  const getNodeProgress = (nodeId) => {
    const nodeEvents = events.filter(
      (e) => e.payload?.node_id === nodeId && e.type === 'LOCAL_TRAINING_PROGRESS'
    );
    const latest = nodeEvents[nodeEvents.length - 1]?.payload || null;
    const update = updates[nodeId] || null;
    const nodeInfo = nodes[nodeId] || {};

    return {
      batch: latest?.batch || (update ? (latest?.total_batches || 4) : (activeStep >= 2 ? 1 : 0)),
      totalBatches: latest?.total_batches || 4,
      loss: latest?.loss ?? update?.loss ?? nodeInfo.last_loss ?? null,
      acc: latest?.accuracy ?? update?.accuracy ?? nodeInfo.last_acc ?? null,
      samples: update?.num_samples || nodeInfo.dataset_size || 0,
      epsilon: update?.epsilon ?? nodeInfo.dp_epsilon ?? null,
      submitted: Boolean(update),
      sizeMb: update?.size_mb ?? null,
    };
  };

  // Total samples for FedAvg formula
  const totalSamples = participants.reduce((sum, nid) => {
    const info = nodes[nid] || {};
    const update = updates[nid];
    return sum + (update?.num_samples || info.dataset_size || 0);
  }, 0);

  // Last completed round aggregation event
  const aggEvent = [...events]
    .reverse()
    .find((e) => e.type === 'AGGREGATION_COMPLETED');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-xl border border-[#E2E8F0] overflow-hidden transform transition-all my-auto max-h-[92vh] flex flex-col">

        {/* Header */}
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

        {/* Privacy Banner */}
        <div className="bg-[#F0FDFA] px-5 py-2.5 border-b border-[#CCFBF1] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs shrink-0 text-[#0F766E]">
          <div className="flex items-center space-x-1.5 font-medium">
            <Lock className="w-3.5 h-3.5 text-[#0D9488]" />
            <span>Raw Patient CXR Images: <b>Never leave hospital edge laptops</b></span>
          </div>
          <div className="text-[11px] font-semibold text-[#0D9488] bg-white px-2.5 py-0.5 rounded border border-[#CCFBF1]">
            ✓ Serialized weight vectors only
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-[#F8FAFC]">

          {/* 5-Step Stepper */}
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

          {/* STEP 1: Broadcast */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">STEP 1</span>
                <h4 className="text-sm font-bold text-[#0F172A]">Broadcast Global Model</h4>
              </div>
              {activeStep > 1 || isCompleted ? (
                <span className="text-xs font-semibold text-[#16A34A] bg-[#F0FDF4] px-2.5 py-0.5 rounded-full border border-[#DCFCE7] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Global Model {globalVersion} Distributed
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE] flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Distributing to {totalExpected} node(s)...
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B]">
              Central server distributes global ResNet-18 weights to all {totalExpected} participating hospital node(s).
            </p>
          </div>

          {/* STEP 2: Local Training — dynamic nodes */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">STEP 2</span>
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

            {/* Dynamic node training cards — 1 to N */}
            <div
              className={`grid gap-3 ${
                participants.length <= 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : participants.length <= 3
                  ? 'grid-cols-1 md:grid-cols-3'
                  : 'grid-cols-2 md:grid-cols-4'
              }`}
            >
              {participants.length === 0 ? (
                <div className="col-span-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#64748B] text-center">
                  Waiting for nodes to register...
                </div>
              ) : (
                participants.map((nodeId, i) => {
                  const prog = getNodeProgress(nodeId);
                  const colors = ['bg-[#2563EB]', 'bg-[#0D9488]', 'bg-[#7C3AED]', 'bg-[#EA580C]', 'bg-[#0891B2]'];
                  const barColor = colors[i % colors.length];
                  return (
                    <div key={nodeId} className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#0F172A]">{nodeId.toUpperCase()}</span>
                        <span className="text-[11px] font-semibold text-[#16A34A]">
                          {prog.submitted || activeStep > 2
                            ? '✓ Complete'
                            : activeStep === 2
                            ? `Batch ${prog.batch}/${prog.totalBatches}`
                            : 'Ready'}
                        </span>
                      </div>

                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`${barColor} h-full rounded-full transition-all duration-300`}
                          style={{
                            width: `${Math.min(100, ((prog.submitted || activeStep > 2 ? prog.totalBatches : prog.batch) / prog.totalBatches) * 100)}%`,
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs text-[#64748B] pt-1 border-t border-[#E2E8F0]">
                        <div>
                          <span className="text-[10px] block">Dataset</span>
                          <span className="font-semibold text-[#0F172A]">{prog.samples} CXRs</span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Loss</span>
                          <span className="font-mono font-semibold text-[#0F172A]">
                            {prog.loss != null ? prog.loss : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] block">Accuracy</span>
                          <span className="font-mono font-semibold text-[#16A34A]">
                            {prog.acc != null ? `${prog.acc}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* STEP 3: Model Updates */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">STEP 3</span>
                <h4 className="text-sm font-bold text-[#0F172A]">Waiting for Model Updates</h4>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  activeStep >= 4 || isCompleted
                    ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                    : 'bg-[#FFFBEB] text-[#F59E0B] border-[#FEF3C7]'
                }`}
              >
                {activeStep >= 4 || isCompleted
                  ? `✓ ${receivedCount} / ${totalExpected} Updates Received`
                  : `Waiting (${receivedCount} / ${totalExpected})`}
              </span>
            </div>

            <div
              className={`grid gap-3 ${
                participants.length <= 3 ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'
              }`}
            >
              {participants.map((nodeId) => {
                const update = updates[nodeId];
                const received = Boolean(update) || activeStep >= 4;
                return (
                  <div key={nodeId} className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-[#0F172A] block text-xs">{nodeId.toUpperCase()}</span>
                      <span className="text-[11px] text-[#64748B]">
                        {update?.size_mb != null ? `${update.size_mb} MB` : '—'}
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${received ? 'text-[#16A34A]' : 'text-[#F59E0B]'}`}>
                      {received ? '✓ Received' : '⟳ Uploading'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 4: FedAvg Aggregation */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">STEP 4</span>
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
              <div className="text-[11px] text-[#64748B]">Sample-Weighted FedAvg Formula ({totalExpected} node(s)):</div>
              <div className="font-bold text-[#2563EB]">
                W_global = Σ (n_i / N) · W_i
              </div>
              <div className="text-[11px] text-[#64748B]">
                {participants.map((nid) => {
                  const prog = getNodeProgress(nid);
                  const w = totalSamples > 0 ? (prog.samples / totalSamples).toFixed(4) : '0.0000';
                  return `${nid}: ${prog.samples}/${totalSamples} = ${w}`;
                }).join(' | ')} | Total: {totalSamples} CXRs
              </div>
            </div>
          </div>

          {/* STEP 5: Global Model Updated */}
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#DBEAFE]">STEP 5</span>
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
                {isCompleted ? (
                  <>
                    <span className="text-[10px] text-[#64748B] uppercase font-bold block">Aggregation Result</span>
                    <div className="text-lg font-bold text-[#16A34A] mt-1 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Central Model Updated Successfully</span>
                    </div>
                    {aggEvent?.payload?.checkpoint && (
                      <div className="text-[11px] text-[#64748B] mt-1 font-mono">
                        Checkpoint: {aggEvent.payload.checkpoint}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-[#64748B] uppercase font-bold block">Pending</span>
                    <div className="text-sm font-semibold text-[#64748B] mt-1">
                      Waiting for aggregation to complete...
                    </div>
                  </>
                )}
              </div>

              <div className="text-right text-xs">
                <span className="text-[#64748B] block">Validation Accuracy</span>
                <span className="font-bold text-[#16A34A] text-sm">
                  {liveStatus?.validation_accuracy != null
                    ? `${liveStatus.validation_accuracy}%`
                    : aggEvent?.payload?.weighted_accuracy != null
                    ? `${aggEvent.payload.weighted_accuracy}%`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Log */}
          {showEventLog && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 text-xs font-mono space-y-2">
              <div className="flex items-center justify-between text-[#64748B] border-b border-[#E2E8F0] pb-2">
                <span className="font-semibold text-[#0F172A]">Live Telemetry Events</span>
                <span>{events.length} Events</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {events.slice(-15).reverse().map((evt) => (
                  <div key={evt.id} className="py-1 border-b border-slate-100 flex justify-between gap-2">
                    <span className="text-[#2563EB] font-semibold shrink-0">[{evt.type}]</span>
                    <span className="text-[#64748B] truncate max-w-xs">
                      {JSON.stringify(evt.payload || {})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white p-4 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <span className="text-xs text-[#64748B]">
            {isCompleted
              ? '✓ Central Model Updated Successfully — ready for inference at all hospitals.'
              : `Round progressing across ${totalExpected} hospital node(s)...`}
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
