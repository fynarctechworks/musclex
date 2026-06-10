import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorSeverity, ErrorSource, AppEnvironment } from '@prisma/client';

/**
 * A single error event reported by a client gym app (or the SCC itself).
 * Payloads are re-scrubbed server-side regardless of client-side masking.
 */
export class IngestErrorEventDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  message!: string;

  @ApiProperty({ enum: ErrorSource })
  @IsEnum(ErrorSource)
  source!: ErrorSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  module?: string;

  @ApiPropertyOptional({ enum: ErrorSeverity })
  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;

  @ApiPropertyOptional({ enum: AppEnvironment })
  @IsOptional()
  @IsEnum(AppEnvironment)
  environment?: AppEnvironment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  stack_trace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  user_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  api_endpoint?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  http_status?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  request_payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  response_payload?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  breadcrumbs?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  device_info?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  browser_info?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  app_version?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  screenshot_url?: string;
}

export class IngestErrorBatchDto {
  @ApiProperty({ type: [IngestErrorEventDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => IngestErrorEventDto)
  events!: IngestErrorEventDto[];
}
