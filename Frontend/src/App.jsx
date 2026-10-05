import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import FLMonitorPage from './pages/FLMonitorPage';
import FederatedMonitorPage from './pages/FederatedMonitorPage';
import { INITIAL_PATIENT_HISTORY, INITIAL_STATS } from './utils/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Patient Scan History State (persisted in localStorage)
  const [historyData, setHistoryData] = useState(() => {
    const saved = localStorage.getItem('tb_patient_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_PATIENT_HISTORY;
      }
    }
    return INITIAL_PATIENT_HISTORY;
  });

  // Current Active Prediction Session
  const [currentResult, setCurrentResult] = useState(null);

  // Sync history to localStorage
  useEffect(() => {
    localStorage.setItem('tb_patient_history', JSON.stringify(historyData));
  }, [historyData]);

  // Handle successful AI prediction
  const handlePredictionSuccess = (predictionPayload) => {
    setCurrentResult(predictionPayload);
    setActiveTab('result');
  };

  // Add new scan record to history after doctor verification
  const handleSaveToHistory = (newRecord) => {
    setHistoryData((prev) => [newRecord, ...prev]);
  };

  // View specific scan in result page
  const handleViewScanDetail = (record) => {
    setCurrentResult({
      prediction_id: record.predictionId || record.id,
      prediction: record.result,
      confidence: record.confidence,
      stage: record.stage,
      heatmap_url: record.heatmapUrl,
      originalImage: record.heatmapUrl || null,
      patientId: record.patientId,
      patientName: record.patientName
    });
    setActiveTab('result');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Top Navbar */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        activeTab={activeTab}
      />

      {/* Main Content Layout (Sidebar + Page Content) */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Dynamic Page Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={INITIAL_STATS}
              historyData={historyData}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'upload' && (
            <UploadPage
              onPredictionSuccess={handlePredictionSuccess}
            />
          )}

          {activeTab === 'result' && (
            <ResultPage
              currentResult={currentResult}
              onBackToUpload={() => setActiveTab('upload')}
              onSaveToHistory={handleSaveToHistory}
            />
          )}

          {activeTab === 'history' && (
            <HistoryPage
              historyData={historyData}
              onViewScanDetail={handleViewScanDetail}
            />
          )}

          {(activeTab === 'federated-network' || activeTab === 'fl-monitor') && (
            <FederatedMonitorPage />
          )}
        </main>

      </div>

    </div>
  );
}
