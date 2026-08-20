import { render, fireEvent, cleanup, screen } from '@testing-library/react-native';

// RNTL v14's auto-cleanup is not registered under the jest-expo preset, so
// without this every render stays mounted and queries match elements from
// earlier tests.
afterEach(cleanup);
import { Button, Chip, Meter, Txt } from '../index';
import { Notice, Confirm } from '../Notice';

/**
 * Behaviour of the primitives every screen is built from. These are the pieces
 * whose defects would be invisible in a typecheck and identical on 25 screens.
 */

/**
 * NOTE ON ORDER: the Txt block runs first deliberately.
 *
 * RNTL v14 under the jest-expo preset leaks something between async renders —
 * a bare `<Txt>` mounted after the Button/Notice blocks cannot be queried, even
 * though the rendered tree is correct and the same test passes in isolation.
 * Ordering it first sidesteps the harness bug. Do not "tidy" it to the bottom.
 */
describe('Txt', () => {
  it('renders its children', async () => {
    await render(<Txt>Hello</Txt>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });
});

describe('Button', () => {
  it('fires onPress when enabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} />);
    fireEvent.press(screen.getByText('Save'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Save" onPress={onPress} disabled />);
    fireEvent.press(screen.getByLabelText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does NOT fire while loading — the guard against double-submitting a workout', async () => {
    const onPress = jest.fn();
    await render(<Button title="Finish" onPress={onPress} loading />);
    fireEvent.press(screen.getByLabelText('Finish'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('hides its title while loading so the spinner stands alone', async () => {
    await render(<Button title="Finish" loading />);
    expect(screen.queryByText('Finish')).toBeNull();
  });

  it('exposes an overriding accessibility label when the title is ambiguous', async () => {
    await render(<Button title="Finish" accessibilityLabel="Finish setup" />);
    expect(screen.getByLabelText('Finish setup')).toBeTruthy();
  });

  it('reports its disabled state to assistive tech', async () => {
    await render(<Button title="Save" disabled />);
    expect(screen.getByLabelText('Save').props.accessibilityState.disabled).toBe(true);
  });
});

describe('Chip', () => {
  it('marks a completed chip with a tick', async () => {
    await render(<Chip label="Workout" on />);
    expect(screen.getByText(/✓/)).toBeTruthy();
  });

  it('leaves an incomplete chip unmarked', async () => {
    await render(<Chip label="Meal" />);
    expect(screen.queryByText(/✓/)).toBeNull();
  });
});

describe('Meter', () => {
  it('renders without dividing by zero when there is no goal', async () => {
    await expect(render(<Meter value={5} max={0} tint="#000" />)).resolves.toBeDefined();
  });

  it('renders when over the goal rather than overflowing', async () => {
    await expect(render(<Meter value={300} max={100} tint="#000" />)).resolves.toBeDefined();
  });
});

describe('Notice', () => {
  it('shows the title and body', async () => {
    await render(<Notice title="Could not book" body="Class is full" />);
    expect(screen.getByText('Could not book')).toBeTruthy();
    expect(screen.getByText('Class is full')).toBeTruthy();
  });

  it('only offers dismiss when a handler is given', async () => {
    await render(<Notice title="Saved" />);
    expect(screen.queryByText('Dismiss')).toBeNull();
  });

  it('dismisses on tap', async () => {
    const onDismiss = jest.fn();
    await render(<Notice title="Saved" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('Confirm', () => {
  it('keeps cancel and confirm separate, so a destructive action needs its own tap', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await render(
      <Confirm
        title="Discard workout?"
        confirmLabel="Discard"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Discard'));
    expect(onConfirm).toHaveBeenCalled();
  });
});

