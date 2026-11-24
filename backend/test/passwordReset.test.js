const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const bcrypt = require('bcryptjs');

test('a valid reset can be consumed once and revokes earlier sessions', async t => {
  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  let storedReset = { userId: 'patient-id', tokenHash, expiresAt: new Date(Date.now() + 60_000) };
  const updates = [];
  const passwordReset = {
    findUnique: async ({ where }) => where.tokenHash === storedReset?.tokenHash ? storedReset : null,
    deleteMany: async ({ where }) => {
      if (!storedReset || where.tokenHash !== storedReset.tokenHash) return { count: 0 };
      storedReset = null;
      return { count: 1 };
    },
  };
  const dbPath = require.resolve('../src/prisma');
  require.cache[dbPath] = { exports: {
    passwordReset,
    $transaction: async run => run({
      passwordReset,
      user: { update: async input => updates.push(input) },
    }),
  } };
  t.after(() => { delete require.cache[dbPath]; });
  const { resetPassword } = require('../src/controllers/passwordResetController');

  async function submit(password) {
    const response = {
      code: 200,
      status(code) { this.code = code; return this; },
      json() { return this; },
    };
    await resetPassword({ body: { token, password } }, response, error => { throw error; });
    return response.code;
  }

  assert.equal(await submit('too-short'), 400);
  const password = 'example-new-password';
  const results = await Promise.all([submit(password), submit(password)]);
  assert.deepEqual(results.sort(), [200, 400]);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].where, { id: 'patient-id' });
  assert.deepEqual(updates[0].data.sessionVersion, { increment: 1 });
  assert.equal(await bcrypt.compare(password, updates[0].data.passwordHash), true);
  assert.equal(await submit(password), 400);
});
