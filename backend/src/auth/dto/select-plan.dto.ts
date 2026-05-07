import { IsString, IsIn, IsOptional } from 'class-validator';

export class SelectPlanDto {
  @IsString()
  plan_id: string;

  @IsIn(['monthly', 'annual'])
  @IsOptional()
  billing_cycle?: 'monthly' | 'annual';
}
