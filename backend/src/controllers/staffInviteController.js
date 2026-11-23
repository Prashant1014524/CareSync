const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { queueWelcomeEmail, sendQueuedWelcome } = require('../services/welcomeEmail');

const hashToken = token => createHash('sha256').update(token).digest('hex');
const invalidInvite = { error: 'This invitation is invalid, expired, or already used.' };

async function issueStaffInvite(req, res, next) {
  const { email, role } = req.body || {};
  if (typeof email !== 'string' || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email.trim()) ||
      !['DOCTOR', 'ADMIN'].includes(role)) {
    return res.status(400).json({ error: 'Provide a valid email and select Doctor or Admin.' });
  }

  try {
    const invitedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: invitedEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUser) return res.status(409).json({ error: 'An account already uses this email.' });

    const code = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const invite = { tokenHash: hashToken(code), role, expiresAt, createdById: req.user.id };
    await prisma.staffInvite.upsert({
      where: { email: invitedEmail },
      create: { ...invite, email: invitedEmail },
      update: { ...invite, consumedAt: null },
    });
    res.status(201).json({ code, expiresAt });
  } catch (error) {
    next(error);
  }
}

async function registerStaff(req, res, next) {
  const { code, name, password } = req.body || {};
  if (typeof code !== 'string' || !/^[\w-]{43}$/.test(code)) {
    return res.status(400).json(invalidInvite);
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
      typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Enter your name and a password of at least 12 characters and at most 72 bytes.' });
  }

  try {
    const tokenHash = hashToken(code);
    const invite = await prisma.staffInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.consumedAt || invite.expiresAt <= new Date()) {
      return res.status(400).json(invalidInvite);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async tx => {
      const { count } = await tx.staffInvite.updateMany({
        where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (!count) return null;

      const user = await tx.user.create({
        data: {
          email: invite.email,
          role: invite.role,
          name: name.trim(),
          passwordHash,
          ...(invite.role === 'DOCTOR' && {
            doctorProfile: { create: { specialization: 'General Medicine' } },
          }),
        },
        select: { id: true, email: true, role: true, name: true, phone: true, doctorProfile: true },
      });
      const welcome = await queueWelcomeEmail(tx, user);
      return { user, welcome };
    });
    if (!result) return res.status(400).json(invalidInvite);

    const { user, welcome } = result;
    sendQueuedWelcome(welcome);
    const { id, email, role, name: accountName } = user;
    const token = jwt.sign({ id, email, role, name: accountName }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ error: 'An account already uses this email.' });
    next(error);
  }
}

module.exports = { issueStaffInvite, registerStaff };
