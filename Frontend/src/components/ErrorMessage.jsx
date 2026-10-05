import React from 'react';
import { AlertOctagon, RefreshCw, XCircle } from 'lucide-react';

export default function ErrorMessage({ title = "Error Encountered", message, onRetry }) {
  return (
    <div className="bg-rose-50 border border-rose-200 text-rose-900 p-6 rounded-2xl shadow-sm max-w-xl mx-auto space-y-4">
      <div className="flex items-start space-x-3.5">
        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <AlertOctagon className="w-6 h-6" />
        </div>

        <div className="space-y-1 flex-1">
          <h4 className="text-base font-bold text-rose-950">{title}</h4>
          <p className="text-xs text-rose-800 leading-relaxed">
            {message || "An unexpected error occurred during processing. Please verify your connection or try again."}
          </p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center space-x-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  );
}
