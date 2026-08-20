import { Platform } from 'react-native';

/**
 * The iOS branch, which no simulator can exercise: a simulator has no motion
 * chip, so it always reports 'unavailable' and never reaches the code that
 * actually reads a step count. Mocking the module is the only way to pin what
 * happens on a real phone short of on-device QA.
 */

const mockPedometer = {
  isAvailableAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getStepCountAsync: jest.fn(),
  watchStepCount: jest.fn(),
};

jest.mock('../steps-native', () => ({ loadPedometer: async () => mockPedometer }));

import * as steps from '../steps';

// The module reads Platform.OS at call time, so the tests can pose as either.
const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  setPlatform('ios');
  mockPedometer.isAvailableAsync.mockResolvedValue(true);
  mockPedometer.getPermissionsAsync.mockResolvedValue({ granted: true });
});

describe('stepsStatus', () => {
  it('is unsupported off iOS, without touching the native module', async () => {
    setPlatform('android');
    expect(await steps.stepsStatus()).toBe('unsupported');
    // The point of the lazy import: Android must never load a module whose
    // only usable API would give a misleading number.
    expect(mockPedometer.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('is unavailable when the device has no pedometer', async () => {
    mockPedometer.isAvailableAsync.mockResolvedValue(false);
    expect(await steps.stepsStatus()).toBe('unavailable');
  });

  it('is denied when motion access was refused', async () => {
    mockPedometer.getPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await steps.stepsStatus()).toBe('denied');
  });

  it('is granted when the device can and may count', async () => {
    expect(await steps.stepsStatus()).toBe('granted');
  });

  it('reports unavailable rather than throwing when the module blows up', async () => {
    mockPedometer.isAvailableAsync.mockRejectedValue(new Error('CMErrorMotionActivityNotAuthorized'));
    expect(await steps.stepsStatus()).toBe('unavailable');
  });
});

describe('readStepsToday', () => {
  it('asks only for steps since LOCAL midnight', async () => {
    mockPedometer.getStepCountAsync.mockResolvedValue({ steps: 6482 });
    const now = new Date(2026, 7, 20, 18, 45);

    expect(await steps.readStepsToday(now)).toBe(6482);

    const [start, end] = mockPedometer.getStepCountAsync.mock.calls[0];
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(20);
    expect(end).toBe(now);
  });

  it('returns null — not 0 — when the device cannot say', async () => {
    // 0 would render as "you have not moved today" to someone who just walked
    // to the gym. Not knowing and knowing nothing happened are different.
    mockPedometer.isAvailableAsync.mockResolvedValue(false);
    expect(await steps.readStepsToday()).toBeNull();
  });

  it('returns null when permission is missing, without querying', async () => {
    mockPedometer.getPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await steps.readStepsToday()).toBeNull();
    expect(mockPedometer.getStepCountAsync).not.toHaveBeenCalled();
  });

  it('survives a throw from CoreMotion', async () => {
    mockPedometer.getStepCountAsync.mockRejectedValue(new Error('nope'));
    expect(await steps.readStepsToday()).toBeNull();
  });

  it('rounds and floors what the sensor returns', async () => {
    mockPedometer.getStepCountAsync.mockResolvedValue({ steps: 1200.6 });
    expect(await steps.readStepsToday()).toBe(1201);
    mockPedometer.getStepCountAsync.mockResolvedValue({ steps: -5 });
    expect(await steps.readStepsToday()).toBe(0);
    mockPedometer.getStepCountAsync.mockResolvedValue({ steps: NaN });
    expect(await steps.readStepsToday()).toBeNull();
  });
});

describe('requestStepPermission', () => {
  it('is false off iOS rather than prompting for something that would not help', async () => {
    setPlatform('android');
    expect(await steps.requestStepPermission()).toBe(false);
    expect(mockPedometer.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports what the member chose', async () => {
    mockPedometer.requestPermissionsAsync.mockResolvedValue({ granted: true });
    expect(await steps.requestStepPermission()).toBe(true);
    mockPedometer.requestPermissionsAsync.mockResolvedValue({ granted: false });
    expect(await steps.requestStepPermission()).toBe(false);
  });
});
