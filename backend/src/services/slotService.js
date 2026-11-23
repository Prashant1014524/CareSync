const prisma = require('../prisma');
const { generatePreVisitSummary } = require('./llmService');
const { sendEmail, getBookingConfirmationTemplate } = require('./emailService');
const { createCalendarEvent } = require('./calendarService');
const { publicDoctorProfile } = require('./doctorListing');

const HOLD_DURATION_MINUTES = 5;

function getClinicSchedule(doctor, clinicId) {
  const assignments = doctor.doctorClinics || [];
  if (assignments.length) {
    const assignment = clinicId ? assignments.find(item => item.clinicId === clinicId) : assignments[0];
    if (!assignment) throw Object.assign(new Error('This doctor is not available at the selected clinic.'), { statusCode: 404 });
    return { ...assignment, clinicId: assignment.clinicId, clinic: assignment.clinic, timeZone: assignment.clinic.timeZone };
  }
  if (clinicId) throw Object.assign(new Error('This clinic is not available for booking.'), { statusCode: 404 });
  return { ...doctor.doctorProfile, clinicId: null, clinic: null, timeZone: 'Asia/Kolkata', weekdays: [1, 2, 3, 4, 5, 6, 7] };
}

function dateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function localTimeToUtc(dateStr, timeStr, timeZone) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = dateTimeParts(new Date(candidate), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    candidate += target - represented;
  }
  const check = dateTimeParts(new Date(candidate), timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) {
    throw Object.assign(new Error('This clinic time does not exist on the selected date because of a time-zone clock change.'), { statusCode: 409 });
  }
  return new Date(candidate);
}

