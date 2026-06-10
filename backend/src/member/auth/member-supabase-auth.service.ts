import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Thin wrapper over Supabase Auth for the member login flow. Mirrors how the
 * admin JwtAuthGuard talks to Supabase (service-role client). OTP is delivered
 * by Supabase's SMS provider; the BFF never verifies the OTP itself — the app
 * verifies with Supabase and sends the resulting token to /auth/session.
 */
@Injectable()
export class MemberSupabaseAuthService {
  private readonly logger = new Logger(MemberSupabaseAuthService.name);
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.get<string>('SUPABASE_URL', ''),
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  /**
   * Trigger a phone OTP. Best-effort and never throws — /auth/otp/request must
   * always return 200 regardless of whether the phone is a member or whether
   * SMS delivery is configured (no enumeration, no error leakage).
   */
  async requestPhoneOtp(phone: string): Promise<void> {
    try {
      const { error } = await this.client.auth.signInWithOtp({ phone });
      if (error) {
        this.logger.warn(`signInWithOtp failed (swallowed): ${error.message}`);
      }
    } catch (err) {
      this.logger.warn(
        `signInWithOtp threw (swallowed): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Verify a Supabase access token (the one the app obtained after OTP
   * verification) and return the user's id + phone. Returns null if invalid.
   */
  async verifyToken(token: string): Promise<{ id: string; phone?: string } | null> {
    try {
      const { data, error } = await this.client.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, phone: data.user.phone ?? undefined };
    } catch (err) {
      this.logger.warn(
        `getUser failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }
}
