import React, { useState, useMemo } from 'react';
import { Search, Filter, Calendar, Eye, CheckCircle2, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

export default function HistoryTable({ historyData = [], onViewDetail }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'POSITIVE' | 'NEGATIVE'
  const [stageFilter, setStageFilter] = useState('ALL');   // 'ALL' | '1' | '2' | '3'
  const [sortOrder, setSortOrder] = useState('desc');     // 'desc' | 'asc'
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  // Filter and search logic
  const filteredData = useMemo(() => {
    return historyData
      .filter((item) => {
        const matchesSearch = 
          item.patientId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.id?.toString().includes(searchTerm);

        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'POSITIVE' && item.result?.toLowerCase().includes('positive')) ||
          (statusFilter === 'NEGATIVE' && item.result?.toLowerCase().includes('negative'));

        const matchesStage =
          stageFilter === 'ALL' ||
          (item.stage && item.stage.toString() === stageFilter);

        return matchesSearch && matchesStatus && matchesStage;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scanDate || 0);
        const dateB = new Date(b.scanDate || 0);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [historyData, searchTerm, statusFilter, stageFilter, sortOrder]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const currentRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const toggleSort = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
      
      {/* Header & Controls bar */}
      <div className="p-5 border-b border-slate-200 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Patient Scan History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive audit trail of AI-predicted and doctor-confirmed chest radiographs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="bg-sky-50 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full border border-sky-200">
              Total Records: {historyData.length}
            </span>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Patient ID or Name..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300 text-xs">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-slate-800 font-medium focus:outline-none"
            >
              <option value="ALL">All Diagnosis Results</option>
              <option value="POSITIVE">TB Positive Only</option>
              <option value="NEGATIVE">TB Negative Only</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-300 text-xs">
            <Filter className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-slate-800 font-medium focus:outline-none"
            >
              <option value="ALL">All Stages</option>
              <option value="1">Stage 1 Only</option>
              <option value="2">Stage 2 Only</option>
              <option value="3">Stage 3 Only</option>
            </select>
          </div>

          {/* Sort order toggle */}
          <button
            onClick={toggleSort}
            className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-4 rounded-xl border border-slate-300 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>Sort: {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>

        </div>

      </div>

      {/* Desktop Table View (Hidden on small mobile screens) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-6">Scan Date</th>
              <th className="py-3.5 px-6">Patient Details</th>
              <th className="py-3.5 px-6">Diagnosis Result</th>
              <th className="py-3.5 px-6">Confidence</th>
              <th className="py-3.5 px-6">Stage</th>
              <th className="py-3.5 px-6">Verification</th>
              <th className="py-3.5 px-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {currentRecords.length > 0 ? (
              currentRecords.map((row) => {
                const isPos = row.result?.toLowerCase().includes('positive');
                return (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono text-slate-600 font-medium">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{row.scanDate}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{row.patientId}</div>
                      <div className="text-[11px] text-slate-500">{row.patientName || 'Anonymous Patient'}</div>
                    </td>

                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold ${
                        isPos
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {isPos ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>{row.result}</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 font-semibold text-slate-800 font-mono">
                      {row.confidence}%
                    </td>

                    <td className="py-4 px-6">
                      {row.stage ? (
                        <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded font-semibold border border-indigo-200">
                          Stage {row.stage}
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      {row.doctorConfirmed ? (
                        <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Doctor Signed</span>
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Pending Verification
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onViewDetail && onViewDetail(row)}
                        className="inline-flex items-center space-x-1 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold px-3 py-1.5 rounded-lg border border-sky-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Scan</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">
                  No patient scan records found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View (Displayed on mobile screens) */}
      <div className="block md:hidden p-4 space-y-4">
        {currentRecords.length > 0 ? (
          currentRecords.map((row) => {
            const isPos = row.result?.toLowerCase().includes('positive');
            return (
              <div key={row.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{row.patientId}</span>
                    <span className="text-xs text-slate-500 block">{row.patientName || 'Anonymous Patient'}</span>
                  </div>
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    isPos ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    <span>{row.result}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-400">Date:</span> {row.scanDate}
                  </div>
                  <div>
                    <span className="text-slate-400">Confidence:</span> {row.confidence}%
                  </div>
                  <div>
                    <span className="text-slate-400">Stage:</span> {row.stage ? `Stage ${row.stage}` : 'N/A'}
                  </div>
                  <div>
                    <span className="text-slate-400">Doctor Status:</span> {row.doctorConfirmed ? 'Signed' : 'Pending'}
                  </div>
                </div>

                <button
                  onClick={() => onViewDetail && onViewDetail(row)}
                  className="w-full flex items-center justify-center space-x-1.5 bg-sky-600 text-white font-semibold text-xs py-2 rounded-lg"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Patient Scan</span>
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-center text-xs text-slate-500 py-4">No records found.</p>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div>
          Showing page <span className="font-bold">{currentPage}</span> of <span className="font-bold">{totalPages}</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
