import { render, cleanup, screen } from '@testing-library/react-native';
import { SkeletonList } from '../Skeleton';

afterEach(cleanup);

describe('SkeletonList', () => {
  it('announces itself once, not once per bar', async () => {
    await render(<SkeletonList count={3} label="Loading your feed" />);
    // One announcement for the whole screen. Nine grey rectangles read out
    // individually would be worse than the spinner this replaces.
    expect(screen.getAllByLabelText('Loading your feed')).toHaveLength(1);
  });

  it('carries the progressbar role for assistive tech', async () => {
    await render(<SkeletonList label="Loading" />);
    expect(screen.getByLabelText('Loading').props.accessibilityRole).toBe('progressbar');
  });

  it('renders one card per requested count', async () => {
    await render(<SkeletonList count={5} label="Loading" />);
    const container = screen.getByLabelText('Loading');
    // Each SkeletonCard is one child of the list container.
    expect(container.props.children).toHaveLength(5);
  });
});
