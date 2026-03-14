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
  @IsIn([
    'membership_expiring',
    'member_inactive',
    'lead_created',
    'class_missed',
    'birthday',
    'payment_failed',
  ])
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
  @IsIn([
    'membership_expiring',
    'member_inactive',
    'lead_created',
    'class_missed',
    'birthday',
    'payment_failed',
  ])
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
