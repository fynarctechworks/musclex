import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateSystemNotificationDto {
  @IsString()
  type: string; // info | warning | critical | maintenance

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  action_url?: string;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class NotificationQueryDto {
  @IsOptional()
  @IsBoolean()
  unread_only?: boolean;

  @IsOptional()
  @IsString()
  type?: string;
}
