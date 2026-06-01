import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  BodyMetricInput,
  CheckInRequestBody,
  SetLogData,
  WorkoutLogRequestBody,
} from '../contract';

/** POST /progress/metrics body. */
export class BodyMetricDto implements BodyMetricInput {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(700)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(300)
  waistCm?: number;

  @IsOptional()
  @IsISO8601()
  recordedAt?: string;
}

/** POST /checkins body. */
export class CheckInDto implements CheckInRequestBody {
  @IsIn(['qr', 'manual'])
  method!: 'qr' | 'manual';

  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}

/** One logged set within POST /workouts/{workoutId}/logs. */
export class SetLogDto implements SetLogData {
  @IsString()
  exerciseId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  setNumber?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  reps?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  weight?: number;

  @IsOptional()
  @IsIn(['kg', 'lb'])
  unit!: 'kg' | 'lb';
}

/** POST /workouts/{workoutId}/logs body. */
export class WorkoutLogDto implements WorkoutLogRequestBody {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SetLogDto)
  sets!: SetLogDto[];
}
