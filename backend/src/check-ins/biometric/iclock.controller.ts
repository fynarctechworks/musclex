import { Controller, Get, Header, Logger, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { IclockService } from './iclock.service';

/**
 * eSSL / ZKTeco ADMS ("iclock") push-protocol endpoints. The device is
 * configured with this server's host; it then polls/pushes:
 *
 *   GET  /iclock/cdata?SN=...&options=all  — handshake / config fetch
 *   POST /iclock/cdata?SN=...&table=ATTLOG — attendance records (raw text)
 *   GET  /iclock/getrequest?SN=...         — pending-command poll
 *
 * No auth headers exist in this protocol — trust is anchored on the device
 * serial being pre-registered by a gym admin (unregistered SNs are ignored)
 * plus rate limiting. Responses are plain text; devices retry until "OK".
 */
@Controller('iclock')
export class IclockController {
  private readonly logger = new Logger(IclockController.name);

  constructor(private readonly iclock: IclockService) {}

  @Get('cdata')
  @Header('Content-Type', 'text/plain')
  @Throttle({ medium: { limit: 60, ttl: 60_000 } })
  async handshake(@Query('SN') serial?: string): Promise<string> {
    const device = serial ? await this.iclock.resolveDevice(serial) : null;
    if (!device) return 'OK'; // never reveal registration state to the caller
    // Minimal ADMS options block: realtime push, no transaction encryption.
    return [
      `GET OPTION FROM: ${serial}`,
      'Stamp=9999',
      'OpStamp=9999',
      'ErrorDelay=30',
      'Delay=10',
      'TransTimes=00:00;12:00',
      'TransInterval=1',
      'TransFlag=1111000000',
      'Realtime=1',
      'Encrypt=0',
    ].join('\r\n');
  }

  @Post('cdata')
  @Header('Content-Type', 'text/plain')
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  async receive(
    @Req() req: Request,
    @Query('SN') serial?: string,
    @Query('table') table?: string,
  ): Promise<string> {
    const body = typeof req.body === 'string' ? req.body : '';
    if (!serial || (table && table.toUpperCase() !== 'ATTLOG')) {
      // OPERLOG / device info etc. — acknowledge without processing.
      return 'OK';
    }
    const result = await this.iclock.ingestAttendance(serial, body);
    return `OK: ${result.received}`;
  }

  @Get('getrequest')
  @Header('Content-Type', 'text/plain')
  @Throttle({ medium: { limit: 120, ttl: 60_000 } })
  async getRequest(@Query('SN') _serial?: string): Promise<string> {
    return 'OK'; // no pending server→device commands
  }
}
