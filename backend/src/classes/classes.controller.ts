import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard, PermissionsGuard, Permissions, CurrentUser, JwtPayload, restrictedBranchIdsForUser } from '../common';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
class DeprecationInterceptor implements NestInterceptor {
  private readonly logger = new Logger('DeprecatedEndpoint');
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const res = context.switchToHttp().getResponse();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', '2026-07-01');
    res.setHeader('Link', '</api/v1/classes/sessions>; rel="successor-version"');
    this.logger.warn(`Deprecated endpoint called: ${context.switchToHttp().getRequest().method} ${context.switchToHttp().getRequest().url}`);
    return next.handle();
  }
}

// LEGACY: migrate to ClassTemplate/ClassSession endpoints
// This controller uses the legacy Class and ClassEnrollment models.
// The new ClassTemplate/ClassSession model is fully implemented in session.controller.ts and booking.controller.ts.
// Frontend still calls these legacy endpoints — see frontend/src/features/classes/api.ts lines 18-47.
// Migration plan:
//   1. Update frontend api.ts to use /classes/sessions and /classes/bookings endpoints
//   2. Map legacy enroll/cancel-enrollment/promote-waitlist to ClassBooking/ClassWaitlist operations
//   3. Remove this controller and ClassesService (legacy)
//   4. Remove Class and ClassEnrollment models from prisma/schema.prisma
//   5. Update CheckIn.class_id FK to point to ClassSession instead of Class
//   6. Create a data migration to copy existing Class rows into ClassSession
@Controller('api/v1/classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(DeprecationInterceptor)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Permissions({ module: 'classes', action: 'create' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      branch_id: string;
      trainer_id: string;
      substitute_trainer_id?: string;
      name: string;
      category: string;
      room?: string;
      capacity: number;
      duration_minutes: number;
      starts_at: string;
      recurrence_rule?: string;
      recurrence_end_date?: string;
    },
  ) {
    return this.classesService.create(user.studio_id, body);
  }

  @Get()
  @Permissions({ module: 'classes', action: 'view' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branch_id') branch_id?: string,
    @Query('trainer_id') trainer_id?: string,
    @Query('category') category?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.classesService.findAll(user.studio_id, {
      branch_id,
      trainer_id,
      category,
      date_from,
      date_to,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      user_branch_ids: restrictedBranchIdsForUser(user),
    });
  }

  @Get(':id')
  @Permissions({ module: 'classes', action: 'view' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.classesService.findOne(user.studio_id, id);
  }

  @Patch(':id')
  @Permissions({ module: 'classes', action: 'edit' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      category?: string;
      room?: string;
      capacity?: number;
      duration_minutes?: number;
      starts_at?: string;
      trainer_id?: string;
      substitute_trainer_id?: string;
      recurrence_rule?: string;
      recurrence_end_date?: string;
      status?: string;
    },
  ) {
    return this.classesService.update(user.studio_id, id, body);
  }

  @Post(':id/enroll')
  @Permissions({ module: 'classes', action: 'edit' })
  enroll(
    @CurrentUser() user: JwtPayload,
    @Param('id') classId: string,
    @Body('member_id') memberId: string,
  ) {
    return this.classesService.enroll(user.studio_id, classId, memberId);
  }

  @Post(':id/cancel-enrollment')
  @Permissions({ module: 'classes', action: 'edit' })
  cancelEnrollment(
    @CurrentUser() user: JwtPayload,
    @Param('id') classId: string,
    @Body('member_id') memberId: string,
  ) {
    return this.classesService.cancelEnrollment(user.studio_id, classId, memberId);
  }

  @Post(':id/promote-waitlist')
  @Permissions({ module: 'classes', action: 'edit' })
  promoteFromWaitlist(
    @CurrentUser() user: JwtPayload,
    @Param('id') classId: string,
    @Body('enrollment_id') enrollmentId: string,
  ) {
    return this.classesService.promoteFromWaitlist(user.studio_id, classId, enrollmentId);
  }
}
