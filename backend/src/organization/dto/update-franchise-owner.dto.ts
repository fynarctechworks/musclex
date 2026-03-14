import { IsString, IsOptional, IsUUID, IsEmail, IsBoolean } from 'class-validator';

export class UpdateFranchiseOwnerDto {
  @IsOptional()
  @IsString()
  owner_name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
