import { IsString, IsOptional, IsInt, IsDateString, Min, Max } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  name: string;

  @IsOptional()
  scopes?: Record<string, string[]>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rate_limit_per_minute?: number;

  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class UpdateApiKeyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  scopes?: Record<string, string[]>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  rate_limit_per_minute?: number;
}
