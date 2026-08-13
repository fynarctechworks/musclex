/**
 * The single seam between MuscleX and whatever actually delivers WhatsApp
 * messages. Mirrors the EmailProvider seam (src/email/providers/*): every
 * WhatsApp send in the codebase goes through `WhatsAppService`, which resolves
 * per-gym WABA credentials and hands a fully-formed message to one of these
 * providers. Swapping Meta Cloud API for Twilio/Gupshup/WATI means writing one
 * new class that implements this interface and binding it to the
 * `WHATSAPP_PROVIDER` token. No caller changes.
 */

/** Credentials for one WhatsApp Business Account sender (per-gym or global). */
export interface WabaCredentials {
  /** Meta phone number id (the sender), e.g. from the WABA dashboard. */
  phoneNumberId: string;
  /** System-user / permanent access token. */
  accessToken: string;
}

export interface WhatsAppTextMessage {
  /** E.164-ish destination; WhatsAppService normalizes before handing over. */
  to: string;
  text: string;
}

export interface WhatsAppTemplateMessage {
  to: string;
  /** Pre-approved template name in the WABA. */
  templateName: string;
  /** BCP-47 language code the template was approved for. */
  languageCode: string;
  /** Positional {{1}}..{{n}} body parameters. */
  bodyParams?: string[];
}

export interface WhatsAppDocumentMessage {
  to: string;
  /** Publicly fetchable URL (e.g. 1-hour signed invoice PDF URL). */
  documentUrl: string;
  filename?: string;
  caption?: string;
}

export interface WhatsAppSendResult {
  /** Provider message id (Meta `wamid...`), when returned. */
  id?: string;
  /** False for the no-op provider — caller can log/skip. */
  delivered: boolean;
}

export interface WhatsAppProvider {
  /**
   * Deliver one message. MUST throw on a transient/hard failure so the caller's
   * retry (inline) or BullMQ (queued) can react. The no-op provider never throws.
   */
  sendText(creds: WabaCredentials, msg: WhatsAppTextMessage): Promise<WhatsAppSendResult>;
  sendTemplate(creds: WabaCredentials, msg: WhatsAppTemplateMessage): Promise<WhatsAppSendResult>;
  sendDocument(creds: WabaCredentials, msg: WhatsAppDocumentMessage): Promise<WhatsAppSendResult>;
  /** Human-readable provider name for logs. */
  readonly name: string;
}

/** DI token for the active WhatsApp provider. */
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
