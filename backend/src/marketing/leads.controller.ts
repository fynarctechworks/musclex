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
import { LeadsService } from './leads.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import { CreateLeadDto, UpdateLeadDto, CreateLeadActivityDto } from './dto';

@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Permissions({ module: 'marketing', action: 'create' })
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Get()
  @Permissions({ module: 'marketing', action: 'view' })
  findAll(
    @Query('organization_id') organizationId?: string,
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
    @Query('lead_source') leadSource?: string,
    @Query('assigned_staff_id') assignedStaffId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.findAll({
      organization_id: organizationId,
      branch_id: branchId,
      status,
      lead_source: leadSource,
      assigned_staff_id: assignedStaffId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('funnel')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'view' })
  getFunnelAnalytics(
    @Query('organization_id') organizationId?: string,
    @Query('branch_id') branchId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.leadsService.getFunnelAnalytics({
      organization_id: organizationId,
      branch_id: branchId,
      start_date: startDate,
      end_date: endDate,
    });
  }

  @Get(':id')
  @Permissions({ module: 'marketing', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'marketing', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Post(':id/activities')
  @Permissions({ module: 'marketing', action: 'create' })
  addActivity(@Param('id') id: string, @Body() dto: CreateLeadActivityDto) {
    dto.lead_id = id;
    return this.leadsService.addActivity(dto);
  }

  @Get(':id/activities')
  @Permissions({ module: 'marketing', action: 'view' })
  getActivities(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadsService.getActivities(
      id,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
