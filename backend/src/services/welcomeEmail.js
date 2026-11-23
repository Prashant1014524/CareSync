const prisma = require('../prisma');

const SUBJECT = 'Welcome to CareSync';
const BODY = '<h1>Welcome to CareSync</h1><p>Your patient account is ready. Sign in to find a doctor, book an appointment, and view your upcoming visits.</p><p>CareSync Team</p>';
const RETRY_LIMIT = 3;

function welcomeEmailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.WELCOME_EMAIL_FROM);
}

async function queueWelcomeEmail(tx, user) {
  if (!welcomeEmailEnabled()) return null;
  return tx.emailLog.create({
    data: {
      id: `welcome-${user.id}`,
      recipient: user.email,
      subject: SUBJECT,
      body: BODY,
      type: 'WELCOME',
    },
  });
}

async function deliverWelcomeEmail(log) {
  if (!log || !welcomeEmailEnabled()) return;

  const attempt = await prisma.emailLog.updateMany({
    where: { id: log.id, status: log.status, retryCount: log.retryCount },
    data: { retryCount: { increment: 1 }, lastAttempt: new Date() },
  });
  if (attempt.count !== 1) return;

  let error = null;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': log.id,
      },
      body: JSON.stringify({
        from: process.env.WELCOME_EMAIL_FROM,
        to: [log.recipient],
        subject: log.subject,
        html: log.body,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) error = `Resend HTTP ${response.status}`;
  } catch (cause) {
    error = cause.name;
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: { status: error ? 'FAILED' : 'SENT', error },
  });
}

async function retryWelcomeEmails() {
  if (!welcomeEmailEnabled()) return;

  const now = Date.now();
  const pending = await prisma.emailLog.findMany({
    where: {
      type: 'WELCOME',
      status: { in: ['PENDING', 'FAILED'] },
      retryCount: { lt: RETRY_LIMIT },
      lastAttempt: { lt: new Date(now - 60000) },
      createdAt: { gt: new Date(now - 23 * 3600000) },
    },
    orderBy: { lastAttempt: 'asc' },
    take: 10,
  });
  for (const log of pending) await deliverWelcomeEmail(log);
}

async function createPatientAccount(data) {
  if (!welcomeEmailEnabled()) return prisma.user.create({ data });

  const { user, log } = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data });
    const log = await queueWelcomeEmail(tx, user);
    return { user, log };
  });
  deliverWelcomeEmail(log).catch(error => console.error('[Welcome email]', error.name));
  return user;
}

module.exports = { createPatientAccount, retryWelcomeEmails };
