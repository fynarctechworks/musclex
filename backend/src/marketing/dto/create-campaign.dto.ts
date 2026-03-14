import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['all', 'active', 'expiring', 'expired', 'new', 'inactive'])
  segment: string;

  @IsObject()
  @IsOptional()
  segment_filters?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @IsString()
  message_template: string;

  @IsUUID()
  created_by_staff_id: string;

  @IsDateString()
  @IsOptional()
  scheduled_at?: string;
}
