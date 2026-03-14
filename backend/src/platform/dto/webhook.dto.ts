import {
  IsString,
  IsUrl,
  IsArray,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';

export class CreateWebhookDto {
  @IsString()
  name: string;

  @IsUrl({ require_tld: false })
  url: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  events: string[]; // member.created, payment.received, checkin.completed, class.booked, etc.

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retry_count?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeout_ms?: number;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  retry_count?: number;

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(30000)
  timeout_ms?: number;
}

export class WebhookDeliveryQueryDto {
  @IsOptional()
  @IsString()
  status?: string; // pending | delivered | failed

  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
