const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const razorpay = require('../services/razorpay.mts');
const { checkout, loadPayment, reconcilePayment } = require('../services/paymentService');

const router = express.Router();
router.get('/config', (_req, res) => res.json({ testCheckout: razorpay.paymentEnabled() }));

router.post('/:appointmentId/checkout', authenticate, authorize('PATIENT'), async (req, res, next) => {
  try {
    const payment = await loadPayment(req.params.appointmentId);
    if (payment?.appointment.patientId !== req.user.id) {
      return res.status(404).json({ error: 'Payment booking not found.' });
    }
    if (!razorpay.paymentEnabled()) return res.status(503).json({ error: 'Test checkout is unavailable.' });
    res.json(await checkout(payment, true));
  } catch (error) {
    next(error);
  }
});

async function razorpayWebhook(req, res, next) {
  if (!Buffer.isBuffer(req.body) || !razorpay.validWebhook(req.body, req.get('x-razorpay-signature'))) {
    return res.sendStatus(401);
  }
  try {
    const { event, payload } = JSON.parse(req.body.toString('utf8'));
    if (!['payment_link.paid', 'payment_link.expired', 'payment_link.cancelled'].includes(event)) {
      return res.sendStatus(204);
    }
    const entity = payload?.payment_link?.entity;
    if (typeof entity?.id !== 'string' || typeof entity?.reference_id !== 'string') return res.sendStatus(400);
    const payment = await loadPayment(entity.reference_id);
    if (payment) await reconcilePayment(payment, await razorpay.fetchLink(entity.id));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
}

module.exports = { paymentRoutes: router, razorpayWebhook };
