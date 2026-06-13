import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PublicPrismaService } from '../prisma/public-prisma.service';

export interface DeviceInfo {
  device_fingerprint?: string;
  device_name?: string;
  device_type?: string;
  user_agent?: string;
  ip_address?: string;
}

export interface ParsedDevice {
  device_fingerprint: string;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
}

@Injectable()
export class AuthDeviceService {
  private readonly logger = new Logger(AuthDeviceService.name);

  constructor(private readonly pub: PublicPrismaService) {}

  /**
   * Track a device login. Creates or updates the device record.
   * Returns the device ID for session/history linking.
   */
  async trackDevice(
    userId: string,
    info: DeviceInfo,
  ): Promise<{ id: string; is_new: boolean }> {
    const parsed = this.parseUserAgent(info.user_agent || '');
    const fingerprint =
      info.device_fingerprint ||
      this.generateFingerprint(userId, info.user_agent || '', info.ip_address || '');

    try {
      // Upsert: find existing device or create new
      const existing = await this.pub.userDevice.findUnique({
        where: {
          user_id_device_fingerprint: {
            user_id: userId,
            device_fingerprint: fingerprint,
          },
        },
      });

      if (existing) {
        await this.pub.userDevice.update({
          where: { id: existing.id },
          data: {
            last_active_at: new Date(),
            ip_address: info.ip_address || existing.ip_address,
            browser: parsed.browser || existing.browser,
            os: parsed.os || existing.os,
            device_name: info.device_name || existing.device_name,
          },
        });
        return { id: existing.id, is_new: false };
      }

      const device = await this.pub.userDevice.create({
        data: {
          user_id: userId,
          device_fingerprint: fingerprint,
          device_name: info.device_name || parsed.device_name,
          device_type: info.device_type || parsed.device_type,
          browser: parsed.browser,
          os: parsed.os,
          ip_address: info.ip_address,
          is_trusted: false,
        },
      });

      return { id: device.id, is_new: true };
    } catch (err) {
      this.logger.error(`Failed to track device: ${err.message}`);
      return { id: '', is_new: false };
    }
  }

  /**
   * List all devices for a user.
   */
  async getUserDevices(userId: string) {
    return this.pub.userDevice.findMany({
      where: { user_id: userId },
      orderBy: { last_active_at: 'desc' },
      select: {
        id: true,
        device_name: true,
        device_type: true,
        browser: true,
        os: true,
        ip_address: true,
        location_city: true,
        location_country: true,
        is_trusted: true,
        last_active_at: true,
        created_at: true,
      },
    });
  }

  /**
   * Trust or untrust a device.
   */
  async setDeviceTrust(userId: string, deviceId: string, trusted: boolean) {
    return this.pub.userDevice.updateMany({
      where: { id: deviceId, user_id: userId },
      data: { is_trusted: trusted },
    });
  }

  /**
   * Remove a device (and its sessions).
   */
  async removeDevice(userId: string, deviceId: string) {
    // Revoke all sessions on this device first
    await this.pub.userSession.updateMany({
      where: { device_id: deviceId, user_id: userId, is_active: true },
      data: { is_active: false, revoked_at: new Date(), revoked_reason: 'device_removed' },
    });

    return this.pub.userDevice.deleteMany({
      where: { id: deviceId, user_id: userId },
    });
  }

  /**
   * Generate a deterministic fingerprint from user agent + IP when client doesn't provide one.
   */
  private generateFingerprint(userId: string, userAgent: string, ip: string): string {
    const raw = `${userId}:${userAgent}:${ip}`;
    return createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  /**
   * Parse a user-agent string into device components.
   */
  private parseUserAgent(ua: string): ParsedDevice {
    const browser = this.detectBrowser(ua);
    const os = this.detectOS(ua);
    const deviceType = this.detectDeviceType(ua);
    const deviceName = `${browser} on ${os}`;

    return {
      device_fingerprint: '',
      device_name: deviceName,
      device_type: deviceType,
      browser,
      os,
    };
  }

  private detectBrowser(ua: string): string {
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
    return 'Unknown Browser';
  }

  private detectOS(ua: string): string {
    if (ua.includes('Windows NT 10')) return 'Windows 10/11';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Linux') && ua.includes('Android')) return 'Android';
    if (ua.includes('Linux')) return 'Linux';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return 'Unknown OS';
  }

  private detectDeviceType(ua: string): string {
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone'))
      return 'mobile';
    if (ua.includes('iPad') || ua.includes('Tablet')) return 'tablet';
    return 'desktop';
  }
}
