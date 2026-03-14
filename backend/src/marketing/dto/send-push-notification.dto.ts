import { IsString, IsUUID, IsOptional, IsObject, MaxLength } from 'class-validator';

export class SendPushNotificationDto {
  @IsUUID()
  member_id: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(1000)
  message: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, unknown>;
}
