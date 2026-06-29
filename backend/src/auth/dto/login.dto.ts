import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @ApiProperty({
    example: 'applicant@example.com',
    description: 'Email address for the user account.',
    format: 'email',
  })
  email!: string;

  @IsString()
  @MinLength(8)
  @ApiProperty({
    example: 'password123',
    description: 'Plain-text password submitted for login.',
    minLength: 8,
  })
  password!: string;
}
