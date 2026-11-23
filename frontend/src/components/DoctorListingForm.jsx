import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const fields = [
  { name: 'name', label: 'Full name', autoComplete: 'name', maxLength: 100 },
  { name: 'email', label: 'Work email', type: 'email', autoComplete: 'email', maxLength: 254 },
  { name: 'specialization', label: 'Specialty', maxLength: 100 },
  { name: 'registrationNumber', label: 'Medical registration number', maxLength: 100 },
  { name: 'clinicName', label: 'Clinic name', autoComplete: 'organization', maxLength: 150 },
  { name: 'clinicAddress', label: 'Clinic address', autoComplete: 'street-address', maxLength: 300, wide: true },
  { name: 'clinicCity', label: 'City', autoComplete: 'address-level2', maxLength: 100 },
  { name: 'clinicPostalCode', label: 'PIN code', autoComplete: 'postal-code', maxLength: 20 },
  { name: 'consultationFee', label: 'Consultation fee (₹)', type: 'number', min: 1, step: '0.01' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', minLength: 12 },
];

export default function DoctorListingForm({ onClose }) {
  const { applyAsDoctor } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    setBusy(true);
    try {
      await applyAsDoctor({ ...values, consultationFee: Number(values.consultationFee) });
      onClose();
    } catch (cause) {
      setError(cause.response?.data?.error || 'Could not submit your practice. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="doctor-listing-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="doctor-listing-title" className="text-xl font-bold text-slate-900">List your practice</h2>
            <p className="mt-1 text-sm text-slate-600">Create a doctor account and submit your clinic for review. Patients can book once your listing is approved.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(({ wide, label, ...input }) => (
            <label key={input.name} className={`text-sm font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
              {label}
              <input required {...input} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          ))}
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          <button disabled={busy} type="submit" className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">
            {busy ? 'Submitting…' : 'Submit practice for review'}
          </button>
        </form>
      </div>
    </div>
  );
}
