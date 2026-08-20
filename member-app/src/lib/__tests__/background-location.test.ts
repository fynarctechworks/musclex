import { bufferedCount, drainBackgroundFixes, LOCATION_TASK } from '../background-location';

/**
 * The buffer between the background task and the recorder.
 *
 * A module-level buffer rather than a callback, because when the task fires
 * the React tree may not be mounted at all. The rules that matter: nothing is
 * delivered twice, and a forgotten recording cannot grow without bound.
 */
describe('background fix buffer', () => {
  afterEach(() => {
    drainBackgroundFixes();
  });

  it('starts empty', () => {
    expect(bufferedCount()).toBe(0);
    expect(drainBackgroundFixes()).toEqual([]);
  });

  it('hands each fix over exactly once', () => {
    // Draining twice must not replay a stretch of the route and double the
    // distance for it.
    expect(drainBackgroundFixes()).toEqual([]);
    expect(drainBackgroundFixes()).toEqual([]);
  });

  it('names the task with our own prefix, so it cannot collide', () => {
    expect(LOCATION_TASK).toBe('musclex.location.recording');
  });
});
