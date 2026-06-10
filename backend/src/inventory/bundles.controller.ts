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
import { BundleService } from './bundle.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import { CreateBundleDto, UpdateBundleDto } from './dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class BundlesController {
  constructor(private readonly bundleService: BundleService) {}

  @Post('bundles')
  @Roles('owner', 'brand_owner', 'manager', 'branch_manager')
  @Permissions({ module: 'inventory', action: 'create' })
  create(@Body() dto: CreateBundleDto) {
    return this.bundleService.create(dto);
  }

  @Get('bundles')
  @Permissions({ module: 'inventory', action: 'view' })
  findAll(
    @Query('branch_id') branchId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bundleService.findAll({
      branch_id: branchId,
      status,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('bundles/:id')
  @Permissions({ module: 'inventory', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.bundleService.findOne(id);
  }

  @Patch('bundles/:id')
  @Roles('owner', 'brand_owner', 'manager', 'branch_manager')
  @Permissions({ module: 'inventory', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateBundleDto) {
    return this.bundleService.update(id, dto);
  }

  @Delete('bundles/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'inventory', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.bundleService.remove(id);
  }
}
