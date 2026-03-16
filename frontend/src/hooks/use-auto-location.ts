import { useEffect, useState } from 'react';

export interface AutoLocationState {
  country: string;
  countryName: string;
  currency: string;
  timezone: string;
  city: string;
  loading: boolean;
  error: string | null;
}

interface IpApiResponse {
  country_code?: string;
  country_name?: string;
  currency?: string;
  timezone?: string;
  city?: string;
}

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
}

export function useAutoLocation(): AutoLocationState {
  const [state, setState] = useState<AutoLocationState>({
    country: '',
    countryName: '',
    currency: '',
    timezone: '',
    city: '',
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const browserTimezone = getBrowserTimezone();

    const detectLocation = async () => {
      try {
        const timeout = setTimeout(() => controller.abort(), 7000);
        const response = await fetch('https://ipapi.co/json/', {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`IP lookup failed with status ${response.status}`);
        }

        const data = (await response.json()) as IpApiResponse;

        setState({
          country: data.country_code || '',
          countryName: data.country_name || '',
          currency: data.currency || '',
          timezone: data.timezone || browserTimezone,
          city: data.city || '',
          loading: false,
          error: null,
        });
      } catch {
        setState({
          country: '',
          countryName: '',
          currency: '',
          timezone: browserTimezone,
          city: '',
          loading: false,
          error: 'Could not auto-detect location. Please select manually.',
        });
      }
    };

    void detectLocation();

    return () => {
      controller.abort();
    };
  }, []);

  return state;
}
