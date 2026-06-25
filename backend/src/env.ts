import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../.env') });

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  corsOrigins: (
    process.env.FRONTEND_ORIGIN ??
    'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  host: process.env.HOST ?? '127.0.0.1',
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  port: Number(process.env.PORT ?? '3000'),
};
