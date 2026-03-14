import { IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @IsOptional()
  @IsString()
  device_fingerprint?: string;

  @IsOptional()
  @IsString()
  device_name?: string;

  @IsOptional()
  @IsString()
  device_type?: string; // mobile | desktop | tablet
}
