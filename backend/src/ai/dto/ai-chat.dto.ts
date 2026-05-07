import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AiChatDto {
  @IsString()
  @MaxLength(4000)
  message: string;

  @IsUUID()
  @IsOptional()
  conversation_id?: string;

  /**
   * The dashboard view the user was looking at when they asked. Lets the
   * advisor answer "are renewals OK?" without re-asking "which branch?"
   * Shape: { branch_id?, period?, role?, screen? }.
   */
  @IsObject()
  @IsOptional()
  view_context?: Record<string, unknown>;
}
