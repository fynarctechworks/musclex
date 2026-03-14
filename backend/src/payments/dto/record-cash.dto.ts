import { IsString, IsNumber, IsOptional, IsUUID, IsPositive } from 'class-validator';

export class RecordCashDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  @IsOptional()
  membership_id?: string;

  @IsUUID()
  branch_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
