import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class GrantTemporaryAccessDto {
  @IsUUID()
  membership_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  branch_ids: string[];

  @IsDateString()
  expires_at: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
