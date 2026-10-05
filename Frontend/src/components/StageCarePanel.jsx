import React from 'react';
import { Pill, AlertTriangle, Utensils, CheckCircle2, Stethoscope, ChevronRight } from 'lucide-react';
import { getStageInformation } from '../utils/stageData';

export default function StageCarePanel({ stage }) {
  if (!stage) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No TB Stage Protocol Required</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
          The X-Ray diagnosis is TB Negative. Standard routine preventive pulmonary wellness guidance applies.
        </p>
      </div>
    );
  }

  const stageInfo = getStageInformation(stage);
  if (!stageInfo) return null;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      
      {/* Header title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-100">
            S{stage}
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              {stageInfo.title} Care Recommendations
            </h3>
            <p className="text-xs text-slate-500">
              Evidence-based clinical guidelines tailored to detected disease severity stage.
            </p>
          </div>
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 self-start sm:self-auto">
          Protocol: Stage {stage} Active Care
        </span>
      </div>

      <p className="text-sm text-slate-600 italic bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        "{stageInfo.description}"
      </p>

      {/* 3 Care Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* 1. Medication Card */}
        <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 hover:border-sky-300 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-sky-700 font-bold text-base mb-4 pb-2 border-b border-slate-200">
              <Pill className="w-5 h-5 text-sky-600" />
              <span>Medication Information</span>
            </div>

            <ul className="space-y-3">
              {stageInfo.medication.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0 mt-1.5"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Clinical Action:</span>
            <span className="text-sky-700">Prescription Standard</span>
          </div>
        </div>

        {/* 2. Precautions Card */}
        <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 hover:border-amber-300 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-amber-700 font-bold text-base mb-4 pb-2 border-b border-slate-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Precautions & Isolation</span>
            </div>

            <ul className="space-y-3">
              {stageInfo.precautions.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Infection Control:</span>
            <span className="text-amber-700">Strict Compliance</span>
          </div>
        </div>

        {/* 3. Diet Recommendations Card */}
        <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-emerald-700 font-bold text-base mb-4 pb-2 border-b border-slate-200">
              <Utensils className="w-5 h-5 text-emerald-600" />
              <span>Diet Recommendations</span>
            </div>

            <ul className="space-y-3">
              {stageInfo.diet.map((item, idx) => (
                <li key={idx} className="flex items-start space-x-2.5 text-xs text-slate-700 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-500 font-medium flex items-center justify-between">
            <span>Nutritional Status:</span>
            <span className="text-emerald-700">High Protein Support</span>
          </div>
        </div>

      </div>

    </div>
  );
}
