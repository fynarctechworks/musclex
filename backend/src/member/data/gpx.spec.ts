import { MAX_POINTS, parseGpx, polylineFor, toGpx } from './gpx';

/**
 * A GPX file is uploaded by a member and produced by somebody else's software.
 * The cases that matter are the malformed ones: this must never throw, never
 * trust a coordinate, and never be talked into reading an enormous file.
 */
const gpx = (body: string) => `<?xml version="1.0"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

describe('parseGpx', () => {
  it('reads a track of points', () => {
    const out = parseGpx(gpx(`
      <trk><name>Beach Road</name><trkseg>
        <trkpt lat="17.7000" lon="83.3000"><ele>10</ele></trkpt>
        <trkpt lat="17.7010" lon="83.3000"><ele>14</ele></trkpt>
      </trkseg></trk>`));
    expect(out.name).toBe('Beach Road');
    expect(out.points).toHaveLength(2);
    expect(out.distanceM).toBeGreaterThan(100);
  });

  it('reads self-closing points, which plenty of exporters emit', () => {
    const out = parseGpx(gpx(`<trk><trkseg>
      <trkpt lat="17.70" lon="83.30" />
      <trkpt lat="17.71" lon="83.30"/>
    </trkseg></trk>`));
    expect(out.points).toHaveLength(2);
  });

  it('reads route points and waypoints as well as track points', () => {
    expect(parseGpx(gpx('<rte><rtept lat="17.7" lon="83.3"/></rte>')).points).toHaveLength(1);
    expect(parseGpx(gpx('<wpt lat="17.7" lon="83.3"/>')).points).toHaveLength(1);
  });

  it('counts sustained climbing and ignores altitude jitter', () => {
    const jitter = Array.from({ length: 10 }, (_, i) =>
      `<trkpt lat="17.7${i}" lon="83.3"><ele>${30 + (i % 2)}</ele></trkpt>`).join('');
    expect(parseGpx(gpx(`<trk><trkseg>${jitter}</trkseg></trk>`)).elevationGainM).toBe(0);

    const climb = Array.from({ length: 5 }, (_, i) =>
      `<trkpt lat="17.7${i}" lon="83.3"><ele>${30 + i * 10}</ele></trkpt>`).join('');
    expect(parseGpx(gpx(`<trk><trkseg>${climb}</trkseg></trk>`)).elevationGainM).toBe(40);
  });

  it('does not count the descent', () => {
    const out = parseGpx(gpx(`<trk><trkseg>
      <trkpt lat="17.70" lon="83.3"><ele>100</ele></trkpt>
      <trkpt lat="17.71" lon="83.3"><ele>50</ele></trkpt>
      <trkpt lat="17.72" lon="83.3"><ele>80</ele></trkpt>
    </trkseg></trk>`));
    expect(out.elevationGainM).toBe(30);
  });

  it('rejects a coordinate that is not on the planet', () => {
    const out = parseGpx(gpx(`<trk><trkseg>
      <trkpt lat="17.70" lon="83.3"/>
      <trkpt lat="999" lon="83.3"/>
      <trkpt lat="17.71" lon="-400"/>
    </trkseg></trk>`));
    expect(out.points).toHaveLength(1);
  });

  it('ignores a point whose numbers are not numbers', () => {
    const out = parseGpx(gpx('<trk><trkseg><trkpt lat="north" lon="east"/></trkseg></trk>'));
    expect(out.points).toEqual([]);
  });

  it('returns an empty route for junk rather than throwing', () => {
    // A file a stranger uploaded must never be able to crash an import.
    expect(parseGpx('').points).toEqual([]);
    expect(parseGpx('not xml at all').points).toEqual([]);
    expect(parseGpx('<gpx><trk>').points).toEqual([]);
    expect(parseGpx(undefined as any).points).toEqual([]);
  });

  it('is not fooled by a doctype or an entity declaration', () => {
    // Reading attributes with a regex means no entity is ever expanded — the
    // reason this is not an XML parser.
    const nasty = `<?xml version="1.0"?>
      <!DOCTYPE gpx [<!ENTITY lol "lololol">]>
      <gpx><trk><trkseg><trkpt lat="17.7" lon="83.3"/></trkseg></trk></gpx>`;
    const out = parseGpx(nasty);
    expect(out.points).toHaveLength(1);
    expect(JSON.stringify(out)).not.toContain('lol');
  });

  it('stops at the point cap however large the file', () => {
    const many = Array.from({ length: MAX_POINTS + 500 }, () =>
      '<trkpt lat="17.7" lon="83.3"/>').join('');
    expect(parseGpx(gpx(`<trk><trkseg>${many}</trkseg></trk>`)).points).toHaveLength(MAX_POINTS);
  });

  it('has no name when the file gives none', () => {
    expect(parseGpx(gpx('<trk><trkseg><trkpt lat="17.7" lon="83.3"/></trkseg></trk>')).name)
      .toBeNull();
  });
});

describe('toGpx', () => {
  const route = {
    name: 'Beach Road',
    points: [{ lat: 17.7, lng: 83.3, ele: 10 }, { lat: 17.71, lng: 83.3, ele: 14 }],
  };

  it('round-trips through parseGpx', () => {
    const back = parseGpx(toGpx(route));
    expect(back.name).toBe('Beach Road');
    expect(back.points).toHaveLength(2);
    expect(back.points[0].lat).toBeCloseTo(17.7, 5);
  });

  it('writes a <trk>, which everything reads', () => {
    expect(toGpx(route)).toContain('<trk>');
  });

  it('escapes a name that would otherwise break the file', () => {
    // Member-supplied text goes straight into XML.
    const out = toGpx({ ...route, name: 'Ben & Jerry\'s <hill>' });
    expect(out).toContain('Ben &amp; Jerry&apos;s &lt;hill&gt;');
    expect(parseGpx(out).points).toHaveLength(2);
  });

  it('omits elevation when there is none rather than writing a fake zero', () => {
    const out = toGpx({ name: 'Flat', points: [{ lat: 1, lng: 2, ele: null }] });
    expect(out).not.toContain('<ele>');
  });
});

describe('polylineFor', () => {
  it('encodes a short route whole', () => {
    expect(polylineFor([{ lat: 1, lng: 2 }, { lat: 1.1, lng: 2 }])).toBeTruthy();
  });

  it('thins a long one and always keeps the finish', () => {
    const pts = Array.from({ length: 5000 }, (_, i) => ({ lat: 17 + i / 100000, lng: 83 }));
    const encoded = polylineFor(pts, 500);
    expect(encoded.length).toBeLessThan(polylineFor(pts, 99999).length);
  });

  it('handles an empty route', () => {
    expect(polylineFor([])).toBe('');
  });
});
