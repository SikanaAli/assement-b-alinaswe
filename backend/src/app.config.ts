import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ApplicationWorkflowExceptionFilter } from './common/application-workflow-exception.filter';
import { createValidationException } from './common/validation-exception.factory';

export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: createValidationException,
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApplicationWorkflowExceptionFilter());
}

