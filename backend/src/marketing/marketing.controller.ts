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
import { MarketingService } from './marketing.service';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';
import { CreateCampaignDto, UpdateCampaignDto } from './dto';

@Controller('api/v1/campaigns')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get()
  @Permissions({ module: 'marketing', action: 'view' })
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketingService.findAll({
      status,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Post()
  @Permissions({ module: 'marketing', action: 'create' })
  create(@Body() data: CreateCampaignDto) {
    return this.marketingService.create(data);
  }

  @Get(':id')
  @Permissions({ module: 'marketing', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.marketingService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'marketing', action: 'edit' })
  update(@Param('id') id: string, @Body() data: UpdateCampaignDto) {
    return this.marketingService.update(id, data);
  }

  @Delete(':id')
  @Permissions({ module: 'marketing', action: 'delete' })
  remove(@Param('id') id: string) {
    return this.marketingService.remove(id);
  }

  @Post(':id/send')
  @Permissions({ module: 'marketing', action: 'edit' })
  sendCampaign(@Param('id') id: string) {
    return this.marketingService.sendCampaign(id);
  }

  @Get(':id/audience')
  @Permissions({ module: 'marketing', action: 'view' })
  getCampaignAudience(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketingService.getCampaignAudience(id, {
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Patch(':campaignId/audience/:memberId')
  @Permissions({ module: 'marketing', action: 'edit' })
  updateAudienceStatus(
    @Param('campaignId') campaignId: string,
    @Param('memberId') memberId: string,
    @Body('status') status: string,
  ) {
    return this.marketingService.updateAudienceStatus(campaignId, memberId, status);
  }

  @Get(':id/analytics')
  @Permissions({ module: 'marketing', action: 'view' })
  getCampaignAnalytics(@Param('id') id: string) {
    return this.marketingService.getCampaignAnalytics(id);
  }
}
