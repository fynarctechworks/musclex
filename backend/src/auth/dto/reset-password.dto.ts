import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /**
   * The Supabase recovery session access token, obtained by the frontend when it
   * exchanges the emailed recovery code/hash for a session. The server
   * re-verifies this token and derives the user id from it — it is NOT a
   * client-supplied user id. See AuthService.resetPassword.
   */
  @IsString()
  access_token: string;

  @IsString()
  @MinLength(8)
  new_password: string;
}
