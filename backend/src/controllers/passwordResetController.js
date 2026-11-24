const { createHash, randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');

const RESET_TTL_MS = 30 * 60 * 1000;
const RESEND_DELAY_MS = 5 * 60 * 1000;
const invalidLink = 'This reset link is invalid or expired. Request a new link.';
const hashToken = token => createHash('sha256').update(token).digest('hex');

function getResetOrigin() {
  if (!process.env.RESEND_API_KEY || !process.env.WELCOME_EMAIL_FROM || !process.env.FRONTEND_URL) return null;
  try {
    const url = new URL(process.env.FRONTEND_URL);
    if (url.protocol === 'https:' || (process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && url.hostname === 'localhost')) {
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

async function emailResetLink(email, origin) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user?.passwordHash) return;

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const now = Date.now();
  const data = { tokenHash, expiresAt: new Date(now + RESET_TTL_MS) };
  const refreshed = await prisma.passwordReset.updateMany({
    where: { userId: user.id, expiresAt: { lte: new Date(now + RESET_TTL_MS - RESEND_DELAY_MS) } },
    data,
  });
  if (!refreshed.count) {
    try {
      await prisma.passwordReset.create({ data: { userId: user.id, ...data } });
    } catch (error) {
      if (error.code === 'P2002') return;
      throw error;
    }
  }

  try {
    const link = new URL('/', origin);
    link.hash = new URLSearchParams({ 'reset-password': token }).toString();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.WELCOME_EMAIL_FROM,
        to: [user.email],
        subject: 'Reset your CareSync password',
        text: `Use this link within 30 minutes to reset your CareSync password:\n\n${link.href}\n\nIf you did not request a reset, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
  } catch (error) {
    await prisma.passwordReset.deleteMany({ where: { userId: user.id, tokenHash } });
    throw error;
  }
}

function forgotPassword(req, res) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const origin = getResetOrigin();
  if (!origin) return res.status(503).json({ error: 'Password reset email is unavailable. Try again later.' });

  // Return the same response before checking whether the account exists.
  res.status(202).json({ message: 'If this email belongs to a password account, you’ll receive a reset link.' });
  emailResetLink(email, origin).catch(error => console.error('[Password reset email]', error.name));
}

async function resetPassword(req, res, next) {
  const { token, password } = req.body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: invalidLink });
  }
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Use a password of at least 12 characters and at most 72 bytes.' });
  }

  try {
    const tokenHash = hashToken(token);
    const reset = await prisma.passwordReset.findUnique({ where: { tokenHash } });
    if (!reset || reset.expiresAt <= new Date()) return res.status(400).json({ error: invalidLink });

    const passwordHash = await bcrypt.hash(password, 12);
    const changed = await prisma.$transaction(async tx => {
      const consumed = await tx.passwordReset.deleteMany({
        where: { userId: reset.userId, tokenHash, expiresAt: { gt: new Date() } },
      });
      if (!consumed.count) return false;
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      });
      return true;
    });
    if (!changed) return res.status(400).json({ error: invalidLink });
    res.json({ message: 'Password updated. Sign in with your new password.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { forgotPassword, resetPassword };
