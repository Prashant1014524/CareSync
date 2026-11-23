const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

test('public registration permits only patient accounts', async (t) => {
  const writes = [];
  const lookup = t.mock.fn(async () => null);
  const create = async ({ data }) => {
    writes.push(data);
    return { ...data, id: 1 };
  };
  const dbPath = require.resolve('../src/prisma');
  require.cache[dbPath] = { exports: { user: { findUnique: lookup, create } } };
  const authRoutes = require('../src/routes/authRoutes');
  t.after(() => { delete require.cache[dbPath]; });
  const app = express();
  app.use(express.json());
  app.use('/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await require('node:events').once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));

  async function signup(role) {
    return fetch(`http://127.0.0.1:${server.address().port}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', name: 'Test', password: 'example-password', role }),
    });
  }

  for (const role of ['ADMIN', 'doctor', {}, null]) {
    assert.equal((await signup(role)).status, 400);
  }
  assert.equal(lookup.mock.callCount(), 0);
  assert.equal(writes.length, 0);
  for (const role of [undefined, 'patient']) {
    const response = await signup(role);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).user.role, 'PATIENT');
  }
  assert.deepEqual(writes.map(data => data.role), ['PATIENT', 'PATIENT']);
});
