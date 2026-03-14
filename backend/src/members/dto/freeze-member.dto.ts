import { IsDateString, IsOptional, IsString } from 'class-validator';

export class FreezeMemberDto {
  @IsDateString()
  freeze_start_date: string;

  @IsDateString()
  freeze_end_date: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