function clinicLocalDate(date, timeZone) {
  const parts = dateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function validateScheduledSlot(startTime, schedule) {
  if (!Number.isFinite(startTime.getTime())) throw Object.assign(new Error('Choose a valid appointment time.'), { statusCode: 400 });
  if (startTime <= new Date()) throw Object.assign(new Error('Choose a future appointment time.'), { statusCode: 409 });
  const local = dateTimeParts(startTime, schedule.timeZone || 'Asia/Kolkata');
  const dateStr = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const weekday = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay() || 7;
  const dayStart = localTimeToUtc(dateStr, schedule.startHour, schedule.timeZone || 'Asia/Kolkata');
  const dayEnd = localTimeToUtc(dateStr, schedule.endHour, schedule.timeZone || 'Asia/Kolkata');
  const durationMs = schedule.slotDurationMinutes * 60000;
  if (!schedule.weekdays.includes(weekday) || startTime < dayStart ||
      startTime >= dayEnd || (startTime.getTime() - dayStart.getTime()) % durationMs !== 0 ||
      startTime.getTime() + durationMs > dayEnd.getTime()) {
    throw Object.assign(new Error('Choose a time within this clinic’s published schedule.'), { statusCode: 409 });
  }
}

/**
 * Get Available Slots for a Doctor on a specific date (YYYY-MM-DD)
 */
async function getAvailableSlots(doctorId, dateStr, currentPatientId = null, clinicId = null) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true, doctorClinics: { include: { clinic: true } } },
  });

  if (doctor?.role !== 'DOCTOR' || doctor.doctorProfile?.listingStatus !== 'APPROVED') {
    throw Object.assign(new Error('Doctor is unavailable for booking.'), { statusCode: 404 });
  }

  const schedule = getClinicSchedule(doctor, clinicId);
  const { startHour, endHour, slotDurationMinutes, weekdays } = schedule;
  const clinicDate = dateStr;

  // Check Doctor Leave for the clinic's local calendar date.
  const leave = await prisma.doctorLeave.findUnique({
    where: {
      doctorId_leaveDate: {
        doctorId,
        leaveDate: clinicDate,
      },
    },
  });

  if (leave) {
    return { isDoctorOnLeave: true, leaveReason: leave.reason || 'Doctor on leave', slots: [] };
  }

  const requestedWeekday = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay() || 7;
  if (!weekdays.includes(requestedWeekday)) {
    return { isDoctorOnLeave: false, isClinicClosed: true, clinic: schedule.clinic, slots: [] };
  }
  const now = new Date();

  // Clean up expired slot holds first
  await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Convert the clinic's wall-clock hours into instants for database lookups.
  const timeZone = schedule.timeZone || 'Asia/Kolkata';
  const dayStart = localTimeToUtc(dateStr, startHour, timeZone);
  const dayEnd = localTimeToUtc(dateStr, endHour, timeZone);

  // Fetch existing appointments for the day
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: { in: ['BOOKED', 'COMPLETED', 'PAYMENT_PENDING'] },
      startTime: { gte: dayStart, lt: dayEnd },
    },
  });

  // Fetch active slot holds for the day
  const activeHolds = await prisma.slotHold.findMany({
    where: {
      doctorId,
      expiresAt: { gt: now },
      slotStartTime: { gte: dayStart, lt: dayEnd },
    },
  });

  // Generate slots
  const slots = [];
  let currentSlotStart = new Date(dayStart);

  while (currentSlotStart < dayEnd) {
    const currentSlotEnd = new Date(currentSlotStart.getTime() + slotDurationMinutes * 60000);
    if (currentSlotEnd > dayEnd) break;

    const slotStartISO = currentSlotStart.toISOString();

    // Check collision with existing bookings
    const isBooked = existingAppointments.some(
      (app) => new Date(app.startTime).getTime() === currentSlotStart.getTime()
    );

    // Check collision with active slot holds
    const hold = activeHolds.find(
      (h) => new Date(h.slotStartTime).getTime() === currentSlotStart.getTime()
    );

    const isHeldByOther = hold && hold.patientId !== currentPatientId;
    const isHeldByMe = hold && hold.patientId === currentPatientId;
    const isPast = currentSlotStart < now;

    const isAvailable = !isBooked && !isHeldByOther && !isPast;

    slots.push({
      startTime: slotStartISO,
      endTime: currentSlotEnd.toISOString(),
      isAvailable,
      isBooked,
      isHeld: !!hold,
      isHeldByMe: !!isHeldByMe,
      holdExpiresAt: hold ? hold.expiresAt : null,
    });

    currentSlotStart = currentSlotEnd;
  }

  return { isDoctorOnLeave: false, isClinicClosed: false, clinic: schedule.clinic, slots };
}

/**
 * Temporarily hold a slot for 5 minutes during patient checkout
 */
async function holdSlot({ doctorId, patientId, slotStartTime, clinicId }) {
  const now = new Date();
  const startTime = new Date(slotStartTime);
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true, doctorClinics: { include: { clinic: true } } },
  });

  if (doctor?.role !== 'DOCTOR' || doctor.doctorProfile?.listingStatus !== 'APPROVED') {
    throw new Error('Doctor is unavailable for booking.');
  }

  const schedule = getClinicSchedule(doctor, clinicId);
  validateScheduledSlot(startTime, schedule);
  const slotDuration = schedule.slotDurationMinutes;
  const endTime = new Date(startTime.getTime() + slotDuration * 60000);
  const expiresAt = new Date(now.getTime() + HOLD_DURATION_MINUTES * 60000);

  const hold = await prisma.$transaction(async (tx) => {
    // The unique (doctor, slot) key is the final arbiter when two requests race.
    await tx.slotHold.deleteMany({
      where: { doctorId, slotStartTime: startTime, expiresAt: { lte: now } },
    });

    const existingApp = await tx.appointment.findFirst({
      where: {
        doctorId,
        startTime,
        status: { in: ['BOOKED', 'COMPLETED', 'PAYMENT_PENDING'] },
      },
    });
    if (existingApp) {
      throw new Error('Slot has already been booked by another patient.');
    }

    const existingHold = await tx.slotHold.findUnique({
      where: { doctorId_slotStartTime: { doctorId, slotStartTime: startTime } },
    });
    if (existingHold && existingHold.patientId !== patientId) {
      throw new Error('Slot is currently held by another patient. Please try again in 5 minutes.');
    }

    // Each patient may hold one slot per doctor; only move their hold after this
    // requested slot has been confirmed available inside the transaction.
    await tx.slotHold.deleteMany({
      where: { doctorId, patientId, slotStartTime: { not: startTime } },
    });

    if (existingHold) {
      return tx.slotHold.update({
        where: { id: existingHold.id },
        data: { clinicId: schedule.clinicId, slotEndTime: endTime, expiresAt },
      });
    }

    return tx.slotHold.create({
      data: { doctorId, patientId, clinicId: schedule.clinicId, slotStartTime: startTime, slotEndTime: endTime, expiresAt },
    });
  });

  return {
    holdId: hold.id,
    expiresAt: hold.expiresAt,
    slotStartTime: hold.slotStartTime,
  };
}

