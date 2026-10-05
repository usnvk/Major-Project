import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X, Loader2, FileText, ShieldCheck } from 'lucide-react';

export default function ConfirmationModal({
  isOpen,
  onClose,
  predictionData,
  selectedDiagnosis, // 'TB Positive' | 'TB Negative'
  onConfirmFeedback,
  isSubmitting,
  submitError,
  submitSuccess
}) {
  const [doctorNotes, setDoctorNotes] = useState('');

  if (!isOpen) return null;

  const isPositiveChoice = selectedDiagnosis === 'TB Positive';
  const aiPrediction = predictionData?.prediction || 'TB Positive';

  const handleConfirmSubmit = (e) => {
    e.preventDefault();
    onConfirmFeedback(isPositiveChoice, doctorNotes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-fade-in">
      
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-6 h-6 text-sky-400" />
            <h3 className="font-bold text-lg tracking-tight">Doctor Diagnosis Confirmation</h3>
          </div>
          
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {submitSuccess ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-bold text-slate-900">Diagnosis Successfully Verified!</h4>
              <p className="text-sm text-slate-600">
                Your clinical feedback has been logged to the backend database (`POST /feedback`) and recorded in the patient scan history.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Please verify and sign off on the AI-generated diagnosis. Your decision will update the official medical record.
              </p>

              {/* Comparison Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">AI Model Prediction:</span>
                  <span className="font-bold text-slate-800">{aiPrediction} ({predictionData?.confidence || 96.4}%)</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Doctor Confirmed Diagnosis:</span>
                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${
                    isPositiveChoice ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedDiagnosis}
                  </span>
                </div>
              </div>

              {/* Error feedback message */}
              {submitError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Doctor Clinical Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Clinical Diagnostic Notes (Optional)
                </label>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Enter observation notes, infiltrate locations, or follow-up recommendations..."
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-800 focus:outline-none"
                />
              </div>
            </>
          )}

        </div>

        {/* Footer buttons */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end space-x-3">
          {submitSuccess ? (
            <button
              onClick={onClose}
              className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              Done & Close
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isSubmitting}
                className={`inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all shadow-md ${
                  isPositiveChoice 
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' 
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                } disabled:opacity-50`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting Feedback...</span>
                  </>
                ) : (
                  <span>Confirm {selectedDiagnosis}</span>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
