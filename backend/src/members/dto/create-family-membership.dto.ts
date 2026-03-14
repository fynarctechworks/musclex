import {
  IsUUID,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateFamilyMembershipDto {
  @IsUUID()
  primary_member_id: string;

  @IsUUID()
  plan_id: string;

  @IsUUID()
  branch_id: string;

  @IsInt()
  @Min(2)
  @Max(10)
  @IsOptional()
  max_members?: number;
}
