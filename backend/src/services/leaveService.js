const prisma = require('../prisma');
const { sendEmail, getCancellationTemplate } = require('./emailService');
const { deleteCalendarEvent } = require('./calendarService');
const { clinicLocalDate, localTimeToUtc } = require('./slotService');

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
  const nextDate = new Date(`${leaveDate}T12:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateString = nextDate.toISOString().slice(0, 10);
  const clinicAssignments = await prisma.doctorClinic.findMany({
    where: { doctorId },
    select: { clinic: { select: { timeZone: true } } },
  });
  const timeZones = [...new Set(clinicAssignments.map(item => item.clinic.timeZone).concat('Asia/Kolkata'))];
  const dayRanges = timeZones.map(timeZone => ({
    start: localTimeToUtc(leaveDate, '00:00', timeZone),
    end: localTimeToUtc(nextDateString, '00:00', timeZone),
  }));
  const rangeStart = new Date(Math.min(...dayRanges.map(range => range.start.getTime())));
  const rangeEnd = new Date(Math.max(...dayRanges.map(range => range.end.getTime())));

  const affectedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      status: 'BOOKED',
      startTime: { gte: rangeStart, lt: rangeEnd },
    },
    include: {
      patient: true,
      doctor: true,
      clinic: true,
    },
  });
  const affectedForLocalDate = affectedAppointments.filter(app =>
    clinicLocalDate(app.startTime, app.clinic?.timeZone || 'Asia/Kolkata') === leaveDate
  );

  let cancelledCount = 0;

  // 3. Process each affected appointment
  for (const app of affectedForLocalDate) {
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
      dateStr: new Date(app.startTime).toLocaleString('en-IN', { timeZone: app.clinic?.timeZone || 'Asia/Kolkata' }),
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
  const holds = await prisma.slotHold.findMany({
    where: {
      doctorId,
      slotStartTime: { gte: rangeStart, lt: rangeEnd },
    },
    include: { clinic: true },
  });
  const holdIds = holds.filter(hold => clinicLocalDate(hold.slotStartTime, hold.clinic?.timeZone || 'Asia/Kolkata') === leaveDate).map(hold => hold.id);
  if (holdIds.length) await prisma.slotHold.deleteMany({ where: { id: { in: holdIds } } });

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
