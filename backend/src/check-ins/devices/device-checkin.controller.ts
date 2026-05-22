import {
  Body,
  Controller,
  Headers,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { CheckInOrchestrator } from '../policy/check-in.orchestrator';

class DeviceScanDto {
  /** Member identifier — either a signed/legacy QR code OR a raw member_id. */
  @IsString()
  @IsOptional()
  qr_code?: string;

  @IsUUID()
  @IsOptional()
  member_id?: string;

  @IsUUID()
  @IsOptional()
  client_event_id?: string;
}

/**
 * Hardware-scanner check-in endpoint.
 *
 * Auth: `Authorization: Bearer dev_<id>:<secret>` — handled by
 * DeviceAuthMiddleware which also installs the tenant ALS context.
 *
 * - No JWT.
 * - No PermissionsGuard.
 * - No BranchAccessGuard.
 *
 * The device is bound to a single branch at registration. Its `branch_id`
 * is authoritative — the body cannot override it. This is how a turnstile
 * is meant to work: it scans for *its* door, not someone else's.
 *
 * Failure modes:
 *  - 401 — bad / missing / inactive device token
 *  - 400 — neither qr_code nor member_id supplied
 *  - 200 with { success: false, ... } — policy denial (rendered locally by the device)
 */
@Controller('api/v1/check-ins/device/:device_id/scan')
export class DeviceCheckInController {
  constructor(private readonly orchestrator: CheckInOrchestrator) {}

  @Post()
  async scan(
    @Req() req: Request & { device?: { id: string; gym_id: string; branch_id: string; kind: string } },
    @Body() body: DeviceScanDto,
    @Headers('user-agent') ua: string | undefined,
    @Ip() ip: string,
  ) {
    const device = req.device;
    if (!device) {
      // Should be impossible — middleware would have 401'd. Belt and braces.
      return { success: false, failure_reason: 'auth_missing', message: 'Device auth missing' };
    }

    const result = await this.orchestrator.process({
      qr_code: body.qr_code,
      member_id: body.member_id,
      branch_id: device.branch_id, // FROM device, never body
      checkin_method: 'qr',
      source: device.kind === 'turnstile' ? 'turnstile' : 'kiosk',
      client_event_id: body.client_event_id,
      ip_address: ip,
      user_agent: ua,
    });

    return result;
  }
}
