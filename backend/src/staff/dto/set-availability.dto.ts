import { IsString, IsInt, IsIn, IsOptional, Min, Max } from 'class-validator';

export class SetAvailabilityDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @IsString()
  start_time: string; // "06:00" HH:mm

  @IsString()
  end_time: string; // "12:00" HH:mm

  @IsOptional()
  @IsString()
  @IsIn(['available', 'unavailable', 'tentative'])
  availability_type?: string;
}
