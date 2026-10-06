import React, { useState } from 'react';
import {
  Activity,
  Lock,
  Mail,
  User,
  ShieldCheck,
  Stethoscope,
  HeartPulse,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('doctor');
  const [regLicense, setRegLicense] = useState('');
  const [regPatientHash, setRegPatientHash] = useState('');
  const [regHospital, setRegHospital] = useState('Node A - Urban Referral');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const res = await login(loginEmail, loginPassword);
      if (!res.success) {
        setErrorMessage(res.error || 'Invalid email or password.');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const generatedPatientHash = regRole === 'patient' 
        ? (regPatientHash.trim() || `PT-${Math.floor(1000 + Math.random() * 9000)}`) 
        : null;

      const res = await register({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        license_number: regRole === 'doctor' ? regLicense : null,
        patient_hash: generatedPatientHash,
        hospital_node: regHospital,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Registration failed.');
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred during account creation.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdminCredentials = () => {
    setActiveTab('login');
    setLoginEmail('admin@pulmoscan.org');
    setLoginPassword('AdminPass123!');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Ambient Shapes */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-blue-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        {/* Brand Logo & Header */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2563EB] text-white shadow-lg shadow-blue-500/25 mb-4">
          <Activity className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
          PulmoScan FL
        </h1>
        <p className="mt-1 text-sm font-medium text-[#64748B]">
          Privacy-Preserving Federated Clinical AI Platform
        </p>

        {/* Security / HIPAA badge */}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F0FDFA] text-[#0F766E] border border-[#CCFBF1]">
          <Lock className="w-3.5 h-3.5 text-[#0D9488]" />
          <span>Local Edge Processing · HIPAA Safe Harbor Anonymization</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-white py-8 px-6 shadow-[0_4px_24px_rgba(15,23,42,0.08)] rounded-3xl border border-[#E2E8F0] sm:px-10">
          
          {/* Admin System Access Helper Card */}
          <div className="mb-6 p-3.5 rounded-2xl bg-slate-50 border border-[#E2E8F0] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-[#0F172A]">System Administrator Credentials</div>
                <div className="text-[11px] text-[#64748B] font-mono">
                  admin@pulmoscan.org &middot; AdminPass123!
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={fillAdminCredentials}
              className="text-[11px] font-bold text-[#2563EB] hover:text-[#1D4ED8] bg-white px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] shadow-2xs hover:bg-slate-50 transition shrink-0"
            >
              Fill Admin
            </button>
          </div>

          {/* Navigation Tabs (Only Sign In & Create Account - No Role Switcher) */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6 border border-[#E2E8F0] text-xs font-semibold">
            <button
              type="button"
              onClick={() => { setActiveTab('login'); setErrorMessage(''); }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${
                activeTab === 'login'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('register'); setErrorMessage(''); }}
              className={`flex-1 py-2.5 rounded-lg transition-all ${
                activeTab === 'register'
                  ? 'bg-white text-[#0F172A] shadow-xs font-bold'
                  : 'text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#F0FDF4] border border-[#DCFCE7] text-xs text-[#16A34A] flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
          )}

          {/* 1. SIGN IN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="clinician@hospital.org"
                    className="block w-full pl-10 pr-3 py-2.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-[#94A3B8]" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="block w-full pl-10 pr-10 py-2.5 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB] transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In to Session</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-[#F1F5F9] text-center">
                <p className="text-xs text-[#64748B]">
                  New clinician or patient?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="font-bold text-[#2563EB] hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Dr. Jordan Hayes"
                    className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                    Account Role
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none bg-white font-medium"
                  >
                    <option value="doctor">Doctor (Clinical Review)</option>
                    <option value="patient">Patient (Health Portal)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="user@hospital.org"
                  className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                />
              </div>

              {regRole === 'doctor' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                    Medical License / NPI #
                  </label>
                  <input
                    type="text"
                    value={regLicense}
                    onChange={(e) => setRegLicense(e.target.value)}
                    placeholder="MD-88392-PULM"
                    className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                  />
                </div>
              )}

              {regRole === 'patient' && (
                <div>
                  <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                    Patient Pseudonym / MRN (e.g. PT-1001)
                  </label>
                  <input
                    type="text"
                    value={regPatientHash}
                    onChange={(e) => setRegPatientHash(e.target.value)}
                    placeholder="PT-1001"
                    className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider mb-1">
                  Hospital Node Location
                </label>
                <input
                  type="text"
                  value={regHospital}
                  onChange={(e) => setRegHospital(e.target.value)}
                  placeholder="Node A - Urban Referral"
                  className="block w-full px-3 py-2 text-xs text-[#0F172A] border border-[#CBD5E1] rounded-xl focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none placeholder-[#94A3B8]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-[#2563EB] hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2563EB] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Complete Registration'}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-[#F1F5F9] text-center">
                <p className="text-xs text-[#64748B]">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('login')}
                    className="font-bold text-[#2563EB] hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-[#94A3B8]">
          PulmoScan Healthcare &copy; 2026. Cryptographically secured federated learning framework.
        </p>
      </div>
    </div>
  );
}
