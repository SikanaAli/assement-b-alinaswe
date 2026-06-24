import 'reflect-metadata';
import './env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApplicationWorkflowExceptionFilter } from './common/application-workflow-exception.filter';
import { createValidationException } from './common/validation-exception.factory';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: createValidationException,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApplicationWorkflowExceptionFilter());
  await app.listen(3000, '127.0.0.1');
}

void bootstrap();
