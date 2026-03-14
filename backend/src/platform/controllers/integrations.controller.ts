import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { IntegrationsService } from '../services/integrations.service';
import {
  CreateIntegrationDto,
  UpdateIntegrationDto,
} from '../dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  JwtPayload,
} from '../../common';

@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Get('catalog')
  getCatalog() {
    return this.integrationsService.getAvailableCatalog();
  }

  @Get()
  getIntegrations(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.getIntegrations(user.studio_id);
  }

  @Get(':id')
  getIntegration(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.integrationsService.getIntegration(user.studio_id, id);
  }

  @Post()
  @Roles('owner')
  createIntegration(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateIntegrationDto,
  ) {
    return this.integrationsService.createIntegration(user.studio_id, dto, user.user_id);
  }

  @Patch(':id')
  @Roles('owner')
  updateIntegration(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.updateIntegration(user.studio_id, id, dto);
  }

  @Patch(':id/toggle')
  @Roles('owner')
  toggleIntegration(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.integrationsService.toggleIntegration(user.studio_id, id, enabled);
  }

  @Post(':id/test')
  testIntegration(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.integrationsService.testIntegration(user.studio_id, id);
  }

  @Delete(':id')
  @Roles('owner')
  deleteIntegration(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.integrationsService.deleteIntegration(user.studio_id, id);
  }
}
