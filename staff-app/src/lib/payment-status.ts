/**
 * Payment status vocabulary.
 *
 * The canonical set is `pending | paid | refunded | failed` — there is no
 * `completed`, and there never was. This screen shipped filtering on
 * `status=completed`, which matched nothing; it *looked* right only because
 * the seeded test data used the same invented value, so two wrongs agreed with
 * each other. Fixing the seeder is what exposed it.
 *
 * Centralised here so the value exists in exactly one place and the next
 * screen cannot invent its own.
 */

export const PAYMENT_PAID = 'paid';
export const PAYMENT_PENDING = 'pending';

export type PaymentFilter = 'all' | typeof PAYMENT_PAID | typeof PAYMENT_PENDING;

/** The `status` query param for a filter, or undefined for "all". */
export function statusParam(filter: PaymentFilter): string | undefined {
  return filter === 'all' ? undefined : filter;
}

/**
 * Badge tone for a payment.
 *
 * `refunded` is neutral rather than red: refunding somebody is a normal, often
 * correct thing for a gym to do, not an error the desk should be warned about.
 * `failed` is the only genuinely bad outcome here.
 */
export function paymentVariant(
  status: string | null | undefined,
): 'success' | 'warning' | 'secondary' | 'destructive' {
  switch (status) {
    case PAYMENT_PAID: return 'success';
    case PAYMENT_PENDING: return 'warning';
    case 'refunded': return 'secondary';
    case 'failed': return 'destructive';
    default: return 'secondary';
  }
}
