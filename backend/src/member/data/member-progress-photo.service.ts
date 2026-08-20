import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { AuditService } from '../../audit/audit.service';
import { CurrentMemberContext } from '../decorators/current-member.decorator';

/** One hour, matching the rule for every private bucket here. */
const SIGNED_URL_TTL_SECONDS = 3600;

const BUCKET = 'member-photos';
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Direct-to-storage progress-photo upload, keeping image bytes out of the API.
 * Flow: app calls `upload-url` → PUTs the file to the signed URL → calls
 * `confirm` to persist the row.
 *
 * Tenant + member safety: the object path is derived ENTIRELY from the verified
 * token (`tenantId/memberId/photoId`), so a member can only ever read or write
 * inside their own folder — cross-member or cross-gym access is impossible by
 * construction, and `confirm` re-checks the object actually exists before
 * persisting (no phantom rows). Bucket is private; signed READ URLs are deferred
 * (consistent with `getProgress`, which returns the stored path).
 */
@Injectable()
export class MemberProgressPhotoService {
  private readonly logger = new Logger(MemberProgressPhotoService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly config: ConfigService,
    private readonly tenant: TenantPrisma,
    private readonly audit: AuditService,
  ) {
    this.supabase = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  private objectPath(member: CurrentMemberContext, photoId: string): string {
    return `${member.tenantId}/${member.memberId}/${photoId}`;
  }

  /** Returns `{ photoId, uploadUrl }`. The app PUTs the image to `uploadUrl`. */
  async createUploadUrl(
    member: CurrentMemberContext,
  ): Promise<{ photoId: string; uploadUrl: string }> {
    await this.ensureBucket();
    const photoId = randomUUID();
    const path = this.objectPath(member, photoId);

    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl) {
      this.logger.error(`signed upload URL failed: ${error?.message ?? 'unknown'}`);
      throw new BadRequestException('Could not create upload URL');
    }
    return { photoId, uploadUrl: data.signedUrl };
  }

  /** Persists the photo row after the member has PUT the file to storage. */
  async confirm(
    member: CurrentMemberContext,
    photoId: string,
    takenAt: string,
  ): Promise<{ id: string; url: string; takenAt: string }> {
    if (!UUID_RE.test(photoId)) {
      throw new BadRequestException('Invalid photoId');
    }
    const when = new Date(takenAt);
    if (Number.isNaN(when.getTime())) {
      throw new BadRequestException('Invalid takenAt');
    }

    // The file must already exist at the member-scoped path — otherwise a client
    // could confirm an upload it never performed.
    const exists = await this.objectExists(member, photoId);
    if (!exists) {
      throw new BadRequestException('Upload not found — PUT the file first');
    }

    const path = this.objectPath(member, photoId);
    const row = await this.tenant.client.memberProgressPhoto.create({
      data: {
        gym_id: member.tenantId,
        member_id: member.memberId,
        photo_url: path,
        taken_at: when,
        photo_type: 'progress',
      },
    });

    void this.audit
      .log({
        user_id: member.memberId,
        action: 'progress_photo.added',
        module: 'member-bff',
        entity_id: row.id,
        entity_type: 'member_progress_photo',
      })
      .catch(() => undefined);

    return {
      id: row.id,
      url: row.photo_url,
      takenAt: row.taken_at.toISOString(),
    };
  }

  /**
   * The member's own photos, newest first, with short-lived signed URLs.
   *
   * The bucket is PRIVATE and stays that way: a stored `photo_url` is an
   * object path, never a public link. Progress photos are among the most
   * personal things this product holds, so the URL a client receives expires
   * — pasting it into a group chat an hour later gets nobody anything.
   *
   * Member-scoped and gym-scoped: `member_id` is filtered explicitly and
   * `gym_id` is injected by the tenant client, so this cannot read across
   * either boundary.
   */
  async list(
    member: CurrentMemberContext,
    limit = 60,
  ): Promise<{ photos: { id: string; url: string | null; takenAt: string }[] }> {
    const rows = await this.tenant.client.memberProgressPhoto.findMany({
      where: { member_id: member.memberId },
      orderBy: { taken_at: 'desc' },
      take: Math.min(Math.max(limit, 1), 200),
      select: { id: true, photo_url: true, taken_at: true },
    });
    if (rows.length === 0) return { photos: [] };

    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrls(rows.map((r) => r.photo_url), SIGNED_URL_TTL_SECONDS);

    if (error) {
      this.logger.error(`signed URLs failed: ${error.message}`);
    }
    const byPath = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));

    return {
      photos: rows.map((r) => ({
        id: r.id,
        // Null rather than the raw path when signing failed: a path is not a
        // URL, and handing one to the client would render a broken image with
        // an internal location in it.
        url: byPath.get(r.photo_url) ?? null,
        takenAt: r.taken_at.toISOString(),
      })),
    };
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
    photoId: string,
  ): Promise<boolean> {
    const prefix = `${member.tenantId}/${member.memberId}`;
    const { data } = await this.supabase.storage
      .from(BUCKET)
      .list(prefix, { search: photoId });
    return !!data?.some((o) => o.name === photoId);
  }
}
