import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'member:raw-response';

/**
 * Return this handler's body EXACTLY as it is, outside the { data, meta }
 * envelope.
 *
 * For file downloads only. A GPX file is meant to open in somebody else's
 * software; wrapped in JSON it arrives as an escaped string that nothing can
 * read, which defeats the whole point of having an export.
 *
 * Deliberately opt-in and named for what it does, so nobody reaches for it to
 * avoid the envelope on an ordinary JSON endpoint — every client depends on
 * that shape.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
