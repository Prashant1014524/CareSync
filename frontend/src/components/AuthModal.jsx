import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GoogleSignIn from './GoogleSignIn';
import { X, Lock, Mail, User, Phone, Stethoscope } from 'lucide-react';

export default function AuthModal({ onClose, onNavigate, onForgotPassword, mode = 'login', inviteCode = '' }) {
  const { login, register, registerStaff, googleLogin } = useAuth();
  const [code, setCode] = useState(inviteCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isStaff = mode === 'staff';
  const isRegister = mode !== 'login';
  const dialogLabel = isStaff ? 'Staff sign up' : isRegister ? 'Patient sign up' : 'Sign in to CareSync';

  const handleGoogleCredential = async (credential) => {
    setError(null);
    setLoading(true);
    try {
      await googleLogin(credential);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isStaff) {
        await registerStaff({ code: code.trim(), name, password });
      } else if (isRegister) {
        await register({ email, password, name, phone });
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        className="bg-white rounded-2xl max-w-md max-h-[90vh] overflow-y-auto w-full p-6 shadow-2xl space-y-5"
      >
        
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <h2 className="text-xl font-bold text-slate-900">{dialogLabel}</h2>

          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        <p className="text-sm text-slate-600">
          {isStaff
            ? 'Enter the invitation code your CareSync administrator sent you.'
            : isRegister
              ? 'Create an account to book appointments and view your visits.'
              : 'Patients, doctors, and admins sign in here. Doctors use the email and password they registered with.'}
        </p>

        {mode === 'register' && <button
          type="button"
          disabled={loading}
          onClick={() => onNavigate('practice')}
          className="flex w-full items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-left hover:bg-sky-100 disabled:opacity-60"
        >
          <Stethoscope aria-hidden="true" className="h-5 w-5 shrink-0 text-sky-700" />
          <span>
            <span className="block text-sm font-semibold text-sky-900">Doctor Sign Up</span>
            <span className="block text-xs text-sky-800">List your practice</span>
          </span>
        </button>}

        {!isStaff && <GoogleSignIn onCredential={handleGoogleCredential} onError={setError} />}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {isStaff && (
            <div>
              <label htmlFor="staff-code" className="block font-semibold text-slate-700 mb-1">Invitation code</label>
              <input
                id="staff-code"
                type="text"
                required
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          )}
          {isRegister && (
            <>
              <div>
                <label htmlFor="auth-name" className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {!isStaff && <div>
                <label htmlFor="auth-phone" className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    id="auth-phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>}

            </>
          )}

          {!isStaff && <div>
            <label htmlFor="auth-email" className="block font-semibold text-slate-700 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="auth-email"
                type="email"
                autoComplete={isRegister ? 'email' : 'username'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>}

          <div>
            <div className="mb-1 flex justify-between gap-2">
              <label htmlFor="auth-password" className="font-semibold text-slate-700">Password *</label>
              {!isRegister && <button type="button" disabled={loading} onClick={() => onForgotPassword(email)}
                className="font-semibold text-sky-700 hover:underline">Forgot password?</button>}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                minLength={isStaff ? 12 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-2.5 rounded-lg shadow transition"
          >
            {loading ? 'Processing...' : isStaff ? 'Create staff account' : isRegister ? 'Create patient account' : 'Sign In'}
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          <button type="button" disabled={loading} onClick={() => onNavigate(isRegister ? 'login' : 'register')}
            className="font-semibold text-sky-700 hover:underline">
            {isRegister ? 'Already have an account? Sign in' : 'Create an account'}
          </button>
          {isRegister && <button type="button" disabled={loading} onClick={() => onNavigate(isStaff ? 'register' : 'staff')}
            className="font-semibold text-sky-700 hover:underline">
            {isStaff ? 'Patient sign up' : 'Staff sign up'}
          </button>}
        </div>

      </div>
    </div>
  );
}
