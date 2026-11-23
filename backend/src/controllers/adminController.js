const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

/**
 * Admin: Create a new Doctor Account & Profile
 */
async function createDoctor(req, res, next) {
  try {
    const { email, password, name, phone, specialization, bio, startHour, endHour, slotDurationMinutes, consultationFee } = req.body;

    if (!email || !password || !name || !specialization) {
      return res.status(400).json({ error: 'Email, password, name, and specialization are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization,
            bio: bio || null,
            startHour: startHour || '09:00',
            endHour: endHour || '17:00',
            slotDurationMinutes: Number(slotDurationMinutes) || 30,
            consultationFee: Number(consultationFee) || 50.0,
          },
        },
      },
      include: { doctorProfile: true },
    });

    res.status(201).json({
      message: 'Doctor profile created successfully',
      doctor: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        doctorProfile: user.doctorProfile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Update Doctor Profile
 */
async function updateDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { name, phone, specialization, bio, startHour, endHour, slotDurationMinutes, consultationFee } = req.body;

    const doctor = await prisma.user.findUnique({
      where: { id: doctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    // Update user info
    if (name || phone) {
      await prisma.user.update({
        where: { id: doctorId },
        data: {
          name: name || doctor.name,
          phone: phone !== undefined ? phone : doctor.phone,
        },
      });
    }

    // Update doctor profile info
    const updatedProfile = await prisma.doctorProfile.upsert({
      where: { userId: doctorId },
      update: {
        specialization: specialization || doctor.doctorProfile?.specialization,
        bio: bio !== undefined ? bio : doctor.doctorProfile?.bio,
        startHour: startHour || doctor.doctorProfile?.startHour,
        endHour: endHour || doctor.doctorProfile?.endHour,
        slotDurationMinutes: slotDurationMinutes ? Number(slotDurationMinutes) : doctor.doctorProfile?.slotDurationMinutes,
        consultationFee: consultationFee !== undefined ? Number(consultationFee) : doctor.doctorProfile?.consultationFee,
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

    const { passwordHash, ...profile } = updatedUser;
    res.json({
      message: 'Doctor profile updated successfully',
      doctor: profile,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List All Doctors
 */
async function getAllDoctors(req, res, next) {
  try {
    const doctors = await prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
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
 * Admin: View Dashboard Analytics & System Logs
 */
async function getAdminStats(req, res, next) {
  try {
    const totalPatients = await prisma.user.count({ where: { role: 'PATIENT' } });
    const totalDoctors = await prisma.user.count({ where: { role: 'DOCTOR' } });
    const totalAppointments = await prisma.appointment.count();
    const bookedAppointments = await prisma.appointment.count({ where: { status: 'BOOKED' } });
    const completedAppointments = await prisma.appointment.count({ where: { status: 'COMPLETED' } });
    const cancelledAppointments = await prisma.appointment.count({ where: { status: 'CANCELLED' } });

    const recentEmailLogs = await prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    res.json({
      stats: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        bookedAppointments,
        completedAppointments,
        cancelledAppointments,
      },
      emailLogs: recentEmailLogs,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDoctor,
  updateDoctor,
  getAllDoctors,
  getAdminStats,
};
