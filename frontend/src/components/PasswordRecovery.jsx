import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function PasswordRecovery({ mode, token, initialEmail, onClose, onNavigate }) {
  const { logout } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const isReset = mode === 'reset';
  const title = isReset ? 'Set a new password' : 'Forgot your password?';
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (isReset && password !== confirmation) {
      setError('The passwords must match.');
      return;
    }
    setBusy(true);
    try {
      const { data } = isReset
        ? await api.post('/auth/reset-password', { token, password })
        : await api.post('/auth/forgot-password', { email });
      if (isReset) {
        setPassword('');
        setConfirmation('');
        logout();
      }
      setNotice(data.message);
    } catch (cause) {
      setError(cause.response?.data?.error || 'Could not complete the request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="password-recovery-title"
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="password-recovery-title" className="text-xl font-bold text-slate-900">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="text-slate-500 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice ? (
          <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm text-slate-800">{notice}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {isReset ? (
              <>
                <p className="text-sm text-slate-600">Choose a password with at least 12 characters.</p>
                <label className="block text-sm font-medium text-slate-700">
                  New password
                  <input className={inputClass} type="password" autoComplete="new-password" required
                    minLength={12} value={password} onChange={event => setPassword(event.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Confirm new password
                  <input className={inputClass} type="password" autoComplete="new-password" required
                    value={confirmation} onChange={event => setConfirmation(event.target.value)} />
                </label>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600">Enter your account email. If you joined with Google, use Continue with Google on the sign-in screen.</p>
                <label className="block text-sm font-medium text-slate-700">
                  Email address
                  <input className={inputClass} type="email" autoComplete="email" required
                    maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
                </label>
              </>
            )}
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-sky-700 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Please wait…' : isReset ? 'Save new password' : 'Send reset link'}
            </button>
          </form>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <button type="button" disabled={busy} onClick={() => onNavigate('login')} className="font-semibold text-sky-700 hover:underline">
            Back to sign in
          </button>
          {isReset && !notice && <button type="button" disabled={busy} onClick={() => onNavigate('forgot')} className="font-semibold text-sky-700 hover:underline">
            Request a new link
          </button>}
        </div>
      </section>
    </div>
  );
}
