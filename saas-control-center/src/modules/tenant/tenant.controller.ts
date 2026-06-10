import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminRole } from '@prisma/client';
import { TenantService } from './tenant.service';
import { AuthService } from '../auth/auth.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTenantPlanDto,
  TenantFilterDto,
} from './dto/tenant.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'List all tenants with filters and pagination' })
  findAll(@Query() query: TenantFilterDto) {
    return this.tenantService.findAll(query);
  }

  @Get('search')
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Call-center search: find gym by ID or slug' })
  findByIdOrSlug(@Query('q') query: string) {
    return this.tenantService.findByIdOrSlug(query);
  }

  @Post('sync')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Import/refresh tenants from the main app (public.studios)' })
  syncFromStudios(@CurrentAdmin() admin: any, @Req() req: Request) {
    return this.tenantService.syncFromStudios({
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Get(':id')
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Get tenant details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantService.findOne(id);
  }

  @Get(':id/operational')
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({
    summary: 'Live operational snapshot (members, branches, staff, revenue)',
  })
  getOperational(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantService.getOperationalDetail(id);
  }

  @Post()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Create new tenant' })
  create(
    @Body() dto: CreateTenantDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.tenantService.create(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Update tenant details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.tenantService.update(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id/plan')
  @Roles(AdminRole.SUPER, AdminRole.BILLING)
  @ApiOperation({ summary: 'Change tenant subscription plan' })
  changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTenantPlanDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.tenantService.changePlan(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post(':id/suspend')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Suspend tenant' })
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.tenantService.suspend(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post(':id/activate')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Activate tenant' })
  activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.tenantService.activate(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post(':id/impersonate')
  @Roles(AdminRole.SUPER, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Generate impersonation token for tenant' })
  impersonate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.authService.generateImpersonationToken(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
