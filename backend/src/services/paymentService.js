const prisma = require('../prisma');
const razorpay = require('./razorpay.mts');
const { notifyBooking, clinicLocalDate } = require('./slotService');

async function reconcilePayment(payment, link) {
  if (payment.appointment.status !== 'PAYMENT_PENDING') return payment.appointment.status;

  let status;
  let paidAt;
  if (!link) {
    if (payment.expiresAt > new Date()) return 'PAYMENT_PENDING';
    status = 'PAYMENT_EXPIRED';
  } else {
    if (link.reference_id !== payment.appointmentId || link.amount !== payment.amountPaise ||
        link.currency !== 'INR' || (payment.razorpayLinkId && link.id !== payment.razorpayLinkId)) {
      throw new Error('Payment link does not match the stored booking.');
    }
    if (link.status === 'paid' && link.amount_paid === payment.amountPaise) {
      status = 'BOOKED';
      paidAt = new Date();
    } else if (['expired', 'cancelled'].includes(link.status) && link.amount_paid === 0) {
      status = 'PAYMENT_EXPIRED';
    } else {
      return 'PAYMENT_PENDING';
    }
  }

  const updated = await prisma.$transaction(async tx => {
    const { appointment } = payment;
    const leave = paidAt && await tx.doctorLeave.findUnique({
      where: { doctorId_leaveDate: {
        doctorId: appointment.doctorId,
        leaveDate: clinicLocalDate(appointment.startTime, appointment.clinic?.timeZone || 'Asia/Kolkata'),
      } },
    });
    if (leave) status = 'CANCELLED';
    const result = await tx.appointment.updateMany({
      where: { id: payment.appointmentId, status: 'PAYMENT_PENDING' },
      data: { status, cancelReason: leave ? 'Doctor on leave. Contact the clinic for payment review.' : undefined },
    });
    if (result.count && paidAt) {
      await tx.bookingPayment.update({
        where: { appointmentId: payment.appointmentId },
        data: { paidAt, razorpayLinkId: link.id },
      });
    }
    return result.count === 1;
  });

  if (updated && status === 'BOOKED') {
    const summary = await prisma.symptomForm.findUnique({ where: { appointmentId: payment.appointmentId } });
    if (summary) {
      notifyBooking(payment.appointment, summary).catch(error => console.error('[Booking notifications]', error.name));
    }
  }
  if (updated) return status;
  const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: payment.appointmentId } });
  return appointment.status;
}

function loadPayment(appointmentId) {
  return prisma.bookingPayment.findUnique({ where: { appointmentId }, include: { appointment: { include: { clinic: true } } } });
}

async function resolveLink(payment) {
  return payment.razorpayLinkId
    ? razorpay.fetchLink(payment.razorpayLinkId)
    : razorpay.findLink(payment.appointmentId);
}

async function checkout(payment, allowCreate) {
  if (payment.appointment.status !== 'PAYMENT_PENDING') return { status: payment.appointment.status };
  let link = await resolveLink(payment);
  if (!link && allowCreate && payment.expiresAt.getTime() > Date.now() + 15 * 60000) {
    try {
      link = await razorpay.createLink(payment.appointmentId, payment.amountPaise, payment.expiresAt);
    } catch (error) {
      // The provider may have created the link before timing out or rejecting a duplicate reference.
      link = await razorpay.findLink(payment.appointmentId);
      if (!link) throw error;
    }
  }
  const status = await reconcilePayment(payment, link);
  if (status !== 'PAYMENT_PENDING' || !link || link.status !== 'created' || payment.expiresAt <= new Date()) {
    return { status };
  }

  await prisma.bookingPayment.update({
    where: { appointmentId: payment.appointmentId },
    data: { razorpayLinkId: link.id },
  });
  const redirect = new URL(link.short_url);
  if (redirect.protocol !== 'https:' || !['rzp.io', 'razorpay.com', 'pay.razorpay.com'].includes(redirect.hostname)) {
    throw new Error('Invalid Razorpay checkout URL.');
  }
  return { status, checkoutUrl: redirect.href };
}

async function reconcileExpiredPayments() {
  if (!razorpay.paymentEnabled()) return;
  const overdue = await prisma.bookingPayment.findMany({
    where: { expiresAt: { lte: new Date() }, appointment: { status: 'PAYMENT_PENDING' } },
    include: { appointment: true },
    take: 10,
  });
  for (const payment of overdue) {
    try {
      await reconcilePayment(payment, await resolveLink(payment));
    } catch (error) {
      console.error('[Payment reconciliation]', error.name);
    }
  }
}

module.exports = { checkout, loadPayment, reconcilePayment, reconcileExpiredPayments };
