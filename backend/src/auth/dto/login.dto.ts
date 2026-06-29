import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @ApiProperty({
    description: 'Email address for the user account.',
    example: 'applicant@example.com',
    format: 'email',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({
    description: 'Plain-text password for login.',
    example: 'password123',
    minLength: 8,
  })
  password!: string;
}
