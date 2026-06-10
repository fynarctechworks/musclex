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
    private readonly prisma: PrismaService,
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
    const row = await this.prisma.memberProgressPhoto.create({
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
