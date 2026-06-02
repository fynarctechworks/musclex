/**
 * Member API contract types — the app-side mirror of the BFF contract
 * (docs/"Member api v1.openapi.yaml"). Hand-curated for the Phase-1 surface so
 * screens code against typed shapes. Run `npm run gen:api` to regenerate the
 * FULL generated contract into src/api/contract.ts; this file stays the curated,
 * ergonomic view the app actually imports.
 *
 * Keep these in lockstep with backend/src/member/contract/member-api.types.ts.
 */

export interface Meta {
  tenantId?: string;
  serverTime?: string;
  /** Seconds the client may cache. */
  cacheTtl?: number;
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}

export interface ApiError {
  code: string;
  message: string;
  retryable?: boolean;
}

// ── Auth ──────────────────────────────────────────────────────────
export interface OtpRequestResult {
  dispatched?: boolean;
  channel?: 'sms' | 'whatsapp';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TenantChoice {
  tenantId?: string;
  gymName?: string;
}

export interface SessionResult {
  tokens?: TokenPair | null;
  tenantChoices?: TenantChoice[];
}

// ── Profile ───────────────────────────────────────────────────────
export type Goal = 'lose_fat' | 'build_muscle' | 'general_fitness';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface MemberProfile {
  id?: string;
  name?: string;
  phone?: string;
  gymName?: string;
  goal?: Goal;
  experienceLevel?: ExperienceLevel;
  avatarUrl?: string | null;
}

// ── Home / occupancy ──────────────────────────────────────────────
export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'frozen';
export type OccupancyLevel = 'low' | 'moderate' | 'high' | 'full';

export interface Occupancy {
  current?: number;
  capacity?: number;
  level?: OccupancyLevel;
  updatedAt?: string;
}

export interface WorkoutSummary {
  id?: string;
  title?: string;
  assignedBy?: string | null;
  exerciseCount?: number;
}

export interface ClassSummary {
  id?: string;
  title?: string;
  startsAt?: string;
  seatsLeft?: number;
}

// ── Classes (browse / book / cancel) ──────────────────────────────
export type ClassBookingStatus = 'enrolled' | 'waitlisted';

export interface ClassListItem {
  id?: string;
  title?: string;
  category?: string;
  startsAt?: string;
  durationMinutes?: number;
  room?: string | null;
  trainerName?: string | null;
  capacity?: number;
  seatsLeft?: number;
  /** true when THIS member has an active booking on the class. */
  booked?: boolean;
  bookingStatus?: ClassBookingStatus | null;
  waitlistPosition?: number | null;
}

export interface ClassList {
  classes?: ClassListItem[];
}

export interface ClassBookingResult {
  classId?: string;
  status?: ClassBookingStatus;
  waitlistPosition?: number | null;
  seatsLeft?: number;
  message?: string;
}

export interface ClassCancelResult {
  cancelled?: boolean;
  promotedMemberName?: string | null;
}

export interface HomeDashboard {
  greeting?: string;
  membership?: {
    status?: MembershipStatus;
    expiresOn?: string;
    daysLeft?: number;
  };
  streak?: { days?: number };
  todayWorkout?: WorkoutSummary | null;
  nextClass?: ClassSummary | null;
  occupancy?: Occupancy;
}

// ── Gym locations (branch finder) ─────────────────────────────────
export type LocationStatus =
  | 'active'
  | 'inactive'
  | 'temporarily_closed'
  | 'coming_soon'
  | 'provisioning';

export interface GymLocation {
  id?: string;
  name?: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  status?: LocationStatus;
}

export interface GymLocations {
  branches?: GymLocation[];
}

// ── Check-in ──────────────────────────────────────────────────────
export interface CheckInRequest {
  method: 'qr' | 'manual';
  token?: string;
  occurredAt?: string;
}

export interface CheckInResult {
  checkInId?: string;
  recordedAt?: string;
  alreadyRecorded?: boolean;
  streakDays?: number;
}

// ── Membership ────────────────────────────────────────────────────
export interface Invoice {
  id?: string;
  amount?: number;
  currency?: string;
  paidOn?: string | null;
  status?: 'paid' | 'pending' | 'failed';
}

export interface Membership {
  status?: MembershipStatus;
  plan?: { id?: string; name?: string; price?: number; currency?: string };
  startedOn?: string;
  expiresOn?: string;
  autoRenew?: boolean;
  invoices?: Invoice[];
}

export interface RazorpayOrder {
  orderId?: string;
  amount?: number;
  currency?: string;
  razorpayKeyId?: string;
  receipt?: string;
}

// ── Workouts ──────────────────────────────────────────────────────
export interface SetLog {
  exerciseId?: string;
  setNumber?: number;
  reps?: number;
  weight?: number;
  unit: 'kg' | 'lb';
}

export interface Exercise {
  id?: string;
  name?: string;
  targetSets?: number;
  targetReps?: number;
  mediaUrl?: string | null;
  lastLog?: SetLog;
}

export interface Workout {
  id?: string;
  title?: string;
  assignedBy?: string | null;
  exercises?: Exercise[];
}

export interface WorkoutLogResult {
  logId?: string;
  newPersonalRecords?: { exerciseId?: string; weight?: number }[];
}

// ── Progress ──────────────────────────────────────────────────────
export interface BodyMetric {
  id?: string;
  weightKg?: number | null;
  bmi?: number | null;
  waistCm?: number | null;
  recordedAt?: string;
}

export interface BodyMetricInput {
  weightKg?: number;
  waistCm?: number;
  recordedAt?: string;
}

export interface ProgressPhoto {
  id?: string;
  url?: string;
  takenAt?: string;
}

export interface Progress {
  latest?: { weightKg?: number | null; bmi?: number | null; bodyFatPct?: number | null };
  series?: BodyMetric[];
  photos?: ProgressPhoto[];
}

export interface UploadTarget {
  photoId?: string;
  uploadUrl?: string;
  expiresIn?: number;
}
