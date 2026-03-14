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
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto';

@Controller('api/v1/membership-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Post()
  @Roles('owner')
  create(@Body() data: CreatePlanDto) {
    return this.plansService.create(data);
  }

  @Patch(':id')
  @Roles('owner')
  update(@Param('id') id: string, @Body() data: UpdatePlanDto) {
    return this.plansService.update(id, data);
  }

  @Delete(':id')
  @Roles('owner')
  remove(@Param('id') id: string) {
    return this.plansService.remove(id);
  }
}
