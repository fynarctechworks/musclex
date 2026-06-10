import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { DevicesService } from './devices.service';
import { tenantContext } from '../../common/tenant-context';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Authenticates hardware-scanner requests and installs the tenant ALS
 * context for the rest of the request lifetime.
 *
 * Why middleware, not a guard?
 *   The tenant context is propagated via Node's AsyncLocalStorage. A
 *   guard's `canActivate` returns before the handler runs, so the ALS
 *   scope established inside it doesn't survive. Middleware naturally
 *   wraps the rest of the request via `next()` inside `als.run()`.
 *
 * Applied at /api/v1/check-ins/device/*. JWT-authenticated routes are
 * untouched.
 *
 * On success: `req.device = { id, gym_id, branch_id, kind }` and the
 * tenant ALS is set to that device's tenant.
 *
 * Fail-closed: any token problem → 401 with a generic "Device not
 * recognized" message. We never leak whether the device id existed.
 */
@Injectable()
export class DeviceAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(DeviceAuthMiddleware.name);

  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.headers?.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Device token required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!this.devices.isPlausibleToken(token)) {
      throw new UnauthorizedException('Bad device token');
    }

    const device = await this.devices.verifySecret(token);
    if (!device) {
      this.logger.warn(`Device auth rejected (fingerprint=${DevicesService.buildTokenFingerprint(token)})`);
      throw new UnauthorizedException('Device not recognized');
    }

    // Resolve tenant schema for the device's gym.
    const rows = await this.prisma.$queryRawUnsafe<Array<{ schema_name: string }>>(
      `SELECT schema_name FROM public.studios WHERE id = $1::uuid LIMIT 1`,
      device.gym_id,
    );
    const schemaName = rows?.[0]?.schema_name;
    if (!schemaName || !/^studio_[0-9a-f_]+$/i.test(schemaName)) {
      throw new UnauthorizedException('Tenant lookup failed for device');
    }

    (req as Request & { device: typeof device }).device = device;

    tenantContext.run(
      {
        schemaName,
        gymId: device.gym_id,
        activeBranchId: device.branch_id,
        allowedBranchIds: [device.branch_id],
        bypassBranchScope: false,
      },
      () => next(),
    );
  }
}
