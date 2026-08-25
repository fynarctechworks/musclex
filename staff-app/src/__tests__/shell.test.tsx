import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Placeholder } from '../ui/Placeholder';
import { Providers } from '../providers';

/**
 * Phase 1/2 shell smoke tests. `render` is awaited because RNTL v14 under the
 * jest-expo preset resolves the tree asynchronously — see jest.setup.ts.
 */
describe('shell', () => {
  it('renders a placeholder that names the screen and its phase', async () => {
    await render(<Placeholder title="Check-in" phase="Phase 5 (front desk)" />);
    expect(screen.getByText('Check-in')).toBeTruthy();
    expect(screen.getByText(/Phase 5 \(front desk\)/)).toBeTruthy();
  });

  it('mounts the provider tree without throwing', async () => {
    await render(
      <Providers>
        <Placeholder title="Members" phase="Phase 5 (front desk)" />
      </Providers>,
    );
    expect(screen.getByText('Members')).toBeTruthy();
  });
});
