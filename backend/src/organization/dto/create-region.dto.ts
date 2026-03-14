import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateRegionDto {
  @IsUUID()
  organization_id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  manager_id?: string;
}
