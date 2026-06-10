"use client";

import React, { useState } from "react";
import {
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import {
  Building2,
  Check,
  ChevronDown,
  Clock,
  Compass,
  Dumbbell,
  Globe2,
  HelpCircle,
  MapPin,
  Network,
  X,
} from "lucide-react";
import { FormInput } from "@/components/shared/form-fields";
import type { Branch } from "@/types";

/**
 * Branded access-type catalog. Each entry is a selectable card so gym owners
 * see the options visually with plain-English explanations and examples —
 * the way Cult.fit / Gold's Gym present membership tiers.
 */
const ACCESS_TYPES: {
  value: string;
  label: string;
  tagline: string;
  example: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "single_branch",
    label: "Local",
    tagline: "One gym only",
    example: "Member can check in at a single home branch.",
    icon: Compass,
  },
  {
    value: "multi_branch",
    label: "Multi",
    tagline: "Selected gyms",
    example: "Pick exactly which branches this plan unlocks (e.g. Madhapur + Gachibowli).",
    icon: Building2,
  },
  {
    value: "all_access",
    label: "Elite (All-Access)",
    tagline: "Every gym in your network",
    example: "Cult ELITE-style — check in at any current or future branch.",
    icon: Network,
  },
  {
    value: "city_access",
    label: "City Pass",
    tagline: "All gyms in one city",
    example: "Every branch in a chosen city is unlocked automatically.",
    icon: MapPin,
  },
  {
    value: "time_based",
    label: "Off-Peak",
    tagline: "Certain hours only",
    example: "Cheaper plan valid only within set hours (e.g. 10am–5pm).",
    icon: Clock,
  },
  {
    value: "class_only",
    label: "Class Pass",
    tagline: "Group classes only",
    example: "Access only when a class is booked — no open-gym entry.",
    icon: Dumbbell,
  },
];

const TIER_SUGGESTIONS = ["Basic", "Pro", "Elite", "VIP", "Student", "Corporate"];

interface Props {
  register: UseFormRegister<any>;
  watch: UseFormWatch<any>;
  setValue: UseFormSetValue<any>;
  branches: Branch[] | undefined;
  basePrice?: number;
}

