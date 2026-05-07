import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class RecordPaymentDto {
  @ApiProperty()
  @IsUUID()
  tenant_id!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'manual' })
  @IsOptional()
  @IsString()
  gateway?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateway_payment_id?: string;
}

export class PaymentFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gateway?: string;
}
