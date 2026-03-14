import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
} from 'class-validator';

export class CreateClassTemplateDto {
  @IsUUID()
  @IsOptional()
  organization_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['cardio', 'strength', 'flexibility', 'mind_body', 'dance', 'martial_arts', 'rehabilitation', 'other'])
  category: string;

  @IsInt()
  @Min(10)
  @IsOptional()
  default_duration_minutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  default_capacity?: number;

  @IsUUID()
  @IsOptional()
  created_by_id?: string;
}

export class UpdateClassTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['cardio', 'strength', 'flexibility', 'mind_body', 'dance', 'martial_arts', 'rehabilitation', 'other'])
  @IsOptional()
  category?: string;

  @IsInt()
  @Min(10)
  @IsOptional()
  default_duration_minutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  default_capacity?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
