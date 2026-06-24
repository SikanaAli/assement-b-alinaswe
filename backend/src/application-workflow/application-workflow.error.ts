export type WorkflowErrorCode =
  | 'APPLICATION_EDIT_FORBIDDEN'
  | 'COMMENT_REQUIRED'
  | 'FORBIDDEN_STATUS_TRANSITION'
  | 'INVALID_STATUS_TRANSITION'
  | 'TERMINAL_STATUS';

export class ApplicationWorkflowError extends Error {
  constructor(
    public readonly code: WorkflowErrorCode,
    message: string,
    public readonly statusCode: 400 | 403,
  ) {
    super(message);
    this.name = 'ApplicationWorkflowError';
    Object.setPrototypeOf(this, ApplicationWorkflowError.prototype);
  }
}

