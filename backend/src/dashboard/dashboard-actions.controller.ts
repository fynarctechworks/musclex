import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActionQueueService } from './action-queue.service';
import {
  PushSubscriptionService,
  type PushSubscriptionPayload,
} from './push-subscription.service';
import {
  JwtAuthGuard,
  PermissionsGuard,
  Permissions,
  CurrentUser,
  JwtPayload,
} from '../common';

/**
 * Action Stack + Push notifications.
 *
 * Owns every endpoint that mutates or reads the user-facing action queue
 * and the web-push subscription registry. Split out from DashboardController
 * per code-review item #4 (controller bloat).
 */
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardActionsController {
  constructor(
    private readonly actionQueue: ActionQueueService,
    private readonly push: PushSubscriptionService,
  ) {}

  @Get('actions')
  @Permissions({ module: 'dashboard', action: 'view' })
  getActions(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
  ) {
    return this.actionQueue.getActions(user, branch_id);
  }

  @Post('actions/:id/dismiss')
  @Permissions({ module: 'dashboard', action: 'edit' })
  dismissAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { branch_id?: string } = {},
  ) {
    if (!id) throw new BadRequestException('Missing action id');
    return this.actionQueue.dismiss(user, id, body.branch_id);
  }

  @Post('actions/:id/snooze')
  @Permissions({ module: 'dashboard', action: 'edit' })
  snoozeAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { until?: string; hours?: number; branch_id?: string } = {},
  ) {
    if (!id) throw new BadRequestException('Missing action id');
    let until: Date;
    if (body.until) {
      until = new Date(body.until);
      if (Number.isNaN(until.getTime())) {
        throw new BadRequestException('Invalid `until` timestamp');
      }
    } else {
      const hours = Math.min(Math.max(body.hours ?? 24, 1), 24 * 30);
      until = new Date(Date.now() + hours * 3600 * 1000);
    }
    return this.actionQueue.snooze(user, id, until, body.branch_id);
  }

  @Post('actions/:id/resolve')
  @Permissions({ module: 'dashboard', action: 'edit' })
  resolveAction(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { branch_id?: string; payload?: Record<string, unknown> } = {},
  ) {
    if (!id) throw new BadRequestException('Missing action id');
    return this.actionQueue.resolve(user, id, body.branch_id, body.payload);
  }

  @Get('action-receipts')
  @Permissions({ module: 'dashboard', action: 'view' })
  getActionReceipts(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('since_days') since_days?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 25;
    const days = since_days ? parseInt(since_days, 10) : 7;
    return this.actionQueue.getReceipts(
      user,
      Number.isFinite(lim) ? lim : 25,
      Number.isFinite(days) ? days : 7,
    );
  }

  // ── Push notifications (Wave 6) ───────────────────────────────────

  @Get('push/public-key')
  @Permissions({ module: 'dashboard', action: 'view' })
  getPushPublicKey() {
    const key = this.push.getPublicKey();
    return { public_key: key, supported: !!key };
  }

  @Post('push/subscribe')
  @Permissions({ module: 'dashboard', action: 'view' })
  subscribePush(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: { subscription: PushSubscriptionPayload; user_agent?: string },
  ) {
    if (!body?.subscription?.endpoint || !body?.subscription?.keys?.auth) {
      throw new BadRequestException('Invalid subscription payload');
    }
    return this.push.subscribe(user, body.subscription, body.user_agent);
  }

  @Post('push/unsubscribe')
  @Permissions({ module: 'dashboard', action: 'view' })
  unsubscribePush(
    @CurrentUser() user: JwtPayload,
    @Body() body: { endpoint: string },
  ) {
    if (!body?.endpoint) throw new BadRequestException('Missing endpoint');
    return this.push.unsubscribe(user, body.endpoint);
  }
}