/**
 * Confirm & Book Slot with Double-Booking Prevention (Atomic DB Transaction)
 */
async function bookAppointment({ doctorId, patientId, slotStartTime, clinicId, symptomsData, requirePayment = false }) {
  const now = new Date();
  const startTime = new Date(slotStartTime);

  // 1. Generate AI Pre-Visit Summary first (outside transaction so LLM call doesn't hold DB lock)
  const preVisitSummary = await generatePreVisitSummary(symptomsData);

  // 2. Perform Atomic Database Transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // Check doctor profile
    const doctor = await tx.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true, doctorClinics: { include: { clinic: true } } },
    });

    if (doctor?.role !== 'DOCTOR' || doctor.doctorProfile?.listingStatus !== 'APPROVED') {
      throw Object.assign(new Error('Doctor is unavailable for booking.'), { statusCode: 404 });
    }

    const schedule = getClinicSchedule(doctor, clinicId);
    validateScheduledSlot(startTime, schedule);
    const dateStr = clinicLocalDate(startTime, schedule.timeZone || 'Asia/Kolkata');

    // Verify doctor is not on leave
    const leave = await tx.doctorLeave.findUnique({
      where: {
        doctorId_leaveDate: {
          doctorId,
          leaveDate: dateStr,
        },
      },
    });

    if (leave) {
      throw new Error(`Doctor is on leave on ${dateStr}. Booking cannot be completed.`);
    }

    // Verify slot is NOT already booked (Double-Booking Check)
    const existingBooking = await tx.appointment.findFirst({
      where: {
        doctorId,
        startTime,
        status: { in: ['BOOKED', 'COMPLETED', 'PAYMENT_PENDING'] },
      },
    });

    if (existingBooking) {
      throw new Error('DOUBLE_BOOKING_PREVENTED: This slot was just booked by another user. Please select another slot.');
    }

    const slotEndTime = new Date(startTime.getTime() + schedule.slotDurationMinutes * 60000);
    let payment;
    if (requirePayment) {
      const expiresAt = new Date(Date.now() + 20 * 60000);
      if (startTime <= expiresAt) {
        throw Object.assign(new Error('Choose a slot at least 20 minutes from now.'), { statusCode: 409 });
      }
      const hold = await tx.slotHold.findFirst({
        where: { doctorId, patientId, clinicId: schedule.clinicId, slotStartTime: startTime, expiresAt: { gt: new Date() } },
      });
      const { startHour, endHour, slotDurationMinutes, consultationFee } = schedule;
      const dayStart = localTimeToUtc(dateStr, startHour, schedule.timeZone || 'Asia/Kolkata');
      const dayEnd = localTimeToUtc(dateStr, endHour, schedule.timeZone || 'Asia/Kolkata');
      const aligned = (startTime - dayStart) % (slotDurationMinutes * 60000) === 0;
      if (!hold || !aligned || startTime < dayStart || slotEndTime > dayEnd) {
        throw Object.assign(new Error('Select an available slot and reserve it again.'), { statusCode: 409 });
      }
      const amountPaise = Math.round(consultationFee * 100);
      if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > 2147483647) {
        throw Object.assign(new Error('This doctor has an invalid consultation fee.'), { statusCode: 409 });
      }
      payment = { create: { amountPaise, expiresAt } };
    }

    // Create Appointment
    const app = await tx.appointment.create({
      data: {
        doctorId,
        patientId,
        clinicId: schedule.clinicId,
        startTime,
        endTime: slotEndTime,
        status: requirePayment ? 'PAYMENT_PENDING' : 'BOOKED',
        payment,
      },
    });

    // Store Symptom Form & Pre-Visit Summary
    await tx.symptomForm.create({
      data: {
        appointmentId: app.id,
        symptoms: symptomsData.symptoms,
        duration: symptomsData.duration || null,
        severity: symptomsData.severity || null,
        medicalHistory: symptomsData.medicalHistory || null,
        urgencyLevel: preVisitSummary.urgencyLevel,
        chiefComplaint: preVisitSummary.chiefComplaint,
        suggestedQuestions: JSON.stringify(preVisitSummary.suggestedQuestions),
        rawLlmResponse: preVisitSummary.rawLlmResponse,
      },
    });

    // Remove slot hold for this patient
    await tx.slotHold.deleteMany({
      where: { doctorId, patientId },
    });

    return app;
  });

  if (requirePayment) return appointment;
  return notifyBooking(appointment, preVisitSummary);
}

