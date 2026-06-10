import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceInfoDto } from './device-info.dto';

/**
 * Payload for `POST /auth/oauth/sync`.
 *
 * The frontend completes the provider handshake with Supabase directly
 * (`signInWithOAuth` → `/auth/callback` → session), then hands the resulting
 * Supabase session tokens to the backend so it can run the same post-auth
 * pipeline as password login: identity sync, RBAC/workspace resolution,
 * onboarding reconciliation, device + history tracking.
 *
 * The tokens are verified server-side (`supabase.auth.getUser`) — they are not
 * trusted blindly.
 */
export class OAuthSyncDto {
  @IsString()
  access_token: string;

  @IsString()
  refresh_token: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  device_info?: DeviceInfoDto;
}
