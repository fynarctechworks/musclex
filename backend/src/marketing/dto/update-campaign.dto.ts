import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsIn,
  IsObject,
} from 'class-validator';

export class UpdateCampaignDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsIn(['all', 'active', 'expiring', 'expired', 'new', 'inactive'])
  @IsOptional()
  segment?: string;

  @IsObject()
  @IsOptional()
  segment_filters?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  channels?: string[];

  @IsString()
  @IsOptional()
  message_template?: string;

  @IsString()
  @IsIn(['draft', 'scheduled', 'sent', 'cancelled'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  scheduled_at?: string;
}
