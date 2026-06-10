import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { ErrorSeverity, ErrorStatus } from '@prisma/client';

export class UpdateErrorDto {
  @ApiPropertyOptional({ enum: ErrorStatus })
  @IsOptional()
  @IsEnum(ErrorStatus)
  status?: ErrorStatus;

  @ApiPropertyOptional({ enum: ErrorSeverity })
  @IsOptional()
  @IsEnum(ErrorSeverity)
  severity?: ErrorSeverity;

  /** AdminUser id to assign the issue to. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolution_note?: string;
}

export class BulkResolveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolution_note?: string;
}
