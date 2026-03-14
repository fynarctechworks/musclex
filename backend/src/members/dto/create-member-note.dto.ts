import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateMemberNoteDto {
  @IsString()
  note: string;

  @IsUUID()
  @IsOptional()
  staff_id?: string;
}
