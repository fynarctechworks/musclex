import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { createHash, randomBytes } from 'crypto';
import {
  JwtAuthGuard,
  RolesGuard,
  PermissionsGuard,
  Permissions,
  Roles,
  CurrentUser,
  JwtPayload,
} from '../../common';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { getTenantGymId, getTenantSchema } from '../../common/tenant-context';

export class RegisterBiometricDeviceDto {
  /** Device serial number (SN) as printed/configured on the unit. */
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{4,64}$/)
  serial: string;

  @IsUUID()
  branch_id: string;

  @IsString()
  @MaxLength(120)
  device_name: string;

  /** e.g. 'essl' | 'zkteco' — informational. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  vendor?: string;
}

export class MapDevicePinDto {
  /** The numeric user PIN enrolled on the device. */
  @IsString()
  @Matches(/^\d{1,12}$/)
  pin: string;

  @IsUUID()
  member_id: string;
}

/**
 * Admin registration for hardware biometric attendance devices (eSSL/ZKTeco
 * iclock). Registering writes the CheckInDevice row (gym schema) AND the
 * public routing index (SN → gym/schema/branch) that /iclock/* trusts.
 * Mapping a device PIN to a member creates a BiometricEnrollment
 * (provider 'iclock') that attendance ingestion resolves.
 */
@Controller('api/v1/biometric-devices')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('owner', 'brand_owner', 'manager')
export class BiometricDevicesController {
  constructor(
    private readonly pub: PublicPrismaService,
    private readonly tenant: TenantPrisma,
  ) {}

  @Get()
  @Permissions({ module: 'check_ins', action: 'view' })
  async list() {
    const gymId = getTenantGymId()!;
    const [devices, index] = await Promise.all([
      this.tenant.client.checkInDevice.findMany({
        where: { kind: 'biometric_iclock' },
        select: {
          id: true,
          device_name: true,
          hardware_id: true,
          status: true,
          last_seen_at: true,
          branch_id: true,
          registered_at: true,
        },
        orderBy: { registered_at: 'desc' },
      }),
      this.pub.biometricDeviceIndex.findMany({ where: { gym_id: gymId } }),
    ]);
    const indexed = new Set(index.map((i) => i.device_sn));
    return devices.map((d) => ({ ...d, routed: d.hardware_id ? indexed.has(d.hardware_id) : false }));
  }

  @Post()
  @Permissions({ module: 'check_ins', action: 'create' })
  async register(@Body() dto: RegisterBiometricDeviceDto, @CurrentUser() user: JwtPayload) {
    const gymId = getTenantGymId()!;
    const schemaName = getTenantSchema();
    if (!schemaName) throw new BadRequestException('No tenant schema in context');

    const branch = await this.tenant.client.branch.findFirst({
      where: { id: dto.branch_id },
      select: { id: true },
    });
    if (!branch) throw new BadRequestException('Unknown branch');

    // SN must be globally unique — it is the routing key.
    const existing = await this.pub.biometricDeviceIndex.findUnique({
      where: { device_sn: dto.serial },
    });
    if (existing && existing.gym_id !== gymId) {
      throw new BadRequestException('This device serial is already registered');
    }

    const device = await this.tenant.client.checkInDevice.create({
      data: {
        gym_id: gymId,
        branch_id: dto.branch_id,
        device_name: dto.device_name,
        kind: 'biometric_iclock',
        hardware_id: dto.serial,
        // iclock has no secret handshake — these columns are NOT used for
        // auth on this path; store hashes of random material.
        device_secret: createHash('sha256').update(randomBytes(32)).digest('hex'),
        pin_hash: createHash('sha256').update(randomBytes(16)).digest('hex'),
        registered_by: user.user_id,
      },
    });

    await this.pub.biometricDeviceIndex.upsert({
      where: { device_sn: dto.serial },
      create: { device_sn: dto.serial, gym_id: gymId, schema_name: schemaName, branch_id: dto.branch_id },
      update: { schema_name: schemaName, branch_id: dto.branch_id },
    });

    return {
      id: device.id,
      serial: dto.serial,
      device_name: device.device_name,
      branch_id: device.branch_id,
      instructions:
        'Point the device to this server: Comm → Cloud Server / ADMS → server address = your API host, port 443, HTTPS on. The device will push attendance automatically.',
    };
  }

  @Post(':serial/map')
  @Permissions({ module: 'check_ins', action: 'create' })
  async mapPin(
    @Param('serial') serial: string,
    @Body() dto: MapDevicePinDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const gymId = getTenantGymId()!;
    const index = await this.pub.biometricDeviceIndex.findUnique({ where: { device_sn: serial } });
    if (!index || index.gym_id !== gymId) throw new NotFoundException('Device not found');

    const member = await this.tenant.client.member.findFirst({
      where: { id: dto.member_id },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const enrollment = await this.tenant.client.biometricEnrollment.upsert({
      where: {
        member_id_modality_provider: {
          member_id: dto.member_id,
          modality: 'fingerprint',
          provider: 'iclock',
        },
      },
      create: {
        gym_id: gymId,
        member_id: dto.member_id,
        provider: 'iclock',
        modality: 'fingerprint',
        template_ref: dto.pin,
        enrolled_by: user.user_id,
      },
      update: { template_ref: dto.pin, revoked_at: null, enrolled_by: user.user_id },
    });

    return { enrollment_id: enrollment.id, pin: dto.pin, member_id: dto.member_id };
  }

  @Delete(':serial')
  @Permissions({ module: 'check_ins', action: 'delete' })
  async unregister(@Param('serial') serial: string) {
    const gymId = getTenantGymId()!;
    const index = await this.pub.biometricDeviceIndex.findUnique({ where: { device_sn: serial } });
    if (!index || index.gym_id !== gymId) throw new NotFoundException('Device not found');

    await this.pub.biometricDeviceIndex.delete({ where: { device_sn: serial } });
    await this.tenant.client.checkInDevice.updateMany({
      where: { hardware_id: serial, kind: 'biometric_iclock' },
      data: { status: 'disabled' },
    });
    return { success: true };
  }
}
