import { useState } from 'react';
import { MapPin, X } from 'lucide-react';
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
  { name: 'startHour', label: 'Clinic opens', type: 'time', defaultValue: '09:00' },
  { name: 'endHour', label: 'Clinic closes', type: 'time', defaultValue: '17:00' },
  { name: 'slotDurationMinutes', label: 'Appointment length (minutes)', type: 'number', min: 5, max: 240, defaultValue: 30 },
  { name: 'consultationFee', label: 'Consultation fee (₹)', type: 'number', min: 1, step: '0.01' },
  { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', minLength: 12 },
];

export default function DoctorListingForm({ onClose, onSignIn }) {
  const { applyAsDoctor } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState({ latitude: '', longitude: '' });
  const [locationMessage, setLocationMessage] = useState('');
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');

  function useClinicLocation() {
    setLocationMessage('');
    if (!navigator.geolocation) {
      setLocationMessage('Location is unavailable in this browser. Enter coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) });
        setLocationMessage('Clinic coordinates added. Confirm the device is at the clinic.');
      },
      () => setLocationMessage('Location access was not granted. Enter coordinates manually or continue without them.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    values.weekdays = weekdays;
    setError('');
    setBusy(true);
    try {
      await applyAsDoctor({
        ...values,
        consultationFee: Number(values.consultationFee),
        slotDurationMinutes: Number(values.slotDurationMinutes),
        latitude: values.latitude === '' ? '' : Number(values.latitude),
        longitude: values.longitude === '' ? '' : Number(values.longitude),
      });
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
            <button type="button" disabled={busy} onClick={onSignIn} className="mt-3 text-sm font-semibold text-sky-800 underline underline-offset-2">Already registered? Sign in</button>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="timeZone" value={timeZone} />
          {fields.map(({ wide, label, ...input }) => (
            <label key={input.name} className={`text-sm font-medium text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
              {label}
              <input required {...input} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          ))}
          <div className="sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Clinic coordinates (for distance search)</span>
            <button type="button" onClick={useClinicLocation} className="ml-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
              <MapPin className="h-4 w-4" /> Use this device location
            </button>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <input aria-label="Clinic latitude" name="latitude" type="number" min="-90" max="90" step="any" placeholder="Latitude" value={location.latitude} onChange={event => setLocation({ ...location, latitude: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" />
              <input aria-label="Clinic longitude" name="longitude" type="number" min="-180" max="180" step="any" placeholder="Longitude" value={location.longitude} onChange={event => setLocation({ ...location, longitude: event.target.value })} className="rounded-lg border border-slate-300 px-3 py-2" />
            </div>
            <p role="status" className="mt-1 text-xs text-slate-500">{locationMessage || 'Allow location access while at the clinic for accurate nearby results. Coordinates are optional.'}</p>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">Clinic working days</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                const value = index + 1;
                return <label key={day} className="flex items-center gap-1.5 text-sm text-slate-700"><input type="checkbox" checked={weekdays.includes(value)} onChange={event => setWeekdays(event.target.checked ? [...weekdays, value].sort() : weekdays.filter(item => item !== value))} />{day}</label>;
              })}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
          <button disabled={busy} type="submit" className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">
            {busy ? 'Submitting…' : 'Submit practice for review'}
          </button>
        </form>
      </div>
    </div>
  );
}