export function AccessScopeSection({
  watch,
  setValue,
  register,
  branches,
  basePrice,
}: Props) {
  const [showHelp, setShowHelp] = useState(false);

  const accessType = watch("access_type") ?? "single_branch";
  const tier: string = watch("tier") ?? "";
  const homeBranchId: string = watch("branch_id") ?? "none";
  const allowedBranchIds: string[] = watch("allowed_branch_ids") ?? [];
  const branchOverrides: Record<string, number | string> =
    watch("branch_price_overrides") ?? {};

  const toggleBranch = (id: string) => {
    const set = new Set(allowedBranchIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setValue("allowed_branch_ids", Array.from(set), { shouldDirty: true });
  };

  const updateOverride = (branchId: string, raw: string) => {
    const next = { ...branchOverrides };
    if (raw === "") delete next[branchId];
    else next[branchId] = raw;
    setValue("branch_price_overrides", next, { shouldDirty: true });
  };

  const selectedMeta = ACCESS_TYPES.find((a) => a.value === accessType);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-background p-4">
      {/* Header + Help toggle */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Branch Access
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which gyms a member on this plan can check in to.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          How it works
          <ChevronDown
            className={`h-3 w-3 transition-transform ${showHelp ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
          <p className="text-xs text-foreground font-medium">
            Pick the access type that matches what you sell:
          </p>
          <ul className="space-y-1.5">
            {ACCESS_TYPES.map((a) => (
              <li key={a.value} className="flex items-start gap-2 text-xs">
                <a.icon className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">{a.label}</span>{" "}
                  — {a.example}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground pt-1 border-t border-primary/10">
            You can change a plan&apos;s access type anytime. Existing members
            keep working — nothing breaks.
          </p>
        </div>
      )}

      {/* Access-type cards */}
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          Access Type
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACCESS_TYPES.map((a) => {
            const selected = a.value === accessType;
            const Icon = a.icon;
            return (
              <button
                key={a.value}
                type="button"
                onClick={() =>
                  setValue("access_type", a.value, { shouldDirty: true })
                }
                className={`relative text-left rounded-lg border p-3 transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                {selected && (
                  <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
                <Icon
                  className={`h-4 w-4 mb-1.5 ${
                    selected ? "text-primary" : "text-muted-foreground"
                  }`}
                />
                <p className="text-xs font-semibold text-foreground leading-tight">
                  {a.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {a.tagline}
                </p>
              </button>
            );
          })}
        </div>
        {selectedMeta && (
          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
            <selectedMeta.icon className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
            {selectedMeta.example}
          </p>
        )}
      </div>

      {/* Tier — free text with suggestions */}
      <div>
        <label className="text-sm font-medium text-foreground mb-1 block">
          Tier Label{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          {...register("tier")}
          maxLength={40}
          placeholder="e.g. Elite, Student, Founders Club…"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {TIER_SUGGESTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setValue("tier", t, { shouldDirty: true })}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                tier.toLowerCase() === t.toLowerCase()
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          A label members see, e.g. &quot;Elite&quot;. Use any name that fits
          your brand — fully editable later.
        </p>
      </div>

      {/* ── Conditional fields per access type ─────────────────────────── */}

      {/* Single Branch → home branch picker (replaces old Branch Scope) */}
      {accessType === "single_branch" && (
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            Home Branch
          </label>
          <select
            value={homeBranchId}
            onChange={(e) =>
              setValue("branch_id", e.target.value, { shouldDirty: true })
            }
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="none">All branches (any single location)</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.city ? ` — ${b.city}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            The branch this plan is sold at. Choose &quot;All branches&quot; to
            offer the same single-gym plan everywhere.
          </p>
        </div>
      )}

      {/* Multi-branch picker */}
      {accessType === "multi_branch" && (
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">
            Included Branches *
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Members on this plan can check in at any branch you select.
          </p>
          <div className="flex flex-wrap gap-2">
            {(branches ?? []).map((b) => {
              const on = allowedBranchIds.includes(b.id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBranch(b.id)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                  {b.name}
                </button>
              );
            })}
            {(!branches || branches.length === 0) && (
              <p className="text-xs text-muted-foreground">
                No branches yet — create branches first.
              </p>
            )}
          </div>
          {allowedBranchIds.length === 0 && (
            <p className="text-[11px] text-warning mt-1.5">
              Select at least one branch to save this plan.
            </p>
          )}
        </div>
      )}

      {/* City pass */}
      {accessType === "city_access" && (
        <FormInput
          label="City *"
          placeholder="e.g. Hyderabad"
          {...register("allowed_city")}
        />
      )}

      {/* Off-peak hours */}
      {accessType === "time_based" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormInput label="Start Time *" type="time" {...register("allowed_hours_start")} />
          <FormInput label="End Time *" type="time" {...register("allowed_hours_end")} />
          <p className="sm:col-span-2 text-[11px] text-muted-foreground">
            Members can only check in within this window (branch local time).
            Overnight windows (e.g. 22:00 → 04:00) are supported.
          </p>
        </div>
      )}

      {/* All-access info */}
      {accessType === "all_access" && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
          <Globe2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">All-access</span> —
            members check in at every branch in your organization, including
            ones you add later. No branch selection needed.
          </span>
        </div>
      )}

      {/* Class-only info */}
      {accessType === "class_only" && (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs flex items-start gap-2">
          <Dumbbell className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Class-only</span> —
            entry is allowed only when the member has a booked class.
            Open-gym check-ins are declined.
          </span>
        </div>
      )}

      {/* ── Per-branch pricing (any multi-location type) ───────────────── */}
      {(accessType === "multi_branch" ||
        accessType === "all_access" ||
        accessType === "city_access") &&
        branches &&
        branches.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-border">
            <div>
              <label className="text-sm font-medium text-foreground">
                Premium Branch Pricing{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Charge more at premium locations. Blank = base price
                {basePrice ? (
                  <span className="font-mono"> ₹{basePrice}</span>
                ) : null}
                .
              </p>
            </div>
            <div className="grid gap-2">
              {branches.map((b) => {
                const raw = branchOverrides[b.id];
                return (
                  <div key={b.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate text-muted-foreground">
                      {b.name}
                      {b.city ? (
                        <span className="text-muted-foreground/60">
                          {" "}
                          · {b.city}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder={basePrice ? String(basePrice) : "0.00"}
                        value={raw ?? ""}
                        onChange={(e) => updateOverride(b.id, e.target.value)}
                        className="w-28 rounded-md border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                      {raw !== undefined && raw !== "" && (
                        <button
                          type="button"
                          onClick={() => updateOverride(b.id, "")}
                          className="text-muted-foreground hover:text-destructive"
                          title="Clear override"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}
