import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

const BUCKET = 'member-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_READ_TTL = 365 * 24 * 60 * 60; // 1 year — matches admin uploads/photo
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Member-facing PROFILE AVATAR upload — the photo that shows on the member's
 * Home/Profile header AND in the admin member record (both read
 * `members.profile_photo_url`). Deliberately writes a 1-year signed READ URL into
 * that column, exactly like the admin `uploads/photo` endpoint, so the new photo
 * appears in BOTH surfaces immediately with no extra signing step.
 *
 * Flow (mirrors progress photos to keep media bytes out of the API):
 *   app → POST /me/avatar/upload-url  → { avatarId, uploadUrl }
 *   app → PUT (file) to uploadUrl
 *   app → POST /me/avatar { avatarId } → { avatarUrl }
 *
 * Tenant + member safety: the object path is derived ENTIRELY from the verified
 * token (`tenantId/memberId/avatar/avatarId`), so a member can only write inside
 * their own folder. `confirm` re-checks the object exists before persisting, and
 * the `members` update is gym-scoped by the tenant `$use` injection.
 */
@Injectable()
export class MemberAvatarService {
  private readonly logger = new Logger(MemberAvatarService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  private objectPath(member: CurrentMemberContext, avatarId: string): string {
    return `${member.tenantId}/${member.memberId}/avatar/${avatarId}`;
  }

  /** Returns `{ avatarId, uploadUrl }`. The app PUTs the image to `uploadUrl`. */
  async createUploadUrl(
    member: CurrentMemberContext,
  ): Promise<{ avatarId: string; uploadUrl: string }> {
    await this.ensureBucket();
    const avatarId = randomUUID();
    const path = this.objectPath(member, avatarId);

    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      this.logger.error(
        `avatar signed upload URL failed: ${error?.message ?? 'unknown'}`,
      );
      throw new BadRequestException('Could not create upload URL');
    }
    return { avatarId, uploadUrl: data.signedUrl };
  }

  /**
   * After the member PUTs the file, persist a signed read URL onto
   * `members.profile_photo_url`. Returns the new `avatarUrl` for the app.
   */
  async confirm(
    member: CurrentMemberContext,
    avatarId: string,
  ): Promise<{ avatarUrl: string }> {
    if (!UUID_RE.test(avatarId)) {
      throw new BadRequestException('Invalid avatarId');
    }

    // The file must already exist at the member-scoped path — otherwise a client
    // could confirm an upload it never performed.
    const exists = await this.objectExists(member, avatarId);
    if (!exists) {
      throw new BadRequestException('Upload not found — PUT the file first');
    }

    const path = this.objectPath(member, avatarId);
    const { data: signed, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_READ_TTL);
    if (error || !signed?.signedUrl) {
      this.logger.error(
        `avatar signed read URL failed: ${error?.message ?? 'unknown'}`,
      );
      throw new BadRequestException('Could not finalize avatar');
    }

    // gym-scoped by the tenant `$use` injection (ALS gym_id == member.tenantId).
    await this.prisma.member.update({
      where: { id: member.memberId },
      data: { profile_photo_url: signed.signedUrl },
    });

    void this.audit
      .log({
        user_id: member.memberId,
        action: 'profile_photo.updated',
        module: 'member-bff',
        entity_id: member.memberId,
        entity_type: 'member',
      })
      .catch(() => undefined);

    return { avatarUrl: signed.signedUrl };
  }

  private async ensureBucket(): Promise<void> {
    const { data: buckets } = await this.supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === BUCKET)) {
      await this.supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ALLOWED_MIME,
      });
    }
  }

  private async objectExists(
    member: CurrentMemberContext,
    avatarId: string,
  ): Promise<boolean> {
    const prefix = `${member.tenantId}/${member.memberId}/avatar`;
    const { data } = await this.supabase.storage
      .from(BUCKET)
      .list(prefix, { search: avatarId });
    return !!data?.some((o) => o.name === avatarId);
  }
}
