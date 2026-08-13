import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Update the platform-wide subscription GST setting. A single global rate is
 * applied (exclusive) on top of every paid plan during gym onboarding/renewal.
 */
export class UpdateGstDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  gst_percent!: number;

  @IsOptional()
  @IsBoolean()
  gst_enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  gst_label?: string;
}
