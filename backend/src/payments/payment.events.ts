/**
 * In-process payment topics.
 *
 * Deliberately a standalone, dependency-free module: `PaymentsService` emits
 * these without importing the document/PDF stack, so nothing that imports
 * payments transitively pulls in @react-pdf/renderer (which is ESM and breaks
 * Jest parsing). Listeners live next to the machinery they drive.
 */
export const PAYMENT_PAID = 'payment.paid';

export interface PaymentPaidPayload {
  payment_id: string;
  /** Set when the emitter had no request tenant context (gateway webhooks). */
  gym_id?: string;
}
