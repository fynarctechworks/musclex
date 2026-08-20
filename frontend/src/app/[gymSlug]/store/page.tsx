import { redirect } from 'next/navigation';

/**
 * `/store` has no screen of its own — the Store workspace is POS, Inventory and
 * Store Reports. It exists because the breadcrumb builder links every path
 * segment, so `/store/reports` renders a clickable "Store" crumb; without this
 * page that crumb 404s (and Next prefetches it, so it 404s on hover too).
 *
 * Sends you to POS, which is what the sidebar's "Store" entry points at.
 */
export default function StoreIndex({ params }: { params: { gymSlug: string } }) {
  redirect(`/${params.gymSlug}/pos`);
}
