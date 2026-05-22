import { IsArray, IsIn, IsOptional, IsString, ArrayMinSize } from 'class-validator';

export class SendDocumentDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['email', 'whatsapp'], { each: true })
  channels: Array<'email' | 'whatsapp'>;

  @IsOptional()
  @IsString()
  email_override?: string;

  @IsOptional()
  @IsString()
  phone_override?: string;

  /** Only honored by the POS send-receipt endpoint. */
  @IsOptional()
  @IsIn(['a4', 'thermal_80mm'])
  format?: 'a4' | 'thermal_80mm';
}
