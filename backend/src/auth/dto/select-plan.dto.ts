import { IsString } from 'class-validator';

export class SelectPlanDto {
  @IsString()
  plan_id: string;
}
