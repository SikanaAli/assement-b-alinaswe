import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateApplicationDto {
  @IsString()
  @MinLength(3)
  @ApiProperty({
    example: 'Quarterly budget request',
    description: 'Short title for the application.',
    minLength: 3,
  })
  title!: string;

  @IsEnum(Category)
  @ApiProperty({
    enum: Category,
    enumName: 'Category',
    example: Category.FINANCE,
    description: 'Business category assigned to the application.',
  })
  category!: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Funding needed for team travel and workshop materials.',
    description: 'Optional longer description for the application.',
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @ApiPropertyOptional({
    example: 1500.5,
    description: 'Optional monetary amount associated with the application.',
    minimum: 0.01,
    type: Number,
  })
  amount?: number;
}
