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
    enum: reviewerTransitionStatuses,
    enumName: 'ReviewerTransitionStatus',
    example: 'APPROVED',
    description: 'Target workflow status selected by the reviewer.',
  })
  status!: ReviewerTransitionStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Looks good.',
    description:
      'Optional reviewer comment. Required by business rules for REJECTED and RETURNED transitions.',
  })
  comment?: string;
}
