import { IsArray, IsString, IsOptional } from 'class-validator';

export class UpdatePermissionOverridesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grants?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  denials?: string[];
}
