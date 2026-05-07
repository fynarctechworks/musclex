import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReverseExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
