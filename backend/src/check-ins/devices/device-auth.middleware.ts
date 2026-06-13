import {
  Injectable,
  Logger,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { DevicesService } from './devices.service';
import { tenantContext } from '../../common/tenant-context';

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

  constructor(private readonly devices: DevicesService) {}

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

    // verifySecret already resolved the schema from the public device_index.
    const schemaName = device.schema_name;
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
