const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { verifyGoogleIdentity } = require('../services/googleIdentity.mts');
const { createPatientAccount } = require('../services/welcomeEmail');

/**
 * Register a patient account
 */
async function register(req, res, next) {
  try {
    const { email, password, name, phone, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required.' });
    }

    if (typeof email !== 'string' || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    if (role !== undefined && (typeof role !== 'string' || role.toUpperCase() !== 'PATIENT')) {
      return res.status(400).json({ error: 'Public registration is for patients only.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createPatientAccount({
      email,
      passwordHash,
      name,
      phone: phone || null,
      role: 'PATIENT',
    });

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
        doctorProfile: null,
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

    if (!user?.passwordHash) {
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

async function googleLogin(req, res, next) {
  const clientId = process.env.GOOGLE_SIGN_IN_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: 'Google sign-in is unavailable.' });

  const { credential } = req.body || {};
  if (!req.is('application/json') || typeof credential !== 'string' || !credential || credential.length > 8192) {
    return res.status(400).json({ error: 'A Google credential is required.' });
  }

  let identity;
  try {
    identity = await verifyGoogleIdentity(credential, clientId);
  } catch {
    return res.status(401).json({ error: 'Google sign-in could not be verified.' });
  }
  if (!identity) return res.status(401).json({ error: 'Use a verified Gmail or Google Workspace account.' });

  try {
    let user = await prisma.user.findUnique({ where: { googleSubject: identity.subject } });
    if (!user) {
      try {
        user = await createPatientAccount({
          googleSubject: identity.subject, email: identity.email, name: identity.name, role: 'PATIENT',
        });
      } catch (error) {
        if (error.code !== 'P2002') throw error;
        user = await prisma.user.findUnique({ where: { googleSubject: identity.subject } });
        if (!user) return res.status(409).json({ error: 'An account already uses this email. Sign in with your password.' });
      }
    }

    if (user.role !== 'PATIENT') return res.status(403).json({ error: 'Google sign-in is available for patients.' });

    const { id, email, name, role, phone } = user;
    const token = jwt.sign({ id, email, name, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id, email, name, role, phone, doctorProfile: null } });
  } catch (error) {
    next(error);
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
  googleLogin,
  getProfile,
};
