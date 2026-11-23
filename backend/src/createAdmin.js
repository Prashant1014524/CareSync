require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Provide a valid ADMIN_EMAIL.');
  }
  if (!password || password.length < 16 || Buffer.byteLength(password) > 72) {
    throw new Error('Provide an ADMIN_PASSWORD of at least 16 characters and at most 72 bytes.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { email, passwordHash, name: 'CareSync Administrator', role: 'ADMIN' },
  });
  console.log('Administrator created.');
}

createAdmin()
  .catch(error => {
    console.error(error.code === 'P2002'
      ? 'An account already uses ADMIN_EMAIL.'
      : error.code || (error.name === 'Error' ? error.message : error.name));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
