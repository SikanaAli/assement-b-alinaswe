import { Role, Status } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { ApplicationWorkflowError } from './application-workflow.error';
import { ApplicationWorkflowService } from './application-workflow.service';

const ownerId = 'owner-id';
const otherApplicantId = 'other-applicant-id';
const reviewerId = 'reviewer-id';

describe('ApplicationWorkflowService', () => {
  const service = new ApplicationWorkflowService();

  function expectWorkflowError(
    callback: () => void,
    expected: {
      code: ApplicationWorkflowError['code'];
      message: string;
      statusCode: ApplicationWorkflowError['statusCode'];
    },
  ) {
    try {
      callback();
      throw new Error('Expected workflow error to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(ApplicationWorkflowError);

      const workflowError = error as ApplicationWorkflowError;

      expect(workflowError.code).toBe(expected.code);
      expect(workflowError.message).toBe(expected.message);
      expect(workflowError.statusCode).toBe(expected.statusCode);
    }
  }

  it('allows DRAFT to SUBMITTED by the owner', () => {
    expect(() =>
      service.assertTransitionAllowed({
        actorId: ownerId,
        actorRole: Role.APPLICANT,
        applicationOwnerId: ownerId,
        currentStatus: Status.DRAFT,
        targetStatus: Status.SUBMITTED,
      }),
    ).not.toThrow();
  });

  it('rejects DRAFT to SUBMITTED by a non-owner', () => {
    expectWorkflowError(
      () =>
      service.assertTransitionAllowed({
        actorId: otherApplicantId,
        actorRole: Role.APPLICANT,
        applicationOwnerId: ownerId,
        currentStatus: Status.DRAFT,
        targetStatus: Status.SUBMITTED,
      }),
      {
        code: 'FORBIDDEN_STATUS_TRANSITION',
        message: 'Applicants can only submit their own draft applications.',
        statusCode: 403,
      },
    );
  });

  it('rejects applicant edits after SUBMITTED', () => {
    expectWorkflowError(
      () =>
      service.assertCanEditApplication({
        actorId: ownerId,
        actorRole: Role.APPLICANT,
        applicationOwnerId: ownerId,
        currentStatus: Status.SUBMITTED,
      }),
      {
        code: 'APPLICATION_EDIT_FORBIDDEN',
        message:
          'Applications can only be edited while they are in DRAFT status.',
        statusCode: 403,
      },
    );
  });

  it('allows SUBMITTED to APPROVED by a reviewer', () => {
    expect(() =>
      service.assertTransitionAllowed({
        actorId: reviewerId,
        actorRole: Role.REVIEWER,
        applicationOwnerId: ownerId,
        currentStatus: Status.SUBMITTED,
        targetStatus: Status.APPROVED,
      }),
    ).not.toThrow();
  });

  it('rejects SUBMITTED to REJECTED without a comment', () => {
    expectWorkflowError(
      () =>
      service.assertTransitionAllowed({
        actorId: reviewerId,
        actorRole: Role.REVIEWER,
        applicationOwnerId: ownerId,
        currentStatus: Status.SUBMITTED,
        targetStatus: Status.REJECTED,
        comment: '   ',
      }),
      {
        code: 'COMMENT_REQUIRED',
        message: 'REJECTED transitions require a non-empty comment.',
        statusCode: 400,
      },
    );
  });

  it('allows UNDER_REVIEW to RETURNED with a comment', () => {
    expect(() =>
      service.assertTransitionAllowed({
        actorId: reviewerId,
        actorRole: Role.REVIEWER,
        applicationOwnerId: ownerId,
        currentStatus: Status.UNDER_REVIEW,
        targetStatus: Status.RETURNED,
        comment: 'Please revise the attached breakdown.',
      }),
    ).not.toThrow();
  });

  it('rejects further transitions after APPROVED', () => {
    expectWorkflowError(
      () =>
      service.assertTransitionAllowed({
        actorId: reviewerId,
        actorRole: Role.REVIEWER,
        applicationOwnerId: ownerId,
        currentStatus: Status.APPROVED,
        targetStatus: Status.RETURNED,
        comment: 'Trying to reopen an approved application.',
      }),
      {
        code: 'TERMINAL_STATUS',
        message: 'APPROVED is a terminal status and cannot transition further.',
        statusCode: 400,
      },
    );
  });

  it('rejects applicants approving their own application', () => {
    expectWorkflowError(
      () =>
      service.assertTransitionAllowed({
        actorId: ownerId,
        actorRole: Role.APPLICANT,
        applicationOwnerId: ownerId,
        currentStatus: Status.SUBMITTED,
        targetStatus: Status.APPROVED,
      }),
      {
        code: 'FORBIDDEN_STATUS_TRANSITION',
        message: 'Applicants can only submit their own draft applications.',
        statusCode: 403,
      },
    );
  });

  it('rejects reviewers submitting an applicant draft', () => {
    expectWorkflowError(
      () =>
      service.assertTransitionAllowed({
        actorId: reviewerId,
        actorRole: Role.REVIEWER,
        applicationOwnerId: ownerId,
        currentStatus: Status.DRAFT,
        targetStatus: Status.SUBMITTED,
      }),
      {
        code: 'FORBIDDEN_STATUS_TRANSITION',
        message: 'Reviewers cannot submit applications on behalf of applicants.',
        statusCode: 403,
      },
    );
  });
});
