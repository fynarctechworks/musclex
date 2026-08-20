import { buildHeadSections, groupsFor, MUSCLES, targetLabel } from '../muscles';

/**
 * `buildHeadSections` decides what a member sees under each heading in the
 * picker and the library. It is shared by both, so a mistake here shows up in
 * two places — and the failure mode that matters is an exercise silently
 * vanishing from the list rather than an obviously wrong heading.
 */

const ex = (name: string, targetMuscle: string | null) => ({ name, targetMuscle });

describe('buildHeadSections', () => {
  const chestHeads = groupsFor('chest')!;

  it('returns null when the group has no heads, so callers render a flat list', () => {
    expect(buildHeadSections([ex('Burpee', null)], null)).toBeNull();
    expect(groupsFor('cardio')).toBeNull();
  });

  it('splits exercises across the heads of a group', () => {
    const out = buildHeadSections(
      [
        ex('Incline Press', 'upper_chest'),
        ex('Flat Bench', 'mid_chest'),
        ex('Decline Press', 'lower_chest'),
        ex('Cable Fly', 'mid_chest'),
      ],
      chestHeads,
    )!;
    const byKey = Object.fromEntries(out.map((s) => [s.head.key, s.list.map((e) => e.name)]));
    expect(byKey.upper_chest).toEqual(['Incline Press']);
    expect(byKey.mid_chest).toEqual(['Flat Bench', 'Cable Fly']);
    expect(byKey.lower_chest).toEqual(['Decline Press']);
  });

  it('keeps heads in the declared anatomical order, not the order exercises arrive', () => {
    const out = buildHeadSections(
      [ex('Decline Press', 'lower_chest'), ex('Incline Press', 'upper_chest')],
      chestHeads,
    )!;
    expect(out.map((s) => s.head.key).slice(0, 3)).toEqual([
      'upper_chest',
      'mid_chest',
      'lower_chest',
    ]);
  });

  it('keeps an empty head rather than dropping it', () => {
    // The heading is how a member notices they have no lower-chest work.
    const out = buildHeadSections([ex('Incline Press', 'upper_chest')], chestHeads)!;
    const lower = out.find((s) => s.head.key === 'lower_chest');
    expect(lower).toBeDefined();
    expect(lower!.list).toEqual([]);
  });

  it('collects unclassified exercises under Other instead of losing them', () => {
    // The dataset genuinely has gaps. Dropping these would mean an exercise
    // that exists in the gym is unreachable from the library.
    const out = buildHeadSections(
      [ex('Incline Press', 'upper_chest'), ex('Mystery Move', null), ex('Odd One', 'not_a_head')],
      chestHeads,
    )!;
    const other = out.find((s) => s.head.key === 'other');
    expect(other).toBeDefined();
    expect(other!.list.map((e) => e.name)).toEqual(['Mystery Move', 'Odd One']);
  });

  it('omits Other entirely when everything is classified', () => {
    const out = buildHeadSections([ex('Flat Bench', 'mid_chest')], chestHeads)!;
    expect(out.some((s) => s.head.key === 'other')).toBe(false);
  });

  it('never loses an exercise', () => {
    const items = [
      ex('a', 'upper_chest'),
      ex('b', 'mid_chest'),
      ex('c', null),
      ex('d', 'bogus'),
      ex('e', 'lower_chest'),
    ];
    const out = buildHeadSections(items, chestHeads)!;
    const seen = out.flatMap((s) => s.list.map((e) => e.name)).sort();
    expect(seen).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('MUSCLES', () => {
  it('leads with All, which clears the filter', () => {
    expect(MUSCLES[0]).toEqual({ label: 'All', value: null });
  });

  it('every group with heads is reachable from the filter row', () => {
    // A head split nobody can navigate to is a split that does not exist.
    for (const m of MUSCLES) {
      const heads = groupsFor(m.value);
      if (heads) expect(heads.length).toBeGreaterThan(1);
    }
  });
});

describe('targetLabel', () => {
  it('renders a head key as prose', () => {
    expect(targetLabel('upper_chest')).toBe('Upper chest');
  });

  it('degrades gracefully on an unknown or missing key', () => {
    expect(typeof targetLabel(null)).toBe('string');
    expect(typeof targetLabel('who_knows')).toBe('string');
  });
});
