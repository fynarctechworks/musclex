import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsInt,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Single source for the accepted trigger names. Create and Update each carried
 * their own hand-maintained list and had already drifted: `class_reminder` was
 * creatable but not editable, so saving an edit to a class-reminder workflow
 * was rejected. Keep this in sync with the executors in
 * AutomationDispatcherService and with LIVE_TRIGGERS in the frontend.
 */
export const TRIGGER_EVENTS = [
  'membership_expiring',
  'member_inactive',
  'member_registered',
  'member_renewed',
  'lead_created',
  'class_missed',
  'class_reminder',
  'birthday',
  'payment_failed',
] as const;

export class CreateWorkflowActionDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  action_order?: number;

  @IsString()
  @IsIn(['send_email', 'send_sms', 'send_whatsapp', 'send_push', 'assign_task', 'update_status'])
  action_type: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  delay_minutes?: number;

  @IsUUID()
  @IsOptional()
  template_id?: string;

  @IsObject()
  @IsOptional()
  action_config?: Record<string, unknown>;
}

export class CreateAutomationWorkflowDto {
  @IsString()
  workflow_name: string;

  @IsString()
  @IsIn(TRIGGER_EVENTS)
  trigger_event: string;

  @IsObject()
  @IsOptional()
  trigger_config?: Record<string, unknown>;

  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowActionDto)
  @IsOptional()
  actions?: CreateWorkflowActionDto[];
}

export class UpdateAutomationWorkflowDto {
  @IsString()
  @IsOptional()
  workflow_name?: string;

  @IsString()
  @IsIn(TRIGGER_EVENTS)
  @IsOptional()
  trigger_event?: string;

  @IsObject()
  @IsOptional()
  trigger_config?: Record<string, unknown>;

  @IsString()
  @IsIn(['active', 'paused', 'archived'])
  @IsOptional()
  status?: string;
}
