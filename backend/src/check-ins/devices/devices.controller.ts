import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DevicesService } from './devices.service';
import {
  AllowWhenLocked,
  BranchAccessGuard,
  CurrentUser,
  JwtAuthGuard,
  JwtPayload,
  Permissions,
  PermissionsGuard,
} from '../../common';

class RegisterDeviceDto {
  @IsUUID()
  branch_id!: string;

  @IsString()
  @MaxLength(80)
  device_name!: string;

  @IsIn(['ipad_kiosk', 'android_kiosk', 'web_kiosk', 'turnstile', 'usb_fingerprint', 'other'])
  kind!: 'ipad_kiosk' | 'android_kiosk' | 'web_kiosk' | 'turnstile' | 'usb_fingerprint' | 'other';

  @IsString()
  @IsOptional()
  @MaxLength(80)
  hardware_id?: string;
}

/**
 * Staff-facing CRUD for kiosk / turnstile devices.
 *
 * Tokens are minted on register, returned ONCE, never recoverable.
 * Status transitions are append-only (active → disabled/lost). Re-enabling
 * a lost device requires re-registering — that mints a new token, which
 * is the right move from a security posture.
 */
@Controller('api/v1/check-ins/devices')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@AllowWhenLocked()
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @Permissions({ module: 'settings', action: 'edit' })
  register(@CurrentUser() user: JwtPayload, @Body() body: RegisterDeviceDto) {
    return this.devices.register({
      branch_id: body.branch_id,
      device_name: body.device_name,
      kind: body.kind,
      hardware_id: body.hardware_id ?? null,
      registered_by: user.user_id,
    });
  }

  @Get()
  @Permissions({ module: 'settings', action: 'view' })
  list(@Query('branch_id') branch_id?: string, @Query('status') status?: string) {
    return this.devices.list({ branch_id, status });
  }

  @Get(':id')
  @Permissions({ module: 'settings', action: 'view' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.devices.getById(id);
  }

  @Delete(':id')
  @Permissions({ module: 'settings', action: 'edit' })
  disable(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.devices.disable(id);
  }

  @Post(':id/lost')
  @Permissions({ module: 'settings', action: 'edit' })
  markLost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.devices.markLost(id);
  }
}
