import { City, Country, State } from 'country-state-city';

export interface CountryOption {
  code: string;
  name: string;
}

export interface CountryMetadata {
  currency?: string;
  timezone?: string;
}

export interface StateOption {
  code: string;
  name: string;
}

export interface CityOption {
  name: string;
}

export interface PhoneMetadata {
  dialCode: string;
  maxDigits: number;
}

export interface PostalLookupResult {
  city: string;
  state: string;
  area: string;
}

interface CountryWithTimezone {
  isoCode: string;
  name: string;
  currency?: string;
  phonecode?: string;
  timezones?: Array<{
    zoneName?: string;
  }>;
}

interface StateWithCode {
  isoCode: string;
  name: string;
}

interface CityWithName {
  name: string;
}

interface PostalApiPostOffice {
  District?: string;
  State?: string;
  Name?: string;
}

interface PostalApiItem {
  Status?: string;
  PostOffice?: PostalApiPostOffice[];
}

const PHONE_DIGIT_LIMITS: Record<string, number> = {
  AE: 9,
  AU: 9,
  CA: 10,
  GB: 10,
  IN: 10,
  SG: 8,
  US: 10,
};

export function getCountryOptions(): CountryOption[] {
  return Country.getAllCountries()
    .map((country) => ({
      code: country.isoCode,
      name: country.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCountryMetadata(countryCode: string): CountryMetadata {
  if (!countryCode) return {};

  const country = Country.getCountryByCode(countryCode) as CountryWithTimezone | undefined;
  if (!country) return {};

  return {
    currency: country.currency,
    timezone: country.timezones?.[0]?.zoneName,
  };
}

export function getCountryName(countryCode: string): string {
  if (!countryCode) return '';
  return Country.getCountryByCode(countryCode)?.name || '';
}

export function getCountryCodeByName(countryName: string): string {
  if (!countryName) return '';

  const normalized = countryName.trim().toLowerCase();
  return (
    Country.getAllCountries().find((country) => country.name.toLowerCase() === normalized)?.isoCode || ''
  );
}

export function getStateName(countryCode: string, stateCode: string): string {
  if (!countryCode || !stateCode) return '';
  return State.getStateByCodeAndCountry(stateCode, countryCode)?.name || '';
}

export function getStateCodeByName(countryCode: string, stateName: string): string {
  if (!countryCode || !stateName) return '';

  const normalized = stateName.trim().toLowerCase();
  return (
    State.getStatesOfCountry(countryCode).find((state) => state.name.toLowerCase() === normalized)
      ?.isoCode || ''
  );
}

export function getStateOptions(countryCode: string): StateOption[] {
  if (!countryCode) return [];

  return State.getStatesOfCountry(countryCode)
    .map((state) => ({
      code: (state as StateWithCode).isoCode,
      name: state.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCityOptions(countryCode: string, stateCode: string): CityOption[] {
  if (!countryCode || !stateCode) return [];

  return City.getCitiesOfState(countryCode, stateCode)
    .map((city) => ({
      name: (city as CityWithName).name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPhoneMetadata(countryCode: string): PhoneMetadata {
  const country = Country.getCountryByCode(countryCode) as CountryWithTimezone | undefined;
  const dialCode = country?.phonecode ? `+${country.phonecode}` : '';

  return {
    dialCode,
    maxDigits: PHONE_DIGIT_LIMITS[countryCode] || 15,
  };
}

export function sanitizePhoneDigits(value: string, maxDigits: number): string {
  return value.replace(/\D/g, '').slice(0, maxDigits);
}

export function formatPhoneForStorage(countryCode: string, digits: string): string {
  const sanitized = digits.replace(/\D/g, '');
  if (!sanitized) return '';

  const { dialCode } = getPhoneMetadata(countryCode);
  return dialCode ? `${dialCode}${sanitized}` : sanitized;
}

export async function lookupIndianPostalCode(postalCode: string): Promise<PostalLookupResult | null> {
  if (!/^\d{6}$/.test(postalCode)) return null;

  const response = await fetch(`https://api.postalpincode.in/pincode/${postalCode}`, {
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const data = (await response.json()) as PostalApiItem[];
  const record = data[0];
  const office = record?.PostOffice?.[0];

  if (!office || record?.Status !== 'Success') return null;

  return {
    city: office.District || '',
    state: office.State || '',
    area: office.Name || '',
  };
}
