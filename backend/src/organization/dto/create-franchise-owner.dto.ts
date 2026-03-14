import { IsString, IsOptional, IsUUID, IsEmail } from 'class-validator';

export class CreateFranchiseOwnerDto {
  @IsUUID()
  organization_id: string;

  @IsString()
  owner_name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;
}
