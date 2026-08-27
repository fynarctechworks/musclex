import { Body, Get, HttpCode, Post, Put, Query } from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { tzOffset } from '../common/tz';
import { MemberRoutineScheduleService, type Weekday } from './member-routine-schedule.service';
import { RoutineScheduleDayDto } from './dto';

/**
 * The member's weekly routine schedule, and the missed-day prompt.
 *
 * Everything here is resolved from @CurrentMember; a routine id arriving from
 * the client is ownership-checked in the service before it is ever stored.
 *
 * The `tz` query parameter is the device's minutes east of UTC (IST sends 330),
 * the same convention the home and streak endpoints use. It matters more here
 * than almost anywhere else: a schedule keyed on weekday is meaningless if the
 * server's Monday and the member's Monday are different days.
 */
@MemberDataController()
export class MemberRoutineScheduleController {
  constructor(private readonly schedule: MemberRoutineScheduleService) {}

  /** The whole week, for the schedule editor. */
  @Get('routines/schedule')
  get(@CurrentMember() member: CurrentMemberContext) {
    return this.schedule.getSchedule(member);
  }

  /** Set or clear one weekday. A null routineId clears it — that is a rest day. */
  @Put('routines/schedule')
  async setDay(
    @CurrentMember() member: CurrentMemberContext,
    @Body() body: RoutineScheduleDayDto,
  ) {
    await this.schedule.setDay(member, body.weekday as Weekday, body.routineId ?? null);
    // The whole week back, not just the day that changed: the editor shows all
    // seven and a partial response would make it guess at the rest.
    return this.schedule.getSchedule(member);
  }

  /** What the member is meant to train today. */
  @Get('routines/schedule/today')
  today(@CurrentMember() member: CurrentMemberContext, @Query('tz') tz?: string) {
    return this.schedule.getTodayPlan(member, tzOffset(tz));
  }

  /** Yesterday's planned routine, when it was planned and not done. */
  @Get('routines/schedule/missed')
  missed(@CurrentMember() member: CurrentMemberContext, @Query('tz') tz?: string) {
    return this.schedule.getMissedYesterday(member, tzOffset(tz));
  }

  /** "Do it now" — take up yesterday's session and slide the rest of the week. */
  @Post('routines/schedule/resume')
  @HttpCode(200)
  resume(@CurrentMember() member: CurrentMemberContext) {
    return this.schedule.resumeMissed(member);
  }

  /** "Back to my normal week" — clears any accumulated shift. */
  @Post('routines/schedule/reset')
  @HttpCode(200)
  reset(@CurrentMember() member: CurrentMemberContext) {
    return this.schedule.resetShift(member);
  }
}
