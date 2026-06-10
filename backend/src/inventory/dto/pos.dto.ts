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
  // Phase 5: exactly ONE of product_id or bundle_id must be set on each cart line.
  // The XOR is enforced in PosService.createSale (validator-level XOR would need a
  // custom decorator and this stays backward compatible with existing API callers).
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsUUID()
  bundle_id?: string;

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

  // Phase 4: loyalty points the member redeems toward this sale (requires member_id).
  @IsOptional()
  @IsInt()
  @Min(1)
  redeem_points?: number;
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
