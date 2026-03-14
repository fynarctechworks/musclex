import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  Min,
} from 'class-validator';

export class ProcessPayrollDto {
  @IsUUID()
  staff_id: string;

  @IsDateString()
  salary_period_start: string;

  @IsDateString()
  salary_period_end: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePayrollRecordDto {
  @IsOptional()
  @IsIn(['pending', 'processed', 'paid'])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deductions?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
