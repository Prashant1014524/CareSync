const { test } = require('node:test');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

test('password and Google signup queue one welcome email per new patient', async (t) => {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.WELCOME_EMAIL_FROM = 'CareSync <welcome@example.test>';
  process.env.GOOGLE_SIGN_IN_CLIENT_ID = 'test-client';

  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({
    getPayload: () => ({ sub: 'test-subject', email: 'new-google-user@gmail.com', email_verified: true }),
  }));

  const users = [];
  const emails = [];
  const sent = [];
  const db = {
    user: {
      findUnique: async ({ where }) => users.find(user =>
        where.email ? user.email === where.email : user.googleSubject === where.googleSubject),
      create: async ({ data }) => {
        const user = { ...data, id: String(users.length + 1) };
        users.push(user);
        return user;
      },
    },
    emailLog: {
      create: async ({ data }) => {
        const log = { ...data, status: 'PENDING', retryCount: 0 };
        emails.push(log);
        return log;
      },
      updateMany: async () => ({ count: 1 }),
      update: async ({ where, data }) => Object.assign(emails.find(log => log.id === where.id), data),
    },
    $transaction: async callback => callback(db),
  };
  const dbPath = require.resolve('../src/prisma');
  require.cache[dbPath] = { exports: db };
  t.after(() => { delete require.cache[dbPath]; });

  const realFetch = global.fetch;
  t.mock.method(global, 'fetch', async (url, init) => {
    if (url !== 'https://api.resend.com/emails') return realFetch(url, init);
    sent.push({ ...JSON.parse(init.body), key: init.headers['Idempotency-Key'] });
    return Response.json({ id: 'example-message' });
  });

  const app = express();
  app.use(express.json());
  app.use('/auth', require('../src/routes/authRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));

  async function post(route, body) {
    return fetch(`http://127.0.0.1:${server.address().port}/auth/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  const credentials = { email: 'patient@example.test', password: 'example-password' };
  const signup = { ...credentials, name: 'Test Patient' };
  assert.equal((await post('register', { ...signup, email: 'patient@example.test,other@example.test' })).status, 400);
  assert.equal((await post('register', signup)).status, 201);
  assert.equal((await post('register', signup)).status, 400);
  assert.equal((await post('login', credentials)).status, 200);
  assert.equal((await post('google', { credential: 'test-google-token' })).status, 200);
  assert.equal((await post('google', { credential: 'test-google-token' })).status, 200);

  assert.deepEqual(emails.map(log => log.status), ['SENT', 'SENT']);
  assert.deepEqual(sent.map(message => message.to), [['patient@example.test'], ['new-google-user@gmail.com']]);
  assert.deepEqual(sent.map(message => message.key), ['welcome-1', 'welcome-2']);
  assert.ok(sent.every(message => message.subject === 'Welcome to CareSync'));
});
