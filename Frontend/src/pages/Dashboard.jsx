import React, { useState, useEffect } from 'react';
import {
  Activity,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchClinicalStats, fetchRecentAuditLogs, fetchScans } from '../services/api';

export default function Dashboard({ onNavigate }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalScans: 0,
    positiveCases: 0,
    negativeCases: 0,
    positivityRate: 0,
    clearRate: 100,
    pendingReviews: 0,
    todayScans: 0,
    feedbackCount: 0,
  });
  const [recentScansList, setRecentScansList] = useState([]);
  const [auditActivities, setAuditActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRealData = async () => {
    try {
      const [statsRes, scansRes, auditRes] = await Promise.all([
        fetchClinicalStats(),
        fetchScans('doctor'),
        fetchRecentAuditLogs(8),
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (scansRes.success && Array.isArray(scansRes.data)) {
        setRecentScansList(scansRes.data.slice(0, 6));
      }
      if (auditRes.success && Array.isArray(auditRes.data)) {
        setAuditActivities(auditRes.data);
      }
    } catch (err) {
      console.warn('Error loading live clinical dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRealData();
    const interval = setInterval(loadRealData, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadRealData();
  };

  const doctorDisplayName = user?.name || 'Authorized Pulmonologist';

  return (
    <div className="space-y-6 animate-fade-in pb-16 max-w-7xl mx-auto">
      
      {/* ── Clinical Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#DBEAFE] mb-1">
            <Activity className="w-3.5 h-3.5" />
            <span>Hospital Node Live Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Good day, {doctorDisplayName}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Real-time pulmonary radiography screening, verification queue, and tamper-evident audit records.
          </p>
        </div>

        {/* Primary Actions: Refresh & New Analysis */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#64748B] hover:text-[#0F172A] transition shadow-xs"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#2563EB]' : ''}`} />
          </button>

          <button
            onClick={() => onNavigate('upload')}
            className="inline-flex items-center space-x-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold px-4 py-2.5 rounded-xl shadow-xs transition text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New CXR Analysis</span>
          </button>
        </div>
      </div>

      {/* ── 4 Authentic Real-Time Metrics (From SQLite DB) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Pending Reviews */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            Pending Reviews
          </div>
          <div className="text-3xl font-extrabold text-[#D97706] mt-1 font-mono">
            {String(stats.pendingReviews ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-[#64748B] mt-1 flex items-center gap-1 font-medium">
            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
            <span>Requires clinician sign-off</span>
          </p>
        </div>

        {/* Metric 2: Today's Scans */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            Today&apos;s Scans
          </div>
          <div className="text-3xl font-extrabold text-[#0F172A] mt-1 font-mono">
            {String(stats.todayScans ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-[#16A34A] mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Processed on local edge node</span>
          </p>
        </div>

        {/* Metric 3: TB Positive Findings */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            TB Positive Cases
          </div>
          <div className="text-3xl font-extrabold text-[#DC2626] mt-1 font-mono">
            {String(stats.positiveCases ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            {stats.positivityRate ?? 0}% overall positivity rate
          </p>
        </div>

        {/* Metric 4: Total Scans Screened */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            Total Scans Ingested
          </div>
          <div className="text-3xl font-extrabold text-[#2563EB] mt-1 font-mono">
            {String(stats.totalScans ?? 0).padStart(2, '0')}
          </div>
          <p className="text-xs text-[#64748B] mt-1 font-medium">
            {stats.negativeCases ?? 0} confirmed negative scans
          </p>
        </div>
      </div>

      {/* ── Workspace Grid: Recent Clinical Cases & Audit Trail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Recent Cases Table (2 cols) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-base text-[#0F172A]">Recent Screening Cases</h3>
              <p className="text-xs text-[#64748B]">Real radiographs archived in local SQLite database</p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-bold flex items-center space-x-1"
            >
              <span>View All Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {recentScansList.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748B]">
                No radiograph scans recorded yet. Click &quot;New CXR Analysis&quot; to ingest your first image.
              </div>
            ) : (
              recentScansList.map((scan) => {
                const isPos = String(scan.result).toLowerCase().includes('positive');
                const pName = scan.patientName || scan.patient_name || 'Patient';
                const pId = scan.patientId || scan.patient_id || scan.patient_hash || 'PT-1001';
                const isConfirmed = scan.doctorConfirmed ?? scan.doctor_confirmed;
                const confVal = scan.confidence ? `${scan.confidence}%` : 'High';
                const scanId = scan.id || scan.predictionId || scan.prediction_id;

                return (
                  <div
                    key={scanId}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/80 transition px-2.5 rounded-xl gap-3"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isPos
                            ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]'
                            : 'bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]'
                        }`}
                      >
                        {isPos ? 'POS' : 'NEG'}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-xs text-[#0F172A] truncate">
                            {pName}
                          </span>
                          <span className="text-[10px] font-mono text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                            {pId}
                          </span>
                          {scan.isDicom && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                              DICOM
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] truncate mt-0.5">
                          Result: <span className="font-semibold text-[#0F172A]">{scan.result}</span> ({confVal} confidence)
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex items-center space-x-2 shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          isConfirmed
                            ? 'bg-[#F0FDF4] text-[#16A34A] border-[#DCFCE7]'
                            : 'bg-[#FFFBEB] text-[#D97706] border-[#FEF3C7]'
                        }`}
                      >
                        {isConfirmed ? '✓ Doctor Confirmed' : '● Needs Verification'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Clinical Audit Activity Feed (1 col) */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
            <div>
              <h3 className="font-bold text-base text-[#0F172A]">Clinical Audit Trail</h3>
              <p className="text-xs text-[#64748B]">HIPAA tamper-evident activity</p>
            </div>
            <span className="text-[10px] font-mono text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded font-semibold border border-[#DBEAFE]">
              Live
            </span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {auditActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B]">No audit events logged yet.</div>
            ) : (
              auditActivities.map((act) => {
                const timeStr = act.created_at ? act.created_at.substring(11, 19) : 'Just now';
                const dateStr = act.created_at ? act.created_at.substring(0, 10) : '';

                return (
                  <div
                    key={act.id}
                    className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 hover:border-[#CBD5E1] transition"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0F172A] font-mono bg-white px-1.5 py-0.2 rounded border border-[#E2E8F0]">
                        {act.action}
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {timeStr}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#475569] leading-tight">
                      {act.details}
                    </p>
                    <div className="text-[10px] text-[#94A3B8] flex items-center justify-between pt-0.5">
                      <span>By: {act.user_email || 'system'}</span>
                      {dateStr && <span>{dateStr}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
