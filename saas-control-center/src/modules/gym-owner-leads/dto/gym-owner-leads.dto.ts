import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Lead workflow states. `status` is TEXT in the database rather than a Postgres
 * enum, so this array is the single source of truth for what is allowed —
 * adding a state is a code change, not a migration.
 */
export const GYM_OWNER_LEAD_STATUSES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'CONVERTED',
  'LOST',
] as const;

export type GymOwnerLeadStatus = (typeof GYM_OWNER_LEAD_STATUSES)[number];

/**
 * Payload accepted from the marketing website.
 *
 * The global ValidationPipe runs `whitelist` + `forbidNonWhitelisted`, so any
 * field not declared here is rejected outright rather than silently stored.
 * Lengths are bounded on every field: this is reachable (via the marketing
 * server) from the public internet, and an unbounded TEXT write is a cheap way
 * to fill someone else's database.
 */
export class CreateGymOwnerLeadDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  studio_name!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ enum: ['1', '2-5', '6-20', '20+'] })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  branches?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  topic?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({ description: 'Which marketing form this came from.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(400)
  user_agent?: string;
}

/** Admin-side update: work the lead through the pipeline. */
export class UpdateGymOwnerLeadDto {
  @ApiPropertyOptional({ enum: GYM_OWNER_LEAD_STATUSES })
  @IsOptional()
  @IsIn(GYM_OWNER_LEAD_STATUSES as unknown as string[])
  status?: GymOwnerLeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

/** Query params for the list view. */
export class ListGymOwnerLeadsDto {
  @ApiPropertyOptional({ enum: GYM_OWNER_LEAD_STATUSES })
  @IsOptional()
  @IsIn(GYM_OWNER_LEAD_STATUSES as unknown as string[])
  status?: GymOwnerLeadStatus;

  @ApiPropertyOptional({ description: 'Matches name, studio, email or phone.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  limit?: number;
}
