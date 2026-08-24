import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, Phone, Stethoscope, UserPlus, LogIn } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const { login, register, quickDemoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [role, setRole] = useState('PATIENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('General Practice');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register({ email, password, name, phone, role, specialization });
        alert(`Account created successfully! Logged in as ${role}: ${name}`);
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
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
        
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          {/* Tab Switcher */}
          <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null); }}
              className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 ${
                !isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null); }}
              className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 ${
                isRegister ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register Account</span>
            </button>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Quick Demo Login Preset Buttons */}
        {!isRegister && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
            <span className="font-bold text-slate-700 block">Instant Demo Sign-in:</span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => { quickDemoLogin('admin@clinic.com', 'admin123'); onClose(); }}
                className="bg-indigo-600 text-white font-medium py-1.5 rounded hover:bg-indigo-700 transition"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => { quickDemoLogin('dr.smith@clinic.com', 'doc123'); onClose(); }}
                className="bg-sky-600 text-white font-medium py-1.5 rounded hover:bg-sky-700 transition"
              >
                Doctor
              </button>
              <button
                type="button"
                onClick={() => { quickDemoLogin('patient1@example.com', 'patient123'); onClose(); }}
                className="bg-emerald-600 text-white font-medium py-1.5 rounded hover:bg-emerald-700 transition"
              >
                Patient
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {isRegister && (
            <>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Account Type *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'PATIENT', label: 'Patient' },
                    { id: 'DOCTOR', label: 'Doctor' },
                    { id: 'ADMIN', label: 'Admin' },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`py-2 rounded-lg font-bold uppercase transition border ${
                        role === r.id ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Alex Vance or Jane Smith"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {role === 'DOCTOR' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medical Specialization *</label>
                  <div className="relative">
                    <Stethoscope className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="e.g. Cardiology, Dermatology, Pediatrics..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Password *</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="password"
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
            {loading ? 'Processing...' : isRegister ? `Create ${role.toLowerCase()} Account` : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
}
