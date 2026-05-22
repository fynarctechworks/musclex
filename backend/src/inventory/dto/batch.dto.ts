import {
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateBatchDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  branch_id: string;

  @IsString()
  batch_number: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsUUID()
  supplier_id?: string;
}

export class AdjustBatchDto {
  // Positive to add, negative to remove (e.g. damage/expiry write-off). Cannot go below 0.
  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
