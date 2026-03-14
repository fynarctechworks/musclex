import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationSettingsDto,
} from './dto';

@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Permissions({ module: 'organizations', action: 'view' })
  findAll(@Query('status') status?: string) {
    return this.organizationService.findAll({ status });
  }

  @Get(':id')
  @Permissions({ module: 'organizations', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Get('slug/:slug')
  @Permissions({ module: 'organizations', action: 'view' })
  findBySlug(@Param('slug') slug: string) {
    return this.organizationService.findBySlug(slug);
  }

  @Get(':id/hierarchy')
  @Permissions({ module: 'organizations', action: 'view' })
  getHierarchy(@Param('id') id: string) {
    return this.organizationService.getHierarchy(id);
  }

  @Post()
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'create' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Patch(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  // ── Organization Settings ───────────────────────────────────

  @Get(':id/settings')
  @Permissions({ module: 'organizations', action: 'view' })
  getSettings(@Param('id') id: string) {
    return this.organizationService.getSettings(id);
  }

  @Patch(':id/settings')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'edit' })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    return this.organizationService.updateSettings(id, dto);
  }
}
