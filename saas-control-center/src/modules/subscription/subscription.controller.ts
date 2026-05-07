import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { CreateSubscriptionDto, SubscriptionFilterDto } from './dto/subscription.dto';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'List all subscriptions' })
  findAll(@Query() query: SubscriptionFilterDto) {
    return this.subscriptionService.findAll(query);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Get subscriptions expiring within N days' })
  getExpiring(@Query('days') days?: number) {
    return this.subscriptionService.getExpiringSoon(days || 7);
  }

  @Post()
  @ApiOperation({ summary: 'Create subscription for a tenant' })
  create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.subscriptionService.create(dto, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: any,
    @Req() req: Request,
  ) {
    return this.subscriptionService.cancel(id, {
      admin_id: admin.id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });
  }
}
