import React, { useState, useEffect } from 'react';
import {
  HeartPulse,
  Lock,
  Pill,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Upload,
} from 'lucide-react';
import { getStageInformation } from '../utils/stageData';
import { useAuth } from '../context/AuthContext';
import { fetchScans } from '../services/api';

export default function PatientDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [patientRecords, setPatientRecords] = useState([]);
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Daily medication adherence tracker state
  const [medsChecked, setMedsChecked] = useState({
    morning: false,
    afternoon: false,
    evening: false,
  });

  const toggleMed = (time) => {
    setMedsChecked((prev) => ({ ...prev, [time]: !prev[time] }));
  };

  useEffect(() => {
    const loadPatientScans = async () => {
      setLoading(true);
      const targetHash = user?.patient_hash || user?.email || null;
      if (!targetHash) {
        setPatientRecords([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetchScans('patient', targetHash);
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setPatientRecords(res.data);
          setSelectedRecordId(res.data[0].id || res.data[0].predictionId);
        } else {
          setPatientRecords([]);
          setSelectedRecordId(null);
        }
      } catch (err) {
        console.warn('Could not load patient scans:', err);
        setPatientRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadPatientScans();
  }, [user]);

  const activeRecord =
    patientRecords.find(
      (r) => String(r.id) === String(selectedRecordId) || String(r.predictionId) === String(selectedRecordId)
    ) || (patientRecords.length > 0 ? patientRecords[0] : null);

  const hasRecords = patientRecords.length > 0 && activeRecord !== null;
  const isPositive = hasRecords && String(activeRecord.result).toLowerCase().includes('positive');
  const stageInfo = hasRecords && activeRecord.stage ? getStageInformation(activeRecord.stage) : null;
  const patientDisplayName = user?.name || (hasRecords ? activeRecord.patientName : 'Patient');
  const attendingDoctor = activeRecord?.doctorName || activeRecord?.doctorEmail || (activeRecord?.doctorConfirmed ? 'Attending Clinician' : 'Pending Verification');

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-16">
      
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#E2E8F0]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0D9488] bg-[#F0FDFA] px-2.5 py-0.5 rounded-full border border-[#CCFBF1] mb-1">
            <HeartPulse className="w-3.5 h-3.5" />
            <span>My Health Portal</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            Hello, {patientDisplayName}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            View your clinical screening summaries, appointments, and care guidance.
          </p>
        </div>

        <button
          onClick={() => onNavigate('upload')}
          className="bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-xs transition self-start sm:self-auto inline-flex items-center space-x-2"
        >
          <Upload className="w-4 h-4" />
          <span>Upload CXR Radiograph</span>
        </button>
      </div>

      {/* ── Persistent Privacy Notice for Patient ── */}
      <div className="p-3.5 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] flex items-center justify-between text-xs text-[#0F766E]">
        <div className="flex items-center space-x-2">
          <Lock className="w-4 h-4 text-[#0D9488] shrink-0" />
          <span className="font-semibold">Privacy Guaranteed:</span>
          <span>Your medical records and chest radiographs remain strictly encrypted inside hospital edge nodes.</span>
        </div>
        <span className="hidden sm:inline font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-[#CCFBF1] text-[#0D9488]">
          ID: {user?.patient_hash || user?.email || 'N/A'}
        </span>
      </div>

      {/* ── 3 Summary Metrics ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Latest Screening Status */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Latest Screening</div>
          <div className="text-xl font-bold mt-1 text-[#0F172A] flex items-center gap-2">
            {!hasRecords ? (
              <span className="text-[#64748B]">No Scans Recorded</span>
            ) : activeRecord.doctorConfirmed ? (
              isPositive ? (
                <span className="text-[#DC2626]">Requires Clinical Care</span>
              ) : (
                <span className="text-[#16A34A]">Verified Normal</span>
              )
            ) : (
              <span className="text-[#F59E0B]">Pending Clinician Sign-Off</span>
            )}
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            {hasRecords ? `Evaluated on ${activeRecord.scanDate || 'Recent'}` : 'Awaiting initial CXR upload'}
          </p>
        </div>

        {/* Reports Count */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Medical Reports</div>
          <div className="text-2xl font-bold text-[#2563EB] mt-1">
            {patientRecords.length} {patientRecords.length === 1 ? 'Report' : 'Reports'}
          </div>
          <p className="text-xs text-[#64748B] mt-1">
            {hasRecords ? 'Archived in encrypted personal health file' : 'No records archived yet'}
          </p>
        </div>

        {/* Clinical Follow-up Status */}
        <div className="bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Clinical Care Status</div>
          <div className="text-xl font-bold text-[#0F172A] mt-1">
            {!hasRecords
              ? 'Pending Screening'
              : isPositive
              ? 'Care Plan Active'
              : 'Normal / Routine'}
          </div>
          <p className="text-xs text-[#16A34A] mt-1 flex items-center gap-1 font-medium">
            {hasRecords && activeRecord.doctorConfirmed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Attending: {attendingDoctor}</span>
              </>
            ) : (
              <span className="text-[#64748B]">
                {hasRecords ? 'Awaiting clinician sign-off' : 'Routine'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Patient Records Content / Empty State ── */}
      {!hasRecords ? (
        <div className="bg-white p-10 rounded-2xl border border-[#E2E8F0] shadow-xs text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mx-auto">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#0F172A]">No Chest Radiographs Archived Yet</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            You do not have any radiographic scans associated with your patient account yet. 
            Once you upload a chest radiograph, AI-assisted screening results and attending physician sign-off notes will appear here.
          </p>
          <button
            onClick={() => onNavigate('upload')}
            className="bg-[#2563EB] hover:bg-[#1E40AF] text-white font-semibold px-5 py-2.5 rounded-xl text-xs shadow-xs transition inline-flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Chest Radiograph (CXR)</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Multiple Scans Selector if > 1 record */}
          {patientRecords.length > 1 && (
            <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex items-center space-x-2 overflow-x-auto text-xs">
              <span className="font-semibold text-slate-600 shrink-0 mr-2">Select Scan:</span>
              {patientRecords.map((rec) => {
                const recId = rec.id || rec.predictionId;
                const isSelected = String(recId) === String(selectedRecordId);
                return (
                  <button
                    key={recId}
                    onClick={() => setSelectedRecordId(recId)}
                    className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
                      isSelected
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    {rec.scanDate || 'Scan'} · {rec.result}
                  </button>
                );
              })}
            </div>
          )}

          {/* Latest Report Detail */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E2E8F0] gap-2">
              <div>
                <h3 className="font-bold text-base text-[#0F172A]">Clinical Screening Summary</h3>
                <p className="text-xs text-[#64748B]">Clear summary of your pulmonary evaluation</p>
              </div>
              <span className="text-xs font-mono text-[#64748B] bg-slate-50 px-2.5 py-0.5 rounded border border-[#E2E8F0]">
                Report ID: {activeRecord.predictionId || activeRecord.id}
              </span>
            </div>

            {/* Doctor Review Note */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="font-semibold text-[#0F172A] flex items-center justify-between">
                <span>Doctor&apos;s Review Note:</span>
                <span className="text-[11px] text-[#64748B] font-normal">
                  {activeRecord.doctorConfirmed ? `Verified by ${attendingDoctor}` : 'Pending Verification'}
                </span>
              </div>
              <p className="text-[#64748B] leading-relaxed">
                {activeRecord.notes || activeRecord.doctor_notes || (
                  activeRecord.doctorConfirmed
                    ? 'Your radiograph has been reviewed by your physician.'
                    : 'Awaiting attending clinician diagnostic sign-off. Please check back shortly.'
                )}
              </p>
            </div>

            {/* Medication Adherence Tracker (Only if TB Positive & Confirmed by Doctor) */}
            {isPositive && activeRecord.doctorConfirmed && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#0F172A]">
                  <span className="flex items-center gap-1.5">
                    <Pill className="w-4 h-4 text-[#2563EB]" /> Prescribed Treatment Adherence
                  </span>
                  <span className="text-[#64748B] font-normal text-[11px]">Tap to mark completed</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {[
                    { id: 'morning', label: 'Morning Regimen', desc: 'Prescribed Antimicrobial' },
                    { id: 'afternoon', label: 'Afternoon Regimen', desc: 'Hydration & Nutrition' },
                    { id: 'evening', label: 'Evening Regimen', desc: 'Evening Dose / Rest' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleMed(m.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        medsChecked[m.id]
                          ? 'bg-[#F0FDF4] border-[#DCFCE7] text-[#16A34A]'
                          : 'bg-white border-[#E2E8F0] text-[#64748B] hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{m.label}</span>
                        {medsChecked[m.id] && <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />}
                      </div>
                      <div className="text-[11px] mt-0.5 text-[#64748B]">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
