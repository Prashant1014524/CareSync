import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Stethoscope, User, LogOut, ShieldAlert, HeartPulse, UserCheck, UserPlus } from 'lucide-react';

export default function Navbar({ onOpenAuthModal }) {
  const { user, logout, quickDemoLogin } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">CareSync</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Healthcare Platform
              </span>
            </div>
          </div>

          {/* User Controls & Demo Switcher */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            
            {/* Quick Demo Login Switcher */}
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium px-2">Demo Roles:</span>
              <button
                onClick={() => quickDemoLogin('admin@clinic.com', 'admin123')}
                className={`px-2 py-1 rounded font-medium transition ${user?.role === 'ADMIN' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
              >
                Admin
              </button>
              <button
                onClick={() => quickDemoLogin('dr.smith@clinic.com', 'doc123')}
                className={`px-2 py-1 rounded font-medium transition ${user?.role === 'DOCTOR' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
              >
                Doctor
              </button>
              <button
                onClick={() => quickDemoLogin('patient1@example.com', 'patient123')}
                className={`px-2 py-1 rounded font-medium transition ${user?.role === 'PATIENT' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white'}`}
              >
                Patient
              </button>
            </div>

            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 py-1.5 px-3 rounded-lg">
                  {user.role === 'ADMIN' && <ShieldAlert className="w-4 h-4 text-indigo-600" />}
                  {user.role === 'DOCTOR' && <Stethoscope className="w-4 h-4 text-sky-600" />}
                  {user.role === 'PATIENT' && <HeartPulse className="w-4 h-4 text-emerald-600" />}
                  <span className="text-sm font-semibold text-slate-800">{user.name}</span>
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                    user.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' :
                    user.role === 'DOCTOR' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {user.role}
                  </span>
                </div>

                <button
                  onClick={logout}
                  title="Sign out"
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenAuthModal('login')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 transition flex items-center space-x-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => onOpenAuthModal('register')}
                  className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition flex items-center space-x-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Register Account</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
}
