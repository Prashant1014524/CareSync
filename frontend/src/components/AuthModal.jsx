import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import GoogleSignIn from './GoogleSignIn';
import { X, Lock, Mail, User, Phone } from 'lucide-react';

export default function AuthModal({ onClose, initialMode = 'login', inviteCode = '' }) {
  const { login, register, registerStaff, googleLogin } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [code, setCode] = useState(inviteCode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isStaff = mode === 'staff';
  const isRegister = mode !== 'login';
  const dialogLabel = isStaff ? 'Staff registration' : isRegister ? 'Patient registration' : 'Sign in to CareSync';

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
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5"
      >
        
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            {[
              ['login', 'Sign In'],
              ['register', 'Patient Sign Up'],
              ['staff', 'Staff Sign Up'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => { setMode(value); setPassword(''); setError(null); }}
                className={`px-2 sm:px-3 py-2 rounded-lg transition ${
                  mode === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

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
            ? 'Doctors and administrators sign up with an invitation from their clinic.'
            : isRegister
              ? 'Create an account to book appointments and view your visits.'
              : 'Sign in with the email address associated with your account.'}
        </p>

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
            <label htmlFor="auth-password" className="block font-semibold text-slate-700 mb-1">Password *</label>
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

      </div>
    </div>
  );
}
