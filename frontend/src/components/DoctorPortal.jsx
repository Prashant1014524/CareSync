import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Calendar, Clock, AlertTriangle, FileText, CheckCircle, Video, User, PlusCircle, X, ShieldAlert, Edit, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DoctorPortal() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  
  // Doctor Profile Editing State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [doctorProfileData, setDoctorProfileData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    specialization: '',
    bio: '',
    startHour: '09:00',
    endHour: '17:00',
    slotDurationMinutes: 30,
    consultationFee: 100,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Post-visit note modal state
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Doctor Leave State
  const [leaves, setLeaves] = useState([]);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveMessage, setLeaveMessage] = useState(null);

  useEffect(() => {
    fetchAppointments();
    fetchLeaves();
    fetchMyProfile();
  }, []);

  const fetchMyProfile = async () => {
    try {
      const res = await api.get('/doctor/profile');
      const doc = res.data.doctor;
      if (doc) {
        setDoctorProfileData({
          name: doc.name || '',
          phone: doc.phone || '',
          specialization: doc.doctorProfile?.specialization || 'Cardiology',
          bio: doc.doctorProfile?.bio || '',
          startHour: doc.doctorProfile?.startHour || '09:00',
          endHour: doc.doctorProfile?.endHour || '17:00',
          slotDurationMinutes: doc.doctorProfile?.slotDurationMinutes || 30,
          consultationFee: doc.doctorProfile?.consultationFee || 100,
        });
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/doctor/profile', doctorProfileData);
      alert('Your doctor profile and consultation schedule have been updated!');
      setShowProfileModal(false);
      fetchMyProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/doctor');
      setAppointments(res.data.appointments);
    } catch (err) {
      console.error('Error fetching doctor appointments:', err);
    }
  };

  const fetchLeaves = async () => {
    try {
      const res = await api.get('/leave/doctor');
      setLeaves(res.data.leaves);
    } catch (err) {
      console.error('Error fetching doctor leaves:', err);
    }
  };

  const handleOpenNoteModal = (app) => {
    setSelectedApp(app);
    setClinicalNotes(app.postVisitNote?.clinicalNotes || '');
    setDiagnosis(app.postVisitNote?.diagnosis || '');
    setPrescriptionNotes(app.postVisitNote?.prescriptionNotes || '');
  };

  const handleSubmitPostVisitNote = async (e) => {
    e.preventDefault();
    if (!selectedApp) return;

    setSubmittingNote(true);
    try {
      await api.post(`/appointments/${selectedApp.id}/post-visit`, {
        clinicalNotes,
        diagnosis,
        prescriptionNotes,
      });

      alert('Post-visit note submitted! LLM Patient Summary and Medication Reminders generated.');
      setSelectedApp(null);
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit post-visit note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleAddLeave = async (e) => {
    e.preventDefault();
    if (!leaveDate) return;

    try {
      const res = await api.post('/leave/mark', {
        leaveDate,
        reason: leaveReason,
      });
      setLeaveMessage(res.data.message);
      setLeaveDate('');
      setLeaveReason('');
      fetchLeaves();
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark leave.');
    }
  };

  const handleRemoveLeave = async (lDate) => {
    try {
      await api.post('/leave/remove', { leaveDate: lDate });
      fetchLeaves();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-sky-700 to-indigo-700 rounded-2xl p-6 text-white shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Doctor Consultation Portal</h1>
          <p className="text-sky-100 text-sm mt-1">
            {doctorProfileData.specialization} • Working Hours: {doctorProfileData.startHour} - {doctorProfileData.endHour}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowProfileModal(true)}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-xl backdrop-blur transition flex items-center space-x-1.5"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Profile & Schedule</span>
          </button>
          <div className="bg-white/10 px-4 py-2 rounded-xl text-center backdrop-blur">
            <span className="text-2xl font-bold block">{appointments.filter(a => a.status === 'BOOKED').length}</span>
            <span className="text-xs text-sky-200">Scheduled Visits</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT 2 COLS: APPOINTMENT QUEUE */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-sky-600" />
            <span>Scheduled Patient Appointments</span>
          </h2>

          <div className="space-y-4">
            {appointments.map((app) => {
              const symptomForm = app.symptomForm;
              const questions = symptomForm?.suggestedQuestions ? JSON.parse(symptomForm.suggestedQuestions) : [];
              const isHighUrgency = symptomForm?.urgencyLevel === 'High';

              return (
                <div key={app.id} className={`bg-white rounded-xl border p-6 shadow-sm space-y-4 ${
                  isHighUrgency ? 'border-l-8 border-l-red-500 border-slate-200' : 'border-slate-200'
                }`}>
                  
                  {/* Top Bar */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center space-x-3">
                        <h3 className="font-bold text-slate-900 text-base">{app.patient?.name}</h3>
                        {symptomForm && (
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            symptomForm.urgencyLevel === 'High' ? 'bg-red-100 text-red-800 animate-pulse' :
                            symptomForm.urgencyLevel === 'Medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            Urgency: {symptomForm.urgencyLevel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(app.startTime).toLocaleString()} • {app.patient?.email} • {app.patient?.phone || 'No phone'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                        app.status === 'BOOKED' ? 'bg-sky-100 text-sky-800' :
                        app.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {app.status}
                      </span>
                      {app.googleMeetLink && (
                        <a
                          href={app.googleMeetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1 rounded-lg flex items-center space-x-1"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Meet</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* AI Pre-Visit Summary Card */}
                  {symptomForm && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">AI Pre-Visit Symptom Summary</span>
                        <span className="text-slate-400">Duration: {symptomForm.duration || 'N/A'}</span>
                      </div>

                      <p className="text-slate-700"><strong>Chief Complaint:</strong> {symptomForm.chiefComplaint}</p>
                      <p className="text-slate-600"><strong>Symptoms Raw:</strong> {symptomForm.symptoms}</p>

                      {questions.length > 0 && (
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <p className="font-semibold text-sky-900 mb-1">Suggested Questions for Doctor:</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-slate-700">
                            {questions.map((q, idx) => (
                              <li key={idx}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => handleOpenNoteModal(app)}
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center space-x-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>{app.postVisitNote ? 'Edit Post-Visit Notes' : 'Complete Visit & Add Notes'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COL: LEAVE MANAGEMENT */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span>Mark Doctor Leave</span>
            </h2>

            <p className="text-xs text-slate-500">
              Setting leave automatically cancels existing bookings for that date and sends email notifications to affected patients.
            </p>

            {leaveMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-800">
                {leaveMessage}
              </div>
            )}

            <form onSubmit={handleAddLeave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Leave Date</label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Medical Conference"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-lg transition"
              >
                Mark Leave & Notify Patients
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h3 className="text-xs font-bold text-slate-800">Scheduled Leaves</h3>
              {leaves.map((l) => (
                <div key={l.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs">
                  <div>
                    <span className="font-semibold text-slate-800">{l.leaveDate}</span>
                    <span className="text-slate-500 block">{l.reason || 'Leave'}</span>
                  </div>
                  <button onClick={() => handleRemoveLeave(l.leaveDate)} className="text-red-500 hover:text-red-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* DOCTOR PROFILE EDIT MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Edit Doctor Profile & Hours</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Doctor Name</label>
                <input
                  type="text"
                  required
                  value={doctorProfileData.name}
                  onChange={(e) => setDoctorProfileData({ ...doctorProfileData, name: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specialization</label>
                <input
                  type="text"
                  required
                  value={doctorProfileData.specialization}
                  onChange={(e) => setDoctorProfileData({ ...doctorProfileData, specialization: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Professional Bio</label>
                <textarea
                  rows={2}
                  value={doctorProfileData.bio}
                  onChange={(e) => setDoctorProfileData({ ...doctorProfileData, bio: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Start Hour (e.g. 09:00)</label>
                  <input
                    type="text"
                    value={doctorProfileData.startHour}
                    onChange={(e) => setDoctorProfileData({ ...doctorProfileData, startHour: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">End Hour (e.g. 17:00)</label>
                  <input
                    type="text"
                    value={doctorProfileData.endHour}
                    onChange={(e) => setDoctorProfileData({ ...doctorProfileData, endHour: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Slot Duration (Mins)</label>
                  <input
                    type="number"
                    value={doctorProfileData.slotDurationMinutes}
                    onChange={(e) => setDoctorProfileData({ ...doctorProfileData, slotDurationMinutes: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consultation Fee ($)</label>
                  <input
                    type="number"
                    value={doctorProfileData.consultationFee}
                    onChange={(e) => setDoctorProfileData({ ...doctorProfileData, consultationFee: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button type="button" onClick={() => setShowProfileModal(false)} className="px-4 py-2 border rounded-lg text-slate-600">Cancel</button>
                <button type="submit" disabled={savingProfile} className="px-4 py-2 bg-sky-600 text-white font-bold rounded-lg shadow">
                  {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POST-VISIT SUBMISSION MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Post-Visit Clinical Notes</h2>
                <p className="text-xs text-slate-500">Patient: {selectedApp.patient?.name}</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmitPostVisitNote} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clinical Notes *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter detailed clinical examination findings..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnosis</label>
                <input
                  type="text"
                  placeholder="e.g. Acute Bronchitis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prescription & Medication Schedule</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Amoxicillin 500mg - Twice daily for 7 days after meals..."
                  value={prescriptionNotes}
                  onChange={(e) => setPrescriptionNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg text-slate-700">
                <p className="font-semibold text-sky-900">Automated AI Processing:</p>
                <p>Submitting will generate a patient-friendly summary, structure the medication schedule, and set background reminders.</p>
              </div>

              <button
                type="submit"
                disabled={submittingNote}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-lg shadow-md transition"
              >
                {submittingNote ? 'Generating Summary & Reminders...' : 'Save & Send Summary to Patient'}
              </button>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
