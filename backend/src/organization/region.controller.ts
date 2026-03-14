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
import { RegionService } from './region.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import { CreateRegionDto, UpdateRegionDto } from './dto';

@Controller('api/v1/regions')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @Get()
  @Permissions({ module: 'organizations', action: 'view' })
  findAll(
    @Query('organization_id') organizationId?: string,
    @Query('is_active') isActive?: string,
  ) {
    return this.regionService.findAll({
      organization_id: organizationId,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Permissions({ module: 'organizations', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.regionService.findOne(id);
  }

  @Post()
  @Roles('owner', 'brand_owner', 'regional_manager')
  @Permissions({ module: 'organizations', action: 'create' })
  create(@Body() dto: CreateRegionDto) {
    return this.regionService.create(dto);
  }

  @Patch(':id')
  @Roles('owner', 'brand_owner', 'regional_manager')
  @Permissions({ module: 'organizations', action: 'edit' })
  update(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionService.update(id, dto);
  }

  @Delete(':id')
  @Roles('owner', 'brand_owner')
  @Permissions({ module: 'organizations', action: 'delete' })
  deactivate(@Param('id') id: string) {
    return this.regionService.deactivate(id);
  }
}
