import { createHmac } from 'crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WhatsAppWebhookController } from '../../src/whatsapp/whatsapp-webhook.controller';

describe('WhatsAppWebhookController', () => {
  const APP_SECRET = 'meta-app-secret';
  const VERIFY_TOKEN = 'verify-me';

  function makeController(env: Record<string, string | undefined> = {}) {
    const config = { get: jest.fn((k: string) => env[k]) } as any;
    const whatsapp = { replyWithCredentials: jest.fn().mockResolvedValue({ delivered: true }) } as any;
    // Inbox with no routing (unrouted number) — the env auto-reply path applies.
    const inbox = {
      resolveGymForNumber: jest.fn().mockResolvedValue(null),
      handleInbound: jest.fn().mockResolvedValue(undefined),
      handleStatus: jest.fn().mockResolvedValue(undefined),
    } as any;
    return { controller: new WhatsAppWebhookController(config, whatsapp, inbox), whatsapp, inbox };
  }

  function signedRequest(body: unknown, secret = APP_SECRET) {
    const raw = Buffer.from(JSON.stringify(body));
    const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
    return {
      body,
      rawBody: raw,
      headers: { 'x-hub-signature-256': signature },
    } as any;
  }

  describe('GET verification', () => {
    it('echoes the challenge for the correct verify token', () => {
      const { controller } = makeController({ WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN });
      expect(controller.verify('subscribe', VERIFY_TOKEN, '12345')).toBe('12345');
    });

    it('rejects a wrong verify token', () => {
      const { controller } = makeController({ WHATSAPP_VERIFY_TOKEN: VERIFY_TOKEN });
      expect(() => controller.verify('subscribe', 'wrong', '12345')).toThrow(ForbiddenException);
    });
  });

  describe('POST signature verification', () => {
    it('rejects when no app secret is configured (cannot authenticate)', async () => {
      const { controller } = makeController({});
      await expect(controller.receive(signedRequest({ entry: [] }))).rejects.toThrow(ForbiddenException);
    });

    it('rejects a missing signature header', async () => {
      const { controller } = makeController({ WHATSAPP_APP_SECRET: APP_SECRET });
      const req = { body: { entry: [] }, rawBody: Buffer.from('{"entry":[]}'), headers: {} } as any;
      await expect(controller.receive(req)).rejects.toThrow(BadRequestException);
    });

    it('rejects a tampered body', async () => {
      const { controller } = makeController({ WHATSAPP_APP_SECRET: APP_SECRET });
      const req = signedRequest({ entry: [] });
      req.rawBody = Buffer.from('{"entry":["tampered"]}');
      await expect(controller.receive(req)).rejects.toThrow(ForbiddenException);
    });

    it('accepts a correctly signed payload', async () => {
      const { controller } = makeController({ WHATSAPP_APP_SECRET: APP_SECRET });
      await expect(controller.receive(signedRequest({ entry: [] }))).resolves.toEqual({ received: true });
    });
  });

  describe('auto-reply', () => {
    const inbound = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'pnid-1' },
                messages: [{ from: '919876543210', id: 'wamid.in', type: 'text', text: { body: 'Hi' } }],
              },
            },
          ],
        },
      ],
    };

    it('replies from the same phone_number_id when configured', async () => {
      const { controller, whatsapp } = makeController({
        WHATSAPP_APP_SECRET: APP_SECRET,
        WHATSAPP_ACCESS_TOKEN: 'tok',
        WHATSAPP_AUTO_REPLY_TEXT: 'Thanks! We will get back to you.',
      });
      await controller.receive(signedRequest(inbound));
      expect(whatsapp.replyWithCredentials).toHaveBeenCalledWith(
        { phoneNumberId: 'pnid-1', accessToken: 'tok' },
        '919876543210',
        'Thanks! We will get back to you.',
      );
    });

    it('does not reply when auto-reply text is not configured', async () => {
      const { controller, whatsapp } = makeController({
        WHATSAPP_APP_SECRET: APP_SECRET,
        WHATSAPP_ACCESS_TOKEN: 'tok',
      });
      await controller.receive(signedRequest(inbound));
      expect(whatsapp.replyWithCredentials).not.toHaveBeenCalled();
    });
  });
});
