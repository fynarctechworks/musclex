import { maskIds, stripQuery } from '@/observability/sentry';

/**
 * The scrubbers are the part of crash reporting that must not be wrong.
 *
 * This app handles members' names, phone numbers, measurements and payments
 * for a multi-tenant SaaS. Sentry's defaults are built for consumer apps and
 * will happily attach request URLs — so `GET /members?search=Neha` would ship
 * a member's name to a third party on every keystroke of a search.
 */
describe('stripQuery', () => {
  it('removes a member search term', () => {
    expect(stripQuery('/members?search=Neha%20Patel&limit=20'))
      .toBe('/members?[redacted]');
  });

  it('removes a phone number used as a search', () => {
    expect(stripQuery('/members?search=9810000021')).toBe('/members?[redacted]');
  });

  it('leaves a plain path alone', () => {
    expect(stripQuery('/dashboard/kpis')).toBe('/dashboard/kpis');
  });

  it('handles undefined', () => {
    expect(stripQuery(undefined)).toBeUndefined();
  });

  it('keeps the path, so crashes are still groupable', () => {
    // The route is what makes an issue groupable; the arguments only make it
    // identifiable. Keep the first, drop the second.
    expect(stripQuery('/members?search=x')?.startsWith('/members')).toBe(true);
  });
});

describe('maskIds', () => {
  it('masks a member id in a path', () => {
    expect(maskIds('/members/905d1a12-f326-4b1c-a8f4-8a60a22e263b'))
      .toBe('/members/:id');
  });

  it('masks EVERY id, not just the first', () => {
    expect(maskIds('/members/905d1a12-f326-4b1c-a8f4-8a60a22e263b/body-stats/0eefc8a8-a065-43ac-8b96-3622101780e5'))
      .toBe('/members/:id/body-stats/:id');
  });

  it('is case-insensitive', () => {
    expect(maskIds('/x/905D1A12-F326-4B1C-A8F4-8A60A22E263B')).toBe('/x/:id');
  });

  it('leaves non-uuid segments alone', () => {
    expect(maskIds('/members/TG1006')).toBe('/members/TG1006');
  });

  it('composes with stripQuery', () => {
    expect(maskIds(stripQuery('/members/905d1a12-f326-4b1c-a8f4-8a60a22e263b?search=Neha')))
      .toBe('/members/:id?[redacted]');
  });
});
