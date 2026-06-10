import { PersonalizationService, ageFromDob } from './personalization.service';

describe('PersonalizationService', () => {
  const svc = new PersonalizationService();

  it('computes calorie/protein/water targets from a full profile', () => {
    // Male, 30y, 180cm, 80kg, moderately active, gain muscle.
    // BMR (Mifflin) = 10*80 + 6.25*180 - 5*30 + 5 = 1780; TDEE = ×1.55 = 2759;
    // gain_muscle ×1.10 ≈ 3035 → rounded to nearest 10.
    const rec = svc.compute({
      gender: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'moderately_active',
      primaryGoal: 'gain_muscle',
      trainingExperience: 'intermediate',
    });
    expect(rec).toBeTruthy();
    expect(rec!.dailyCalories).toBe(3030);
    expect(rec!.proteinG).toBe(160); // 2.0 g/kg × 80
    expect(rec!.waterMl).toBe(2800); // 35 ml/kg × 80
    // carbs/fat fill remaining kcal
    expect(rec!.fatG).toBeGreaterThan(0);
    expect(rec!.carbsG).toBeGreaterThan(0);
    // intermediate → PPL split
    expect(rec!.splitKey).toBe('push_pull_legs');
    expect(rec!.weeklyWorkouts).toBe(4);
  });

  it('cuts calories for weight loss and bumps water for athletes', () => {
    const rec = svc.compute({
      gender: 'female',
      age: 25,
      heightCm: 165,
      weightKg: 60,
      activityLevel: 'athlete',
      primaryGoal: 'lose_weight',
      trainingExperience: 'advanced',
    });
    expect(rec!.proteinG).toBe(108); // 1.8 g/kg × 60
    // base water 60*35=2100; athlete ×1.15 ≈ 2415 → rounded to 50 = 2400
    expect(rec!.waterMl).toBe(2400);
    expect(rec!.splitKey).toBe('advanced_split');
  });

  it('returns a split-only recommendation when biometrics are missing', () => {
    const rec = svc.compute({ trainingExperience: 'beginner' });
    expect(rec).toEqual({ weeklyWorkouts: 3, splitKey: 'full_body', split: 'Full Body · 3×/week' });
    expect(rec!.dailyCalories).toBeUndefined();
  });

  it('returns null when nothing is computable', () => {
    expect(svc.compute({})).toBeNull();
  });

  it('ageFromDob computes whole years and rejects junk', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 28);
    expect(ageFromDob(d)).toBe(28);
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob('not-a-date')).toBeNull();
  });
});
