/**
 * Haversine distance + distance formatting (`src/lib/geo.ts`).
 *
 * Drives the nearby-gym finder and the branch list. A wrong distance here sends a
 * member to the wrong gym, so the reference distances below are checked against
 * known great-circle values.
 */
import { formatDistance, haversineKm } from '../geo';

const BENGALURU = { latitude: 12.9716, longitude: 77.5946 };
const MYSURU = { latitude: 12.2958, longitude: 76.6394 };
const DELHI = { latitude: 28.6139, longitude: 77.209 };

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm(BENGALURU, BENGALURU)).toBe(0);
  });

  it('matches the known Bengaluru → Mysuru great-circle distance (~128 km)', () => {
    expect(haversineKm(BENGALURU, MYSURU)).toBeCloseTo(128, 0);
  });

  it('matches the known Bengaluru → Delhi great-circle distance (~1740 km)', () => {
    expect(haversineKm(BENGALURU, DELHI)).toBeCloseTo(1740, -1);
  });

  it('is symmetric', () => {
    expect(haversineKm(BENGALURU, DELHI)).toBeCloseTo(
      haversineKm(DELHI, BENGALURU),
      9,
    );
  });

  it('handles the antimeridian without blowing up', () => {
    const west = { latitude: 0, longitude: 179.9 };
    const east = { latitude: 0, longitude: -179.9 };
    // 0.2° of longitude at the equator ≈ 22 km — NOT most of the way round the world.
    expect(haversineKm(west, east)).toBeCloseTo(22.2, 0);
  });

  it('handles poles', () => {
    const northPole = { latitude: 90, longitude: 0 };
    const southPole = { latitude: -90, longitude: 0 };
    expect(haversineKm(northPole, southPole)).toBeCloseTo(20_015, -2);
  });
});

describe('formatDistance', () => {
  it('shows metres below 1 km', () => {
    expect(formatDistance(0.35)).toBe('350 m');
    expect(formatDistance(0.999)).toBe('999 m');
  });

  it('shows one decimal between 1 and 10 km', () => {
    expect(formatDistance(1)).toBe('1.0 km');
    expect(formatDistance(2.44)).toBe('2.4 km');
    expect(formatDistance(9.4)).toBe('9.4 km');
  });

  // Documents a real (harmless) quirk rather than hiding it: toFixed(1) rounds on
  // the binary value, so 9.95 — which is stored as 9.9499…— renders "9.9 km", and
  // 9.96 crosses into "10.0 km" while 10 itself renders "10 km". Worth knowing if
  // anyone ever screenshot-tests this boundary.
  it('rounds the sub-10km boundary on the binary value', () => {
    expect(formatDistance(9.95)).toBe('9.9 km');
    expect(formatDistance(9.96)).toBe('10.0 km');
    expect(formatDistance(10)).toBe('10 km');
  });

  it('shows whole kilometres at 10 km and above', () => {
    expect(formatDistance(18.4)).toBe('18 km');
    expect(formatDistance(126.2)).toBe('126 km');
  });

  it('handles zero', () => {
    expect(formatDistance(0)).toBe('0 m');
  });
});
