const cron = require('node-cron');
const prisma = require('../prisma');
const { sendEmail, getMedicationReminderTemplate, retryFailedEmails } = require('./emailService');
const { reconcileExpiredPayments } = require('./paymentService');
const { retryWelcomeEmails } = require('./welcomeEmail');

function startScheduler() {
  console.log('[Scheduler Service] Starting background job cron scheduler...');

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();

      // 1. Clean expired Slot Holds
      await prisma.slotHold.deleteMany({
        where: { expiresAt: { lt: now } },
      });

      // 2. Process Pending Medication Reminders
      const dueReminders = await prisma.medicationReminder.findMany({
        where: {
          isCompleted: false,
          nextRunAt: { lte: now },
        },
        include: { patient: true },
        take: 20,
      });

      for (const rem of dueReminders) {
        console.log(`[Scheduler] Dispatching Medication Reminder for Patient: ${rem.patient.email} | Medicine: ${rem.medicationName}`);

        const html = getMedicationReminderTemplate({
          patientName: rem.patient.name,
          medicationName: rem.medicationName,
          dosage: rem.dosage,
          frequency: rem.frequency,
          instructions: rem.instructions,
        });

        await sendEmail({
          to: rem.patient.email,
          subject: `Medication Reminder: Take ${rem.medicationName} (${rem.dosage})`,
          html,
          type: 'MEDICATION',
        });

        // Compute next run time or complete if one-time
        let nextRun = null;
        if (/every 8 hours/i.test(rem.frequency)) {
          nextRun = new Date(now.getTime() + 8 * 3600 * 1000);
        } else if (/every 12 hours/i.test(rem.frequency) || /twice daily/i.test(rem.frequency)) {
          nextRun = new Date(now.getTime() + 12 * 3600 * 1000);
        } else if (/daily|once daily/i.test(rem.frequency)) {
          nextRun = new Date(now.getTime() + 24 * 3600 * 1000);
        }

        if (nextRun) {
          await prisma.medicationReminder.update({
            where: { id: rem.id },
            data: { nextRunAt: nextRun },
          });
        } else {
          await prisma.medicationReminder.update({
            where: { id: rem.id },
            data: { isCompleted: true },
          });
        }
      }

      // 3. Process Failed Email Retries
      await retryFailedEmails();
      await reconcileExpiredPayments();

    } catch (err) {
      console.error('[Scheduler Error]', err.message);
    }
  }, { noOverlap: true });

  console.log('[Scheduler Service] Background cron tasks initialized.');
  cron.schedule('* * * * *', async () => {
    try {
      await retryWelcomeEmails();
    } catch (error) {
      console.error('[Welcome email retry]', error.name);
    }
  }, { noOverlap: true });
}

module.exports = { startScheduler };
