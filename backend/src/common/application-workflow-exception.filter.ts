import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Response } from 'express';
import { ApplicationWorkflowError } from '../application-workflow/application-workflow.error';

@Catch(ApplicationWorkflowError)
export class ApplicationWorkflowExceptionFilter
  implements ExceptionFilter<ApplicationWorkflowError>
{
  catch(exception: ApplicationWorkflowError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(exception.statusCode).json({
      statusCode: exception.statusCode,
      code: exception.code,
      message: exception.message,
    });
  }
}

