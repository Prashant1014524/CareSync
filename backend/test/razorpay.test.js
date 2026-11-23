const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { validWebhook } = require('../src/services/razorpay.mts');

test('Razorpay verifies the exact webhook body with its webhook secret', (t) => {
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const secret = 'temporary-webhook-test-secret';
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  t.after(() => {
    if (previousSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  });

  const body = Buffer.from('{ "event": "payment_link.paid" }');
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(validWebhook(body, signature), true);
  assert.equal(validWebhook(Buffer.from('{"event":"payment_link.paid"}'), signature), false);
  assert.equal(validWebhook(body, '0'.repeat(64)), false);
  assert.equal(validWebhook(body, undefined), false);
});
