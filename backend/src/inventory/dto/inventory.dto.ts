import {
  IsUUID,
  IsInt,
  IsOptional,
  IsString,
  IsIn,
  Min,
} from 'class-validator';

export class AdjustInventoryDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  branch_id: string;

  @IsInt()
  quantity: number; // positive to add, negative to remove

  @IsIn(['adjustment', 'damage', 'return'])
  transaction_type: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReorderLevelDto {
  @IsUUID()
  branch_id: string;

  @IsInt()
  @Min(0)
  reorder_level: number;
}
