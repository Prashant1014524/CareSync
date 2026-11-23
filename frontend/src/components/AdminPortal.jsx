import React, { useState, useEffect } from 'react';
import api from '../services/api';
import StaffInvites from './StaffInvites';
import { Users, Stethoscope, Calendar, Mail, Plus, Edit, ShieldAlert, CheckCircle, Clock } from 'lucide-react';

export default function AdminPortal() {
  const [stats, setStats] = useState(null);
  const [emailLogs, setEmailLogs] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [reviewing, setReviewing] = useState(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const pendingListings = doctors.filter(doctor => doctor.doctorProfile?.listingStatus === 'PENDING');
  
  // Create / Edit Doctor Modal State
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctorId, setEditingDoctorId] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialization, setSpecialization] = useState('Cardiology');
  const [bio, setBio] = useState('');
  const [startHour, setStartHour] = useState('09:00');
  const [endHour, setEndHour] = useState('17:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState(30);
  const [consultationFee, setConsultationFee] = useState(100);

  useEffect(() => {
    fetchStats();
    fetchDoctors();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data.stats);
      setEmailLogs(res.data.emailLogs);
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.get('/admin/doctors');
      setDoctors(res.data.doctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const handleOpenCreateDoctor = () => {
    setEditingDoctorId(null);
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
    setSpecialization('Cardiology');
    setBio('');
    setStartHour('09:00');
    setEndHour('17:00');
    setSlotDurationMinutes(30);
    setConsultationFee(100);
    setShowDoctorModal(true);
  };

  async function reviewListing(doctorId, status) {
    setReviewing(doctorId);
    setReviewMessage('');
    try {
      await api.patch(`/admin/doctors/${doctorId}/listing`, { status });
      setReviewMessage(status === 'APPROVED' ? 'Practice listed.' : 'Application declined.');
      await fetchDoctors();
    } catch (error) {
      setReviewMessage(error.response?.data?.error || 'Could not update the listing.');
    } finally {
      setReviewing(null);
    }
  }

  const handleOpenEditDoctor = (doc) => {
    setEditingDoctorId(doc.id);
    setEmail(doc.email);
    setPassword('');
    setName(doc.name);
    setPhone(doc.phone || '');
    setSpecialization(doc.doctorProfile?.specialization || 'Cardiology');
    setBio(doc.doctorProfile?.bio || '');
    setStartHour(doc.doctorProfile?.startHour || '09:00');
    setEndHour(doc.doctorProfile?.endHour || '17:00');
    setSlotDurationMinutes(doc.doctorProfile?.slotDurationMinutes || 30);
    setConsultationFee(doc.doctorProfile?.consultationFee || 100);
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    try {
      if (editingDoctorId) {
        await api.put(`/admin/doctors/${editingDoctorId}`, {
          name,
          phone,
          specialization,
          bio,
          startHour,
          endHour,
          slotDurationMinutes,
          consultationFee,
        });
        alert('Doctor profile updated successfully!');
      } else {
        await api.post('/admin/doctors', {
          email,
          password,
          name,
          phone,
          specialization,
          bio,
          startHour,
          endHour,
          slotDurationMinutes,
          consultationFee,
        });
        alert('Doctor account created successfully!');
      }
      setShowDoctorModal(false);
      fetchDoctors();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save doctor.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Admin Control Center</h1>
          <p className="text-slate-400 text-xs mt-1">Manage doctor profiles, schedules, and monitor background notification logs</p>
        </div>
        <button
          onClick={handleOpenCreateDoctor}
          className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-sm transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Doctor</span>
        </button>
      </div>

      <StaffInvites />

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">Practice applications</h2>
        {reviewMessage && <p role="status" className="text-sm text-slate-700">{reviewMessage}</p>}
        {pendingListings.length === 0 && <p className="text-sm text-slate-600">No practice applications awaiting review.</p>}
        {pendingListings.map(doctor => {
          const profile = doctor.doctorProfile;
          return (
            <div key={doctor.id} className="flex flex-wrap items-start justify-between gap-4 border-t border-slate-200 pt-4">
              <div className="space-y-1 text-sm text-slate-700">
                <p className="font-semibold">{doctor.name} · {profile.specialization}</p>
                <p>{doctor.email} · ₹{profile.consultationFee} per visit</p>
                <p>Medical registration number {profile.registrationNumber}</p>
                <p>{profile.clinicName}, {profile.clinicAddress}, {profile.clinicCity} {profile.clinicPostalCode}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={reviewing === doctor.id} onClick={() => reviewListing(doctor.id, 'APPROVED')} className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Approve listing</button>
                <button type="button" disabled={reviewing === doctor.id} onClick={() => reviewListing(doctor.id, 'REJECTED')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Decline</button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Analytics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-semibold uppercase block">Total Patients</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.totalPatients}</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-semibold uppercase block">Active Doctors</span>
            <span className="text-2xl font-bold text-sky-600 mt-1 block">{stats.totalDoctors}</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-semibold uppercase block">Total Appointments</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{stats.totalAppointments}</span>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-xs font-semibold uppercase block">Booked / Completed</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">{stats.bookedAppointments} / {stats.completedAppointments}</span>
          </div>
        </div>
      )}

      {/* Doctor Profiles Management Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Stethoscope className="w-5 h-5 text-sky-600" />
          <span>Doctor Roster & Work Schedules</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Doctor Name</th>
                <th className="p-3">Specialization</th>
                <th className="p-3">Working Hours</th>
                <th className="p-3">Slot Duration</th>
                <th className="p-3">Fee</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{doc.name}</td>
                  <td className="p-3 font-semibold text-sky-700">{doc.doctorProfile?.specialization}</td>
                  <td className="p-3 text-slate-600">{doc.doctorProfile?.startHour} - {doc.doctorProfile?.endHour}</td>
                  <td className="p-3 text-slate-600">{doc.doctorProfile?.slotDurationMinutes} mins</td>
                  <td className="p-3 font-bold text-slate-900">₹{doc.doctorProfile?.consultationFee}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => handleOpenEditDoctor(doc)}
                      className="text-sky-600 hover:text-sky-800 font-semibold flex items-center space-x-1 ml-auto"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Email & Retries Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <Mail className="w-5 h-5 text-indigo-600" />
          <span>Notification & Email Audit Logs</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="p-3">Recipient</th>
                <th className="p-3">Type</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Status</th>
                <th className="p-3">Retries</th>
                <th className="p-3">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emailLogs.map((log) => (
                <tr key={log.id}>
                  <td className="p-3 font-medium text-slate-800">{log.recipient}</td>
                  <td className="p-3 font-bold text-slate-600">{log.type}</td>
                  <td className="p-3 text-slate-700 max-w-xs truncate">{log.subject}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      log.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">{log.retryCount}</td>
                  <td className="p-3 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT DOCTOR MODAL */}
      {showDoctorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{editingDoctorId ? 'Edit Doctor Profile' : 'Create New Doctor'}</h2>
            
            <form onSubmit={handleSaveDoctor} className="space-y-3 text-xs">
              {!editingDoctorId && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Password *</label>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Doctor Name *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialization *</label>
                <input type="text" required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Hour</label>
                  <input type="text" value={startHour} onChange={(e) => setStartHour(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Hour</label>
                  <input type="text" value={endHour} onChange={(e) => setEndHour(e.target.value)} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slot Duration (Mins)</label>
                  <input type="number" value={slotDurationMinutes} onChange={(e) => setSlotDurationMinutes(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultation Fee ($)</label>
                  <input type="number" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} className="w-full p-2 border rounded" />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setShowDoctorModal(false)} className="px-4 py-2 border rounded text-slate-600">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-sky-600 text-white font-bold rounded">Save Doctor</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
