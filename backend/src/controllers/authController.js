const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET } = require('../middleware/authMiddleware');

/**
 * Register User (Patient, Doctor, Admin)
 */
async function register(req, res, next) {
  try {
    const { email, password, name, phone, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    const userRole = (role || 'PATIENT').toUpperCase();
    if (!['ADMIN', 'DOCTOR', 'PATIENT'].includes(userRole)) {
      return res.status(400).json({ error: 'Invalid user role specified.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let createdDoctorProfile = null;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: phone || null,
        role: userRole,
      },
    });

    // If role is DOCTOR, create DoctorProfile
    if (userRole === 'DOCTOR') {
      createdDoctorProfile = await prisma.doctorProfile.create({
        data: {
          userId: user.id,
          specialization: req.body.specialization || 'General Medicine',
          bio: req.body.bio || 'General Healthcare Practitioner',
          startHour: req.body.startHour || '09:00',
          endHour: req.body.endHour || '17:00',
          slotDurationMinutes: Number(req.body.slotDurationMinutes) || 30,
          consultationFee: Number(req.body.consultationFee) || 50.0,
        },
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        doctorProfile: createdDoctorProfile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * User Login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        doctorProfile: user.doctorProfile,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Current Logged-in User Profile
 */
async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { doctorProfile: true },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      doctorProfile: user.doctorProfile,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getProfile,
};
