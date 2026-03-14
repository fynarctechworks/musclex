import { IsUUID, IsOptional, IsNumber, IsDateString, Min, Max } from 'class-validator';

export class CreateBranchFranchiseDto {
  @IsUUID()
  branch_id: string;

  @IsUUID()
  franchise_owner_id: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  revenue_share_pct?: number;

  @IsOptional()
  @IsDateString()
  contract_start?: string;

  @IsOptional()
  @IsDateString()
  contract_end?: string;
}
