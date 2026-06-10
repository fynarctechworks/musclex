import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminRole } from '@prisma/client';
import { PlansService } from './plans.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreatePlanDto, UpdatePlanDto } from './dto/plans.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'List all subscription plans' })
  findAll(@Query('include_inactive') includeInactive?: boolean) {
    return this.plansService.findAll(includeInactive);
  }

  @Get('assignable')
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({
    summary: 'List plans valid for tenant assignment (from the scc table the FK references)',
  })
  findAssignable() {
    return this.plansService.findAssignable();
  }

  @Get(':id')
  @Roles(AdminRole.SUPER, AdminRole.BILLING, AdminRole.SUPPORT)
  @ApiOperation({ summary: 'Get plan details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Create subscription plan' })
  create(
    @Body() dto: CreatePlanDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.create(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Put(':id')
  @Roles(AdminRole.SUPER)
  @ApiOperation({ summary: 'Full update of a plan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.update(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partial update of a plan' })
  partialUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.update(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a plan (sets is_active=false)' })
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.remove(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post(':id/toggle')
  @ApiOperation({ summary: 'Toggle plan active/inactive' })
  toggle(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.toggleActive(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id/featured')
  @ApiOperation({ summary: 'Toggle isFeatured flag' })
  toggleFeatured(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.toggleFeatured(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id/sort')
  @ApiOperation({ summary: 'Update sort order' })
  updateSort(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('sort_order') sortOrder: number,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.plansService.updateSortOrder(id, sortOrder, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
