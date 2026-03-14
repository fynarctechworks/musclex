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
import { AuthSsoService } from './auth-sso.service';
import { CreateSsoProviderDto, UpdateSsoProviderDto } from './dto';
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser, JwtPayload } from '../common';

/**
 * SSO Provider management endpoints.
 * Only owners can manage SSO configurations.
 *
 * The actual SSO login flow (redirects, callbacks, token exchange)
 * requires per-provider Passport strategies and is handled separately
 * once a provider is configured and activated.
 */
@Controller('api/v1/auth/sso')
export class AuthSsoController {
  constructor(private ssoService: AuthSsoService) {}

  /**
   * Get active SSO providers for the login page (public within tenant context).
   */
  @Get('providers/active')
  @UseGuards(JwtAuthGuard)
  getActiveProviders() {
    return this.ssoService.getActiveProviders();
  }

  /**
   * List all SSO providers (admin view).
   */
  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  listProviders() {
    return this.ssoService.listProviders();
  }

  /**
   * Get a single SSO provider by ID.
   */
  @Get('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  getProvider(@Param('id') id: string) {
    return this.ssoService.getProvider(id);
  }

  /**
   * Create a new SSO provider configuration.
   */
  @Post('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  createProvider(
    @Body() dto: CreateSsoProviderDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ssoService.createProvider(dto, user.user_id);
  }

  /**
   * Update an SSO provider configuration.
   */
  @Patch('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  updateProvider(@Param('id') id: string, @Body() dto: UpdateSsoProviderDto) {
    return this.ssoService.updateProvider(id, dto);
  }

  /**
   * Delete an SSO provider.
   */
  @Delete('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner')
  deleteProvider(@Param('id') id: string) {
    return this.ssoService.deleteProvider(id);
  }
}
