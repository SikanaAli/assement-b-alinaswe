import { Category } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
    description: 'Application title.',
    example: 'Office Laptop Refresh',
    minLength: 3,
  })
  title!: string;

  @IsEnum(Category)
  @ApiProperty({
    description: 'Category assigned to the application.',
    enum: Category,
    example: Category.IT,
  })
  category!: Category;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description: 'Optional supporting details for the application.',
    example: 'Requesting replacement hardware for the design team.',
  })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @ApiPropertyOptional({
    description: 'Optional monetary amount associated with the application.',
    example: 2400,
    minimum: 0.01,
    type: Number,
  })
  amount?: number;
}
