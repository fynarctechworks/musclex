import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClassesService } from './classes.service';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1/classes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Permissions({ module: 'classes', action: 'create' })
  create(
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
    return this.classesService.create(body);
  }

  @Get()
  @Permissions({ module: 'classes', action: 'view' })
  findAll(
    @Query('branch_id') branch_id?: string,
    @Query('trainer_id') trainer_id?: string,
    @Query('category') category?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.classesService.findAll({
      branch_id,
      trainer_id,
      category,
      date_from,
      date_to,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  @Get(':id')
  @Permissions({ module: 'classes', action: 'view' })
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  @Patch(':id')
  @Permissions({ module: 'classes', action: 'edit' })
  update(
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
    return this.classesService.update(id, body);
  }

  @Post(':id/enroll')
  @Permissions({ module: 'classes', action: 'edit' })
  enroll(
    @Param('id') classId: string,
    @Body('member_id') memberId: string,
  ) {
    return this.classesService.enroll(classId, memberId);
  }

  @Post(':id/cancel-enrollment')
  @Permissions({ module: 'classes', action: 'edit' })
  cancelEnrollment(
    @Param('id') classId: string,
    @Body('member_id') memberId: string,
  ) {
    return this.classesService.cancelEnrollment(classId, memberId);
  }

  @Post(':id/promote-waitlist')
  @Permissions({ module: 'classes', action: 'edit' })
  promoteFromWaitlist(
    @Param('id') classId: string,
    @Body('enrollment_id') enrollmentId: string,
  ) {
    return this.classesService.promoteFromWaitlist(classId, enrollmentId);
  }
}
