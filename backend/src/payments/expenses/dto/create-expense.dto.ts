import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsUUID()
  branch_id!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  // Either category_id (preferred) OR category slug (legacy) must be provided.
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string; // slug — auto-resolved to category_id if provided

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsDateString()
  expense_date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn(['cash', 'bank_transfer', 'upi', 'card'])
  payment_method?: 'cash' | 'bank_transfer' | 'upi' | 'card';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  receipt_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotency_key?: string;

  @IsOptional()
  @IsUUID()
  recorded_by_staff_id?: string;
}
