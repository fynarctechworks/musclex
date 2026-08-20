import { Body, Headers, HttpCode, Post , Query} from '@nestjs/common';
import { MemberDataController } from '../decorators/member-data-controller.decorator';
import { CurrentMember, CurrentMemberContext } from '../decorators/current-member.decorator';
import { tzOffset } from '../common/tz';
import { Idempotent } from '../decorators/idempotent.decorator';
import { MemberCheckInService } from './member-checkin.service';
import { CheckInDto } from './dto';

/**
 * Member self check-in (the core-loop write). @Idempotent + the offline outbox
 * make retries safe; the orchestrator enforces all access-policy rules.
 */
@MemberDataController()
export class MemberCheckInController {
  constructor(private readonly checkins: MemberCheckInService) {}

  @Post('checkins')
  @HttpCode(201)
  @Idempotent()
  checkIn(
    @CurrentMember() member: CurrentMemberContext,
    @Body() dto: CheckInDto,
    @Headers('idempotency-key') idempotencyKey: string,
    @Query('tz') tz?: string,
  ) {
    return this.checkins.checkIn(member, dto, idempotencyKey, tzOffset(tz));
  }
}
