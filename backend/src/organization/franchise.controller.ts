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
import { FranchiseService } from './franchise.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateFranchiseOwnerDto,
  UpdateFranchiseOwnerDto,
  CreateBranchFranchiseDto,
} from './dto';

@Controller('api/v1/franchise-owners')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class FranchiseController {
  constructor(private readonly franchiseService: FranchiseService) {}

  @Get()
  @Permissions({ module: 'organizations', action: 'view' })
  findAll(
    @Query('organization_id') organizationId?: string,
    @Query('is_active') isActive?: string,
  ) {
    return this.franchiseService.findAllOwners({
      organization_id: organizationId,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Permissions({ module: 'organizations', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.franchiseService.findOneOwner(id);
  }

  @Post()
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'create' })
  create(@Body() dto: CreateFranchiseOwnerDto) {
    return this.franchiseService.createOwner(dto);
  }

  @Patch(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateFranchiseOwnerDto) {
    return this.franchiseService.updateOwner(id, dto);
  }

  // ── Branch-Franchise Mapping ──────────────────────────────────

  @Post('branch-assignments')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'create' })
  assignBranch(@Body() dto: CreateBranchFranchiseDto) {
    return this.franchiseService.assignBranch(dto);
  }

  @Delete(':franchiseOwnerId/branches/:branchId')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'delete' })
  unassignBranch(
    @Param('branchId') branchId: string,
    @Param('franchiseOwnerId') franchiseOwnerId: string,
  ) {
    return this.franchiseService.unassignBranch(branchId, franchiseOwnerId);
  }

  @Get(':id/branches')
  @Permissions({ module: 'organizations', action: 'view' })
  getBranches(@Param('id') id: string) {
    return this.franchiseService.getBranchFranchises(id);
  }
}
