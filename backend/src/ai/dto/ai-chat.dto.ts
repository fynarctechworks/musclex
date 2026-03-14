import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class AiChatDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsUUID()
  @IsOptional()
  conversation_id?: string;
}
