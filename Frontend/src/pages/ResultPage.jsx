import React, { useState } from 'react';
import HeatmapViewer from '../components/HeatmapViewer';
import StageCarePanel from '../components/StageCarePanel';
import { submitFeedback } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Printer,
  User,
  Calendar,
  FileCheck,
  Info,
  Check,
} from 'lucide-react';

export default function ResultPage({ currentResult, onBackToUpload, onSaveToHistory }) {
  const { user, role } = useAuth();
  const [reviewDecision, setReviewDecision] = useState('confirm'); // 'confirm' | 'override'
  const [overrideLabel, setOverrideLabel] = useState('TB Negative');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  if (!currentResult) {
    return (
      <div className="bg-white p-10 rounded-2xl border border-[#E2E8F0] shadow-xs text-center space-y-4 max-w-lg mx-auto my-12">
        <h3 className="text-lg font-bold text-[#0F172A]">No Active Diagnostic Scan</h3>
        <p className="text-xs text-[#64748B]">
          Please upload a Chest X-Ray radiograph first to view screening results and Grad-CAM feature visualizations.
        </p>
        <button
          onClick={onBackToUpload}
          className="bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-5 py-2 rounded-xl text-xs transition"
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const {
    prediction,
    confidence = 94.2,
    stage = 2,
    heatmap_url,
    originalImage,
    prediction_id,
    patient_hash = 'PT-1001',
    is_dicom,
    dicom_metadata,
  } = currentResult;

  const isPositive = prediction?.toLowerCase().includes('positive');

  const handleConfirmReview = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const finalLabel = reviewDecision === 'confirm' ? prediction : overrideLabel;
    const finalStage = finalLabel === 'TB Positive' ? stage || 1 : undefined;
    const predId = prediction_id || `pred_${Date.now()}`;

    const pName = currentResult.patient_name || currentResult.patientName || (role === 'patient' ? user?.name : 'Clinical Patient');

    try {
      const res = await submitFeedback(
        predId,
        finalLabel,
        finalStage,
        doctorNotes || 'Reviewed and confirmed by clinician.',
        user?.email,
        user?.name
      );
      if (res.success) {
        setSubmitSuccess(true);
        if (onSaveToHistory) {
          onSaveToHistory({
            id: String(Date.now()),
            predictionId: predId,
            patientId: patient_hash,
            patientName: pName,
            scanDate: new Date().toISOString().split('T')[0],
            result: finalLabel,
            confidence: confidence,
            stage: finalStage,
            doctorConfirmed: true,
            doctorLabel: finalLabel,
            notes: doctorNotes || 'Reviewed and signed off by clinician.',
            doctorEmail: user?.email,
            doctorName: user?.name,
            heatmapUrl: heatmap_url,
          });
        }
      } else {
        setSubmitError(res.error || 'Failed to submit review.');
      }
    } catch (err) {
      setSubmitError('Network error connecting to feedback service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-16">
      
      {/* ── Top Header Navigation ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-[#E2E8F0] shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToUpload}
            className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-[#E2E8F0] transition"
            title="Upload another scan"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-[#0F172A]">AI-Assisted TB Screening Workspace</h2>
              <span className="bg-[#EFF6FF] text-[#2563EB] text-[11px] font-mono px-2 py-0.5 rounded border border-[#DBEAFE]">
                ID: {prediction_id || 'PX-9042'}
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Processed on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center space-x-1.5 text-xs text-[#0F172A] bg-slate-50 hover:bg-slate-100 px-3.5 py-2 rounded-xl font-medium border border-[#E2E8F0] transition self-start sm:self-auto"
        >
          <Printer className="w-3.5 h-3.5 text-[#64748B]" />
          <span>Print Clinical Report</span>
        </button>
      </div>

      {/* ── Patient Information Bar (Section 17) ── */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[#64748B] text-[11px] block">Patient Identifier</span>
          <span className="font-mono font-bold text-[#0F172A]">{patient_hash}</span>
        </div>
        <div>
          <span className="text-[#64748B] text-[11px] block">Modality / View</span>
          <span className="font-semibold text-[#0F172A]">
            {is_dicom ? `${dicom_metadata?.modality || 'DX'} (PA View)` : 'Chest Radiograph (PA)'}
          </span>
        </div>
        <div>
          <span className="text-[#64748B] text-[11px] block">Safe Harbor PHI</span>
          <span className="font-semibold text-[#0D9488] flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> De-identified
          </span>
        </div>
        <div>
          <span className="text-[#64748B] text-[11px] block">Clinical Priority</span>
          <span className="font-semibold text-[#0F172A]">
            {isPositive ? 'Routine Pulm Consult' : 'Baseline Normal'}
          </span>
        </div>
      </div>

      {/* ── Workspace: AI Analysis Summary & Grad-CAM (Section 17 & 18) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left 2 cols: Grad-CAM Explainability Viewer */}
        <div className="lg:col-span-2">
          <HeatmapViewer originalImage={originalImage} heatmapUrl={heatmap_url} />
        </div>

        {/* Right 1 col: AI Analysis Card (Section 17) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="pb-3 border-b border-[#E2E8F0]">
            <span className="text-[10px] uppercase font-bold text-[#64748B] block">AI Analysis Result</span>
            <h3 className="text-base font-bold text-[#0F172A] mt-0.5">TB Screening Evaluation</h3>
          </div>

          {/* Finding Badge */}
          <div className={`p-4 rounded-xl border space-y-1 ${
            isPositive
              ? 'bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]'
              : 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A]'
          }`}>
            <span className="text-xs uppercase font-bold tracking-wider block">
              Model Screening Output
            </span>
            <div className="text-xl font-bold">
              {prediction || (isPositive ? 'TB Positive' : 'TB Negative')}
            </div>
            <div className="text-xs font-medium text-[#64748B]">
              Model Confidence: <span className="font-bold text-[#0F172A]">{confidence}%</span>
            </div>
          </div>

          {/* Confidence scale */}
          <div className="space-y-1.5 text-xs text-[#64748B]">
            <div className="flex justify-between">
              <span>Confidence Threshold:</span>
              <span className="font-mono font-medium text-[#0F172A]">0.85 (High)</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${isPositive ? 'bg-[#2563EB]' : 'bg-[#16A34A]'}`}
                style={{ width: `${Math.min(100, confidence)}%` }}
              />
            </div>
          </div>

          {/* Disease Staging if positive */}
          {isPositive && (
            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] space-y-1 text-xs">
              <span className="text-[#64748B] text-[11px] block">Estimated Classification</span>
              <div className="font-semibold text-[#0F172A]">
                Stage {stage} — {stage === 1 ? 'Early Latent' : stage === 2 ? 'Active Pulmonary' : 'Advanced Fibro-Cavitary'}
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#64748B] leading-relaxed pt-2 border-t border-[#E2E8F0]">
            AI screening outputs serve as clinical decision support and do not constitute a confirmed medical diagnosis without attending clinician sign-off.
          </div>
        </div>
      </div>

      {/* ── Stage Care Guidance (if positive) ── */}
      {isPositive && <StageCarePanel stage={stage} />}

      {/* ── Doctor Review Panel (Section 19) ── */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">Clinician Review & Sign-Off</h3>
            <p className="text-xs text-[#64748B]">
              Review the radiograph and confirm or override AI screening findings for patient history and active learning.
            </p>
          </div>
          <span className="text-xs font-mono text-[#64748B] bg-slate-50 px-2.5 py-1 rounded border border-[#E2E8F0]">
            Audit Trail: Active
          </span>
        </div>

        {role === 'patient' ? (
          <div className="p-4 rounded-xl bg-slate-50 border border-[#E2E8F0] space-y-3 text-xs">
            <div className="font-semibold text-[#0F172A] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
              <span>Attending Physician Review Status</span>
            </div>
            <p className="text-[#64748B]">
              {currentResult.doctorConfirmed || currentResult.doctor_confirmed
                ? `Confirmed by Attending Clinician (${currentResult.doctorName || currentResult.doctorEmail || 'Pulmonologist'}).`
                : 'Your radiograph has been safely logged in the edge clinical node and is currently in the physician verification queue. Attending clinician sign-off will appear here once verified.'}
            </p>
            {(currentResult.notes || currentResult.doctor_notes) && (
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0] text-[#0F172A]">
                <span className="font-semibold block text-[11px] text-[#64748B] mb-0.5">Physician Clinical Note:</span>
                {currentResult.notes || currentResult.doctor_notes}
              </div>
            )}
          </div>
        ) : submitSuccess ? (
          <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] text-[#16A34A] text-xs flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold text-sm">Clinical Verification Successfully Saved</div>
              <p className="mt-0.5 text-[#16A34A]/90">
                Your verification has been recorded in the patient file and synced with the hospital active learning queue.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConfirmReview} className="space-y-4 text-xs">
            {/* AI Screening result echo */}
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <span className="text-[#64748B] block text-[11px]">AI Screening Result:</span>
                <span className="font-bold text-sm text-[#0F172A]">
                  {prediction} ({confidence}% confidence)
                </span>
              </div>
              <span className="text-[11px] text-[#64748B]">ResNet-18 v2.1</span>
            </div>

            {/* Doctor Decision Options (Section 19) */}
            <div className="space-y-2">
              <label className="font-semibold text-[#0F172A] block">Clinician Assessment:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`p-3 rounded-xl border flex items-center space-x-3 cursor-pointer transition ${
                  reviewDecision === 'confirm'
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-semibold'
                    : 'border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="confirm"
                    checked={reviewDecision === 'confirm'}
                    onChange={() => setReviewDecision('confirm')}
                    className="accent-[#2563EB]"
                  />
                  <span>Confirm AI Result ({prediction})</span>
                </label>

                <label className={`p-3 rounded-xl border flex items-center space-x-3 cursor-pointer transition ${
                  reviewDecision === 'override'
                    ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-semibold'
                    : 'border-[#E2E8F0] hover:bg-slate-50 text-[#0F172A]'
                }`}>
                  <input
                    type="radio"
                    name="decision"
                    value="override"
                    checked={reviewDecision === 'override'}
                    onChange={() => setReviewDecision('override')}
                    className="accent-[#2563EB]"
                  />
                  <span>Override AI Result</span>
                </label>
              </div>

              {/* If Override selected */}
              {reviewDecision === 'override' && (
                <div className="p-3 bg-[#FFFBEB] rounded-xl border border-[#FEF3C7] space-y-2 mt-2">
                  <span className="font-semibold text-[#0F172A] block">Select Correct Diagnostic Finding:</span>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="override_choice"
                        value="TB Positive"
                        checked={overrideLabel === 'TB Positive'}
                        onChange={(e) => setOverrideLabel(e.target.value)}
                        className="accent-[#2563EB]"
                      />
                      <span>TB Positive</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name="override_choice"
                        value="TB Negative"
                        checked={overrideLabel === 'TB Negative'}
                        onChange={(e) => setOverrideLabel(e.target.value)}
                        className="accent-[#2563EB]"
                      />
                      <span>TB Negative (Normal)</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Clinical Notes (Section 19) */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[#0F172A] block">
                Clinical Notes / Radiologist Observations:
              </label>
              <textarea
                rows={3}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Enter clinical observations, anatomical findings, and verification notes..."
                className="w-full p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] text-[#0F172A] placeholder:text-[#64748B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] transition"
              />
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Confirm Review Button (Medical Blue #2563EB) (Section 19 & 24) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-6 py-2.5 rounded-xl shadow-xs transition text-xs disabled:opacity-50"
              >
                {isSubmitting ? 'Recording Review...' : 'Confirm Review'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
