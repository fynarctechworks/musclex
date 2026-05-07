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
import { AutomationService } from './automation.service';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Roles,
  Permissions,
} from '../common';
import {
  CreateMessageTemplateDto,
  UpdateMessageTemplateDto,
  CreateAutomationWorkflowDto,
  UpdateAutomationWorkflowDto,
  CreateWorkflowActionDto,
  CreateReferralProgramDto,
  UpdateReferralProgramDto,
} from './dto';
import { SendPushNotificationDto } from './dto/send-push-notification.dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // ── Message Templates ─────────────────────────────────────────

  @Post('message-templates/seed-defaults')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  seedDefaultTemplates() {
    return this.automationService.seedDefaultTemplates();
  }

  @Post('message-templates')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  createTemplate(@Body() dto: CreateMessageTemplateDto) {
    return this.automationService.createTemplate(dto);
  }

  @Get('message-templates')
  @Permissions({ module: 'marketing', action: 'view' })
  findAllTemplates(
    @Query('organization_id') organizationId?: string,
    @Query('channel') channel?: string,
    @Query('is_active') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.automationService.findAllTemplates({
      organization_id: organizationId,
      channel,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
      search,
    });
  }

  @Get('message-templates/:id')
  @Permissions({ module: 'marketing', action: 'view' })
  findOneTemplate(@Param('id') id: string) {
    return this.automationService.findOneTemplate(id);
  }

  @Patch('message-templates/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'edit' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateMessageTemplateDto) {
    return this.automationService.updateTemplate(id, dto);
  }

  @Delete('message-templates/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'delete' })
  deleteTemplate(@Param('id') id: string) {
    return this.automationService.deleteTemplate(id);
  }

  // ── Automation Workflows ──────────────────────────────────────

  @Post('workflows/seed-defaults')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  seedDefaultWorkflows() {
    return this.automationService.seedDefaultWorkflows();
  }

  @Post('workflows')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  createWorkflow(@Body() dto: CreateAutomationWorkflowDto) {
    return this.automationService.createWorkflow(dto);
  }

  @Get('workflows')
  @Permissions({ module: 'marketing', action: 'view' })
  findAllWorkflows(
    @Query('organization_id') organizationId?: string,
    @Query('trigger_event') triggerEvent?: string,
    @Query('status') status?: string,
  ) {
    return this.automationService.findAllWorkflows({
      organization_id: organizationId,
      trigger_event: triggerEvent,
      status,
    });
  }

  @Get('workflows/:id')
  @Permissions({ module: 'marketing', action: 'view' })
  findOneWorkflow(@Param('id') id: string) {
    return this.automationService.findOneWorkflow(id);
  }

  @Patch('workflows/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'edit' })
  updateWorkflow(@Param('id') id: string, @Body() dto: UpdateAutomationWorkflowDto) {
    return this.automationService.updateWorkflow(id, dto);
  }

  @Post('workflows/:id/actions')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  addWorkflowAction(@Param('id') id: string, @Body() dto: CreateWorkflowActionDto) {
    return this.automationService.addWorkflowAction(id, dto);
  }

  @Delete('workflows/:workflowId/actions/:actionId')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'delete' })
  removeWorkflowAction(@Param('actionId') actionId: string) {
    return this.automationService.removeWorkflowAction(actionId);
  }

  @Delete('workflows/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'delete' })
  deleteWorkflow(@Param('id') id: string) {
    return this.automationService.deleteWorkflow(id);
  }

  // ── Referral Programs ─────────────────────────────────────────

  @Post('referral-programs')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'create' })
  createReferralProgram(@Body() dto: CreateReferralProgramDto) {
    return this.automationService.createReferralProgram(dto);
  }

  @Get('referral-programs')
  @Permissions({ module: 'marketing', action: 'view' })
  findAllReferralPrograms(
    @Query('organization_id') organizationId?: string,
    @Query('status') status?: string,
  ) {
    return this.automationService.findAllReferralPrograms({
      organization_id: organizationId,
      status,
    });
  }

  @Get('referral-programs/stats')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'view' })
  getReferralStats(@Query('organization_id') organizationId?: string) {
    return this.automationService.getReferralStats(organizationId);
  }

  @Get('referral-programs/:id')
  @Permissions({ module: 'marketing', action: 'view' })
  findOneReferralProgram(@Param('id') id: string) {
    return this.automationService.findOneReferralProgram(id);
  }

  @Patch('referral-programs/:id')
  @Roles('owner', 'brand_owner', 'manager')
  @Permissions({ module: 'marketing', action: 'edit' })
  updateReferralProgram(@Param('id') id: string, @Body() dto: UpdateReferralProgramDto) {
    return this.automationService.updateReferralProgram(id, dto);
  }

  // ── Push Notifications ────────────────────────────────────────

  @Post('push-notifications')
  @Permissions({ module: 'marketing', action: 'create' })
  sendPushNotification(@Body() data: SendPushNotificationDto) {
    return this.automationService.sendPushNotification(data);
  }

  @Get('push-notifications/:memberId')
  @Permissions({ module: 'marketing', action: 'view' })
  getMemberNotifications(
    @Param('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.automationService.getMemberNotifications(
      memberId,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Patch('push-notifications/:id/read')
  @Permissions({ module: 'marketing', action: 'edit' })
  markNotificationRead(@Param('id') id: string) {
    return this.automationService.markNotificationRead(id);
  }
}
