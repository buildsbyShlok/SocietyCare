require('../src/config/env');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { BCRYPT_SALT_ROUNDS } = require('../src/utils/constants');

const prisma = new PrismaClient();

/**
 * Non-destructive admin creation script.
 * Creates a new explicitly configured admin; never changes an existing account.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12 characters minimum, 72 UTF-8 bytes maximum).');
  const name = process.env.ADMIN_NAME || 'Society Admin (Operations)';
  const flatNumber = process.env.ADMIN_FLAT || 'OFFICE-01';
  const phone = process.env.ADMIN_PHONE || null;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role === 'ADMIN') {
      console.log(`Admin account '${email}' already exists.`);
      return;
    }
    throw new Error('This email belongs to an existing resident. Use the authorized admin directory to change roles.');
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS || 12);
  const created = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: 'ADMIN',
      flatNumber,
      phone,
    },
  });

  console.log(`Admin account '${created.email}' created successfully.`);
}

main()
  .catch(() => { console.error('Admin provisioning failed. Check configuration and whether the account already exists.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
