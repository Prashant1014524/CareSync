const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { queueWelcomeEmail, sendQueuedWelcome } = require('../services/welcomeEmail');

const requiredFields = {
  name: 100,
  email: 254,
  specialization: 100,
  registrationNumber: 100,
  clinicName: 150,
  clinicAddress: 300,
  clinicCity: 100,
  clinicPostalCode: 20,
};

async function applyForListing(req, res, next) {
  const body = req.body || {};
  const fields = {};
  for (const [field, maxLength] of Object.entries(requiredFields)) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (!value || value.length > maxLength) {
      return res.status(400).json({ error: 'Complete all doctor and clinic details within the form limits.' });
    }
    fields[field] = value;
  }

  const email = fields.email.toLowerCase();
  const validEmail = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;
  if (!validEmail.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof body.password !== 'string' || body.password.length < 12 || Buffer.byteLength(body.password) > 72) {
    return res.status(400).json({ error: 'Use a password of at least 12 characters and at most 72 bytes.' });
  }
  if (typeof body.consultationFee !== 'number' || !Number.isFinite(body.consultationFee) ||
      body.consultationFee < 1 || body.consultationFee > 21474836.47) {
    return res.status(400).json({ error: 'Enter a consultation fee of at least ₹1.' });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return res.status(409).json({ error: 'An account already uses this email.' });

    const { name, email: _email, ...practice } = fields;
    const passwordHash = await bcrypt.hash(body.password, 12);
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          name, email, passwordHash, role: 'DOCTOR',
          doctorProfile: {
            create: {
              ...practice,
              consultationFee: Math.round(body.consultationFee * 100) / 100,
              listingStatus: 'PENDING',
            },
          },
        },
        select: { id: true, email: true, name: true, role: true, doctorProfile: true },
      });
      const welcome = await queueWelcomeEmail(tx, user);
      return { user, welcome };
    });
    sendQueuedWelcome(result.welcome);
    const { id, name: accountName, role } = result.user;
    const token = jwt.sign({ id, name: accountName, email, role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: result.user });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'An account already uses this email.' });
    next(error);
  }
}

async function reviewListing(req, res, next) {
  const { status } = req.body || {};
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Choose Approve or Decline.' });
  }
  try {
    const result = await prisma.doctorProfile.updateMany({
      where: { userId: req.params.doctorId, listingStatus: 'PENDING', registrationNumber: { not: null } },
      data: { listingStatus: status },
    });
    if (!result.count) return res.status(409).json({ error: 'This listing is no longer awaiting review.' });
    res.json({ status });
  } catch (error) {
    next(error);
  }
}

module.exports = { applyForListing, reviewListing };
