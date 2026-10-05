import React, { useState } from 'react';
import ResultCard from '../components/ResultCard';
import HeatmapViewer from '../components/HeatmapViewer';
import StageCarePanel from '../components/StageCarePanel';
import ConfirmationModal from '../components/ConfirmationModal';
import ErrorMessage from '../components/ErrorMessage';
import { submitFeedback } from '../services/api';
import { CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck, Printer, Share2 } from 'lucide-react';

export default function ResultPage({ currentResult, onBackToUpload, onSaveToHistory }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDiagnosisChoice, setSelectedDiagnosisChoice] = useState('TB Positive');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  if (!currentResult) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4 max-w-xl mx-auto my-12">
        <h3 className="text-xl font-bold text-slate-800">No Active Diagnostic Scan</h3>
        <p className="text-xs text-slate-500">
          Please upload a Chest X-Ray image first to view prediction results, Grad-CAM heatmaps, and stage recommendations.
        </p>
        <button
          onClick={onBackToUpload}
          className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2.5 rounded-xl text-xs"
        >
          Go to Upload Page
        </button>
      </div>
    );
  }

  const { prediction, confidence, stage, heatmap_url, originalImage, prediction_id } = currentResult;
  const isPositive = prediction?.toLowerCase().includes('positive');

  const handleOpenConfirmation = (choice) => {
    setSelectedDiagnosisChoice(choice);
    setFeedbackError(null);
    setFeedbackSuccess(false);
    setModalOpen(true);
  };

  const handleConfirmFeedback = async (isPositiveConfirmed, notes) => {
    setIsSubmittingFeedback(true);
    setFeedbackError(null);

    const confirmedLabel = isPositiveConfirmed ? 'TB Positive' : 'TB Negative';
    const predId = prediction_id || `pred_${Date.now()}`;

    try {
      const confirmedStage = isPositiveConfirmed
        ? currentResult.stage || 1
        : undefined;
      const res = await submitFeedback(predId, confirmedLabel, confirmedStage);

      if (res.success) {
        setFeedbackSuccess(true);

        // Update global patient history record
        const newRecord = {
          id: String(Date.now()),
          predictionId: predId,
          patientId: currentResult.patientId || `PT-${Math.floor(1000 + Math.random() * 9000)}`,
          patientName: currentResult.patientName || 'Clinical Patient',
          scanDate: new Date().toISOString().split('T')[0],
          result: confirmedLabel,
          confidence: confidence || 0,
          stage: isPositiveConfirmed ? confirmedStage : null,
          doctorConfirmed: true,
          doctorLabel: confirmedLabel,
          notes: notes || 'Confirmed by attending doctor.',
          heatmapUrl: heatmap_url
        };

        if (onSaveToHistory) {
          onSaveToHistory(newRecord);
        }
      } else {
        setFeedbackError(res.error || 'Failed to record doctor feedback.');
      }
    } catch (err) {
      setFeedbackError('An error occurred while connecting to the feedback server.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl mx-auto">
      
      {/* Top Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToUpload}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            title="Upload another X-Ray"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-extrabold text-slate-900">AI Diagnostic Report</h2>
              <span className="bg-sky-50 text-sky-700 text-[11px] font-mono px-2 py-0.5 rounded border border-sky-200">
                ID: {prediction_id || 'PX-9042'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Evaluated on {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl font-semibold border border-slate-300 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print Report</span>
          </button>
        </div>
      </div>

      {/* 1. Summary Cards (Status, Confidence, Stage) */}
      <ResultCard predictionData={currentResult} />

      {/* 2. Grad-CAM Heatmap Viewer */}
      <HeatmapViewer
        originalImage={originalImage}
        heatmapUrl={heatmap_url}
      />

      {/* 3. Stage-Wise Care Panel */}
      <StageCarePanel stage={stage} />

      {/* 4. Doctor Confirmation Section */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Doctor Diagnosis Confirmation
              </h3>
              <p className="text-xs text-slate-400">
                Verify AI prediction and submit official sign-off to `POST /feedback`.
              </p>
            </div>
          </div>

          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 self-start sm:self-auto">
            Audit Endpoint: /feedback
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          As the attending pulmonologist, please review the original X-Ray and Grad-CAM spatial activation patterns before selecting your final diagnosis confirmation.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          {isPositive ? (
            <button
              onClick={() => handleOpenConfirmation('TB Positive')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-rose-600/30 transition-all text-sm"
            >
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm TB Positive</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenConfirmation('TB Negative')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all text-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Confirm TB Negative</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        predictionData={currentResult}
        selectedDiagnosis={selectedDiagnosisChoice}
        onConfirmFeedback={handleConfirmFeedback}
        isSubmitting={isSubmittingFeedback}
        submitError={feedbackError}
        submitSuccess={feedbackSuccess}
      />

    </div>
  );
}
