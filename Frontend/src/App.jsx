import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PatientDashboard from './pages/PatientDashboard';
import UploadPage from './pages/UploadPage';
import ResultPage from './pages/ResultPage';
import HistoryPage from './pages/HistoryPage';
import FederatedMonitorPage from './pages/FederatedMonitorPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { fetchScans } from './services/api';

function AppContent() {
  const { user, role } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Live scan history loaded from SQLite
  const [historyData, setHistoryData] = useState([]);

  // Current Active Prediction Session
  const [currentResult, setCurrentResult] = useState(null);

  // Sync tab whenever authenticated user or role changes
  useEffect(() => {
    if (!user) return;
    if (role === 'admin') {
      setActiveTab('admin-panel');
    } else if (role === 'patient') {
      setActiveTab('patient-portal');
    } else {
      setActiveTab('dashboard');
    }
  }, [user?.id, role]);

  // Strict role guard: ensure only permitted views can be active for the current role
  useEffect(() => {
    if (!user) return;
    if (role === 'admin') {
      if (activeTab !== 'admin-panel' && activeTab !== 'federated-network' && activeTab !== 'history') {
        setActiveTab('admin-panel');
      }
    } else if (role === 'patient') {
      if (activeTab !== 'patient-portal' && activeTab !== 'upload' && activeTab !== 'result' && activeTab !== 'history') {
        setActiveTab('patient-portal');
      }
    } else {
      // doctor
      if (
        activeTab !== 'dashboard' &&
        activeTab !== 'upload' &&
        activeTab !== 'result' &&
        activeTab !== 'history' &&
        activeTab !== 'federated-network'
      ) {
        setActiveTab('dashboard');
      }
    }
  }, [role, activeTab, user]);

  // If user is not authenticated, render the dedicated LoginPage
  if (!user) {
    return <LoginPage />;
  }

  // Load real scans from SQLite backend
  const refreshScans = async () => {
    try {
      const targetHash = role === 'patient' ? (user?.patient_hash || 'PT-1001') : null;
      const res = await fetchScans(role, targetHash);
      if (res.success && Array.isArray(res.data)) {

        setHistoryData(res.data);
      }
    } catch (err) {
      console.warn('Could not refresh scans from database:', err);
    }
  };

  useEffect(() => {
    refreshScans();
  }, [role, user]);

  // Handle successful AI prediction
  const handlePredictionSuccess = (predictionPayload) => {
    setCurrentResult(predictionPayload);
    setActiveTab('result');
    refreshScans();
  };

  // Add new scan record to history after doctor verification
  const handleSaveToHistory = (newRecord) => {
    setHistoryData((prev) => [newRecord, ...prev]);
    refreshScans();
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
      patientName: record.patientName,
    });
    setActiveTab('result');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans antialiased text-[#0F172A]">
      {/* Top Navbar with Clean Authenticated Profile */}
      <Navbar
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        activeTab={activeTab}
        onNavigate={setActiveTab}
      />

      {/* Main Content Layout (Sidebar + Page Content) */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar tailored strictly to logged-in role */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isOpen={sidebarOpen}
          onCloseMobile={() => setSidebarOpen(false)}
        />

        {/* Dynamic Page Container with Strict RBAC Content Visibility */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* ── Doctor Only Views ── */}
          {role === 'doctor' && activeTab === 'dashboard' && (
            <Dashboard
              historyData={historyData}
              onNavigate={setActiveTab}
            />
          )}

          {/* ── Diagnostic Scan Review (Doctor & Patient) ── */}
          {(role === 'doctor' || role === 'patient') && activeTab === 'result' && (
            <ResultPage
              currentResult={currentResult}
              onBackToUpload={() => setActiveTab('upload')}
              onSaveToHistory={handleSaveToHistory}
            />
          )}

          {/* ── Admin Only Views ── */}
          {role === 'admin' && activeTab === 'admin-panel' && (
            <AdminDashboard
              onNavigate={setActiveTab}
            />
          )}

          {/* ── Patient Only Views ── */}
          {role === 'patient' && activeTab === 'patient-portal' && (
            <PatientDashboard
              historyData={historyData}
              onNavigate={setActiveTab}
            />
          )}

          {/* ── Scans Ingestion (Doctor & Patient) ── */}
          {(role === 'doctor' || role === 'patient') && activeTab === 'upload' && (
            <UploadPage
              onPredictionSuccess={handlePredictionSuccess}
            />
          )}

          {/* ── Records & Audit History (Role-filtered data from SQLite) ── */}
          {activeTab === 'history' && (
            <HistoryPage
              historyData={historyData}
              onViewScanDetail={handleViewScanDetail}
            />
          )}

          {/* ── Federated Telemetry (Doctor & Admin) ── */}
          {(role === 'doctor' || role === 'admin') &&
            (activeTab === 'federated-network' || activeTab === 'fl-monitor') && (
              <FederatedMonitorPage />
            )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
