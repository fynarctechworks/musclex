import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

export class CreateProgressPhotoDto {
  @IsString()
  @IsNotEmpty()
  photo_url: string;

  @IsString()
  @IsOptional()
  caption?: string;

  @IsString()
  @IsIn(['before', 'after', 'progress'])
  @IsOptional()
  photo_type?: string;

  @IsDateString()
  @IsOptional()
  taken_at?: string;
}
