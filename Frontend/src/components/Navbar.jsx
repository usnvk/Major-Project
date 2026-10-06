import React, { useState } from 'react';
import {
  Activity,
  Menu,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Bell,
  ChevronDown,
  Building2,
  Lock,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onToggleSidebar, activeTab, onNavigate, onOpenAuthModal }) {
  const { user, role, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Dynamic Page Title & Breadcrumb based on active tab & role (Section 6)
  const getHeaderInfo = () => {
    switch (activeTab) {
      case 'admin-panel':
      case 'federated-network':
        return {
          title: 'Federated Learning Operations',
          breadcrumb: 'Central Aggregation / FL Operations',
          org: 'Central FL Aggregation Hub',
        };
      case 'dashboard':
        return {
          title: 'Clinical Radiography Workspace',
          breadcrumb: 'Pulmonology Suite / Screening Cases',
          org: 'Hospital A — Urban Referral',
        };
      case 'upload':
        return {
          title: 'New CXR Analysis',
          breadcrumb: 'Clinical Suite / Radiograph Ingest',
          org: 'Hospital A — Urban Referral',
        };
      case 'result':
        return {
          title: 'AI-Assisted TB Screening Report',
          breadcrumb: 'Clinical Review / Explainable AI',
          org: 'Hospital A — Urban Referral',
        };
      case 'patient-portal':
        return {
          title: 'My Health Overview',
          breadcrumb: 'Patient Portal / Care Roadmap',
          org: 'Hospital A — Urban Referral',
        };
      case 'history':
        return {
          title: 'Clinical Audit & Scan Records',
          breadcrumb: 'Records / Tamper-Evident History',
          org: role === 'admin' ? 'Central FL Hub' : 'Hospital A — Urban Referral',
        };
      default:
        return {
          title: 'Tuberculosis Healthcare Platform',
          breadcrumb: 'Medical AI Platform',
          org: 'PulmoScan Healthcare',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        
        {/* Left: Mobile Toggle & Page Title / Breadcrumbs (Section 6) */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="text-[11px] font-medium text-[#64748B] flex items-center space-x-1.5">
              <span>{headerInfo.breadcrumb}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] leading-tight">
              {headerInfo.title}
            </h1>
          </div>
        </div>

        {/* Right: Health Status, Notifications, Hospital Org, User Profile (Section 6) */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          
          {/* Connection Status: "● System Healthy" */}
          <div className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0FDF4] text-[#16A34A] border border-[#DCFCE7]">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span>System Healthy</span>
          </div>

          {/* Privacy Badge indicator */}
          <div className="hidden lg:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
            <Lock className="w-3 h-3 text-[#0D9488]" />
            <span>Data Kept Local</span>
          </div>

          {/* Organization indicator */}
          <div className="hidden xl:flex items-center space-x-1.5 text-xs text-[#64748B] px-2.5 py-1 rounded-lg bg-slate-50 border border-[#E2E8F0]">
            <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
            <span className="font-medium text-[#0F172A]">{headerInfo.org}</span>
          </div>

          {/* Notification Bell */}
          <button
            className="relative p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 border border-[#E2E8F0] transition"
            title="System notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#2563EB] rounded-full ring-2 ring-white" />
          </button>

          {/* User Profile Chip & Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center space-x-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 border border-[#E2E8F0] transition text-left group"
              title="User Account Menu"
              aria-expanded={profileDropdownOpen}
            >
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs border border-[#DBEAFE] shrink-0">
                {role === 'admin' ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : role === 'patient' ? (
                  <HeartPulse className="w-4 h-4" />
                ) : (
                  <Stethoscope className="w-4 h-4" />
                )}
              </div>

              <div className="hidden sm:block">
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-bold text-[#0F172A] leading-tight truncate max-w-[130px]">
                    {user?.name || 'Authorized Clinician'}
                  </span>
                </div>
                <p className="text-[10px] text-[#64748B] leading-none capitalize">
                  {role === 'doctor'
                    ? 'Pulmonologist'
                    : role === 'admin'
                    ? 'System Admin'
                    : 'Patient'}
                </p>
              </div>

              <ChevronDown className={`w-3.5 h-3.5 text-[#64748B] group-hover:text-[#0F172A] transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {profileDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setProfileDropdownOpen(false)} 
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] py-2 z-50 animate-fade-in text-xs">
                  <div className="px-4 py-3 border-b border-[#F1F5F9]">
                    <div className="font-bold text-[#0F172A] text-sm truncate">{user?.name}</div>
                    <div className="text-[11px] text-[#64748B] truncate">{user?.email}</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE]">
                        {role}
                      </span>
                      {user?.hospital_node && (
                        <span className="text-[10px] text-[#64748B] truncate">
                          {user.hospital_node}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-left text-[#DC2626] hover:bg-rose-50 transition font-semibold"
                    >
                      <LogOut className="w-4 h-4 text-[#DC2626]" />
                      <span>Sign Out / Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
