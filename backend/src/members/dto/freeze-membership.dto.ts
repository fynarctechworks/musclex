import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';

export class FreezeMembershipDto {
  @IsDateString()
  start_date: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsUUID()
  @IsOptional()
  approved_by_id?: string;
}
