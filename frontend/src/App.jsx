import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PatientPortal from './components/PatientPortal';
import DoctorPortal from './components/DoctorPortal';
import AdminPortal from './components/AdminPortal';
import AuthModal from './components/AuthModal';
import { HeartPulse, Stethoscope, ShieldCheck, ArrowRight } from 'lucide-react';

function DashboardSwitcher({ onOpenAuth }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-8">
        <div className="inline-flex items-center space-x-2 bg-sky-100 text-sky-800 text-xs font-semibold px-3 py-1.5 rounded-full border border-sky-200">
          <HeartPulse className="w-4 h-4 text-sky-600" />
          <span>Next-Generation Healthcare Platform</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Smart Appointments, AI Symptom Analysis & Instant Follow-ups
        </h1>

        <p className="text-slate-600 text-base max-w-2xl mx-auto">
          CareSync connects patients and doctors with AI pre-visit urgency summaries, race-condition protected booking, automatic doctor leave conflict handling, and Google Calendar integration.
        </p>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => onOpenAuth('register')}
            className="bg-sky-600 hover:bg-sky-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg hover:shadow-sky-200 transition flex items-center space-x-2"
          >
            <span>Register & Get Started</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Patient Portal</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Search doctors, hold time slots with live countdown timers, fill pre-visit symptom forms, and receive automated medication reminders.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700 font-bold">
              <Stethoscope className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Doctor Portal</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Review AI pre-visit urgency levels and suggested questions, record post-visit clinical notes, and manage leave schedules.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Admin Portal</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Manage doctor roster, working hours, and slot durations while auditing system notification retries and analytics.
            </p>
          </div>
        </div>

      </div>
    );
  }

  switch (user.role) {
    case 'ADMIN':
      return <AdminPortal />;
    case 'DOCTOR':
      return <DoctorPortal />;
    case 'PATIENT':
    default:
      return <PatientPortal />;
  }
}

export default function App() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  const handleOpenAuth = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar onOpenAuthModal={handleOpenAuth} />
        <main className="flex-1">
          <DashboardSwitcher onOpenAuth={handleOpenAuth} />
        </main>
        {authModalOpen && (
          <AuthModal initialMode={authModalMode} onClose={() => setAuthModalOpen(false)} />
        )}
      </div>
    </AuthProvider>
  );
}
