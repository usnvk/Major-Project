import React from 'react';
import { LayoutDashboard, UploadCloud, FileSpreadsheet, History, Stethoscope, ChevronRight, Network } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab, isOpen, onCloseMobile }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Overview & Analytics' },
    { id: 'upload', label: 'Upload X-Ray', icon: UploadCloud, desc: 'New AI Scan Analysis' },
    { id: 'result', label: 'Results', icon: FileSpreadsheet, desc: 'Grad-CAM & Diagnostic Report' },
    { id: 'history', label: 'Patient History', icon: History, desc: 'Records & Audit Trail' },
    { id: 'federated-network', label: 'Federated Network', icon: Network, desc: 'Nodes, Privacy & Retraining' },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar navigation container */}
      <aside
        className={`fixed md:sticky top-0 md:top-[65px] left-0 z-50 md:z-10 w-64 bg-slate-900 border-r border-slate-800 text-slate-300 h-screen md:h-[calc(100vh-65px)] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-4 py-6 space-y-6 flex-1 overflow-y-auto">
          
          <div className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Clinical Navigation
          </div>

          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-sky-600/15 text-sky-400 border border-sky-500/30 shadow-sm'
                      : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <div className="text-left">
                      <div className="leading-tight">{item.label}</div>
                      <div className="text-[11px] text-slate-500 font-normal">{item.desc}</div>
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-sky-400" />}
                </button>
              );
            })}
          </nav>

          {/* Quick Info Box */}
          <div className="mt-8 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2 text-slate-200 font-semibold">
              <Stethoscope className="w-4 h-4 text-sky-400" />
              <span>Decision Support</span>
            </div>
            <p className="leading-relaxed">
              AI outputs are diagnostic support recommendations and require doctor verification.
            </p>
          </div>

        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          <p>© 2026 TB AI Diagnosis System</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Approved for Pulmonary Screening</p>
        </div>

      </aside>
    </>
  );
}
