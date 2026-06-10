import { Body, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberDataService } from './member-data.service';
import { MemberBillingService } from './member-billing.service';
import { MemberProgressPhotoService } from './member-progress-photo.service';
import { MemberAvatarService } from './member-avatar.service';
import {
  BodyMetricDto,
  UpdateProfileDto,
  RenewMembershipDto,
  ProgressPhotoUploadUrlDto,
  ProgressPhotoConfirmDto,
  AvatarUploadUrlDto,
  AvatarConfirmDto,
} from './dto';

/**
 * Core-loop read endpoints + body-metric logging. Every handler derives the
 * member from @CurrentMember (the verified token) — never from the client.
 * Responses are wrapped in { data, meta } by EnvelopeInterceptor.
 */
@MemberDataController()
export class MemberCoreController {
  constructor(
    private readonly data: MemberDataService,
    private readonly billing: MemberBillingService,
    private readonly photos: MemberProgressPhotoService,
    private readonly avatar: MemberAvatarService,
  ) {}

  @Get('me')
  me(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getProfile(member);
  }

  @Patch('me')
  updateMe(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.data.updateProfile(member, dto);
  }

  /**
   * Get a signed URL to upload a new profile avatar directly to storage. The
   * confirmed photo lands on `members.profile_photo_url`, so it shows in both the
   * member app and the admin panel.
   */
  @Post('me/avatar/upload-url')
  @HttpCode(200)
  avatarUploadUrl(
    @CurrentMember() member: CurrentMemberContext,
    // Body is validated (content-type allowlist); the path/identity are derived
    // from the token, and the bucket enforces the real MIME on upload.
    @Body() _dto: AvatarUploadUrlDto,
  ) {
    return this.avatar.createUploadUrl(member);
  }

  /** Confirm an uploaded avatar — persists the signed URL to the member record. */
  @Post('me/avatar')
  @HttpCode(200)
  confirmAvatar(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: AvatarConfirmDto,
  ) {
    return this.avatar.confirm(member, dto.avatarId);
  }

  @Get('home')
  home(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getHome(member);
  }

  @Get('gym/occupancy')
  occupancy(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getOccupancy(member);
  }

  @Get('gym/locations')
  locations(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getLocations(member);
  }

  @Get('membership')
  membership(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getMembership(member);
  }

  /** Start a renewal — returns a Razorpay order; payment is confirmed by webhook. */
  @Post('membership/renew')
  @HttpCode(200)
  @Idempotent()
  renew(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: RenewMembershipDto,
  ) {
    return this.billing.renew(member, dto.planId);
  }

  @Get('progress')
  progress(@CurrentMember() member: CurrentMemberContext) {
    return this.data.getProgress(member);
  }

  @Post('progress/metrics')
  @HttpCode(201)
  @Idempotent()
  addMetric(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: BodyMetricDto,
  ) {
    return this.data.addMetric(member, dto);
  }

  /** Get a signed URL to upload a progress photo directly to storage. */
  @Post('progress/photos/upload-url')
  @HttpCode(200)
  photoUploadUrl(
    @CurrentMember() member: CurrentMemberContext,
    // Body is validated (content type allowlist) even though the path/identity
    // are derived from the token; the bucket enforces the real MIME on upload.
    @Body() _dto: ProgressPhotoUploadUrlDto,
  ) {
    return this.photos.createUploadUrl(member);
  }

  /** Confirm an uploaded progress photo (persists the row). */
  @Post('progress/photos')
  @HttpCode(201)
  confirmPhoto(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: ProgressPhotoConfirmDto,
  ) {
    return this.photos.confirm(member, dto.photoId, dto.takenAt);
  }
}
