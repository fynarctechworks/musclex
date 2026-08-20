import { toPayload, totalDuration, totalVolume, type SessionBlock } from '../sets';

const block = (id: string, sets: [string, string, boolean][]): SessionBlock => ({
  id,
  name: id,
  sets: sets.map(([kg, reps, done]) => ({ kg, reps, secs: '', done })),
});

/** A timed exercise: seconds instead of weight x reps. */
const timedBlock = (id: string, secs: [string, boolean][]): SessionBlock => ({
  id,
  name: id,
  trackingType: 'duration',
  sets: secs.map(([s, done]) => ({ kg: '', reps: '', secs: s, done })),
});

describe('toPayload', () => {
  it('sends only completed sets', () => {
    const out = toPayload([
      block('bench', [
        ['60', '8', true],
        ['60', '8', false],
      ]),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ exerciseId: 'bench', weight: 60, reps: 8, unit: 'kg' });
  });

  it('numbers sets after filtering, so a skipped row leaves no gap', () => {
    const out = toPayload([
      block('bench', [
        ['60', '8', false],
        ['65', '6', true],
        ['70', '4', true],
      ]),
    ]);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('numbers independently per exercise', () => {
    const out = toPayload([
      block('bench', [['60', '8', true]]),
      block('squat', [
        ['100', '5', true],
        ['100', '5', true],
      ]),
    ]);
    expect(out.filter((s) => s.exerciseId === 'squat').map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('coerces strings and tolerates blanks', () => {
    const out = toPayload([block('bench', [['62.5', '', true]])]);
    expect(out[0].weight).toBe(62.5);
    expect(out[0].reps).toBe(0);
  });

  it('rounds fractional reps — half a rep is not a thing', () => {
    const out = toPayload([block('bench', [['60', '8.6', true]])]);
    expect(out[0].reps).toBe(9);
  });

  it('returns nothing when no set was completed', () => {
    expect(toPayload([block('bench', [['60', '8', false]])])).toEqual([]);
  });
});

describe('unit conversion at the write boundary', () => {
  it('stores kg unchanged when the member types kg', () => {
    const out = toPayload([block('bench', [['60', '8', true]])], 'kg');
    expect(out[0].weight).toBe(60);
  });

  it('converts pounds to kg before storing — the column means kilograms', () => {
    const out = toPayload([block('bench', [['138', '8', true]])], 'lb');
    expect(out[0].weight).toBeCloseTo(62.6, 1);
    expect(out[0].unit).toBe('kg');
  });

  it('defaults to kg when no unit is given, so existing callers cannot corrupt data', () => {
    const out = toPayload([block('bench', [['60', '8', true]])]);
    expect(out[0].weight).toBe(60);
  });
});

describe('interval (timed) exercises', () => {
  it('sends durationSeconds and zeroes weight and reps', () => {
    const out = toPayload([timedBlock('plank', [['45', true]])]);
    expect(out[0]).toMatchObject({ durationSeconds: 45, reps: 0, weight: 0 });
  });

  it('omits durationSeconds entirely for rep-based exercises', () => {
    const out = toPayload([block('bench', [['60', '8', true]])]);
    expect(out[0].durationSeconds).toBeUndefined();
  });

  it('does not let a timed set inflate volume — a plank moves no load', () => {
    const out = toPayload([timedBlock('plank', [['60', true]])]);
    expect(totalVolume(out)).toBe(0);
  });

  it('totals seconds under tension across timed sets', () => {
    const out = toPayload([timedBlock('plank', [['45', true], ['60', true], ['30', false]])]);
    expect(totalDuration(out)).toBe(105);
  });

  it('counts no duration for a rep session', () => {
    const out = toPayload([block('bench', [['60', '8', true]])]);
    expect(totalDuration(out)).toBe(0);
  });
});

describe('totalVolume', () => {
  it('multiplies weight by reps across every set', () => {
    const out = toPayload([
      block('bench', [
        ['60', '10', true],
        ['60', '10', true],
      ]),
    ]);
    expect(totalVolume(out)).toBe(1200);
  });

  it('is zero for an empty session', () => {
    expect(totalVolume([])).toBe(0);
  });
});
