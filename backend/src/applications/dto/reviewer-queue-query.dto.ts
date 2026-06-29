import { ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '@prisma/client';
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
    enum: reviewerQueueStatuses,
    enumName: 'ReviewerQueueStatus',
    example: 'SUBMITTED',
    description: 'Optional status filter for the reviewer queue.',
  })
  status?: ReviewerQueueStatus;

  @IsOptional()
  @IsEnum(Category)
  @ApiPropertyOptional({
    enum: Category,
    enumName: 'Category',
    example: Category.IT,
    description: 'Optional category filter for the reviewer queue.',
  })
  category?: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'budget',
    description:
      'Optional case-insensitive search across title, description, owner name, and owner email.',
  })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number for paginated reviewer queue results.',
    minimum: 1,
    default: 1,
    type: Number,
  })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiPropertyOptional({
    example: 10,
    description: 'Number of reviewer queue items returned per page.',
    minimum: 1,
    maximum: 100,
    default: 10,
    type: Number,
  })
  pageSize?: number;
}
