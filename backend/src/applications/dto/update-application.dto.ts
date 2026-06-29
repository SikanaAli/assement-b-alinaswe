import { Category } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @ApiPropertyOptional({
    description: 'Updated application title.',
    example: 'Office Laptop Refresh - Revised',
    minLength: 3,
  })
  title?: string;

  @IsOptional()
  @IsEnum(Category)
  @ApiPropertyOptional({
    description: 'Updated category for the application.',
    enum: Category,
    example: Category.IT,
  })
  category?: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Updated supporting details for the application.',
    example: 'Adjusted hardware quantities after reviewer feedback.',
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @ApiPropertyOptional({
    description: 'Updated monetary amount.',
    example: 2550,
    minimum: 0.01,
    type: Number,
  })
  amount?: number;
}
