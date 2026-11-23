import { useEffect, useState } from 'react';
import { MapPin, Plus, Save, X } from 'lucide-react';
import api from '../services/api';

const blankClinic = () => ({
  name: '', address: '', city: '', postalCode: '', latitude: '', longitude: '',
  startHour: '09:00', endHour: '17:00', slotDurationMinutes: 30, consultationFee: 50,
  weekdays: [1, 2, 3, 4, 5], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
});
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorClinics() {
  const [clinics, setClinics] = useState([]);
  const [form, setForm] = useState(blankClinic);
  const [editingId, setEditingId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const { data } = await api.get('/doctor/clinics');
    setClinics(data.clinics || []);
  }

  useEffect(() => { refresh().catch(() => setError('Could not load clinic schedules.')); }, []);

  function editClinic(assignment) {
    setEditingId(assignment.clinicId);
    setForm({
      ...assignment.clinic,
      latitude: assignment.clinic.latitude ?? '',
      longitude: assignment.clinic.longitude ?? '',
      startHour: assignment.startHour,
      endHour: assignment.endHour,
      slotDurationMinutes: assignment.slotDurationMinutes,
      consultationFee: assignment.consultationFee,
      weekdays: assignment.weekdays,
    });
    setExpanded(true);
    setError('');
    setNotice('');
  }

  function locateClinic() {
    setNotice('');
    if (!navigator.geolocation) return setNotice('Location is unavailable in this browser.');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm(current => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) }));
        setNotice('Location added. Check the pin is at your clinic.');
      },
      () => setNotice('Location access was not granted. You can enter coordinates manually.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const payload = {
      ...form,
      latitude: form.latitude === '' ? '' : Number(form.latitude),
      longitude: form.longitude === '' ? '' : Number(form.longitude),
      slotDurationMinutes: Number(form.slotDurationMinutes),
      consultationFee: Number(form.consultationFee),
    };
    try {
      if (editingId) await api.put(`/doctor/clinics/${editingId}`, payload);
      else await api.post('/doctor/clinics', payload);
      await refresh();
      setEditingId(null);
      setForm(blankClinic());
      setExpanded(false);
      setNotice('Clinic and schedule saved.');
    } catch (cause) {
      setError(cause.response?.data?.error || 'Could not save this clinic.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">Clinics and schedules</h2>
          <p className="text-sm text-slate-600">Set a separate address, location, working days, hours, and fee for each practice.</p>
        </div>
        <button type="button" onClick={() => { setEditingId(null); setForm(blankClinic()); setExpanded(value => !value); setError(''); }} className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white">
          {expanded ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{expanded ? 'Close form' : 'Add clinic'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {clinics.map(assignment => (
          <article key={assignment.clinicId} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{assignment.clinic.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{assignment.clinic.address}, {assignment.clinic.city} {assignment.clinic.postalCode}</p>
                <p className="mt-2 text-xs text-slate-600">{assignment.startHour}–{assignment.endHour} {assignment.clinic.timeZone} · {assignment.slotDurationMinutes} min · ₹{assignment.consultationFee} · {assignment.weekdays.map(day => dayNames[day - 1]).join(', ')}</p>
                {assignment.clinic.latitude == null && <p className="mt-1 text-xs text-amber-700">Add coordinates to appear in nearby searches.</p>}
              </div>
              <button type="button" onClick={() => editClinic(assignment)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</button>
            </div>
          </article>
        ))}
        {!clinics.length && <p className="text-sm text-slate-600">No clinic schedule is linked to this account yet.</p>}
      </div>

      {expanded && <form onSubmit={save} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Clinic name<input required maxLength={150} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">City<input required maxLength={100} value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700 sm:col-span-2">Street address<input required maxLength={300} value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">PIN code<input required maxLength={20} value={form.postalCode} onChange={event => setForm({ ...form, postalCode: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Time zone (IANA)<input required maxLength={100} value={form.timeZone} onChange={event => setForm({ ...form, timeZone: event.target.value })} placeholder="Asia/Kolkata" className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <div className="text-sm font-medium text-slate-700">Location coordinates<button type="button" onClick={locateClinic} className="ml-2 inline-flex items-center gap-1 text-sky-700"><MapPin className="h-4 w-4" />Use this device</button><div className="mt-1 flex gap-2"><input aria-label="Latitude" type="number" min="-90" max="90" step="any" placeholder="Latitude" value={form.latitude} onChange={event => setForm({ ...form, latitude: event.target.value })} className="min-w-0 w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-2" /><input aria-label="Longitude" type="number" min="-180" max="180" step="any" placeholder="Longitude" value={form.longitude} onChange={event => setForm({ ...form, longitude: event.target.value })} className="min-w-0 w-1/2 rounded-lg border border-slate-300 bg-white px-2 py-2" /></div></div>
        <label className="text-sm font-medium text-slate-700">Opens<input required type="time" value={form.startHour} onChange={event => setForm({ ...form, startHour: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Closes<input required type="time" value={form.endHour} onChange={event => setForm({ ...form, endHour: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Slot length (minutes)<input required type="number" min="5" max="240" value={form.slotDurationMinutes} onChange={event => setForm({ ...form, slotDurationMinutes: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <label className="text-sm font-medium text-slate-700">Consultation fee (₹)<input required type="number" min="1" step="0.01" value={form.consultationFee} onChange={event => setForm({ ...form, consultationFee: event.target.value })} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
        <fieldset className="sm:col-span-2"><legend className="text-sm font-medium text-slate-700">Working days</legend><div className="mt-2 flex flex-wrap gap-3">{dayNames.map((day, index) => { const value = index + 1; return <label key={day} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={form.weekdays.includes(value)} onChange={event => setForm({ ...form, weekdays: event.target.checked ? [...form.weekdays, value].sort() : form.weekdays.filter(item => item !== value) })} />{day}</label>; })}</div></fieldset>
        {notice && <p role="status" className="text-sm text-emerald-700 sm:col-span-2">{notice}</p>}
        {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
        <button disabled={busy} type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"><Save className="h-4 w-4" />{busy ? 'Saving…' : editingId ? 'Update clinic' : 'Add clinic and schedule'}</button>
      </form>}
      {notice && !expanded && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
      {error && !expanded && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
