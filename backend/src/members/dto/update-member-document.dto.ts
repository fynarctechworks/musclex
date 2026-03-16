import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';

export class UpdateMemberDocumentDto {
  @IsString()
  @IsIn(['medical_clearance', 'waiver', 'fitness_assessment', 'id_proof', 'other'])
  @IsOptional()
  document_type?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  expires_at?: string | null;
}
