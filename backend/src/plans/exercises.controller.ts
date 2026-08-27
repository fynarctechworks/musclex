import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Permissions,
} from '../common';
import { ExercisesService } from './exercises.service';

const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
  'cardio',
] as const;

export class CreateExerciseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(MUSCLE_GROUPS as unknown as string[])
  muscle_group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  equipment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  media_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateExerciseDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(MUSCLE_GROUPS as unknown as string[])
  muscle_group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  equipment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  media_url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  instructions?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

/**
 * Exercise catalog for the admin plan builder. Reads are open to anyone who
 * can view members (the plan builder needs them); writes require edit rights.
 * The member BFF has its own read-only library routes.
 */
@Controller('api/v1/exercises')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}


  /** Muscle heads in this gym's catalogue, optionally within one group. */
  @Get('muscle-heads')
  @Permissions({ module: 'members', action: 'view' })
  muscleHeads(@Query('muscle_group') muscleGroup?: string) {
    return this.exercises.muscleHeads(muscleGroup);
  }

  @Get()
  @Permissions({ module: 'members', action: 'view' })
  findAll(
    @Query('search') search?: string,
    @Query('muscle_group') muscleGroup?: string,
    @Query('target_muscle') targetMuscle?: string,
    @Query('include_inactive') includeInactive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.exercises.findAll({
      search,
      muscle_group: muscleGroup,
      target_muscle: targetMuscle,
      include_inactive: includeInactive === 'true',
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @Permissions({ module: 'members', action: 'edit' })
  create(@Body() dto: CreateExerciseDto) {
    return this.exercises.create(dto);
  }

  /** Populate the starter catalog (idempotent — never overwrites curation). */
  @Post('seed-defaults')
  @Permissions({ module: 'members', action: 'edit' })
  seedDefaults() {
    return this.exercises.seedDefaults();
  }

  @Patch(':id')
  @Permissions({ module: 'members', action: 'edit' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateExerciseDto,
  ) {
    return this.exercises.update(id, dto);
  }

  /** Soft delete — plans, set logs and PRs reference exercises. */
  @Delete(':id')
  @Permissions({ module: 'members', action: 'delete' })
  archive(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.exercises.archive(id);
  }
}
