import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { JwtAuthGuard, CurrentUser, JwtPayload } from '../common';
import { randomUUID } from 'crypto';

/** Extension → canonical content-type, plus a magic-byte sniffer. The multipart
 *  `mimetype` is client-supplied and trivially spoofable, so we verify the actual
 *  bytes and the filename extension rather than trusting the declared type. */
const IMAGE_TYPES: Record<string, { ext: string[]; sniff: (b: Buffer) => boolean }> = {
  jpeg: {
    ext: ['jpg', 'jpeg'],
    sniff: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  png: {
    ext: ['png'],
    sniff: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  webp: {
    ext: ['webp'],
    sniff: (b) =>
      b.length > 12 &&
      b.toString('ascii', 0, 4) === 'RIFF' &&
      b.toString('ascii', 8, 12) === 'WEBP',
  },
};

/**
 * Validate an uploaded image by BOTH its filename extension and its real content
 * bytes. Returns the safe lowercase extension to store the object under. Throws
 * BadRequestException on any mismatch so a spoofed content-type or a disguised
 * payload (e.g. an .html renamed .png) is rejected before it hits storage.
 */
function assertValidImage(file: Express.Multer.File): string {
  if (!file?.buffer?.length) throw new BadRequestException('Empty file');
  const rawExt = (file.originalname.split('.').pop() || '').toLowerCase();
  for (const { ext, sniff } of Object.values(IMAGE_TYPES)) {
    if (ext.includes(rawExt) && sniff(file.buffer)) {
      return rawExt === 'jpeg' ? 'jpg' : rawExt;
    }
  }
  throw new BadRequestException(
    'Invalid image: file content does not match an allowed type (jpg, png, webp).',
  );
}

@Controller('api/v1/uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL', ''),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY', ''),
    );
  }

  @Post('photo')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const ext = assertValidImage(file);
    const fileName = `${user.studio_id}/${randomUUID()}.${ext}`;
    const bucket = 'member-photos';

    // Ensure bucket exists
    const { data: buckets } = await this.supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === bucket)) {
      await this.supabase.storage.createBucket(bucket, {
        public: false,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Upload failed: ${error.message}`);
      throw new BadRequestException('Upload failed: ' + error.message);
    }

    // Generate signed URL (1 year expiry for profile photos)
    const { data: signedData } = await this.supabase.storage
      .from(bucket)
      .createSignedUrl(fileName, 365 * 24 * 60 * 60);

    return {
      url: signedData?.signedUrl || '',
      path: fileName,
      bucket,
    };
  }

  /**
   * Upload a studio/gym logo. Used during onboarding (before a studio exists)
   * and from gym settings. Goes to a PUBLIC bucket so the returned URL can be
   * stored on the studio and rendered directly. Runs with the service-role key,
   * so the browser never needs storage-admin permissions (creating the bucket
   * and inserting objects both require it — the old client-side path 400'd).
   */
  @Post('logo')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB (matches the onboarding UI hint)
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    const ext = assertValidImage(file);
    const fileName = `logos/${randomUUID()}.${ext}`;
    const bucket = 'studio-assets';

    // Ensure the public bucket exists (the client can't create buckets).
    const { data: buckets } = await this.supabase.storage.listBuckets();
    if (!buckets?.find((b) => b.name === bucket)) {
      await this.supabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
      });
    }

    const { error } = await this.supabase.storage
      .from(bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Logo upload failed: ${error.message}`);
      throw new BadRequestException('Upload failed: ' + error.message);
    }

    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return {
      url: urlData.publicUrl,
      path: fileName,
      bucket,
    };
  }
}
