export interface BodyStat {
  id: string;
  member_id: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  bmi: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
  calves: number | null;
  recorded_at: string;
  created_at: string;
}

export interface ProgressChanges {
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
  bmi: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
  calves: number | null;
  period_days: number;
}

export interface ProgressSummary {
  latest: BodyStat | null;
  changes: ProgressChanges | null;
  total_records: number;
}

export interface ProgressPhoto {
  id: string;
  member_id: string;
  photo_url: string;
  caption: string | null;
  photo_type: 'before' | 'after' | 'progress';
  taken_at: string;
  created_at: string;
}

export interface CreateBodyStatPayload {
  weight?: number;
  body_fat?: number;
  muscle_mass?: number;
  bmi?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  calves?: number;
  recorded_at?: string;
}

export interface CreateProgressPhotoPayload {
  photo_url: string;
  caption?: string;
  photo_type?: 'before' | 'after' | 'progress';
  taken_at?: string;
}
