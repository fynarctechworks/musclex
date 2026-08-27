import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
afterEach(cleanup);
import { Button } from '../../ui';

describe('Button', () => {
  it('fires onPress', async () => {
    const onPress = jest.fn();
    await render(<Button title="Get started" onPress={onPress} />);
    fireEvent.press(screen.getByText('Get started'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Nope" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Nope'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
