import { AsyncLocalStorage } from 'async_hooks';

/**
 * REQUEST CORRELATION — One ID per inbound HTTP request that gets stamped
 * on every log line, every WS event, and every CheckInEvent row, so a
 * single check-in attempt can be traced end-to-end:
 *
 *   browser mutation → X-Correlation-Id header → backend log → DB event
 *   row → outgoing WS payload → frontend Sentry breadcrumb
 *
 * When an operator says "the check-in for John just failed", you can
 * grep for the correlation_id in either layer and see the whole story.
 *
 * Separate ALS from tenantContext so it survives even when there's no
 * authenticated tenant (e.g. failed-auth traces, public webhooks).
 */
export interface CorrelationStore {
  correlationId: string;
}

export const correlationContext = new AsyncLocalStorage<CorrelationStore>();

export function getCorrelationId(): string | undefined {
  return correlationContext.getStore()?.correlationId;
}
