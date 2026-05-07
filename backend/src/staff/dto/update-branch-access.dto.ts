import { IsArray, IsUUID, ArrayUnique } from 'class-validator';

export class UpdateBranchAccessDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  branch_ids!: string[];
}
