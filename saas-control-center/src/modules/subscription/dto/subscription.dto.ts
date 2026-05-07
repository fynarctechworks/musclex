import {
  IsUUID,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsUUID()
  plan_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;
}

export class SubscriptionFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  plan_id?: string;
}
