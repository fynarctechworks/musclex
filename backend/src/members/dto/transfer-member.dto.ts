import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class TransferMemberDto {
  @IsUUID()
  to_branch_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
