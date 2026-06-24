import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

export default async function globalSetup() {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL is required for e2e tests and must point to a dedicated test database.',
    );
  }

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET ||= 'test-secret';

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      JWT_SECRET: process.env.JWT_SECRET,
    },
    stdio: 'inherit',
  });
}

