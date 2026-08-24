const prisma = require('../prisma');

/**
 * Get logged-in Doctor Profile
 */
async function getProfile(req, res, next) {
  try {
    const doctorId = req.user.id;
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ error: 'Doctor profile not found.' });
    }

    res.json({ doctor });
  } catch (err) {
    next(err);
  }
}

/**
 * Update Doctor Profile (Self)
 */
async function updateProfile(req, res, next) {
  try {
    const doctorId = req.user.id;
    const { name, phone, specialization, bio, startHour, endHour, slotDurationMinutes, consultationFee } = req.body;

    // Update user info
    if (name || phone !== undefined) {
      await prisma.user.update({
        where: { id: doctorId },
        data: {
          name: name || undefined,
          phone: phone !== undefined ? phone : undefined,
        },
      });
    }

    // Update or create doctor profile
    const profile = await prisma.doctorProfile.upsert({
      where: { userId: doctorId },
      update: {
        specialization: specialization || undefined,
        bio: bio !== undefined ? bio : undefined,
        startHour: startHour || undefined,
        endHour: endHour || undefined,
        slotDurationMinutes: slotDurationMinutes ? Number(slotDurationMinutes) : undefined,
        consultationFee: consultationFee !== undefined ? Number(consultationFee) : undefined,
      },
      create: {
        userId: doctorId,
        specialization: specialization || 'General Practitioner',
        bio: bio || null,
        startHour: startHour || '09:00',
        endHour: endHour || '17:00',
        slotDurationMinutes: Number(slotDurationMinutes) || 30,
        consultationFee: Number(consultationFee) || 50.0,
      },
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true },
    });

    res.json({
      message: 'Doctor profile updated successfully',
      doctor: updatedUser,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
};
