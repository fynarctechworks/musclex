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
import { BranchesService } from './branches.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { UpdateBranchSettingsDto } from '../organization/dto';

@Controller('api/v1/branches')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions({ module: 'branches', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('organization_id') organizationId?: string,
    @Query('region_id') regionId?: string,
    @Query('status') status?: string,
  ) {
    return this.branchesService.findAll(user, {
      organization_id: organizationId,
      region_id: regionId,
      status,
    });
  }

  @Get(':id')
  @Permissions({ module: 'branches', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'branches', action: 'create' })
  create(@Body() data: CreateBranchDto) {
    return this.branchesService.create(data);
  }

  @Patch(':id')
  @Roles('owner', 'brand_owner', 'regional_manager', 'branch_manager')
  @Permissions({ module: 'branches', action: 'edit' })
  update(@Param('id') id: string, @Body() data: UpdateBranchDto) {
    return this.branchesService.update(id, data);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'branches', action: 'delete' })
  deactivate(@Param('id') id: string) {
    return this.branchesService.deactivate(id);
  }

  // ── Branch Settings ─────────────────────────────────────────

  @Get(':id/settings')
  @Permissions({ module: 'branches', action: 'view' })
  getSettings(@Param('id') id: string) {
    return this.branchesService.getSettings(id);
  }

  @Patch(':id/settings')
  @Roles('owner', 'brand_owner', 'branch_manager')
  @Permissions({ module: 'branches', action: 'edit' })
  updateSettings(
    @Param('id') id: string,
    @Body() dto: UpdateBranchSettingsDto,
  ) {
    return this.branchesService.updateSettings(id, dto);
  }
}
