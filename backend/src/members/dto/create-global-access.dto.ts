import {
  IsUUID,
  IsDateString,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateGlobalAccessPassDto {
  @IsUUID()
  member_id: string;

  @IsUUID()
  plan_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  allowed_branch_ids: string[];

  @IsDateString()
  expiry_date: string;
}
