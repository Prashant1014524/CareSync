const { PrismaClient } = require('@prisma/client');

// Prisma Client with connection logging in development and clean error monitoring in production
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
