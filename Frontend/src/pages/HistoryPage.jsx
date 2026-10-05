import React, { useState } from 'react';
import HistoryTable from '../components/HistoryTable';
import { History, Download, FileSpreadsheet, X, Eye, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function HistoryPage({ historyData, onViewScanDetail }) {
  const [selectedRecordModal, setSelectedRecordModal] = useState(null);

  const handleExportCSV = () => {
    const headers = ["Scan Date", "Patient ID", "Patient Name", "Result", "Confidence (%)", "Stage", "Doctor Confirmed"];
    const rows = historyData.map(r => [
      r.scanDate,
      r.patientId,
      `"${r.patientName || ''}"`,
      r.result,
      r.confidence,
      r.stage || "N/A",
      r.doctorConfirmed ? "Yes" : "No"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TB_Patient_Scan_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewDetail = (record) => {
    setSelectedRecordModal(record);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-3">
            <History className="w-7 h-7 text-sky-600" />
            <span>Patient Scan History & Audit Trail</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Search, filter, and inspect historical chest radiograph predictions and physician diagnosis sign-offs.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center justify-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Audit</span>
        </button>
      </div>

      {/* History Table Component */}
      <HistoryTable
        historyData={historyData}
        onViewDetail={handleViewDetail}
      />

      {/* Record Inspection Modal */}
      {selectedRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">Patient Scan Details - {selectedRecordModal.patientId}</h3>
              </div>
              <button
                onClick={() => setSelectedRecordModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[11px]">Patient Name</span>
                  <span className="font-bold text-slate-900">{selectedRecordModal.patientName}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Scan Date</span>
                  <span className="font-bold text-slate-900">{selectedRecordModal.scanDate}</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">AI Confidence</span>
                  <span className="font-bold text-sky-700 font-mono">{selectedRecordModal.confidence}%</span>
                </div>

                <div>
                  <span className="text-slate-400 block text-[11px]">Disease Stage</span>
                  <span className="font-bold text-indigo-700">
                    {selectedRecordModal.stage ? `Stage ${selectedRecordModal.stage}` : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedRecordModal.result?.toLowerCase().includes('positive')
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center space-x-2 font-bold text-sm">
                  {selectedRecordModal.result?.toLowerCase().includes('positive') ? (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                  <span>Diagnosis Result: {selectedRecordModal.result}</span>
                </div>

                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/80 shadow-sm border border-slate-200">
                  {selectedRecordModal.doctorConfirmed ? 'Doctor Verified' : 'Pending Verification'}
                </span>
              </div>

              {/* Clinical Notes */}
              <div className="space-y-1">
                <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px]">
                  Attending Physician Clinical Notes
                </span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 italic">
                  "{selectedRecordModal.notes || 'No doctor observation notes attached to this scan.'}"
                </p>
              </div>

              {/* Heatmap Thumbnail */}
              {selectedRecordModal.heatmapUrl && (
                <div className="space-y-2">
                  <span className="font-bold text-slate-900 uppercase tracking-wide text-[10px]">
                    Archived Grad-CAM Heatmap Analysis
                  </span>
                  <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden aspect-video flex items-center justify-center max-h-[220px]">
                    <img
                      src={selectedRecordModal.heatmapUrl}
                      alt="Archived Heatmap"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              )}

            </div>

            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-between items-center">
              <button
                onClick={() => {
                  if (onViewScanDetail) onViewScanDetail(selectedRecordModal);
                  setSelectedRecordModal(null);
                }}
                className="inline-flex items-center space-x-1 text-xs text-sky-700 bg-sky-50 hover:bg-sky-100 px-3.5 py-2 rounded-xl font-semibold border border-sky-200"
              >
                <Eye className="w-4 h-4" />
                <span>Open Full Interactive Report</span>
              </button>

              <button
                onClick={() => setSelectedRecordModal(null)}
                className="bg-slate-900 text-white text-xs font-semibold px-5 py-2 rounded-xl"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
