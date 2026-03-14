import {
  IsString,
  IsUUID,
  IsIn,
} from 'class-validator';

export class AddFamilyMemberDto {
  @IsUUID()
  member_id: string;

  @IsString()
  @IsIn(['spouse', 'child', 'parent', 'sibling', 'other'])
  relation: string;
}
