import { IsUUID, IsString, IsNumber, IsOptional, IsIn, IsObject, Min } from 'class-validator';
import { Prisma } from '@prisma/client';

export class UpsertPayrollConfigDto {
  @IsUUID()
  staff_id: string;

  @IsOptional()
  @IsString()
  @IsIn(['fixed', 'commission', 'hybrid'])
  salary_type?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  base_salary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission_percentage?: number;

  @IsOptional()
  @IsObject()
  bonus_structure?: Prisma.InputJsonValue;
}
