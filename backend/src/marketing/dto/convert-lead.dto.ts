import { IsOptional, IsUUID } from 'class-validator';

export class ConvertLeadDto {
  /** Branch for the new member. Falls back to the lead's branch, then the caller's. */
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  /**
   * Link the lead to an existing member instead of creating a new one — the
   * escape hatch when duplicate detection finds the person already trains here.
   */
  @IsOptional()
  @IsUUID()
  existing_member_id?: string;
}
