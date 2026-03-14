import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthApiKeyService } from './auth-api-key.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, JwtPayload } from '../common';

/**
 * API Key management for programmatic access.
 * Only owners can create and manage API keys.
 */
@Controller('api/v1/auth/api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
export class AuthApiKeyController {
  constructor(private apiKeyService: AuthApiKeyService) {}

  @Get()
  listApiKeys() {
    return this.apiKeyService.listApiKeys();
  }

  @Get(':id')
  getApiKey(@Param('id') id: string) {
    return this.apiKeyService.getApiKey(id);
  }

  @Post()
  createApiKey(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeyService.createApiKey(dto, user.user_id);
  }

  @Patch(':id')
  updateApiKey(@Param('id') id: string, @Body() dto: UpdateApiKeyDto) {
    return this.apiKeyService.updateApiKey(id, dto);
  }

  @Post(':id/deactivate')
  deactivateApiKey(@Param('id') id: string) {
    return this.apiKeyService.deactivateApiKey(id);
  }

  @Post(':id/reactivate')
  reactivateApiKey(@Param('id') id: string) {
    return this.apiKeyService.reactivateApiKey(id);
  }

  @Delete(':id')
  deleteApiKey(@Param('id') id: string) {
    return this.apiKeyService.deleteApiKey(id);
  }
}
