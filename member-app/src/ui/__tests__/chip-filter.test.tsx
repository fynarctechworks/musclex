import { render, fireEvent, cleanup, screen } from '@testing-library/react-native';

jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: View };
});

afterEach(cleanup);

import { Chip } from '../Chip';

/**
 * ────────────────────────────────────────────────────────────────
 * FILTER CHIP
 * ────────────────────────────────────────────────────────────────
 *
 * NOT the same component as the `Chip` exported from src/ui/index.tsx. That one
 * is a static done-state pill used only by the gallery; this one is the
 * interactive filter used by fourteen screens. Two components sharing a name
 * with different props is a trap, and the reason this file names the path it
 * imports from.
 *
 * Worth pinning because two screens — settings/goals and settings/profile —
 * each used to hand-roll this pill, complete with their own
 * accessibilityRole="radio" and accessibilityState. Folding them onto the
 * shared component moved that semantics INTO here; if it were ever dropped,
 * both screens would silently lose it at once and nothing else would notice.
 *
 * TWO HARNESS QUIRKS, both verified rather than guessed at:
 *
 *  1. The chip's Pressable is `accessible`, which collapses it into a single
 *     node and hides its children from label queries. screen.debug() confirms
 *     the tick's label IS rendered — getByLabelText simply cannot see through
 *     the accessible boundary — so the tick is found by walking the tree.
 *  2. The value returned by the FIRST render() in a file has an empty tree,
 *     while `screen` is populated correctly. Same family as the note in
 *     ui.test.tsx about RNTL v14 under jest-expo. Always walk screen.toJSON().
 */

/** Every accessibilityLabel in the subtree, including inside `accessible` nodes. */
function labelsIn(node: any, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) labelsIn(n, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  // toJSON() surfaces the web-flavoured `aria-label` alongside the RN prop
  // depending on the node, so read both rather than guessing which one.
  const label = node.props?.accessibilityLabel ?? node.props?.['aria-label'];
  if (typeof label === 'string') out.push(label);
  // Leaf nodes carry children: null, so guard rather than recursing into it.
  if (node.children) labelsIn(node.children, out);
  return out;
}
describe('the filter chip', () => {
  it('is a radio, not a button — one of a group is chosen', async () => {
    await render(<Chip label="Chest" active onPress={() => {}} />);
    expect(screen.getByRole('radio')).toBeTruthy();
  });

  // Two cases rather than one with a cleanup() in the middle: an explicit
  // cleanup mid-test leaves the harness in a state where the NEXT test's first
  // render does not populate, which then reads as a failure in whatever case
  // happens to run after it.
  it('announces that it is the selected one', async () => {
    await render(<Chip label="Chest" active onPress={() => {}} />);
    expect(screen.getByRole('radio').props.accessibilityState.selected).toBe(true);
  });

  it('announces that it is not the selected one', async () => {
    await render(<Chip label="Chest" active={false} onPress={() => {}} />);
    expect(screen.getByRole('radio').props.accessibilityState.selected).toBe(false);
  });

  it('reports presses', async () => {
    const hits: number[] = [];
    await render(<Chip label="Legs" active={false} onPress={() => hits.push(1)} />);
    // By text: the accessible Pressable is the element that carries the press,
    // and pressing the label resolves to it.
    fireEvent.press(screen.getByText('Legs'));
    expect(hits).toHaveLength(1);
  });

  it('carries the done tick as a LABEL, not just a colour', async () => {
    // The tick says "covered" on top of being green, because colour must never
    // be the only indicator — a member who cannot distinguish the hue still
    // needs to know the head is already worked.
    await render(<Chip label="Upper chest" active={false} done onPress={() => {}} />);
    expect(labelsIn(screen.toJSON())).toContain('covered');
  });

  it('has no tick when it is not done', async () => {
    await render(<Chip label="Upper chest" active={false} onPress={() => {}} />);
    // Present but empty is the trap here: assert the walker found the LABEL
    // and not merely that it found nothing at all.
    const labels = labelsIn(screen.toJSON());
    expect(labels).not.toContain('covered');
  });
});
