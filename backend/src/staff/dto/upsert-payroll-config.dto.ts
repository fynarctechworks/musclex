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

  /**
   * What the gym charges for one PT session. Merged into `bonus_structure`
   * server-side so the client never has to round-trip the whole pay config
   * (which can hold other compensation keys). Every TrainerRevenue row and
   * therefore every commission figure is priced off this; omit or send 0 to
   * fall back to the platform default.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  session_rate?: number;
}
