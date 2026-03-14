import {
  IsString,
  IsOptional,
  IsUUID,
  IsIn,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateMessageTemplateDto {
  @IsString()
  template_name: string;

  @IsString()
  @IsIn(['email', 'sms', 'whatsapp', 'push_notification'])
  channel: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  content: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @IsUUID()
  @IsOptional()
  organization_id?: string;
}

export class UpdateMessageTemplateDto {
  @IsString()
  @IsOptional()
  template_name?: string;

  @IsString()
  @IsIn(['email', 'sms', 'whatsapp', 'push_notification'])
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
