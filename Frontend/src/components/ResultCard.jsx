import React from 'react';
import { AlertTriangle, CheckCircle, Percent, Layers, Activity } from 'lucide-react';

export default function ResultCard({ predictionData }) {
  if (!predictionData) return null;

  const { prediction, confidence, stage } = predictionData;
  const isPositive = prediction?.toLowerCase().includes('positive');

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* 1. TB Status Badge Card */}
      <div className={`p-6 rounded-2xl border shadow-sm transition-all ${
        isPositive
          ? 'bg-gradient-to-br from-rose-50 to-red-50/50 border-rose-200 text-rose-900'
          : 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200 text-emerald-900'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            TB Diagnosis Status
          </span>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
            isPositive ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            {isPositive ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
          </div>
        </div>

        <div>
          <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
            isPositive ? 'text-rose-700' : 'text-emerald-700'
          }`}>
            {prediction || 'TB Positive'}
          </div>
          
          <p className="text-xs mt-2 font-medium opacity-90 leading-relaxed">
            {isPositive 
              ? 'Pulmonary infiltrates consistent with Active Tuberculosis detected.' 
              : 'No pathognomonic lesions or active TB infiltrates detected.'}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold">
          <span>AI Model Flag:</span>
          <span className={`px-2 py-0.5 rounded-full ${
            isPositive ? 'bg-rose-200/60 text-rose-800' : 'bg-emerald-200/60 text-emerald-800'
          }`}>
            {isPositive ? 'High Priority Clinical Review' : 'Negative Screening'}
          </span>
        </div>
      </div>

      {/* 2. AI Confidence Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              AI Confidence Score
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Percent className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900">{confidence}%</span>
            <span className="text-xs font-medium text-slate-500">Model Probability</span>
          </div>

          {/* Progress bar visual */}
          <div className="mt-4 space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  confidence > 90 ? 'bg-sky-600' : confidence > 75 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${confidence}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-medium">
              <span>0% Threshold</span>
              <span>100% Certainty</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span className="flex items-center space-x-1">
            <Activity className="w-3.5 h-3.5 text-sky-500" />
            <span>Deep ResNet-50 Ensemble</span>
          </span>
          <span className="font-mono text-slate-600">p &lt; 0.001</span>
        </div>
      </div>

      {/* 3. Detected Stage Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Detected Stage
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="text-2xl font-extrabold text-slate-900">
            {stage ? `Stage ${stage}` : 'N/A (Negative)'}
          </div>

          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            {stage === 1 && 'Stage 1 – Early condition. Incipient localized lesion.'}
            {stage === 2 && 'Stage 2 – Moderate condition. Prescribed regimen required.'}
            {stage === 3 && 'Stage 3 – Advanced condition. Extensive cavitary involvement.'}
            {!stage && 'No pathologic stage classification applicable for negative result.'}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500">Classification:</span>
          <span className="font-semibold text-slate-700">
            {stage ? `Pulmonary Stage ${stage}` : 'Unremarkable'}
          </span>
        </div>
      </div>

    </div>
  );
}
