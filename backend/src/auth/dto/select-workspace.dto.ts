import { IsUUID, IsOptional } from 'class-validator';

export class SelectWorkspaceDto {
  @IsUUID()
  studio_id: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;
}
