const prisma = require('../prisma');
const { sendEmail, getCancellationTemplate } = require('./emailService');
const { deleteCalendarEvent } = require('./calendarService');

/**
 * Mark Doctor Leave and process cancellations for affected bookings
 */
async function markDoctorLeave({ doctorId, leaveDate, reason }) {
  const doctor = await prisma.user.findUnique({
    where: { id: doctorId },
    include: { doctorProfile: true },
  });

  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Invalid doctor specified.');
  }

  // 1. Create Leave Record
  const leave = await prisma.doctorLeave.upsert({
    where: {
      doctorId_leaveDate: {
        doctorId,
        leaveDate,
      },
    },
    update: { reason },
    create: {
      doctorId,
      leaveDate,
      reason,
    },
  });

  // 2. Find affected appointments on leaveDate
  const dayStart = new Date(`${leaveDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${leaveDate}T23:59:59.999Z`);

  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: 'BOOKED',
      startTime: { gte: dayStart, lte: dayEnd },
    },
    include: {
      patient: true,
      doctor: true,
    },
  });

  let cancelledCount = 0;

  // 3. Process each affected appointment
  for (const app of affectedAppointments) {
    // Update DB status to CANCELLED
    const updated = await prisma.appointment.updateMany({
      where: { id: app.id, status: 'BOOKED' },
      data: {
        status: 'CANCELLED',
        cancelReason: `Doctor marked on leave: ${reason || 'Schedule updated'}`,
      },
    });

    if (!updated.count) continue;
    cancelledCount++;

    // Delete Google Calendar event if exists
    if (app.googleEventId) {
      deleteCalendarEvent(app.googleEventId).catch((e) =>
        console.error(`[Calendar Delete Error] ${e.message}`)
      );
    }

    // Send Cancellation Email to Patient
    const cancelHtml = getCancellationTemplate({
      recipientName: app.patient.name,
      doctorName: app.doctor.name,
      dateStr: new Date(app.startTime).toLocaleString(),
      reason: reason || 'Doctor marked on leave',
    });

    sendEmail({
      to: app.patient.email,
      subject: `Appointment Cancelled - Dr. ${app.doctor.name} on Leave`,
      html: cancelHtml,
      type: 'CANCELLATION',
    }).catch((e) => console.error(`[Email Send Error] ${e.message}`));
  }

  // 4. Remove active slot holds on leave date
  await prisma.slotHold.deleteMany({
    where: {
      doctorId,
      slotStartTime: { gte: dayStart, lte: dayEnd },
    },
  });

  return {
    leave,
    affectedAppointmentsCount: cancelledCount,
  };
}

/**
 * Remove Doctor Leave
 */
async function removeDoctorLeave({ doctorId, leaveDate }) {
  await prisma.doctorLeave.delete({
    where: {
      doctorId_leaveDate: {
        doctorId,
        leaveDate,
      },
    },
  });
  return { message: `Leave for ${leaveDate} removed successfully.` };
}

module.exports = {
  markDoctorLeave,
  removeDoctorLeave,
};
