import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, Calendar, Clock, Stethoscope, AlertTriangle, CheckCircle, Video, FileText, Pill, ShieldAlert, X, MapPin } from 'lucide-react';

function ClinicLocation({ clinic }) {
  if (!clinic?.name) return null;
  return (
    <div className="text-xs text-slate-600">
      <p className="font-semibold text-slate-800">{clinic.name}</p>
      {(clinic.address || clinic.city || clinic.postalCode) && <p>{[clinic.address, clinic.city, clinic.postalCode].filter(Boolean).join(', ')}</p>}
      {clinic.distanceKm !== null && clinic.distanceKm !== undefined && <p className="mt-1 inline-flex items-center gap-1 font-medium text-emerald-700"><MapPin className="h-3 w-3" />{clinic.distanceKm < 10 ? clinic.distanceKm.toFixed(1) : Math.round(clinic.distanceKm)} km away</p>}
    </div>
  );
}

export default function PatientPortal() {
  const [doctors, setDoctors] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [patientLocation, setPatientLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  
  // Booking modal state
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [isDoctorOnLeave, setIsDoctorOnLeave] = useState(false);
  const [isClinicClosed, setIsClinicClosed] = useState(false);
  const [leaveReason, setLeaveReason] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [holdTimer, setHoldTimer] = useState(null); // seconds left
  const [symptoms, setSymptoms] = useState('');
  const [duration, setDuration] = useState('1-3 days');
  const [severity, setSeverity] = useState('Moderate');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [testCheckout, setTestCheckout] = useState(null);
  const [paymentMessage, setPaymentMessage] = useState(null);

  // Appointments & Reminders tab
  const [activeTab, setActiveTab] = useState('doctors'); // 'doctors', 'appointments', 'reminders'
  const [myAppointments, setMyAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [selectedAppSummary, setSelectedAppSummary] = useState(null);

  useEffect(() => {
    fetchDoctors();
    fetchReminders();
    api.get('/payments/config').then(({ data }) => setTestCheckout(data.testCheckout)).catch(() => {});
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get('appointmentPayment');
    if (paymentId) {
      url.searchParams.delete('appointmentPayment');
      for (const key of [...url.searchParams.keys()]) {
        if (key.startsWith('razorpay_')) url.searchParams.delete(key);
      }
      window.history.replaceState(null, '', url);
      setActiveTab('appointments');
      checkPayment(paymentId, false);
    } else {
      fetchAppointments();
    }
  }, []);

  const checkPayment = async (appointmentId, openCheckout) => {
    setBookingLoading(true);
    setPaymentMessage(null);
    try {
      const { data } = await api.post(`/payments/${appointmentId}/checkout`);
      if (openCheckout && data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.status === 'BOOKED') setPaymentMessage('Payment verified. Your appointment is booked.');
      else if (data.status === 'PAYMENT_PENDING') setPaymentMessage('Payment is pending. You can check again from your appointment.');
      else setPaymentMessage('Check the updated appointment status below.');
    } catch {
      setPaymentMessage('Could not reach checkout. Try again from your appointment.');
    } finally {
      fetchAppointments();
      setBookingLoading(false);
    }
  };

  const fetchDoctors = async (location = patientLocation) => {
    try {
      const res = await api.get(`/appointments/doctors/search`, {
        params: { query: searchQuery, specialization, ...(location || {}) },
      });
      setDoctors(res.data.doctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments/patient');
      setMyAppointments(res.data.appointments);
    } catch (err) {
      console.error('Error fetching patient appointments:', err);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await api.get('/reminders');
      setReminders(res.data.reminders);
    } catch (err) {
      console.error('Error fetching reminders:', err);
    }
  };

  const fetchSlots = async (docId, dateStr, clinicId) => {
    try {
      const res = await api.get(`/appointments/doctors/${docId}/slots`, {
        params: { date: dateStr, ...(clinicId ? { clinicId } : {}) },
      });
      setIsDoctorOnLeave(res.data.isDoctorOnLeave);
      setIsClinicClosed(res.data.isClinicClosed || false);
      setLeaveReason(res.data.leaveReason || (res.data.isClinicClosed ? 'This clinic is closed on the selected day.' : ''));
      setSlots(res.data.slots || []);
    } catch (err) {
      console.error('Error fetching slots:', err);
    }
  };

  const handleSelectDoctor = (doc, clinic) => {
    const clinicDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinic.timeZone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    setBookingDate(clinicDate);
    setSelectedDoctor(doc);
    setSelectedClinic(clinic);
    setSelectedSlot(null);
    setHoldTimer(null);
    setBookingError(null);
    fetchSlots(doc.id, clinicDate, clinic.id);
  };

  const handleDateChange = (e) => {
    const dateVal = e.target.value;
    setBookingDate(dateVal);
    setSelectedSlot(null);
    setHoldTimer(null);
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.id, dateVal, selectedClinic?.id);
    }
  };

  const handleHoldSlot = async (slot) => {
    try {
      setBookingError(null);
      const res = await api.post('/appointments/hold-slot', {
        doctorId: selectedDoctor.id,
        clinicId: selectedClinic?.id || null,
        slotStartTime: slot.startTime,
      });
      setSelectedSlot(slot);
      setHoldTimer(300); // 5 minutes countdown
    } catch (err) {
      setBookingError(err.response?.data?.error || 'Could not reserve slot.');
    }
  };

  // Countdown timer for held slot
  useEffect(() => {
    if (holdTimer === null) return;
    if (holdTimer <= 0) {
      setSelectedSlot(null);
      setHoldTimer(null);
      setBookingError('Slot hold expired. Please select a time slot again.');
      return;
    }
    const interval = setInterval(() => {
      setHoldTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [holdTimer]);

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setBookingLoading(true);
    setBookingError(null);

    try {
      const { data } = await api.post('/appointments/book', {
        doctorId: selectedDoctor.id,
        clinicId: selectedClinic?.id || null,
        slotStartTime: selectedSlot.startTime,
        symptoms,
        duration,
        severity,
        medicalHistory,
      });

      setSelectedDoctor(null);
      setSelectedSlot(null);
      setHoldTimer(null);
      setSymptoms('');
      fetchAppointments();
      setActiveTab('appointments');
      if (data.appointment.status === 'PAYMENT_PENDING') {
        await checkPayment(data.appointment.id, true);
      } else {
        setPaymentMessage('Appointment booked.');
      }
    } catch (err) {
      setBookingError(err.response?.data?.error || 'Failed to complete booking.');
    } finally {
      setBookingLoading(false);
    }
  };

  const useMyLocation = () => {
    setLocationStatus('');
    if (!navigator.geolocation) {
      setLocationStatus('Location is unavailable in this browser. Search by city or PIN code instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude };
        setPatientLocation(location);
        setLocationStatus('Showing clinics nearest to your location.');
        fetchDoctors(location);
      },
      () => setLocationStatus('Location access was not granted. Search by city or PIN code instead.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const toggleReminder = async (remId, currentStatus) => {
    try {
      await api.patch(`/reminders/${remId}/toggle`, { isCompleted: !currentStatus });
      fetchReminders();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('doctors')}
          className={`pb-3 flex items-center space-x-2 border-b-2 font-semibold transition ${
            activeTab === 'doctors' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Find & Book Doctors</span>
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`pb-3 flex items-center space-x-2 border-b-2 font-semibold transition ${
            activeTab === 'appointments' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>My Appointments ({myAppointments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`pb-3 flex items-center space-x-2 border-b-2 font-semibold transition ${
            activeTab === 'reminders' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Pill className="w-4 h-4" />
          <span>Medication Reminders ({reminders.filter(r => !r.isCompleted).length})</span>
        </button>
      </div>

      {/* TAB 1: DOCTORS SEARCH & BOOKING */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          
          {/* Search Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search by doctor, specialty, clinic, city or PIN code"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">All Specializations</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Neurology">Neurology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="General">General Practice</option>
            </select>
            <button
              onClick={fetchDoctors}
              className="bg-sky-600 hover:bg-sky-700 text-white font-medium px-6 py-2 rounded-lg text-sm shadow-sm transition"
            >
              Search
            </button>
            <button type="button" onClick={useMyLocation} className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50">
              <MapPin className="h-4 w-4" /> Near me
            </button>
            {locationStatus && <p role="status" className="basis-full text-xs text-slate-600">{locationStatus}</p>}
          </div>

          {/* Doctors List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.flatMap(doc => doc.clinics.map(clinic => ({ doc, clinic }))).map(({ doc, clinic }) => (
              <div key={`${doc.id}-${clinic.id || 'legacy'}`} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{doc.name}</h3>
                    <span className="inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-800">
                      {doc.doctorProfile?.specialization || 'General'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900">₹{clinic.consultationFee ?? doc.doctorProfile?.consultationFee ?? 50}</span>
                    <span className="text-xs text-slate-500 block">/ visit</span>
                  </div>
                </div>

                <ClinicLocation clinic={clinic} />
                {doc.doctorProfile?.bio && <p className="line-clamp-2 text-xs text-slate-600">{doc.doctorProfile.bio}</p>}

                <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-3">
                  <p><strong>Hours:</strong> {clinic.startHour} - {clinic.endHour} {clinic.timeZone || ''}</p>
                  <p><strong>Slot Duration:</strong> {clinic.slotDurationMinutes} mins</p>
                  <p><strong>Days:</strong> {clinic.weekdays.map(day => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day - 1]).join(', ')}</p>
                </div>

                <button
                  onClick={() => handleSelectDoctor(doc, clinic)}
                  className="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm py-2.5 rounded-lg shadow-sm transition flex items-center justify-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Appointment</span>
                </button>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* BOOKING MODAL */}
      {selectedDoctor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Book Appointment with {selectedDoctor.name}</h2>
                <ClinicLocation clinic={selectedClinic} />
                <p className="text-xs text-slate-500">{selectedDoctor.doctorProfile?.specialization} • ₹{selectedClinic?.consultationFee}</p>
              </div>
              <button onClick={() => setSelectedDoctor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {bookingError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded text-xs text-red-700 flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* Date Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Select Date</label>
              <input
                type="date"
                min={new Intl.DateTimeFormat('en-CA', { timeZone: selectedClinic?.timeZone || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}
                value={bookingDate}
                onChange={handleDateChange}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {/* Doctor Leave Warning */}
            {isDoctorOnLeave || isClinicClosed ? (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-xs text-amber-800">
                <p className="font-bold">{isDoctorOnLeave ? 'Doctor on Leave' : 'Clinic Closed'}</p>
                <p>{isDoctorOnLeave ? `Doctor is unavailable on this date (${leaveReason}). Please select another date.` : leaveReason}</p>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">Available Time Slots</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((slot, idx) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    return (
                      <button
                        key={idx}
                        disabled={!slot.isAvailable}
                        onClick={() => handleHoldSlot(slot)}
                        className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition ${
                          isSelected
                            ? 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300'
                            : slot.isAvailable
                            ? 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                            : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through'
                        }`}
                      >
                        {new Date(slot.startTime).toLocaleTimeString([], { timeZone: selectedClinic?.timeZone || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hold Timer Banner */}
            {selectedSlot && holdTimer !== null && (
              <div className="bg-sky-50 border border-sky-200 p-3 rounded-lg flex justify-between items-center text-xs text-sky-900">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-sky-600 animate-pulse" />
                  <span>Slot reserved for you! Complete form before timer expires.</span>
                </div>
                <span className="font-mono font-bold text-sm text-sky-700">
                  {Math.floor(holdTimer / 60)}:{String(holdTimer % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Pre-Visit Symptom Form */}
            {selectedSlot && (
              <form onSubmit={handleConfirmBooking} className="space-y-4 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Pre-Visit Symptom Form</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Describe your symptoms *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Sharp chest pain after walking, shortness of breath..."
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Symptom Duration</label>
                    <input
                      type="text"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g. 3 days"
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className="w-full p-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Mild">Mild</option>
                      <option value="Moderate">Moderate</option>
                      <option value="Severe">Severe</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relevant Medical History</label>
                  <input
                    type="text"
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    placeholder="e.g. Asthma, High Blood Pressure, Diabetes..."
                    className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-3 rounded-lg shadow-md transition flex items-center justify-center space-x-2"
                >
                  {bookingLoading ? 'Processing booking…' : testCheckout ? 'Continue to Razorpay test checkout' : 'Confirm & Book Appointment'}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

      {/* TAB 2: MY APPOINTMENTS */}
      {activeTab === 'appointments' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Your Appointment History</h2>
          {paymentMessage && <p role="status" className="text-sm text-slate-700">{paymentMessage}</p>}
          
          <div className="grid grid-cols-1 gap-4">
            {myAppointments.map((app) => (
              <div key={app.id} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-3 gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Dr. {app.doctor?.name}</h3>
                    <ClinicLocation clinic={app.clinic || (app.doctor?.doctorProfile?.clinicName ? { name: app.doctor.doctorProfile.clinicName, address: app.doctor.doctorProfile.clinicAddress, city: app.doctor.doctorProfile.clinicCity, postalCode: app.doctor.doctorProfile.clinicPostalCode } : null)} />
                    <p className="text-xs text-slate-500">{app.doctor?.doctorProfile?.specialization} • {new Date(app.startTime).toLocaleString([], { timeZone: app.clinic?.timeZone || 'Asia/Kolkata' })}</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${
                      app.status === 'BOOKED' ? 'bg-sky-100 text-sky-800' :
                      app.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {app.status.replaceAll('_', ' ')}
                    </span>
                    {app.status === 'PAYMENT_PENDING' && (
                      <button
                        type="button"
                        disabled={bookingLoading}
                        onClick={() => checkPayment(app.id, true)}
                        className="bg-sky-700 text-white px-3 py-1 rounded text-xs"
                      >
                        Resume test checkout
                      </button>
                    )}
                    {app.googleMeetLink && (
                      <a
                        href={app.googleMeetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1 rounded-lg flex items-center space-x-1"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Join Meet</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Pre-visit AI Urgency */}
                {app.symptomForm && (
                  <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-700">Pre-Visit AI Urgency: 
                      <span className={`ml-2 px-2 py-0.5 rounded font-bold ${
                        app.symptomForm.urgencyLevel === 'High' ? 'bg-red-100 text-red-700' :
                        app.symptomForm.urgencyLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {app.symptomForm.urgencyLevel}
                      </span>
                    </p>
                    <p className="text-slate-600"><strong>Chief Complaint:</strong> {app.symptomForm.chiefComplaint}</p>
                  </div>
                )}

                {/* Post-visit AI Summary Button */}
                {app.postVisitNote && (
                  <div className="pt-2">
                    <button
                      onClick={() => setSelectedAppSummary(app.postVisitNote)}
                      className="bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span>View Doctor's Summary & Prescription</span>
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      )}

      {/* POST-VISIT SUMMARY MODAL */}
      {selectedAppSummary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Patient Consultation Summary</h2>
              <button onClick={() => setSelectedAppSummary(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-800">
              <div className="bg-sky-50 p-4 rounded-xl border border-sky-100">
                <h3 className="font-bold text-sky-900 mb-1 text-sm">Summary of Care</h3>
                <p className="leading-relaxed">{selectedAppSummary.patientSummary}</p>
              </div>

              {selectedAppSummary.prescriptionNotes && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Prescription Notes</h4>
                  <p className="bg-slate-50 p-3 rounded-lg border border-slate-200">{selectedAppSummary.prescriptionNotes}</p>
                </div>
              )}

              {selectedAppSummary.medicationSchedule && (
                <div>
                  <h4 className="font-bold text-slate-900 mb-2">Medication Schedule</h4>
                  <div className="space-y-2">
                    {JSON.parse(selectedAppSummary.medicationSchedule || '[]').map((med, idx) => (
                      <div key={idx} className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                        <p className="font-bold text-emerald-900">{med.medicationName} ({med.dosage})</p>
                        <p className="text-emerald-700">Frequency: {med.frequency}</p>
                        <p className="text-slate-600 italic mt-1">{med.instructions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MEDICATION REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Active Medication Reminders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reminders.map((rem) => (
              <div key={rem.id} className={`p-5 rounded-xl border transition ${
                rem.isCompleted ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-emerald-200 shadow-sm'
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-slate-900">{rem.medicationName}</h3>
                    <p className="text-xs text-slate-600">{rem.dosage} • {rem.frequency}</p>
                    <p className="text-xs text-slate-400 mt-1">Prescribed by Dr. {rem.appointment?.doctor?.name}</p>
                  </div>
                  <button
                    onClick={() => toggleReminder(rem.id, rem.isCompleted)}
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center space-x-1 ${
                      rem.isCompleted ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{rem.isCompleted ? 'Completed' : 'Mark Taken'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
