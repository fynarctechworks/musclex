import { IsUUID, IsOptional, IsString } from 'class-validator';

export class SelectWorkspaceDto {
  @IsUUID()
  studio_id: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  /**
   * The caller's refresh token, so the response can carry a session already
   * scoped to the chosen studio.
   *
   * OPTIONAL for backward compatibility, but strongly preferred. The active
   * studio is read from Supabase `user_metadata`, which is embedded in an
   * access token at MINT time — so a token issued before the switch keeps
   * serving the previous gym no matter what this endpoint returns. Without a
   * refresh the caller has to know to do it themselves, and the web app did
   * not, which is why switching never took effect.
   */
  @IsString()
  @IsOptional()
  refresh_token?: string;
}
