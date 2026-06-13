import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { promisify } from 'util';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { TenantPrisma } from '../../prisma/tenant-prisma.accessor';
import { PublicPrismaService } from '../../prisma/public-prisma.service';
import { TenantClientFactory } from '../../prisma/tenant-client.factory';
import { getTenantGymId, getTenantSchema } from '../../common/tenant-context';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Manages CheckInDevice rows (kiosk iPads, turnstiles, USB scanners).
 *
 * Auth model:
 *   - A device is bound to a single branch.
 *   - On registration we mint a one-time device secret (32 random bytes,
 *     base64url-encoded). The secret is scrypt-hashed at rest in
 *     check_in_devices.device_secret. Format: `scrypt$<salt_hex>$<hash_hex>`.
 *   - The raw secret is returned to the caller ONCE, in the register
 *     response. Cannot be recovered later — rotation requires re-register.
 *   - Hardware scanners present `Authorization: Bearer dev_<id>:<secret>`
 *     on every scan. `verifySecret()` is constant-time via `timingSafeEqual`.
 *
 * The pin_hash column is reserved for kiosk exit PIN (set on first launch
 * via KioskPinLock); not used by device-token auth.
 */
@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);
  private static readonly SCRYPT_KEYLEN = 32;
  private static readonly SCRYPT_SALT_BYTES = 16;

  constructor(
    // Context methods (register/list/...) use the request's gym client; verifySecret
    // runs BEFORE any gym context, so it resolves the schema from the public
    // device_index and builds a client for it via the factory.
    private readonly tenant: TenantPrisma,
    private readonly pub: PublicPrismaService,
    private readonly factory: TenantClientFactory,
  ) {}

  async register(input: {
    branch_id: string;
    device_name: string;
    kind: 'ipad_kiosk' | 'android_kiosk' | 'web_kiosk' | 'turnstile' | 'usb_fingerprint' | 'other';
    hardware_id?: string | null;
    registered_by: string;
  }) {
    const gymId = getTenantGymId();
    const schemaName = getTenantSchema();
    if (!gymId || !schemaName) throw new BadRequestException('Tenant context missing');

    const branch = await this.tenant.client.branch.findUnique({
      where: { id: input.branch_id },
      select: { id: true, name: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const rawSecret = randomBytes(32).toString('base64url');
    const secretHash = await this.hashSecret(rawSecret);

    // PIN sentinel — no valid PIN can produce this string; defeats any
    // bug that would treat an empty-PIN field as "no PIN required".
    const pinSentinel = 'pending:' + randomBytes(16).toString('hex');

    const device = await this.tenant.client.checkInDevice.create({
      data: {
        gym_id: gymId,
        branch_id: input.branch_id,
        device_name: input.device_name,
        kind: input.kind,
        hardware_id: input.hardware_id ?? null,
        device_secret: secretHash,
        pin_hash: pinSentinel,
        status: 'active',
        registered_by: input.registered_by,
      },
      select: {
        id: true,
        device_name: true,
        kind: true,
        branch_id: true,
        status: true,
        registered_at: true,
      },
    });

    // Maintain the public routing index so device-token auth can resolve this
    // device's gym + schema BEFORE any tenant context exists (verifySecret).
    await this.pub.deviceIndex.upsert({
      where: { device_id: device.id },
      create: { device_id: device.id, gym_id: gymId, schema_name: schemaName },
      update: { gym_id: gymId, schema_name: schemaName },
    });

    const token = `dev_${device.id}:${rawSecret}`;

    this.logger.log(
      `Registered device id=${device.id} kind=${input.kind} branch=${input.branch_id} (by user=${input.registered_by})`,
    );

    return {
      ...device,
      branch_name: branch.name,
      token, // ONLY returned on registration. Store securely on the device.
      token_format:
        'Use as Authorization: Bearer dev_<device_id>:<secret>. Never share. Rotate by re-registering.',
    };
  }

  async list(filters: { branch_id?: string; status?: string }) {
    const gymId = getTenantGymId();
    if (!gymId) return [];

    return this.tenant.client.checkInDevice.findMany({
      where: {
        ...(filters.branch_id ? { branch_id: filters.branch_id } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: {
        id: true,
        device_name: true,
        kind: true,
        branch_id: true,
        hardware_id: true,
        status: true,
        last_seen_at: true,
        registered_by: true,
        registered_at: true,
        // NEVER select device_secret or pin_hash
      },
      orderBy: [{ status: 'asc' }, { registered_at: 'desc' }],
    });
  }

  async getById(id: string) {
    const device = await this.tenant.client.checkInDevice.findUnique({
      where: { id },
      select: {
        id: true,
        device_name: true,
        kind: true,
        branch_id: true,
        hardware_id: true,
        status: true,
        last_seen_at: true,
        registered_by: true,
        registered_at: true,
      },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async disable(id: string) {
    await this.getById(id);
    return this.tenant.client.checkInDevice.update({
      where: { id },
      data: { status: 'disabled' },
      select: { id: true, status: true },
    });
  }

  async markLost(id: string) {
    await this.getById(id);
    return this.tenant.client.checkInDevice.update({
      where: { id },
      data: { status: 'lost' },
      select: { id: true, status: true },
    });
  }

  /**
   * Verify a `dev_<id>:<secret>` token. Returns the device row on success
   * or null on any failure (bad format, unknown id, wrong secret, status
   * not active). Constant-time secret comparison via `timingSafeEqual`.
   */
  async verifySecret(token: string): Promise<{
    id: string;
    gym_id: string;
    branch_id: string;
    kind: string;
    schema_name: string;
  } | null> {
    const parsed = parseToken(token);
    if (!parsed) return null;
    const { id, secret } = parsed;

    // Routing: resolve the device's gym + schema from the public index — no gym
    // context exists yet. Then read the device row from that gym's schema.
    const idx = await this.pub.deviceIndex.findUnique({ where: { device_id: id } });
    if (!idx) {
      await this.hashSecret(secret).catch(() => undefined);
      return null;
    }
    const client = this.factory.forSchema(idx.schema_name);

    const row = await client.checkInDevice.findUnique({
      where: { id },
      select: {
        id: true,
        gym_id: true,
        branch_id: true,
        kind: true,
        status: true,
        device_secret: true,
      },
    });
    if (!row || row.status !== 'active') {
      // Best-effort timing equalization to mask "device exists?"
      await this.hashSecret(secret).catch(() => undefined);
      return null;
    }

    const ok = await this.compareSecret(secret, row.device_secret);
    if (!ok) return null;

    // Best-effort liveness ping; don't block the request on it.
    client.checkInDevice
      .update({ where: { id }, data: { last_seen_at: new Date() }, select: { id: true } })
      .catch(() => undefined);

    return {
      id: row.id,
      gym_id: row.gym_id,
      branch_id: row.branch_id,
      kind: row.kind,
      schema_name: idx.schema_name,
    };
  }

  isPlausibleToken(token: string): boolean {
    return parseToken(token) !== null;
  }

  static buildTokenFingerprint(token: string): string {
    return createHash('sha256').update(token).digest('hex').slice(0, 16);
  }

  // ── Hash helpers ─────────────────────────────────────────────────

  private async hashSecret(secret: string): Promise<string> {
    const salt = randomBytes(DevicesService.SCRYPT_SALT_BYTES);
    const hash = await scryptAsync(secret, salt, DevicesService.SCRYPT_KEYLEN);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  }

  private async compareSecret(secret: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    try {
      const salt = Buffer.from(parts[1], 'hex');
      const expected = Buffer.from(parts[2], 'hex');
      const candidate = await scryptAsync(secret, salt, expected.length);
      if (candidate.length !== expected.length) return false;
      return timingSafeEqual(candidate, expected);
    } catch {
      return false;
    }
  }
}

function parseToken(token: string): { id: string; secret: string } | null {
  if (typeof token !== 'string' || !token.startsWith('dev_')) return null;
  const rest = token.slice('dev_'.length);
  const colon = rest.indexOf(':');
  if (colon <= 0) return null;
  const id = rest.slice(0, colon);
  const secret = rest.slice(colon + 1);
  if (!UUID_RE.test(id) || secret.length < 32) return null;
  return { id, secret };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
