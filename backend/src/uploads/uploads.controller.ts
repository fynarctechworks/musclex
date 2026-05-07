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

    const ext = file.originalname.split('.').pop() || 'jpg';
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
}
