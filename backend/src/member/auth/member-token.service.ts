import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import * as jose from 'jose';

/**
 * ────────────────────────────────────────────────────────────────
 * MEMBER TOKEN SERVICE
 * ────────────────────────────────────────────────────────────────
 *
 * Mints and verifies the member app's OWN access tokens — distinct from
 * the Supabase/admin tokens the rest of the SaaS uses.
 *
 * Audience separation (TRD §6, Checklist §1):
 *   - Member access tokens are signed with MEMBER_JWT_SECRET and carry
 *     `aud=member`. The admin JwtAuthGuard verifies against SUPABASE_JWT_SECRET
 *     with issuer ${SUPABASE_URL}/auth/v1, so it rejects these naturally.
 *   - MemberJwtGuard additionally requires `aud=member`, so an admin/Supabase
 *     token can never authorize a /member/* route.
 *
 * Refresh tokens are opaque random strings (NOT JWTs). Only their SHA-256 hash
 * is persisted server-side so they are revocable and rotating. This service
 * owns generation/hashing; persistence lives in the auth/session service
 * (added in a later commit alongside the public-schema migration).
 */

export const MEMBER_AUDIENCE = 'member';
export const MEMBER_ISSUER = 'musclex-member-bff';

/** Claims carried by a member access token. Tenant + member come from here ONLY. */
export interface MemberTokenClaims {
  /** member_id (PK of the member row inside the tenant) */
  sub: string;
  /** tenant id = the Studio UUID (drives gym_id scoping) */
  tenantId: string;
  role: 'member';
}

export interface MinifiedTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  /** SHA-256 of the refresh token — store THIS, never the raw token */
  refreshTokenHash: string;
}

@Injectable()
export class MemberTokenService {
  private readonly logger = new Logger(MemberTokenService.name);
  private readonly secret: Uint8Array;
  /** Access-token lifetime in seconds (~15 min per TRD §6). */
  private readonly accessTtlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('MEMBER_JWT_SECRET');
    if (!secret) {
      // Fail loud at startup rather than minting unsigned/forgeable tokens.
      throw new Error(
        'MEMBER_JWT_SECRET is not configured — the member BFF cannot issue tokens.',
      );
    }
    this.secret = new TextEncoder().encode(secret);
    this.accessTtlSeconds = Number(
      this.config.get<string>('MEMBER_ACCESS_TTL_SECONDS') ?? 900,
    );
  }

  /** Sign a short-lived member access token. */
  async signAccessToken(claims: MemberTokenClaims): Promise<string> {
    return new jose.SignJWT({ tenantId: claims.tenantId, role: claims.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setAudience(MEMBER_AUDIENCE)
      .setIssuer(MEMBER_ISSUER)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.secret);
  }

  /**
   * Verify a member access token. Throws UnauthorizedException on any failure
   * (bad signature, expired, wrong audience/issuer, missing claims).
   */
  async verifyAccessToken(token: string): Promise<MemberTokenClaims> {
    let payload: jose.JWTPayload;
    try {
      ({ payload } = await jose.jwtVerify(token, this.secret, {
        audience: MEMBER_AUDIENCE,
        issuer: MEMBER_ISSUER,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired member token');
    }

    const sub = payload.sub;
    const tenantId = payload.tenantId as string | undefined;
    if (!sub || !tenantId || payload.role !== 'member') {
      throw new UnauthorizedException('Malformed member token claims');
    }
    return { sub, tenantId, role: 'member' };
  }

  /** Generate an opaque rotating refresh token + its storable hash. */
  generateRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashRefreshToken(token) };
  }

  /** SHA-256 hash used for refresh-token storage/lookup (constant per token). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  get accessTokenTtlSeconds(): number {
    return this.accessTtlSeconds;
  }
}
