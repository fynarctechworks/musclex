import { IsArray, IsUUID, IsNumber, ArrayMinSize } from 'class-validator';

export class FacialCheckInDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  descriptor: number[];

  @IsUUID()
  branch_id: string;
}
