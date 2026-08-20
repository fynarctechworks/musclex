import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminRole, AuditAction } from '@prisma/client';
import { GymOwnerLeadsService } from './gym-owner-leads.service';
import { IngestSecretGuard } from '../../common/guards/ingest-secret.guard';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AuditLogsService, AuditContext } from '../audit-logs/audit-logs.service';
import {
  CreateGymOwnerLeadDto,
  ListGymOwnerLeadsDto,
  UpdateGymOwnerLeadDto,
} from './dto/gym-owner-leads.dto';

/**
 * Gym-owner enquiries from the public marketing website.
 *
 * NOT the member-app "Leads" surface — that one lists registered consumer app
 * users who have not joined a gym yet. These are prospective tenants.
 */
@ApiTags('Gym Owner Leads')
@Controller('gym-owner-leads')
export class GymOwnerLeadsController {
  constructor(
    private readonly service: GymOwnerLeadsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * Ingest from the marketing site. Server-to-server only: `@Public()` skips
   * the admin JWT, and IngestSecretGuard requires the shared secret in its
   * place. Throttled hard because it is the one write path reachable from
   * outside the control plane.
   */
  @Post('ingest')
  @Public()
  @UseGuards(IngestSecretGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiExcludeEndpoint()
  ingest(@Body() dto: CreateGymOwnerLeadDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'List gym-owner enquiries from the marketing site' })
  findAll(@Query() query: ListGymOwnerLeadsDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT, AdminRole.BILLING)
  @ApiOperation({ summary: 'Get one gym-owner enquiry' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Update status or notes on an enquiry' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGymOwnerLeadDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    const lead = await this.service.update(id, dto);
    await this.auditLogs.log(AuditAction.UPDATE, 'gym_owner_lead', id, auditCtx(admin, req), {
      new_value: dto,
    });
    return lead;
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Delete an enquiry (e.g. spam or a GDPR erasure request)' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    const result = await this.service.remove(id);
    await this.auditLogs.log(AuditAction.DELETE, 'gym_owner_lead', id, auditCtx(admin, req));
    return result;
  }
}

/** Builds the AuditContext the audit service expects from the request. */
function auditCtx(admin: any, req: Request): AuditContext {
  return {
    admin_id: admin.id,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
  };
}
