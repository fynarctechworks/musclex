import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
  AUD: 'A$',
};

/**
 * Returns the currency symbol for the current studio.
 * Reads from GET /settings/studio -> studio.currency.
 * Falls back to '₹' if not yet loaded or currency is unknown.
 */
export function useCurrency(): string {
  const { data } = useQuery({
    queryKey: ['settings', 'studio'],
    queryFn: () => apiClient.get<{ currency?: string }>('/settings/studio'),
    staleTime: 10 * 60 * 1000, // 10 minutes — studio currency rarely changes
  });

  const currency = data?.currency ?? 'INR';
  return CURRENCY_SYMBOL_MAP[currency] ?? currency;
}
