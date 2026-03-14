import {
  IsUUID,
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
  IsIn,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PosSaleItemDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreatePosSaleDto {
  @IsUUID()
  branch_id: string;

  @IsOptional()
  @IsUUID()
  member_id?: string;

  @IsUUID()
  staff_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];

  @IsIn(['cash', 'card', 'upi', 'wallet'])
  payment_method: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;
}

export class CreateProductReturnDto {
  @IsUUID()
  sale_id: string;

  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsUUID()
  processed_by?: string;
}
