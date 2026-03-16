import { IsString, Length, IsOptional } from 'class-validator';

/** Body for POST /auth/2fa/verify (setup verification) */
export class Verify2faSetupDto {
  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}

/** Body for POST /auth/2fa/login (login step-2) */
export class Login2faDto {
  @IsString()
  tempToken: string;

  @IsString()
  @Length(6, 9, { message: 'Code must be 6 digits or a backup code' })
  code: string;
}

/** Body for POST /auth/2fa/disable */
export class Disable2faDto {
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  code?: string;
}
