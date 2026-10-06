import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  History,
  ShieldCheck,
  Network,
  HeartPulse,
  Server,
  Layers,
  Cpu,
  BarChart2,
  Lock,
  FileText,
  Clock,
  Activity,
  LogOut,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, setActiveTab, isOpen, onCloseMobile }) {
  const { user, role, logout } = useAuth();

  // Clean, purposeful role-specific navigation menus
  let navItems = [];

  if (role === 'admin') {
    navItems = [
      { id: 'admin-panel', label: 'FL Operations Hub', icon: LayoutDashboard },
      { id: 'federated-network', label: 'Federated Telemetry', icon: Network },
      { id: 'history', label: 'HIPAA Audit Trail', icon: History },
    ];
  } else if (role === 'patient') {
    navItems = [
      { id: 'patient-portal', label: 'Health Overview', icon: LayoutDashboard },
      { id: 'upload', label: 'Upload Radiograph', icon: UploadCloud },
      { id: 'history', label: 'My Clinical Records', icon: History },
    ];
  } else {
    // Doctor
    navItems = [
      { id: 'dashboard', label: 'Clinical Dashboard', icon: LayoutDashboard },
      { id: 'upload', label: 'New CXR Analysis', icon: UploadCloud },
      { id: 'result', label: 'AI Diagnostic Review', icon: Clock },
      { id: 'history', label: 'Scan Records & Audit', icon: History },
      { id: 'federated-network', label: 'Federated Network', icon: Network },
    ];
  }

  // Handle tab switching
  const handleItemClick = (id) => {
    setActiveTab(id);
    if (onCloseMobile) onCloseMobile();
  };

  const isNavActive = (itemId) => {
    return activeTab === itemId;
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden transition-opacity"
        />
      )}

      {/* Hospital SaaS Sidebar: White background, thin border, minimal shadow */}
      <aside
        className={`fixed md:sticky top-0 md:top-[61px] left-0 z-50 md:z-10 w-64 bg-white border-r border-[#E2E8F0] h-screen md:h-[calc(100vh-61px)] flex flex-col justify-between transition-transform duration-200 ease-in-out shadow-[1px_0_4px_rgba(0,0,0,0.02)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-3 py-4 space-y-4 flex-1 overflow-y-auto">
          {/* Brand header in sidebar */}
          <div className="px-3 pt-1 pb-2 flex items-center space-x-2.5 border-b border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] text-white flex items-center justify-center font-bold shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-[#0F172A] leading-tight">PulmoScan FL</div>
              <div className="text-[10px] text-[#64748B]">Clinical AI Platform</div>
            </div>
          </div>

          {/* Navigation group label */}
          <div className="px-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center justify-between">
            <span>{role ? `${role} Workspace` : 'Navigation'}</span>
          </div>

          {/* Role Navigation List */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(item.id);

              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                    active
                      ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold border border-[#DBEAFE]'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-[#2563EB]' : 'text-[#64748B]'
                    }`}
                  />
                  <span className="truncate text-left flex-1">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: User Card, Sign Out & Privacy Indicator */}
        <div className="p-3 border-t border-[#E2E8F0] bg-slate-50/50 space-y-2">
          {/* Active User Card & Quick Logout */}
          <div className="p-2.5 rounded-xl bg-white border border-[#E2E8F0] shadow-2xs flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-xs text-[#0F172A] truncate">
                {user?.name || 'Logged In'}
              </div>
              <div className="text-[10px] text-[#64748B] capitalize truncate">
                {role} · {user?.hospital_node || 'Hospital Node'}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-[#DC2626] hover:bg-rose-50 transition shrink-0"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] text-[#0F766E] text-[10px] leading-relaxed flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
            <span className="truncate">Local PHI Privacy Safe Harbor</span>
          </div>
        </div>
      </aside>
    </>
  );
}
