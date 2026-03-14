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
import { WebhooksService } from '../services/webhooks.service';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
} from '../dto';
import {
  JwtAuthGuard,
  RolesGuard,
  Roles,
  CurrentUser,
  JwtPayload,
} from '../../common';

@Controller('api/v1/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner', 'admin')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Get('events')
  getSupportedEvents() {
    return this.webhooksService.getSupportedEvents();
  }

  @Get()
  getWebhooks(@CurrentUser() user: JwtPayload) {
    return this.webhooksService.getWebhooks(user.studio_id);
  }

  @Get(':id')
  getWebhook(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.webhooksService.getWebhook(user.studio_id, id);
  }

  @Post()
  @Roles('owner')
  createWebhook(@CurrentUser() user: JwtPayload, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.createWebhook(user.studio_id, dto, user.user_id);
  }

  @Patch(':id')
  @Roles('owner')
  updateWebhook(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(user.studio_id, id, dto);
  }

  @Delete(':id')
  @Roles('owner')
  deleteWebhook(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.webhooksService.deleteWebhook(user.studio_id, id);
  }

  @Post(':id/rotate-secret')
  @Roles('owner')
  rotateSecret(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.webhooksService.rotateSecret(user.studio_id, id);
  }

  @Get(':id/deliveries')
  getDeliveries(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhooksService.getDeliveries(
      user.studio_id,
      id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('deliveries/:deliveryId/retry')
  @Roles('owner')
  retryDelivery(
    @CurrentUser() user: JwtPayload,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooksService.retryDelivery(user.studio_id, deliveryId);
  }
}
