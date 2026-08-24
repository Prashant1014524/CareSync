const prisma = require('../prisma');

/**
 * Get Patient Medication Reminders
 */
async function getPatientReminders(req, res, next) {
  try {
    const patientId = req.user.id;
    const reminders = await prisma.medicationReminder.findMany({
      where: { patientId },
      include: {
        appointment: {
          include: {
            doctor: { select: { name: true } },
          },
        },
      },
      orderBy: { nextRunAt: 'asc' },
    });

    res.json({ reminders });
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle Reminder Completion Status
 */
async function toggleReminderStatus(req, res, next) {
  try {
    const { reminderId } = req.params;
    const { isCompleted } = req.body;

    const reminder = await prisma.medicationReminder.findUnique({
      where: { id: reminderId },
    });

    if (!reminder) return res.status(404).json({ error: 'Reminder not found.' });

    if (req.user.role === 'PATIENT' && reminder.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized.' });
    }

    const updated = await prisma.medicationReminder.update({
      where: { id: reminderId },
      data: { isCompleted: isCompleted !== undefined ? isCompleted : !reminder.isCompleted },
    });

    res.json({ message: 'Reminder status updated', reminder: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPatientReminders,
  toggleReminderStatus,
};
