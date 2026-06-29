import { ApiPropertyOptional } from '@nestjs/swagger';
import { Category } from '@prisma/client';
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
    example: 'Updated quarterly budget request',
    description: 'Updated title for the application.',
    minLength: 3,
  })
  title?: string;

  @IsOptional()
  @IsEnum(Category)
  @ApiPropertyOptional({
    enum: Category,
    enumName: 'Category',
    example: Category.GENERAL,
    description: 'Updated business category for the application.',
  })
  category?: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Adjusted request after reviewer feedback.',
    description: 'Updated optional description.',
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @ApiPropertyOptional({
    example: 950,
    description: 'Updated optional monetary amount.',
    minimum: 0.01,
    type: Number,
  })
  amount?: number;
}
