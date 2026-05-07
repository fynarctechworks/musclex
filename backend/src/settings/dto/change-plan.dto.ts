import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class ChangePlanDto {
  @IsString()
  @IsNotEmpty()
  plan: string;

  @IsOptional()
  @IsString()
  @IsIn(['monthly', 'annual'])
  billing_cycle?: string;
}
