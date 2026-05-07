import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ExportExpensesDto {
  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
