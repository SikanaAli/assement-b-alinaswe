import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Target workflow status chosen by the reviewer.',
    enum: reviewerTransitionStatuses,
    example: 'APPROVED',
  })
  status!: ReviewerTransitionStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'Optional reviewer comment. Required by business rules for REJECTED and RETURNED transitions.',
    example: 'Please revise the cost breakdown.',
  })
  comment?: string;
}
