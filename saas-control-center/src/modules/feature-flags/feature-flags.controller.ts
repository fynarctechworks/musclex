import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { FeatureFlagsService } from './feature-flags.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import {
  CreateFeatureFlagDto,
  UpdateFeatureFlagDto,
  SetPlanFlagDto,
  SetTenantFlagDto,
} from './dto/feature-flags.dto';

@ApiTags('Feature Flags')
@ApiBearerAuth()
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  @ApiOperation({ summary: 'List all feature flags' })
  findAll() {
    return this.featureFlagsService.findAll();
  }

  @Get('resolve/:tenantId')
  @ApiOperation({ summary: 'Resolve all flags for a tenant (tenant > plan > global)' })
  resolve(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.featureFlagsService.resolveForTenant(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create feature flag' })
  create(
    @Body() dto: CreateFeatureFlagDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.featureFlagsService.create(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update feature flag' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.featureFlagsService.update(id, dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('plan')
  @ApiOperation({ summary: 'Set feature flag for a plan' })
  setPlanFlag(
    @Body() dto: SetPlanFlagDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.featureFlagsService.setPlanFlag(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post('tenant')
  @ApiOperation({ summary: 'Set feature flag override for a tenant' })
  setTenantFlag(
    @Body() dto: SetTenantFlagDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.featureFlagsService.setTenantFlag(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
