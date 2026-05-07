import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsInt,
  IsArray,
  IsDateString,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty({ example: 'pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'Pro' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name!: string;

  @ApiPropertyOptional({ example: 'Best for growing studios' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 2499.0, description: 'Monthly price in INR' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monthly_price!: number;

  @ApiProperty({ example: 24990.0, description: 'Annual price in INR' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  annual_price!: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_branches!: number;

  @ApiProperty({ example: 1000 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_members!: number;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_staff!: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  storage_limit_gb?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  api_access?: boolean;

  @ApiProperty({
    example: { check_in: true, ai_advisor: true, classes: true },
  })
  @IsObject()
  features!: Record<string, boolean>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort_order?: number;

  // Discount fields
  @ApiPropertyOptional({ example: 20, description: 'Discount percent 0-100' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discount_percent?: number;

  @ApiPropertyOptional({ example: '20% OFF — Limited time' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  discount_label?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  discount_expires_at?: string;

  @ApiPropertyOptional({ example: 'regular', enum: ['regular'] })
  @IsOptional()
  @IsString()
  plan_type?: 'regular';
}

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monthly_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  annual_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_branches?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_members?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_staff?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  storage_limit_gb?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  api_access?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sort_order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  discount_percent?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  discount_label?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  discount_expires_at?: string | null;

  @ApiPropertyOptional({ enum: ['regular'] })
  @IsOptional()
  @IsString()
  plan_type?: 'regular';
}
