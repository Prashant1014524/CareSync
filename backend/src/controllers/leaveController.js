const prisma = require('../prisma');
const { markDoctorLeave, removeDoctorLeave } = require('../services/leaveService');

/**
 * Mark Doctor Leave for a Date (YYYY-MM-DD)
 */
async function addLeave(req, res, next) {
  try {
    const { doctorId, leaveDate, reason } = req.body;
    const targetDoctorId = req.user.role === 'DOCTOR' ? req.user.id : doctorId;

    if (!targetDoctorId || !leaveDate) {
      return res.status(400).json({ error: 'doctorId and leaveDate (YYYY-MM-DD) are required.' });
    }

    const result = await markDoctorLeave({
      doctorId: targetDoctorId,
      leaveDate,
      reason: reason || 'Out of office',
    });

    res.json({
      message: `Doctor marked on leave for ${leaveDate}. ${result.affectedAppointmentsCount} affected appointments cancelled and patients notified.`,
      leave: result.leave,
      affectedAppointmentsCount: result.affectedAppointmentsCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Remove Doctor Leave
 */
async function deleteLeave(req, res, next) {
  try {
    const { doctorId, leaveDate } = req.body;
    const targetDoctorId = req.user.role === 'DOCTOR' ? req.user.id : doctorId;

    if (!targetDoctorId || !leaveDate) {
      return res.status(400).json({ error: 'doctorId and leaveDate are required.' });
    }

    const result = await removeDoctorLeave({ doctorId: targetDoctorId, leaveDate });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/**
 * Get Leaves for a Doctor
 */
async function getDoctorLeaves(req, res, next) {
  try {
    const doctorId = req.user.role === 'DOCTOR' ? req.user.id : req.query.doctorId;
    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId is required.' });
    }

    const leaves = await prisma.doctorLeave.findMany({
      where: { doctorId },
      orderBy: { leaveDate: 'asc' },
    });

    res.json({ leaves });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  addLeave,
  deleteLeave,
  getDoctorLeaves,
};
