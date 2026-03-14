import { IsString, IsUUID } from 'class-validator';

export class RenewMemberDto {
  @IsUUID()
  plan_id: string;

  @IsString()
  payment_method: string;
}
