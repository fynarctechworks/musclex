import { IsUUID, IsOptional, IsString, IsIn } from 'class-validator';

export class AssignClientDto {
  @IsUUID()
  trainer_id: string;

  @IsUUID()
  member_id: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'paused'])
  status?: string;
}