async function notifyBooking(appointment, preVisitSummary) {
  const { doctorId, patientId } = appointment;
  const patient = await prisma.user.findUnique({ where: { id: patientId } });
  const doctor = await prisma.user.findUnique({ where: { id: doctorId }, include: { doctorProfile: true } });

  // Create Google Calendar event
  const calendarResult = await createCalendarEvent({
    summary: `Doctor Consultation: ${patient.name} & Dr. ${doctor.name}`,
    description: `Pre-visit Urgency: ${preVisitSummary.urgencyLevel}\nChief Complaint: ${preVisitSummary.chiefComplaint}`,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    patientEmail: patient.email,
    doctorEmail: doctor.email,
  });

  // Update appointment with Google Calendar details
  const updatedApp = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      googleEventId: calendarResult.googleEventId,
      googleMeetLink: calendarResult.googleMeetLink,
    },
    include: {
      doctor: { select: { name: true, email: true, doctorProfile: publicDoctorProfile } },
      patient: { select: { name: true, email: true } },
      clinic: true,
      symptomForm: true,
    },
  });

  // Send Confirmation Email to Patient
  const emailHtml = getBookingConfirmationTemplate({
    patientName: patient.name,
    doctorName: doctor.name,
    specialization: doctor.doctorProfile?.specialization || 'General Healthcare',
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    meetLink: calendarResult.googleMeetLink,
  });

  sendEmail({
    to: patient.email,
    subject: `Booking Confirmed with Dr. ${doctor.name}`,
    html: emailHtml,
    type: 'CONFIRMATION',
  }).catch((e) => console.error('[Email Send Background Error]', e.message));

  // Also notify doctor
  sendEmail({
    to: doctor.email,
    subject: `New Patient Appointment: ${patient.name} [Urgency: ${preVisitSummary.urgencyLevel}]`,
    html: `<p>New appointment booked with <strong>${patient.name}</strong> on ${new Date(appointment.startTime).toLocaleString()}. Chief complaint: ${preVisitSummary.chiefComplaint}</p>`,
    type: 'CONFIRMATION',
  }).catch((e) => console.error('[Doctor Email Send Error]', e.message));

  return updatedApp;
}

module.exports = {
  getAvailableSlots,
  holdSlot,
  bookAppointment,
  notifyBooking,
  clinicLocalDate,
  localTimeToUtc,
};
