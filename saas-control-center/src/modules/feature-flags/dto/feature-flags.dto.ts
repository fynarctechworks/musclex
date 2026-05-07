import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'ai_advisor' })
  @IsString()
  key!: string;

  @ApiProperty({ example: 'AI Advisor' })
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_global?: boolean;
}

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_global?: boolean;
}

export class SetPlanFlagDto {
  @ApiProperty()
  @IsUUID()
  plan_id!: string;

  @ApiProperty()
  @IsUUID()
  flag_id!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class SetTenantFlagDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  flag_id!: string;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
