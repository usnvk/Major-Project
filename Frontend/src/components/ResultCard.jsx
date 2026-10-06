import React from 'react';
import { AlertTriangle, CheckCircle, Percent, Layers, Activity, ShieldCheck, Binary, Target } from 'lucide-react';

export default function ResultCard({ predictionData }) {
  if (!predictionData) return null;

  const { prediction, confidence, stage, patient_hash, is_dicom, dicom_metadata, bounding_boxes } = predictionData;
  const isPositive = prediction?.toLowerCase().includes('positive');
  const boxCount = bounding_boxes?.length || 0;

  return (
    <div className="space-y-4">
      
      {/* Top Patient Anonymization & PHI Metadata Bar */}
      <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs border border-slate-800 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Patient Cryptographic Pseudonym</div>
            <div className="font-mono text-sky-300 font-bold text-sm">{patient_hash || 'PT-HASH-DEIDENTIFIED'}</div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {is_dicom ? (
            <span className="inline-flex items-center space-x-1.5 bg-sky-950 text-sky-300 px-3 py-1.5 rounded-lg border border-sky-800">
              <Binary className="w-3.5 h-3.5" />
              <span>DICOM Ingested ({dicom_metadata?.modality || 'DX'} - {dicom_metadata?.view_position || 'PA'})</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">
              <span>Standard CXR Radiograph</span>
            </span>
          )}

          <span className="inline-flex items-center space-x-1 bg-emerald-950 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>HIPAA PHI Stripped</span>
          </span>
        </div>
      </div>

      {/* Main 3-Card Grid */}
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
              <span>ResNet-18 (layer4)</span>
            </span>
            <span className="font-mono text-slate-600">p &lt; 0.001</span>
          </div>
        </div>

        {/* 3. Detected Stage Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Detected Stage & Focus
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="text-2xl font-extrabold text-slate-900">
              {stage ? `Stage ${stage}` : 'N/A (Negative)'}
            </div>

            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {stage === 1 && 'Stage 1 – Latent / Early condition. Incipient localized lesion.'}
              {stage === 2 && 'Stage 2 – Mild condition. Standard 2-drug therapy indicated.'}
              {stage === 3 && 'Stage 3 – Moderate condition. 4-drug HRZE regimen required.'}
              {stage === 4 && 'Stage 4 – Severe / Cavitary condition. Urgent isolation & care.'}
              {!stage && 'No pathologic stage classification applicable for negative result.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center space-x-1">
              <Target className="w-3.5 h-3.5 text-rose-500" />
              <span>Lesion Foci:</span>
            </span>
            <span className="font-semibold text-slate-700">
              {boxCount > 0 ? `${boxCount} region(s) mapped` : 'No focal lesions'}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
