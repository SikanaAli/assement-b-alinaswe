import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'dotenv -e ../.env -- ts-node --project tsconfig.json prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '',
  },
});
