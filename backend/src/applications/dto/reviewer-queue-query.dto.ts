import { Category } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @ApiPropertyOptional({
    description: 'Optional status filter for the reviewer queue.',
    enum: reviewerQueueStatuses,
    example: 'SUBMITTED',
  })
  status?: ReviewerQueueStatus;

  @IsOptional()
  @IsEnum(Category)
  @ApiPropertyOptional({
    description: 'Optional category filter for the reviewer queue.',
    enum: Category,
    example: Category.FINANCE,
  })
  category?: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      'Optional text search across title, description, owner name, and owner email.',
    example: 'budget',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    description: '1-based page number.',
    example: 1,
    minimum: 1,
    type: Number,
  })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({
    description: 'Number of results per page.',
    example: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  pageSize?: number;
}
