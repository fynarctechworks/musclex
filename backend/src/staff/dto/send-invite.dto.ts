import {
  IsString,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsArray,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

class InvitePermissionOverridesDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grants?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  denials?: string[];
}

/**
 * Body for POST staff/:id/invite. Previously an inline object literal, which the
 * global ValidationPipe cannot whitelist/validate — untrusted keys and types
 * flowed straight into the invite. This DTO enforces shape and strips extras.
 */
export class SendInviteDto {
  @IsString()
  @MaxLength(64)
  role_name: string;

  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvitePermissionOverridesDto)
  permission_overrides?: InvitePermissionOverridesDto;
}
