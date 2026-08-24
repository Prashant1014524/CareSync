const prisma = require('../prisma');
const { generatePreVisitSummary } = require('./llmService');
const { sendEmail, getBookingConfirmationTemplate } = require('./emailService');
const { createCalendarEvent } = require('./calendarService');

const HOLD_DURATION_MINUTES = 5;

/**
 * Get Available Slots for a Doctor on a specific date (YYYY-MM-DD)
 */
async function getAvailableSlots(doctorId, dateStr, currentPatientId = null) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true },
  });

  if (!doctor || doctor.role !== 'DOCTOR' || !doctor.doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  // Check Doctor Leave
  const leave = await prisma.doctorLeave.findUnique({
    where: {
      doctorId_leaveDate: {
        doctorId,
        leaveDate: dateStr,
      },
    },
  });

  if (leave) {
    return { isDoctorOnLeave: true, leaveReason: leave.reason || 'Doctor on leave', slots: [] };
  }

  const { startHour, endHour, slotDurationMinutes } = doctor.doctorProfile;
  const now = new Date();

  // Clean up expired slot holds first
  await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Calculate start and end of day in UTC
  const [startH, startM] = startHour.split(':').map(Number);
  const [endH, endM] = endHour.split(':').map(Number);

  const dayStart = new Date(`${dateStr}T${startHour}:00.000Z`);
  const dayEnd = new Date(`${dateStr}T${endHour}:00.000Z`);

  // Fetch existing appointments for the day
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: 'BOOKED',
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

  return { isDoctorOnLeave: false, slots };
}

/**
 * Temporarily hold a slot for 5 minutes during patient checkout
 */
async function holdSlot({ doctorId, patientId, slotStartTime }) {
  const now = new Date();
  const startTime = new Date(slotStartTime);
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true },
  });

  if (!doctor || !doctor.doctorProfile) {
    throw new Error('Doctor profile not found');
  }

  const slotDuration = doctor.doctorProfile.slotDurationMinutes;
  const endTime = new Date(startTime.getTime() + slotDuration * 60000);
  const expiresAt = new Date(now.getTime() + HOLD_DURATION_MINUTES * 60000);

  // Clean expired holds
  await prisma.slotHold.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  // Check if slot is already booked
  const existingApp = await prisma.appointment.findFirst({
    where: {
      doctorId,
      startTime,
      status: 'BOOKED',
    },
  });

  if (existingApp) {
    throw new Error('Slot has already been booked by another patient.');
  }

  // Check if held by someone else
  const existingHold = await prisma.slotHold.findFirst({
    where: {
      doctorId,
      slotStartTime: startTime,
      expiresAt: { gt: now },
      patientId: { not: patientId },
    },
  });

  if (existingHold) {
    throw new Error('Slot is currently held by another patient. Please try again in 5 minutes.');
  }

  // Clear any previous hold by this patient for this doctor
  await prisma.slotHold.deleteMany({
    where: { doctorId, patientId },
  });

  // Create new hold
  const hold = await prisma.slotHold.create({
    data: {
      doctorId,
      patientId,
      slotStartTime: startTime,
      slotEndTime: endTime,
      expiresAt,
    },
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
async function bookAppointment({ doctorId, patientId, slotStartTime, symptomsData }) {
  const now = new Date();
  const startTime = new Date(slotStartTime);

  // 1. Generate AI Pre-Visit Summary first (outside transaction so LLM call doesn't hold DB lock)
  const preVisitSummary = await generatePreVisitSummary(symptomsData);

  // 2. Perform Atomic Database Transaction
  const appointment = await prisma.$transaction(async (tx) => {
    // Check doctor profile
    const doctor = await tx.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || !doctor.doctorProfile) {
      throw new Error('Doctor profile not found');
    }

    const dateStr = startTime.toISOString().split('T')[0];

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
        status: 'BOOKED',
      },
    });

    if (existingBooking) {
      throw new Error('DOUBLE_BOOKING_PREVENTED: This slot was just booked by another user. Please select another slot.');
    }

    const slotEndTime = new Date(startTime.getTime() + doctor.doctorProfile.slotDurationMinutes * 60000);

    // Create Appointment
    const app = await tx.appointment.create({
      data: {
        doctorId,
        patientId,
        startTime,
        endTime: slotEndTime,
        status: 'BOOKED',
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

  // 3. Post-transaction external integrations (Google Calendar & Email Notifications)
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
      doctor: { select: { name: true, email: true, doctorProfile: true } },
      patient: { select: { name: true, email: true } },
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
};
