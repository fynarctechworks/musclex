import {
  IsString,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class AssignMembershipDto {
  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsBoolean()
  @IsOptional()
  auto_renew?: boolean;

  @IsString()
  @IsOptional()
  payment_method?: string;
}
