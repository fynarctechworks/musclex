import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class CreateMemberDocumentDto {
  @IsString()
  @IsIn(['medical_clearance', 'waiver', 'fitness_assessment', 'id_proof', 'other'])
  document_type: string;

  @IsString()
  file_url: string;

  @IsString()
  @IsOptional()
  file_name?: string;

  @IsNumber()
  @IsOptional()
  file_size?: number;
}
