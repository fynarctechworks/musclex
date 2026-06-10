import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsIn,
  IsBoolean,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  product_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsIn(['physical', 'digital', 'service', 'subscription', 'consumable'])
  product_type?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  unit_type?: string;

  @IsOptional()
  @IsBoolean()
  track_batches?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initial_stock?: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  product_name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax_rate?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsIn(['physical', 'digital', 'service', 'subscription', 'consumable'])
  product_type?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  unit_type?: string;

  @IsOptional()
  @IsBoolean()
  track_batches?: boolean;

  @IsOptional()
  @IsIn(['active', 'inactive', 'discontinued'])
  status?: string;
}

export class AddProductImageDto {
  @IsString()
  image_url: string;

  @IsOptional()
  @IsString()
  alt_text?: string;

  @IsOptional()
  @IsBoolean()
  is_primary?: boolean;
}

export class ReorderProductImagesDto {
  @IsUUID('4', { each: true })
  image_ids: string[];
}

export class CreateProductCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  organization_id?: string;
}

export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  is_active?: boolean;
}
