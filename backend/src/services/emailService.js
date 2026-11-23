const nodemailer = require('nodemailer');
const prisma = require('../prisma');

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && host.trim() !== '') {
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user, pass },
    });
    console.log(`[Email Service] Configured with SMTP host: ${host}`);
  } else {
    // Zero-config Ethereal Test Transporter
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[Email Service] Operating with Ethereal Test Account (${testAccount.user})`);
    } catch (err) {
      console.warn('[Email Service] Could not create Ethereal account, falling back to mock logger:', err.message);
    }
  }

  return transporter;
}

/**
 * Send an email and log the result to DB
 */
async function sendEmail({ to, subject, html, type = 'GENERAL' }) {
  if (process.env.EMAIL_DISABLED === 'true') {
    return { success: false, error: 'Email delivery is disabled.' };
  }

  let status = 'PENDING';
  let errorMsg = null;

  try {
    const activeTransporter = await getTransporter();
    if (activeTransporter) {
      const info = await activeTransporter.sendMail({
        from: process.env.SMTP_FROM || 'Healthcare App <no-reply@healthcareapp.com>',
        to,
        subject,
        html,
      });

      status = 'SENT';
      console.log(`[Email Sent] To: ${to} | Subject: ${subject} | MessageID: ${info.messageId}`);
      if (nodemailer.getTestMessageUrl && info) {
        console.log(`[Email Preview URL]: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } else {
      status = 'SENT'; // Mock success
      console.log(`[Mock Email] To: ${to} | Subject: ${subject}`);
    }
  } catch (err) {
    status = 'FAILED';
    errorMsg = err.message;
    console.error(`[Email Failed] To: ${to} | Subject: ${subject} | Error: ${err.message}`);
  }

  // Record in Database EmailLog
  try {
    await prisma.emailLog.create({
      data: {
        recipient: to,
        subject,
        body: html,
        type,
        status,
        retryCount: status === 'SENT' ? 0 : 1,
        lastAttempt: new Date(),
        error: errorMsg,
      },
    });
  } catch (logErr) {
    console.error('[Email Log Error]', logErr.message);
  }

  return { success: status === 'SENT', error: errorMsg };
}

/**
 * Retry failed emails
 */
async function retryFailedEmails() {
  if (process.env.EMAIL_DISABLED === 'true') return;

  const MAX_RETRIES = 3;
  const failedLogs = await prisma.emailLog.findMany({
    where: {
      status: 'FAILED',
      type: { not: 'WELCOME' },
      retryCount: { lt: MAX_RETRIES },
    },
    take: 10,
  });

  for (const log of failedLogs) {
    console.log(`[Retrying Email] ID: ${log.id} | Recipient: ${log.recipient} | Attempt: ${log.retryCount + 1}`);
    const activeTransporter = await getTransporter();
    try {
      if (activeTransporter) {
        await activeTransporter.sendMail({
          from: process.env.SMTP_FROM || 'Healthcare App <no-reply@healthcareapp.com>',
          to: log.recipient,
          subject: log.subject,
          html: log.body,
        });

        await prisma.emailLog.update({
          where: { id: log.id },
          data: {
            status: 'SENT',
            retryCount: log.retryCount + 1,
            lastAttempt: new Date(),
            error: null,
          },
        });
        console.log(`[Retry Succeeded] Log ID: ${log.id}`);
      }
    } catch (err) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          retryCount: log.retryCount + 1,
          lastAttempt: new Date(),
          error: err.message,
        },
      });
      console.error(`[Retry Failed] Log ID: ${log.id} | Error: ${err.message}`);
    }
  }
}

// HTML Template Generators
function getBookingConfirmationTemplate({ patientName, doctorName, specialization, startTime, endTime, meetLink }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #0284c7; color: white; padding: 20px; text-align: center;">
        <h2>Healthcare Appointment Confirmation</h2>
      </div>
      <div style="padding: 24px; color: #333;">
        <p>Dear <strong>${patientName}</strong>,</p>
        <p>Your appointment with <strong>Dr. ${doctorName}</strong> (${specialization}) has been successfully confirmed!</p>
        <div style="background-color: #f8fafc; padding: 16px; border-left: 4px solid #0284c7; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${new Date(startTime).toLocaleString()}</p>
          <p style="margin: 4px 0;"><strong>Doctor:</strong> Dr. ${doctorName}</p>
          ${meetLink ? `<p style="margin: 4px 0;"><strong>Google Meet Video Link:</strong> <a href="${meetLink}">${meetLink}</a></p>` : ''}
        </div>
        <p>Please log in to your patient portal to review pre-visit notes and instructions.</p>
        <p>Best regards,<br>Healthcare Management Team</p>
      </div>
    </div>
  `;
}

function getCancellationTemplate({ recipientName, doctorName, dateStr, reason }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
        <h2>Appointment Cancellation Notice</h2>
      </div>
      <div style="padding: 24px; color: #333;">
        <p>Dear <strong>${recipientName}</strong>,</p>
        <p>We regret to inform you that your appointment scheduled for <strong>${dateStr}</strong> with Dr. ${doctorName} has been cancelled.</p>
        <div style="background-color: #fef2f2; padding: 16px; border-left: 4px solid #ef4444; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Reason:</strong> ${reason || 'Doctor Leave / Schedule Conflict'}</p>
        </div>
        <p>You can log into your portal to select a new appointment slot at your convenience.</p>
        <p>We apologize for any inconvenience caused.</p>
      </div>
    </div>
  `;
}

function getMedicationReminderTemplate({ patientName, medicationName, dosage, frequency, instructions }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
        <h2>Medication Reminder</h2>
      </div>
      <div style="padding: 24px; color: #333;">
        <p>Hello <strong>${patientName}</strong>,</p>
        <p>This is your automated reminder to take your prescribed medication:</p>
        <div style="background-color: #f0fdf4; padding: 16px; border-left: 4px solid #10b981; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>Medication:</strong> ${medicationName}</p>
          <p style="margin: 4px 0;"><strong>Dosage:</strong> ${dosage}</p>
          <p style="margin: 4px 0;"><strong>Frequency:</strong> ${frequency}</p>
          ${instructions ? `<p style="margin: 4px 0;"><strong>Instructions:</strong> ${instructions}</p>` : ''}
        </div>
        <p>Stay consistent with your treatment plan for a healthy recovery!</p>
      </div>
    </div>
  `;
}

module.exports = {
  sendEmail,
  retryFailedEmails,
  getBookingConfirmationTemplate,
  getCancellationTemplate,
  getMedicationReminderTemplate,
};
