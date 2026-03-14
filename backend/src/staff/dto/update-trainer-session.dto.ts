import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateTrainerSessionDto {
  @IsOptional()
  @IsString()
  @IsIn([
    'scheduled',
    'completed',
    'cancelled',
    'no_show',
  ])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
