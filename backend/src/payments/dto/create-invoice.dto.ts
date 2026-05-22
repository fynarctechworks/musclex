import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsIn(['membership', 'class', 'personal_training', 'product'])
  item_type: string;

  @IsOptional()
  @IsUUID()
  item_id?: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @IsNumber()
  @Min(0)
  unit_price: number;

  @IsOptional()
  @IsString()
  hsn_sac?: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @IsUUID()
  branch_id: string;

  @IsUUID()
  member_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @IsOptional()
  @IsUUID()
  discount_id?: string;

  @IsOptional()
  @IsString()
  discount_code?: string;

  @IsOptional()
  @IsUUID()
  tax_rate_id?: string;

  @IsOptional()
  @IsDateString()
  due_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** 2-digit GST state code of buyer; if omitted, falls back to branch state */
  @IsOptional()
  @IsString()
  place_of_supply?: string;
}

export class UpdateInvoiceStatusDto {
  @IsIn(['pending', 'paid', 'partial', 'cancelled', 'refunded'])
  status: string;
}
