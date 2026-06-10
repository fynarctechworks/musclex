import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ErrorSeverity,
  ErrorStatus,
  ErrorSource,
  AppEnvironment,
} from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryErrorsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ErrorStatus })
  @IsOptional()
  @IsEnum(ErrorStatus)
  status?: ErrorStatus;

  @ApiPropertyOptional({ enum: ErrorSeverity })
  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;

  @ApiPropertyOptional({ enum: ErrorSource })
  @IsOptional()
  @IsEnum(ErrorSource)
  source?: ErrorSource;

  @ApiPropertyOptional({ enum: AppEnvironment })
  @IsOptional()
  @IsEnum(AppEnvironment)
  environment?: AppEnvironment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  module?: string;

  /** Filter to errors that affected a specific gym/tenant. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenant_id?: string;

  /** Free-text search across title + message. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
