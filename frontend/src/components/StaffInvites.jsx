import { useState } from 'react';
import api from '../services/api';

export default function StaffInvites() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('DOCTOR');
  const [invite, setInvite] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function issueInvite(event) {
    event.preventDefault();
    setBusy(true);
    setInvite(null);
    setMessage('');
    setError('');
    try {
      const { data } = await api.post('/admin/staff-invites', { email, role });
      const link = new URL('/', window.location.origin);
      link.hash = new URLSearchParams({ 'staff-invite': data.code }).toString();
      setInvite({ link: link.href, expiresAt: data.expiresAt });
    } catch (cause) {
      setError(cause.response?.data?.error || 'Could not create an invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(invite.link);
      setMessage('Invitation link copied.');
    } catch {
      setMessage('Select and copy the link below.');
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-slate-900">Invite clinic staff</h2>
      <p className="text-sm text-slate-600">Create a single-use registration link for a doctor or administrator.</p>
      <form onSubmit={issueInvite} className="flex flex-wrap items-end gap-3">
        <label className="flex-auto text-sm font-medium text-slate-700">
          Staff email
          <input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Staff role
          <select value={role} onChange={event => setRole(event.target.value)} className="mt-1 block px-3 py-2 border border-slate-300 rounded-lg">
            <option value="DOCTOR">Doctor</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </label>
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg bg-sky-700 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Creating…' : 'Create invitation'}
        </button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {invite && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Private invitation link
            <input readOnly value={invite.link} className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </label>
          <button type="button" onClick={copyInvite} className="text-sm font-semibold text-sky-800">Copy invitation link</button>
          <p className="text-sm text-slate-600">Share this link privately. It expires on {new Date(invite.expiresAt).toLocaleString()}.</p>
          {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </div>
      )}
    </section>
  );
}
