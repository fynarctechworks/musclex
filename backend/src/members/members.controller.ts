import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { MemberProfileService } from './member-profile.service';
import { MemberCrmService } from './member-crm.service';
import {
  CreateMemberDto,
  UpdateMemberDto,
  FreezeMemberDto,
  RenewMemberDto,
  UpsertMemberProfileDto,
  CreateBodyStatsDto,
  UpdateBodyStatsDto,
  CreateProgressPhotoDto,
  CreateMemberNoteDto,
  CreateMemberTagDto,
  AssignTagDto,
  CreateMemberDocumentDto,
  UpdateMemberDocumentDto,
  CreateMemberReferralDto,
  UpdateReferralStatusDto,
} from './dto';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

@Controller('api/v1/members')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class MembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly profileService: MemberProfileService,
    private readonly crmService: MemberCrmService,
  ) {}

  // ── Member CRUD ───────────────────────────────────────────────

  @Get()
  @Permissions({ module: 'members', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
    @Query('search') search?: string,
    @Query('tag_id') tag_id?: string,
    @Query('trainer_id') trainer_id?: string,
    @Query('churn_risk') churn_risk?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.membersService.findAll({
      status,
      branch_id: branch_id,
      organization_id,
      search,
      tag_id,
      trainer_id,
      churn_risk,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      user_branch_ids: user.role !== 'owner' && user.role !== 'brand_owner'
        ? user.branch_ids
        : undefined,
    });
  }

  @Get('churn-risk')
  @Permissions({ module: 'members', action: 'view' })
  getChurnRisk(@Query('risk') risk?: string) {
    return this.membersService.getChurnRisk(risk);
  }

  @Get('lifecycle')
  @Permissions({ module: 'members', action: 'view' })
  getLifecycle(
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
  ) {
    return this.membersService.getLifecycleSummary({ branch_id, organization_id });
  }

  @Post()
  @Permissions({ module: 'members', action: 'create' })
  create(@Body() dto: CreateMemberDto) {
    return this.membersService.create(dto);
  }

  @Get(':id')
  @Permissions({ module: 'members', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'members', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateMemberDto) {
    return this.membersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner', 'branch_manager')
  @Permissions({ module: 'members', action: 'delete' })
  softDelete(@Param('id') id: string) {
    return this.membersService.softDelete(id);
  }

  // ── Freeze / Unfreeze / Renew ─────────────────────────────────

  @Post(':id/freeze')
  @Permissions({ module: 'members', action: 'edit' })
  freeze(@Param('id') id: string, @Body() dto: FreezeMemberDto) {
    return this.membersService.freeze(id, dto);
  }

  @Post(':id/unfreeze')
  @Permissions({ module: 'members', action: 'edit' })
  unfreeze(@Param('id') id: string) {
    return this.membersService.unfreeze(id);
  }

  @Post(':id/renew')
  @Permissions({ module: 'members', action: 'edit' })
  renew(@Param('id') id: string, @Body() dto: RenewMemberDto) {
    return this.membersService.renew(id, dto);
  }

  @Post(':id/face-descriptor')
  @Permissions({ module: 'members', action: 'edit' })
  saveFaceDescriptor(
    @Param('id') id: string,
    @Body('descriptor') descriptor: number[],
  ) {
    return this.membersService.saveFaceDescriptor(id, descriptor);
  }

  // ── Health Profile ────────────────────────────────────────────

  @Get(':id/profile')
  @Permissions({ module: 'members', action: 'view' })
  getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Patch(':id/profile')
  @Permissions({ module: 'members', action: 'edit' })
  upsertProfile(@Param('id') id: string, @Body() dto: UpsertMemberProfileDto) {
    return this.profileService.upsertProfile(id, dto);
  }

  // ── Body Stats (Progress Tracking) ────────────────────────────

  @Get(':id/body-stats')
  @Permissions({ module: 'members', action: 'view' })
  getBodyStats(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.profileService.getBodyStats(id, limit ? parseInt(limit) : 50);
  }

  @Post(':id/body-stats')
  @Permissions({ module: 'members', action: 'edit' })
  createBodyStats(@Param('id') id: string, @Body() dto: CreateBodyStatsDto) {
    return this.profileService.createBodyStats(id, dto);
  }

  @Patch('body-stats/:statsId')
  @Permissions({ module: 'members', action: 'edit' })
  updateBodyStats(@Param('statsId') statsId: string, @Body() dto: UpdateBodyStatsDto) {
    return this.profileService.updateBodyStats(statsId, dto);
  }

  @Delete('body-stats/:statsId')
  @Permissions({ module: 'members', action: 'edit' })
  deleteBodyStats(@Param('statsId') statsId: string) {
    return this.profileService.deleteBodyStats(statsId);
  }

  @Get(':id/progress')
  @Permissions({ module: 'members', action: 'view' })
  getProgressSummary(@Param('id') id: string) {
    return this.profileService.getProgressSummary(id);
  }

  // ── Progress Photos ───────────────────────────────────────────

  @Get(':id/progress-photos')
  @Permissions({ module: 'members', action: 'view' })
  getProgressPhotos(@Param('id') id: string) {
    return this.profileService.getProgressPhotos(id);
  }

  @Post(':id/progress-photos')
  @Permissions({ module: 'members', action: 'edit' })
  createProgressPhoto(@Param('id') id: string, @Body() dto: CreateProgressPhotoDto) {
    return this.profileService.createProgressPhoto(id, dto);
  }

  @Delete('progress-photos/:photoId')
  @Permissions({ module: 'members', action: 'delete' })
  deleteProgressPhoto(@Param('photoId') photoId: string) {
    return this.profileService.deleteProgressPhoto(photoId);
  }

  // ── Visit Stats ───────────────────────────────────────────────

  @Get(':id/visits')
  @Permissions({ module: 'members', action: 'view' })
  getVisitStats(@Param('id') id: string) {
    return this.membersService.getVisitStats(id);
  }

  // ── Notes ─────────────────────────────────────────────────────

  @Get(':id/notes')
  @Permissions({ module: 'members', action: 'view' })
  getNotes(@Param('id') id: string) {
    return this.crmService.getNotes(id);
  }

  @Post(':id/notes')
  @Permissions({ module: 'members', action: 'edit' })
  createNote(@Param('id') id: string, @Body() dto: CreateMemberNoteDto) {
    return this.crmService.createNote(id, dto);
  }

  @Delete('notes/:noteId')
  @Permissions({ module: 'members', action: 'edit' })
  deleteNote(@Param('noteId') noteId: string) {
    return this.crmService.deleteNote(noteId);
  }

  // ── Tags ──────────────────────────────────────────────────────

  @Get('tags/all')
  @Permissions({ module: 'members', action: 'view' })
  getAllTags() {
    return this.crmService.getAllTags();
  }

  @Post('tags')
  @Permissions({ module: 'members', action: 'create' })
  createTag(@Body() dto: CreateMemberTagDto) {
    return this.crmService.createTag(dto);
  }

  @Delete('tags/:tagId')
  @Permissions({ module: 'members', action: 'delete' })
  deleteTag(@Param('tagId') tagId: string) {
    return this.crmService.deleteTag(tagId);
  }

  @Get(':id/tags')
  @Permissions({ module: 'members', action: 'view' })
  getMemberTags(@Param('id') id: string) {
    return this.crmService.getMemberTags(id);
  }

  @Post(':id/tags')
  @Permissions({ module: 'members', action: 'edit' })
  assignTag(@Param('id') id: string, @Body() dto: AssignTagDto) {
    return this.crmService.assignTag(id, dto.tag_id);
  }

  @Delete(':id/tags/:tagId')
  @Permissions({ module: 'members', action: 'edit' })
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.crmService.removeTag(id, tagId);
  }

  // ── Documents ─────────────────────────────────────────────────

  @Get(':id/documents')
  @Permissions({ module: 'members', action: 'view' })
  getDocuments(@Param('id') id: string) {
    return this.crmService.getDocuments(id);
  }

  @Post(':id/documents')
  @Permissions({ module: 'members', action: 'edit' })
  uploadDocument(@Param('id') id: string, @Body() dto: CreateMemberDocumentDto) {
    return this.crmService.uploadDocument(id, dto);
  }

  @Patch('documents/:documentId')
  @Permissions({ module: 'members', action: 'edit' })
  updateDocument(@Param('documentId') documentId: string, @Body() dto: UpdateMemberDocumentDto) {
    return this.crmService.updateDocument(documentId, dto);
  }

  @Delete('documents/:documentId')
  @Permissions({ module: 'members', action: 'delete' })
  deleteDocument(@Param('documentId') documentId: string) {
    return this.crmService.deleteDocument(documentId);
  }

  // ── Referrals ─────────────────────────────────────────────────

  @Get(':id/referrals')
  @Permissions({ module: 'members', action: 'view' })
  getReferrals(@Param('id') id: string) {
    return this.crmService.getReferrals(id);
  }

  @Post('referrals')
  @Permissions({ module: 'members', action: 'create' })
  createReferral(@Body() dto: CreateMemberReferralDto) {
    return this.crmService.createReferral(dto);
  }

  @Patch('referrals/:referralId')
  @Permissions({ module: 'members', action: 'edit' })
  updateReferralStatus(
    @Param('referralId') referralId: string,
    @Body() dto: UpdateReferralStatusDto,
  ) {
    return this.crmService.updateReferralStatus(referralId, dto.reward_status);
  }
}
