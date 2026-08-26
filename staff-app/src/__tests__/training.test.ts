import {
  describeDifficulty, describeGoal, describeMuscleGroup, describePrescription,
} from '@/lib/training';

describe('describeGoal / describeDifficulty', () => {
  it('names known values properly', () => {
    expect(describeGoal('weight_loss')).toBe('Weight loss');
    expect(describeDifficulty('intermediate')).toBe('Intermediate');
  });

  it('degrades an unknown value to readable text', () => {
    expect(describeGoal('sport_specific')).toBe('sport specific');
  });

  it('returns null for absent, so callers can omit the chip entirely', () => {
    expect(describeGoal(null)).toBeNull();
    expect(describeDifficulty(undefined)).toBeNull();
  });
});

describe('describeMuscleGroup', () => {
  it('capitalises', () => {
    expect(describeMuscleGroup('chest')).toBe('Chest');
  });

  it('handles a compound group', () => {
    expect(describeMuscleGroup('full_body')).toBe('Full body');
  });

  it('falls back rather than showing nothing', () => {
    expect(describeMuscleGroup(null)).toBe('Other');
  });
});

describe('describePrescription', () => {
  it('reads as a coach would say it', () => {
    expect(describePrescription({
      target_sets: 3, target_reps: 10, target_weight: 40, rest_seconds: 60,
    })).toBe('3 × 10 · @ 40kg · 60s rest');
  });

  it('OMITS weight rather than printing zero', () => {
    // "3 × 10 @ 0kg" reads as an instruction to lift nothing.
    expect(describePrescription({ target_sets: 3, target_reps: 10, target_weight: 0 }))
      .toBe('3 × 10');
  });

  it('accepts a Decimal serialised as a string', () => {
    expect(describePrescription({ target_sets: 3, target_reps: 8, target_weight: '42.5' }))
      .toBe('3 × 8 · @ 42.5kg');
  });

  it('handles sets without reps', () => {
    expect(describePrescription({ target_sets: 4 })).toBe('4 sets');
  });

  it('singularises one set', () => {
    expect(describePrescription({ target_sets: 1 })).toBe('1 set');
  });

  it('handles reps without sets', () => {
    expect(describePrescription({ target_reps: 12 })).toBe('12 reps');
  });

  it('returns an empty string when nothing is prescribed', () => {
    // The caller can then skip the line rather than render a stray separator.
    expect(describePrescription({})).toBe('');
  });

  it('ignores junk weight instead of printing NaN', () => {
    expect(describePrescription({ target_sets: 3, target_weight: 'heavy' })).toBe('3 sets');
  });
});
