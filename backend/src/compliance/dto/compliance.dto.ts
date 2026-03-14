import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class RequestDataExportDto {
  @IsString()
  member_id: string;

  @IsOptional()
  @IsEnum(['json', 'csv'])
  format?: 'json' | 'csv';
}

export class RequestDataDeletionDto {
  @IsString()
  member_id: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class RecordConsentDto {
  @IsString()
  member_id: string;

  @IsEnum(['marketing_email', 'marketing_sms', 'marketing_whatsapp', 'data_processing', 'facial_recognition', 'analytics', 'third_party_sharing'])
  consent_type: string;

  @IsBoolean()
  granted: boolean;

  @IsOptional()
  @IsString()
  ip_address?: string;
}

export class ConsentQueryDto {
  @IsString()
  member_id: string;
}
