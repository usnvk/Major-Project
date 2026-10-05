import React from 'react';
import { Activity, UploadCloud, AlertTriangle, CheckCircle2, History, ArrowRight, TrendingUp, Users, Clock } from 'lucide-react';
import { RECENT_ACTIVITIES } from '../utils/mockData';

export default function Dashboard({ stats, historyData, onNavigate }) {
  const totalScans = stats?.totalScans || historyData.length;
  const positiveCases = stats?.positiveCases || historyData.filter(d => d.result?.toLowerCase().includes('positive')).length;
  const negativeCases = stats?.negativeCases || historyData.filter(d => d.result?.toLowerCase().includes('negative')).length;
  const recentCount = historyData.slice(0, 5).length;

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-sky-500/20 text-sky-400 text-xs font-semibold px-3 py-1 rounded-full border border-sky-500/30">
              <Activity className="w-3.5 h-3.5" />
              <span>AI Diagnostic Clinical Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, Doctor 👋
            </h1>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Real-time deep learning pulmonary analytics. Upload chest radiograph scans for automated TB detection, stage classification, and Grad-CAM spatial activation mapping.
            </p>
          </div>

          <div className="shrink-0 flex items-center space-x-3">
            <button
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-sky-600/30 transition-all text-sm"
            >
              <UploadCloud className="w-5 h-5" />
              <span>Upload New X-Ray</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Scans */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Scans</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{totalScans}</h3>
            <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> +12% from last month
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* TB Positive Cases */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">TB Positive Cases</p>
            <h3 className="text-3xl font-extrabold text-rose-600 mt-1">{positiveCases}</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {((positiveCases / (totalScans || 1)) * 100).toFixed(1)}% Positivity Rate
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* TB Negative Cases */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">TB Negative Cases</p>
            <h3 className="text-3xl font-extrabold text-emerald-600 mt-1">{negativeCases}</h3>
            <p className="text-[11px] text-slate-500 mt-1 font-medium">
              {((negativeCases / (totalScans || 1)) * 100).toFixed(1)}% Clear Rate
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Recent Scans */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Scans</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{recentCount}</h3>
            <p className="text-[11px] text-sky-600 font-medium mt-1">Active Batch Today</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Grid Section: Recent Activity & Quick Upload Callout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Scans List (2 columns on large screens) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-900">Recent Patient Scans</h3>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-sky-600 hover:text-sky-800 font-semibold flex items-center space-x-1"
            >
              <span>View All History</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {historyData.slice(0, 4).map((record) => {
              const isPos = record.result?.toLowerCase().includes('positive');
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isPos ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {record.patientId?.substring(0, 4) || 'PT'}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{record.patientId} - {record.patientName}</p>
                      <p className="text-[11px] text-slate-500">Scanned on {record.scanDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                      isPos ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {record.result}
                    </span>
                    <span className="font-mono text-slate-600 font-semibold hidden sm:inline">
                      {record.confidence}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity Feed (1 column) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Clinical Audit Activity</h3>
            <span className="text-[11px] text-slate-400 font-mono">Live</span>
          </div>

          <div className="space-y-4">
            {RECENT_ACTIVITIES.map((act) => (
              <div key={act.id} className="flex items-start space-x-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-sky-500 mt-1.5 shrink-0"></div>
                <div className="flex-1 space-y-0.5">
                  <p className="font-semibold text-slate-800">
                    Patient <span className="text-sky-700">{act.patientId}</span> {act.action.toLowerCase()}
                  </p>
                  <p className="text-slate-500 font-medium">{act.result}</p>
                  <p className="text-[10px] text-slate-400">{act.time}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => onNavigate('upload')}
              className="w-full bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 rounded-xl transition-colors"
            >
              Start New Analysis Session
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
