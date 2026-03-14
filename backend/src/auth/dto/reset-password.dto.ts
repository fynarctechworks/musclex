import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  otp: string;

  @IsString()
  @MinLength(8)
  new_password: string;
}
