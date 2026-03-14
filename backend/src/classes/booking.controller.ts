import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { AttendanceService } from './attendance.service';
import { BookClassDto, CancelBookingDto, MarkAttendanceDto } from './dto';
import { JwtAuthGuard, PermissionsGuard, Permissions } from '../common';

@Controller('api/v1/classes/bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly attendanceService: AttendanceService,
  ) {}

  // ── Bookings ──────────────────────────────────────────────

  @Post()
  @Permissions({ module: 'classes', action: 'edit' })
  bookClass(@Body() dto: BookClassDto) {
    return this.bookingService.bookClass(dto);
  }

  @Post(':id/cancel')
  @Permissions({ module: 'classes', action: 'edit' })
  cancelBooking(@Param('id') id: string, @Body() dto: CancelBookingDto) {
    return this.bookingService.cancelBooking(id, dto);
  }

  @Get('session/:sessionId')
  @Permissions({ module: 'classes', action: 'view' })
  getSessionBookings(@Param('sessionId') sessionId: string) {
    return this.bookingService.getSessionBookings(sessionId);
  }

  @Get('member/:memberId')
  @Permissions({ module: 'classes', action: 'view' })
  getMemberBookings(
    @Param('memberId') memberId: string,
    @Query('status') status?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.bookingService.getMemberBookings(memberId, {
      status,
      upcoming: upcoming === 'true',
    });
  }

  // ── Waitlist ──────────────────────────────────────────────

  @Get('waitlist/:sessionId/:memberId')
  @Permissions({ module: 'classes', action: 'view' })
  getWaitlistPosition(
    @Param('sessionId') sessionId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.bookingService.getWaitlistPosition(sessionId, memberId);
  }

  @Delete('waitlist/:sessionId/:memberId')
  @Permissions({ module: 'classes', action: 'edit' })
  removeFromWaitlist(
    @Param('sessionId') sessionId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.bookingService.removeFromWaitlist(sessionId, memberId);
  }

  // ── Attendance ────────────────────────────────────────────

  @Post('attendance/:sessionId')
  @Permissions({ module: 'classes', action: 'edit' })
  markAttendance(
    @Param('sessionId') sessionId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(sessionId, dto);
  }

  @Post('attendance/:sessionId/bulk')
  @Permissions({ module: 'classes', action: 'edit' })
  bulkMarkAttendance(
    @Param('sessionId') sessionId: string,
    @Body('entries') entries: MarkAttendanceDto[],
  ) {
    return this.attendanceService.bulkMarkAttendance(sessionId, entries);
  }

  @Get('attendance/:sessionId')
  @Permissions({ module: 'classes', action: 'view' })
  getSessionAttendance(@Param('sessionId') sessionId: string) {
    return this.attendanceService.getSessionAttendance(sessionId);
  }

  @Get('attendance/member/:memberId')
  @Permissions({ module: 'classes', action: 'view' })
  getMemberAttendanceHistory(
    @Param('memberId') memberId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('category') category?: string,
  ) {
    return this.attendanceService.getMemberAttendanceHistory(memberId, {
      date_from: dateFrom,
      date_to: dateTo,
      category,
    });
  }

  @Post('attendance/:sessionId/complete')
  @Permissions({ module: 'classes', action: 'edit' })
  completeSession(@Param('sessionId') sessionId: string) {
    return this.attendanceService.completeSession(sessionId);
  }
}
