import { render, fireEvent, cleanup, screen } from '@testing-library/react-native';

afterEach(cleanup);

import { Txt } from '../index';
import { InfoBullet, InfoDot, InfoNote } from '../InfoTip';

/**
 * The tip is an icon with no visible text, which is exactly the shape that
 * looks fine on screen and is unusable with a screen reader. These pin the
 * parts a typecheck cannot see.
 */

describe('InfoDot', () => {
  it('is reachable by what it explains, not by "i"', async () => {
    await render(<InfoDot open={false} onPress={() => {}} label="What counts as a streak day" />);
    expect(screen.getByLabelText('What counts as a streak day')).toBeTruthy();
  });

  it('toggles on press', async () => {
    const onPress = jest.fn();
    await render(<InfoDot open={false} onPress={onPress} label="What counts" />);
    fireEvent.press(screen.getByLabelText('What counts'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces whether the explanation is open', async () => {
    // Without `expanded`, a screen reader gives no clue the press did anything.
    await render(<InfoDot open onPress={() => {}} label="What counts" />);
    expect(screen.getByLabelText('What counts').props.accessibilityState.expanded).toBe(true);
  });

  it('carries a touch target larger than the glyph', async () => {
    await render(<InfoDot open={false} onPress={() => {}} label="What counts" />);
    expect(screen.getByLabelText('What counts').props.hitSlop).toBeTruthy();
  });
});

describe('InfoNote', () => {
  it('renders the explanation it is given', async () => {
    await render(
      <InfoNote>
        <Txt>Any one of these marks the day</Txt>
      </InfoNote>,
    );
    expect(screen.getByText('Any one of these marks the day')).toBeTruthy();
  });
});

describe('InfoBullet', () => {
  it('keeps the text queryable on its own, apart from the decorative dot', async () => {
    await render(<InfoBullet>Log a meal</InfoBullet>);
    expect(screen.getByText('Log a meal')).toBeTruthy();
  });
});
