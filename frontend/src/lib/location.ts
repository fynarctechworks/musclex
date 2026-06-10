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

// National (subscriber) number length per country — used to cap phone input.
// Typical mobile length; generous where variable. Unknowns fall back to 15 (E.164).
const PHONE_DIGIT_LIMITS: Record<string, number> = {
  AD: 6, AE: 9, AF: 9, AG: 7, AL: 9, AM: 8, AO: 9, AR: 10, AT: 11, AU: 9,
  AZ: 9, BA: 8, BB: 7, BD: 10, BE: 9, BF: 8, BG: 9, BH: 8, BI: 8, BJ: 8,
  BN: 7, BO: 8, BR: 11, BS: 7, BT: 8, BW: 8, BY: 9, BZ: 7, CA: 10, CD: 9,
  CF: 8, CG: 9, CH: 9, CI: 10, CL: 9, CM: 9, CN: 11, CO: 10, CR: 8, CU: 8,
  CV: 7, CY: 8, CZ: 9, DE: 11, DJ: 8, DK: 8, DM: 7, DO: 10, DZ: 9, EC: 9,
  EE: 8, EG: 10, ER: 7, ES: 9, ET: 9, FI: 9, FJ: 7, FM: 7, FR: 9, GA: 7,
  GB: 10, GD: 7, GE: 9, GH: 9, GL: 6, GM: 7, GN: 9, GQ: 9, GR: 10, GT: 8,
  GW: 7, GY: 7, HK: 8, HN: 8, HR: 9, HT: 8, HU: 9, ID: 11, IE: 9, IL: 9,
  IN: 10, IQ: 10, IR: 10, IS: 7, IT: 10, JM: 7, JO: 9, JP: 10, KE: 9, KG: 9,
  KH: 9, KI: 5, KM: 7, KN: 7, KP: 10, KR: 10, KW: 8, KZ: 10, LA: 9, LB: 8,
  LC: 7, LI: 7, LK: 9, LR: 8, LS: 8, LT: 8, LU: 9, LV: 8, LY: 9, MA: 9,
  MC: 8, MD: 8, ME: 8, MG: 9, MH: 7, MK: 8, ML: 8, MM: 9, MN: 8, MO: 8,
  MR: 8, MT: 8, MU: 8, MV: 7, MW: 9, MX: 10, MY: 9, MZ: 9, NA: 9, NE: 8,
  NG: 10, NI: 8, NL: 9, NO: 8, NP: 10, NR: 7, NZ: 9, OM: 8, PA: 8, PE: 9,
  PG: 8, PH: 10, PK: 10, PL: 9, PR: 10, PS: 9, PT: 9, PW: 7, PY: 9, QA: 8,
  RO: 9, RS: 9, RU: 10, RW: 9, SA: 9, SB: 7, SC: 7, SD: 9, SE: 9, SG: 8,
  SI: 8, SK: 9, SL: 8, SM: 10, SN: 9, SO: 8, SR: 7, SS: 9, ST: 7, SV: 8,
  SY: 9, SZ: 8, TD: 8, TG: 8, TH: 9, TJ: 9, TL: 8, TM: 8, TN: 8, TO: 7,
  TR: 10, TT: 7, TV: 6, TW: 9, TZ: 9, UA: 9, UG: 9, US: 10, UY: 8, UZ: 9,
  VA: 10, VC: 7, VE: 10, VN: 9, VU: 7, WS: 7, YE: 9, ZA: 9, ZM: 9, ZW: 9,
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
