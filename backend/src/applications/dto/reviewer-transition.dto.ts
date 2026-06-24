import { IsIn, IsOptional, IsString } from 'class-validator';

const reviewerTransitionStatuses = [
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'RETURNED',
] as const;

export type ReviewerTransitionStatus =
  (typeof reviewerTransitionStatuses)[number];

export class ReviewerTransitionDto {
  @IsIn(reviewerTransitionStatuses)
  status!: ReviewerTransitionStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

