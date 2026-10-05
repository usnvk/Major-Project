import React from 'react';
import { Loader2, Activity } from 'lucide-react';

export default function LoadingSpinner({
  title = "Analyzing Chest X-Ray...",
  subtitle = "Please wait while the deep neural network evaluates pulmonary structures and calculates spatial Grad-CAM activation maps.",
  compact = false
}) {
  if (compact) {
    return (
      <div className="flex items-center space-x-3 text-sky-700 bg-sky-50 px-4 py-3 rounded-xl border border-sky-200">
        <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
        <span className="text-xs font-semibold">{title}</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-5 animate-fade-in">
      <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-sky-100"></div>
        <div className="absolute inset-0 rounded-full border-4 border-sky-600 border-t-transparent animate-spin"></div>
        <Activity className="w-8 h-8 text-sky-600 animate-pulse" />
      </div>

      <div className="space-y-1.5">
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className="inline-flex items-center space-x-2 bg-slate-100 px-3.5 py-1.5 rounded-full text-[11px] text-slate-600 font-mono">
        <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
        <span>Running ResNet-50 Convolutional Pipeline</span>
      </div>
    </div>
  );
}
