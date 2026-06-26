import { Injectable } from '@nestjs/common';
import { Role, Status } from '@prisma/client';
import {
  ApplicationWorkflowError,
  WorkflowErrorCode,
} from './application-workflow.error';
import {
  ApplicationEditContext,
  ApplicationTransitionContext,
} from './application-workflow.types';

const terminalStatuses = new Set<Status>([Status.APPROVED, Status.REJECTED]);
const editableStatuses = new Set<Status>([Status.DRAFT, Status.RETURNED]);

@Injectable()
export class ApplicationWorkflowService {
  assertCanEditApplication(context: ApplicationEditContext) {
    if (!editableStatuses.has(context.currentStatus)) {
      throw this.createError(
        'APPLICATION_EDIT_FORBIDDEN',
        'Applications can only be edited while they are in DRAFT or RETURNED status.',
        403,
      );
    }

    if (context.actorId !== context.applicationOwnerId) {
      throw this.createError(
        'APPLICATION_EDIT_FORBIDDEN',
        'Only the owner can edit a draft or returned application.',
        403,
      );
    }
  }

  assertTransitionAllowed(context: ApplicationTransitionContext) {
    if (context.currentStatus === context.targetStatus) {
      throw this.createError(
        'INVALID_STATUS_TRANSITION',
        `Applications cannot transition from ${context.currentStatus} to the same status.`,
        400,
      );
    }

    if (terminalStatuses.has(context.currentStatus)) {
      throw this.createError(
        'TERMINAL_STATUS',
        `${context.currentStatus} is a terminal status and cannot transition further.`,
        400,
      );
    }

    if (context.actorRole === Role.APPLICANT) {
      this.assertApplicantTransition(context);
      return;
    }

    if (context.actorRole === Role.REVIEWER) {
      this.assertReviewerTransition(context);
      return;
    }

    throw this.createError(
      'FORBIDDEN_STATUS_TRANSITION',
      'This actor role is not allowed to perform workflow transitions.',
      403,
    );
  }

  private assertApplicantTransition(context: ApplicationTransitionContext) {
    if (context.targetStatus !== Status.SUBMITTED) {
      throw this.createError(
        'FORBIDDEN_STATUS_TRANSITION',
        'Applicants can only submit their own draft applications.',
        403,
      );
    }

    if (context.currentStatus !== Status.DRAFT) {
      throw this.createError(
        'INVALID_STATUS_TRANSITION',
        'Applicants can only submit applications from DRAFT status.',
        400,
      );
    }

    if (context.actorId !== context.applicationOwnerId) {
      throw this.createError(
        'FORBIDDEN_STATUS_TRANSITION',
        'Applicants can only submit their own draft applications.',
        403,
      );
    }
  }

  private assertReviewerTransition(context: ApplicationTransitionContext) {
    if (context.targetStatus === Status.SUBMITTED) {
      throw this.createError(
        'FORBIDDEN_STATUS_TRANSITION',
        'Reviewers cannot submit applications on behalf of applicants.',
        403,
      );
    }

    const allowedTargets = this.getAllowedReviewerTargets(context.currentStatus);

    if (!allowedTargets) {
      throw this.createError(
        'INVALID_STATUS_TRANSITION',
        `Reviewers cannot transition applications from ${context.currentStatus}.`,
        400,
      );
    }

    if (!allowedTargets.has(context.targetStatus)) {
      throw this.createError(
        'INVALID_STATUS_TRANSITION',
        `Reviewers cannot transition applications from ${context.currentStatus} to ${context.targetStatus}.`,
        400,
      );
    }

    if (this.requiresComment(context.targetStatus) && !this.hasComment(context.comment)) {
      throw this.createError(
        'COMMENT_REQUIRED',
        `${context.targetStatus} transitions require a non-empty comment.`,
        400,
      );
    }
  }

  private getAllowedReviewerTargets(currentStatus: Status) {
    if (currentStatus === Status.SUBMITTED) {
      return new Set<Status>([
        Status.UNDER_REVIEW,
        Status.APPROVED,
        Status.REJECTED,
        Status.RETURNED,
      ]);
    }

    if (currentStatus === Status.UNDER_REVIEW) {
      return new Set<Status>([
        Status.APPROVED,
        Status.REJECTED,
        Status.RETURNED,
      ]);
    }

    return null;
  }

  private requiresComment(targetStatus: Status) {
    return targetStatus === Status.REJECTED || targetStatus === Status.RETURNED;
  }

  private hasComment(comment?: string | null) {
    return Boolean(comment?.trim());
  }

  private createError(
    code: WorkflowErrorCode,
    message: string,
    statusCode: 400 | 403,
  ) {
    return new ApplicationWorkflowError(code, message, statusCode);
  }
}
