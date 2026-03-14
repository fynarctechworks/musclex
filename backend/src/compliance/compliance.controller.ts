import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import {
  RequestDataExportDto,
  RequestDataDeletionDto,
  RecordConsentDto,
} from './dto/compliance.dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from '../common';

@Controller('api/v1/compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ─── Consent Endpoints ─────────────────────────────────────

  @Post('consents')
  @Roles('owner', 'admin', 'manager', 'front_desk')
  async recordConsent(
    @Body() dto: RecordConsentDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    const ipAddress = dto.ip_address ||
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress;
    return this.complianceService.recordConsent(
      dto.member_id,
      dto.consent_type,
      dto.granted,
      ipAddress,
      user.user_id,
    );
  }

  @Get('consents/:memberId')
  @Roles('owner', 'admin', 'manager', 'front_desk')
  async getMemberConsents(@Param('memberId') memberId: string) {
    return this.complianceService.getMemberConsents(memberId);
  }

  @Get('consents/:memberId/history')
  @Roles('owner', 'admin')
  async getConsentHistory(@Param('memberId') memberId: string) {
    return this.complianceService.getConsentHistory(memberId);
  }

  // ─── Data Export Endpoints ─────────────────────────────────

  @Post('data-export')
  @Roles('owner', 'admin', 'manager')
  async requestDataExport(@Body() dto: RequestDataExportDto) {
    return this.complianceService.requestDataExport(dto.member_id, dto.format);
  }

  // ─── Data Deletion Endpoints ───────────────────────────────

  @Post('data-deletion')
  @Roles('owner', 'admin')
  async requestDataDeletion(
    @Body() dto: RequestDataDeletionDto,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.requestDataDeletion(
      dto.member_id,
      dto.reason,
      user.user_id,
    );
  }

  @Post('data-deletion/:requestId/process')
  @Roles('owner')
  async processDeletion(
    @Param('requestId') requestId: string,
    @CurrentUser() user: any,
  ) {
    return this.complianceService.processDeletion(requestId, user.user_id);
  }

  @Get('data-deletion')
  @Roles('owner', 'admin')
  async getDeletionRequests(@Query('status') status?: string) {
    return this.complianceService.getDeletionRequests(status);
  }

  // ─── Retention Policy ──────────────────────────────────────

  @Get('retention-policy')
  @Roles('owner', 'admin')
  async getRetentionPolicy() {
    return this.complianceService.getRetentionPolicy();
  }
}
