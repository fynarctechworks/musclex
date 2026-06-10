import {
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateTransferDto {
  @IsUUID()
  from_branch_id: string;

  @IsUUID()
  to_branch_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  initiated_by?: string;
}

export class ReceiveTransferDto {
  @IsOptional()
  @IsUUID()
  received_by?: string;
}

// Per-branch price override (upsert). tax_rate omitted => inherit product tax.
export class UpsertBranchPriceDto {
  @IsUUID()
  product_id: string;

  @IsUUID()
  branch_id: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;
}
