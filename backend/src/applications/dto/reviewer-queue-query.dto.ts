import { IsIn, IsOptional } from 'class-validator';

export const reviewerQueueStatuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
] as const;

export type ReviewerQueueStatus = (typeof reviewerQueueStatuses)[number];

export class ReviewerQueueQueryDto {
  @IsOptional()
  @IsIn(reviewerQueueStatuses)
  status?: ReviewerQueueStatus;
}
