import React from 'react';
import { Activity, Bell, User, ShieldCheck, Menu } from 'lucide-react';

export default function Navbar({ onToggleSidebar, activeTab }) {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        
        {/* Left branding & mobile sidebar toggle */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">PulmoScan AI</span>
                <span className="bg-sky-500/20 text-sky-400 text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">
                  v2.4 Clinical
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium hidden sm:block">
                Tuberculosis Chest X-Ray AI Diagnostics
              </p>
            </div>
          </div>
        </div>

        {/* Right doctor info & notification badge */}
        <div className="flex items-center space-x-4">
          
          <div className="hidden md:flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>AI Model Status: Active (98.2% Accuracy)</span>
          </div>

          <div className="relative">
            <button 
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sky-400 rounded-full animate-ping"></span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sky-400 rounded-full"></span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-700 hidden sm:block"></div>

          {/* Doctor Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
              <User className="w-5 h-5 text-sky-400" />
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-semibold text-white leading-tight">Dr. Sarah Jenkins</p>
              <p className="text-xs text-slate-400">Pulmonology Specialist</p>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
}
