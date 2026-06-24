import { BadRequestException, ValidationError } from '@nestjs/common';

type ValidationIssue = {
  field: string;
  messages: string[];
};

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath?: string,
): ValidationIssue[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const ownIssues = error.constraints
      ? [{ field: path, messages: Object.values(error.constraints) }]
      : [];
    const childIssues = error.children?.length
      ? flattenValidationErrors(error.children, path)
      : [];

    return [...ownIssues, ...childIssues];
  });
}

export function createValidationException(errors: ValidationError[]) {
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed.',
    errors: flattenValidationErrors(errors),
  });
}

