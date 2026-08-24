const prisma = require('../prisma');
const { getAvailableSlots, holdSlot, bookAppointment } = require('../services/slotService');
const { generatePostVisitSummary } = require('../services/llmService');
const { sendEmail, getCancellationTemplate } = require('../services/emailService');
const { deleteCalendarEvent } = require('../services/calendarService');

/**
 * Search Doctors by Specialization or Name
 */
async function searchDoctors(req, res, next) {
  try {
    const { specialization, query } = req.query;

    const whereClause = {
      role: 'DOCTOR',
    };

    if (specialization) {
      whereClause.doctorProfile = {
        specialization: { contains: specialization },
      };
    }

    if (query) {
      whereClause.OR = [
        { name: { contains: query } },
        { doctorProfile: { specialization: { contains: query } } },
      ];
    }

    const doctors = await prisma.user.findMany({
      where: whereClause,
      include: {
        doctorProfile: true,
        doctorLeaves: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ doctors });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Available Slots for a Doctor on a Date
 */
async function getSlots(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: 'Date parameter (YYYY-MM-DD) is required.' });
    }

    const result = await getAvailableSlots(doctorId, date, req.user?.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Temporary Hold Slot (5-minute TTL)
 */
async function reserveSlotHold(req, res, next) {
  try {
    const { doctorId, slotStartTime } = req.body;
    const patientId = req.user.id;

    if (!doctorId || !slotStartTime) {
      return res.status(400).json({ error: 'doctorId and slotStartTime are required.' });
    }

    const hold = await holdSlot({ doctorId, patientId, slotStartTime });
    res.json({
      message: 'Slot temporarily reserved for 5 minutes.',
      hold,
    });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
}

/**
 * Book Appointment with Pre-Visit AI Summary (Double-Booking Protected)
 */
async function confirmBooking(req, res, next) {
  try {
    const { doctorId, slotStartTime, symptoms, duration, severity, medicalHistory } = req.body;
    const patientId = req.user.id;

    if (!doctorId || !slotStartTime || !symptoms) {
      return res.status(400).json({ error: 'doctorId, slotStartTime, and symptoms are required.' });
    }

    const appointment = await bookAppointment({
      doctorId,
      patientId,
      slotStartTime,
      symptomsData: { symptoms, duration, severity, medicalHistory },
    });

    res.status(201).json({
      message: 'Appointment booked successfully.',
      appointment,
    });
  } catch (err) {
    if (err.message.includes('DOUBLE_BOOKING_PREVENTED')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
}

/**
 * Doctor submits Post-Visit Notes -> Generates LLM Summary -> Schedules Medication Reminders
 */
async function submitPostVisitNotes(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { clinicalNotes, diagnosis, prescriptionNotes } = req.body;

    if (!clinicalNotes) {
      return res.status(400).json({ error: 'Clinical notes are required.' });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (req.user.role === 'DOCTOR' && appointment.doctorId !== req.user.id) {
      return res.status(403).json({ error: 'You can only submit notes for your own appointments.' });
    }

    // Generate LLM Post-Visit Summary & Medication Schedule
    const postVisitResult = await generatePostVisitSummary({
      clinicalNotes,
      diagnosis,
      prescriptionNotes,
    });

    // Create or Update PostVisitNote in DB
    const postVisitNote = await prisma.postVisitNote.upsert({
      where: { appointmentId },
      update: {
        clinicalNotes,
        diagnosis,
        prescriptionNotes,
        patientSummary: postVisitResult.patientSummary,
        medicationSchedule: JSON.stringify(postVisitResult.medicationSchedule),
        followUpSteps: JSON.stringify(postVisitResult.followUpSteps),
        rawLlmResponse: postVisitResult.rawLlmResponse,
      },
      create: {
        appointmentId,
        clinicalNotes,
        diagnosis: diagnosis || null,
        prescriptionNotes: prescriptionNotes || null,
        patientSummary: postVisitResult.patientSummary,
        medicationSchedule: JSON.stringify(postVisitResult.medicationSchedule),
        followUpSteps: JSON.stringify(postVisitResult.followUpSteps),
        rawLlmResponse: postVisitResult.rawLlmResponse,
      },
    });

    // Mark appointment as COMPLETED
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });

    // Automatically Schedule Medication Reminders in DB
    const now = new Date();
    await prisma.medicationReminder.deleteMany({ where: { appointmentId } });

    if (Array.isArray(postVisitResult.medicationSchedule)) {
      for (const med of postVisitResult.medicationSchedule) {
        if (med.medicationName) {
          await prisma.medicationReminder.create({
            data: {
              appointmentId,
              patientId: appointment.patientId,
              medicationName: med.medicationName,
              dosage: med.dosage || 'As prescribed',
              frequency: med.frequency || 'Once daily',
              instructions: med.instructions || null,
              nextRunAt: new Date(now.getTime() + 60000), // First reminder in 1 min
              isCompleted: false,
            },
          });
        }
      }
    }

    // Send Post-Visit Email Summary to Patient
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; padding: 24px; border-radius: 8px;">
        <h2 style="color: #0284c7;">Post-Visit Consultation Summary</h2>
        <p>Dear <strong>${appointment.patient.name}</strong>,</p>
        <p>Dr. <strong>${appointment.doctor.name}</strong> has completed your post-visit notes.</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #0284c7; margin: 16px 0;">
          <h3 style="margin-top: 0;">Summary of Care</h3>
          <p>${postVisitResult.patientSummary}</p>
        </div>

        ${postVisitResult.medicationSchedule.length > 0 ? `
          <h3>Medication Schedule</h3>
          <ul>
            ${postVisitResult.medicationSchedule.map(m => `<li><strong>${m.medicationName}</strong> (${m.dosage}) - ${m.frequency}: <em>${m.instructions}</em></li>`).join('')}
          </ul>
        ` : ''}

        ${postVisitResult.followUpSteps.length > 0 ? `
          <h3>Next Steps</h3>
          <ul>
            ${postVisitResult.followUpSteps.map(s => `<li>${s}</li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;

    sendEmail({
      to: appointment.patient.email,
      subject: `Post-Visit Summary & Prescription from Dr. ${appointment.doctor.name}`,
      html: emailHtml,
      type: 'SUMMARY',
    }).catch(e => console.error('[Post Visit Email Error]', e.message));

    res.json({
      message: 'Post-visit note submitted and patient summary generated.',
      postVisitNote,
      postVisitResult,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Patient Appointments
 */
async function getPatientAppointments(req, res, next) {
  try {
    const patientId = req.user.id;
    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: { select: { name: true, email: true, doctorProfile: true } },
        symptomForm: true,
        postVisitNote: true,
        medicationReminders: true,
      },
      orderBy: { startTime: 'desc' },
    });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Doctor Appointments (with Urgency Badge & Pre-Visit AI Summary)
 */
async function getDoctorAppointments(req, res, next) {
  try {
    const doctorId = req.user.role === 'DOCTOR' ? req.user.id : req.query.doctorId;
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required.' });
    }

    const appointments = await prisma.appointment.findMany({
      where: { doctorId },
      include: {
        patient: { select: { id: true, name: true, email: true, phone: true } },
        symptomForm: true,
        postVisitNote: true,
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel Appointment
 */
async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true },
    });

    if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });

    // Authorization check
    if (req.user.role === 'PATIENT' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this appointment.' });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason || 'Cancelled by user',
      },
    });

    if (appointment.googleEventId) {
      deleteCalendarEvent(appointment.googleEventId).catch(e => console.error(e.message));
    }

    // Send cancellation email
    const cancelHtml = getCancellationTemplate({
      recipientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      dateStr: new Date(appointment.startTime).toLocaleString(),
      reason: reason || 'Cancelled by user',
    });

    sendEmail({
      to: appointment.patient.email,
      subject: `Appointment Cancelled - Dr. ${appointment.doctor.name}`,
      html: cancelHtml,
      type: 'CANCELLATION',
    }).catch(e => console.error(e.message));

    res.json({ message: 'Appointment cancelled successfully.', appointment: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  searchDoctors,
  getSlots,
  reserveSlotHold,
  confirmBooking,
  submitPostVisitNotes,
  getPatientAppointments,
  getDoctorAppointments,
  cancelAppointment,
};
