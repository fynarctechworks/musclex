import { clearRecording, loadRecording, saveRecording } from '../recording-store';
import { newRecording } from '../recorder';

/**
 * A run must survive the app dying.
 *
 * This is not hypothetical: a cold launch during testing destroyed a
 * two-minute recording that had 66 fixes in it. Losing somebody's run is the
 * worst failure a tracker has — it is not a feature that broke, it is work
 * that cannot be redone.
 */
describe('recording persistence', () => {
  const withPoints = (n: number, ageMs = 0) => {
    const st = newRecording(Date.now() - ageMs);
    st.points = Array.from({ length: n }, (_, i) => ({
      lat: 17.7 + i / 100000,
      lng: 83.3,
      at: Date.now() - ageMs + i * 1000,
    }));
    st.distanceM = n * 3;
    st.elapsedMs = n * 1000;
    return st;
  };

  afterEach(async () => {
    await clearRecording();
  });

  it('has nothing to offer when nothing was saved', async () => {
    expect(await loadRecording()).toBeNull();
  });

  it('gives back what was saved', async () => {
    await saveRecording('run', withPoints(5));
    const back = await loadRecording();
    expect(back?.sport).toBe('run');
    expect(back?.state.points).toHaveLength(5);
    expect(back?.state.distanceM).toBe(15);
  });

  it('keeps only the most recent save', async () => {
    await saveRecording('run', withPoints(3));
    await saveRecording('ride', withPoints(9));
    const back = await loadRecording();
    expect(back?.sport).toBe('ride');
    expect(back?.state.points).toHaveLength(9);
  });

  it('does not offer a recording with no points', async () => {
    // Pressing Start and immediately quitting leaves nothing worth resuming.
    await saveRecording('run', newRecording(Date.now()));
    expect(await loadRecording()).toBeNull();
  });

  it('clears what was saved', async () => {
    await saveRecording('run', withPoints(4));
    await clearRecording();
    expect(await loadRecording()).toBeNull();
  });

  it('survives being cleared when nothing is there', async () => {
    await expect(clearRecording()).resolves.toBeUndefined();
    await expect(clearRecording()).resolves.toBeUndefined();
  });
});
