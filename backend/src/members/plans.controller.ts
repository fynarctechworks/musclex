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
import { PlansService } from './plans.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto';

@Controller('api/v1/membership-plans')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('organization_id') organization_id?: string,
    @Query('plan_type') plan_type?: string,
    @Query('multi_branch_access') multi_branch_access?: string,
    @Query('is_active') is_active?: string,
  ) {
    return this.plansService.findAll({
      branch_id,
      organization_id,
      plan_type,
      multi_branch_access: multi_branch_access === 'true' ? true : multi_branch_access === 'false' ? false : undefined,
      is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined,
    });
  }

  @Get('by-type/:planType')
  findByType(@Param('planType') planType: string) {
    return this.plansService.findByType(planType);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  // Plans control pricing + access scope — owner + brand_owner only.
  // Branch managers cannot unilaterally change company-wide pricing.
  // Permissions guard adds fine-grained override via the settings.edit
  // permission matrix (a brand_owner may have settings.edit disabled).

  @Post()
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'settings', action: 'edit' })
  create(@Body() data: CreatePlanDto) {
    return this.plansService.create(data);
  }

  @Patch(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'settings', action: 'edit' })
  update(@Param('id') id: string, @Body() data: UpdatePlanDto) {
    return this.plansService.update(id, data);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'settings', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
