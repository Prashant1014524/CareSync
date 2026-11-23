import { createHmac, timingSafeEqual } from 'node:crypto';

type PaymentLink = {
  id: string;
  amount: number;
  amount_paid: number;
  currency: string;
  short_url: string;
  reference_id: string;
  status: 'created' | 'paid' | 'expired' | 'cancelled' | 'partially_paid';
};

function paymentEnabled() {
  return Boolean(process.env.RAZORPAY_TEST_KEY_ID?.startsWith('rzp_test_') &&
    process.env.RAZORPAY_TEST_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET && process.env.FRONTEND_URL);
}

async function request<T>(path: string, body?: object): Promise<T> {
  if (!paymentEnabled()) throw new Error('Razorpay test checkout is unavailable.');
  const credentials = Buffer.from(
    `${process.env.RAZORPAY_TEST_KEY_ID}:${process.env.RAZORPAY_TEST_KEY_SECRET}`,
  ).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/payment_links${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Razorpay request failed (${response.status})`);
  return await response.json() as T;
}

async function findLink(reference: string) {
  const { payment_links: links } = await request<{ payment_links?: PaymentLink[] }>(
    `?reference_id=${encodeURIComponent(reference)}`,
  );
  return links?.find(link => link.reference_id === reference);
}

function fetchLink(id: string) {
  return request<PaymentLink>(`/${encodeURIComponent(id)}`);
}

function createLink(reference: string, amount: number, expiresAt: Date) {
  const callback = new URL('/', process.env.FRONTEND_URL);
  callback.searchParams.set('appointmentPayment', reference);
  return request<PaymentLink>('', {
    amount,
    currency: 'INR',
    accept_partial: false,
    description: 'CareSync appointment (test payment)',
    reference_id: reference,
    expire_by: Math.floor(expiresAt.getTime() / 1000),
    reminder_enable: false,
    notify: { sms: false, email: false },
    callback_url: callback.href,
    callback_method: 'get',
  });
}

function validWebhook(body: Buffer, signature: string | undefined) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export { paymentEnabled, findLink, fetchLink, createLink, validWebhook };
