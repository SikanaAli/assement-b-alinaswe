import 'reflect-metadata';
import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

config({ path: resolve(process.cwd(), '../.env') });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000, '127.0.0.1');
}

void bootstrap();
