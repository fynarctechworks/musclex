import { describePtType, ptStatusVariant } from '@/lib/pt';

describe('describePtType', () => {
  it.each([
    ['personal_training', 'Personal training'],
    ['group_training', 'Group training'],
    ['rehab_session', 'Rehab'],
    ['assessment', 'Assessment'],
  ])('names %s properly', (input, expected) => {
    expect(describePtType(input)).toBe(expected);
  });

  it('degrades an unknown type to readable text', () => {
    // Never leak a raw enum onto the screen.
    expect(describePtType('aqua_therapy')).toBe('aqua therapy');
  });

  it.each([[null], [undefined], ['']])('falls back for %p', (v) => {
    expect(describePtType(v)).toBe('Session');
  });
});

describe('ptStatusVariant', () => {
  it('marks a completed session as success', () => {
    expect(ptStatusVariant('completed')).toBe('success');
  });

  it('does NOT paint a no-show as an error', () => {
    // A missed session is a normal fact the trainer records, not a mistake
    // they made. Shouting at them every time gets the screen ignored.
    expect(ptStatusVariant('no_show')).not.toBe('destructive');
    expect(ptStatusVariant('no_show')).toBe('warning');
  });

  it('treats a cancellation as neutral', () => {
    expect(ptStatusVariant('cancelled')).toBe('secondary');
  });

  it('falls back for an unknown status rather than throwing', () => {
    expect(ptStatusVariant('rescheduled')).toBe('secondary');
  });
});
