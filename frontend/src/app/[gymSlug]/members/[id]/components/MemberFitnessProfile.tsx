"use client";

import React from "react";
import { Dumbbell, CheckCircle2, Clock } from "lucide-react";
import type { Member, MemberFitnessProfile as FitnessProfile } from "@/types";

/** snake_case / kebab enum value → "Title Case" label. */
function humanize(value?: string | null): string {
  if (!value) return "--";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function Chips({ values }: { values?: string[] }) {
  if (!values || values.length === 0) return <span>--</span>;
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="rounded-full bg-canvas-soft px-2.5 py-0.5 text-xs font-medium text-foreground"
        >
          {humanize(v)}
        </span>
      ))}
    </div>
  );
}

/** True when the profile holds no member-app fitness data worth showing. */
function isEmpty(p: FitnessProfile): boolean {
  return (
    p.height == null &&
    p.weight == null &&
    p.body_fat_percentage == null &&
    !p.fitness_goal &&
    !(p.goals && p.goals.length) &&
    !p.activity_level &&
    !p.training_experience &&
    !(p.workout_preferences && p.workout_preferences.length) &&
    !(p.medical_conditions && p.medical_conditions.length) &&
    !(p.allergies && p.allergies.length) &&
    !p.blood_group
  );
}

/**
 * Fitness Profile card — surfaces the data the member collects during member-app
 * onboarding (goals, activity level, experience, body metrics, preferences,
 * limitations). Read-only; the member owns this data in the app.
 */
export function MemberFitnessProfile({ member }: { member: Member }) {
  const p = member.profile;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Fitness Profile</h3>
        </div>
        {p?.onboarding_completed_at ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Onboarded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {p?.onboarding_step ? "Onboarding in progress" : "Not onboarded"}
          </span>
        )}
      </div>

      {!p || isEmpty(p) ? (
        <p className="text-sm text-muted-foreground">
          No fitness profile yet — the member hasn&apos;t completed app onboarding.
        </p>
      ) : (
        <div className="space-y-0">
          <InfoRow label="Primary Goal" value={humanize(p.fitness_goal)} />
          {p.goals && p.goals.length > 0 && (
            <InfoRow label="Goals" value={<Chips values={p.goals} />} />
          )}
          <InfoRow label="Activity Level" value={humanize(p.activity_level)} />
          <InfoRow label="Experience" value={humanize(p.training_experience)} />
          <InfoRow
            label="Height"
            value={p.height != null ? `${p.height} ${p.height_unit ?? "cm"}` : "--"}
          />
          <InfoRow
            label="Weight"
            value={p.weight != null ? `${p.weight} ${p.weight_unit ?? "kg"}` : "--"}
          />
          {p.body_fat_percentage != null && (
            <InfoRow label="Body Fat" value={`${p.body_fat_percentage}%`} />
          )}
          {p.blood_group && <InfoRow label="Blood Group" value={p.blood_group} />}
          <InfoRow
            label="Workout Preferences"
            value={<Chips values={p.workout_preferences} />}
          />
          {p.medical_conditions && p.medical_conditions.length > 0 && (
            <InfoRow label="Limitations" value={<Chips values={p.medical_conditions} />} />
          )}
          {p.allergies && p.allergies.length > 0 && (
            <InfoRow label="Allergies" value={<Chips values={p.allergies} />} />
          )}
        </div>
      )}
    </div>
  );
}
