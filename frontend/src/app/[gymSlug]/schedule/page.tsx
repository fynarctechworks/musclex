"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { FormInput, FormSelect, FormTextarea, FieldWrapper } from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useEntitlement, LockedFeatureCard } from "@/features/entitlements";
import { apiClient } from "@/lib/api";
import { ClassItem, Staff, Branch } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Users,
  MapPin,
  X,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isToday,
  isSameDay,
  set,
} from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useAuthStore } from "@/stores/auth-store";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";

// Slot granularity: how finely the grid is divided and how clicks snap. Gyms
// run classes on the hour, half-hour, or quarter-hour, so let the user choose.
// Per-hour pixel height scales with granularity so finer slots stay clickable.
const SLOT_OPTIONS = [
  { label: "60 min", value: 60 },
  { label: "30 min", value: 30 },
  { label: "15 min", value: 15 },
] as const;
type SlotMinutes = (typeof SLOT_OPTIONS)[number]["value"];
const HOUR_HEIGHT_BY_SLOT: Record<SlotMinutes, number> = {
  60: 60,
  30: 80,
  15: 120,
};

// ── Per-gym schedule view preferences ──────────────────────────────
// Operating hours and slot size differ per gym, so they're configurable and
// persisted. These are VIEW preferences (how the calendar renders), not gym
// data, so they live in localStorage — no schema/RLS change. Keyed by gym +
// active branch so a multi-branch operator can tune each branch's day window.
interface SchedulePrefs {
  openHour: number; // first hour shown (0–23)
  closeHour: number; // end boundary, exclusive (1–24); last row is closeHour-1
  slotMinutes: SlotMinutes;
}
const DEFAULT_PREFS: SchedulePrefs = { openHour: 5, closeHour: 23, slotMinutes: 60 };
const PREFS_VERSION = 1;

function prefsStorageKey(gymSlug: string, branchId: string | null): string {
  return `musclex:schedulePrefs:v${PREFS_VERSION}:${gymSlug}:${branchId ?? "all"}`;
}

function isSlotMinutes(v: unknown): v is SlotMinutes {
  return v === 60 || v === 30 || v === 15;
}

/** Read + sanitise saved prefs; always returns a valid, ordered window. */
function loadPrefs(key: string): SchedulePrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<SchedulePrefs>;
    const openHour = clampHour(p.openHour, DEFAULT_PREFS.openHour, 0, 23);
    const closeHour = clampHour(p.closeHour, DEFAULT_PREFS.closeHour, 1, 24);
    return {
      openHour: Math.min(openHour, closeHour - 1),
      closeHour: Math.max(closeHour, openHour + 1),
      slotMinutes: isSlotMinutes(p.slotMinutes) ? p.slotMinutes : DEFAULT_PREFS.slotMinutes,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function clampHour(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Pretty label for an hour boundary: 0 → "12 AM", 13 → "1 PM", 24 → "12 AM". */
function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12} ${h < 12 ? "AM" : "PM"}`;
}

const categories = [
  { label: "Cardio", value: "cardio" },
  { label: "Strength", value: "strength" },
  { label: "Flexibility", value: "flexibility" },
  { label: "Mind & Body", value: "mind_body" },
  { label: "Dance", value: "dance" },
  { label: "Martial Arts", value: "martial_arts" },
  { label: "Rehabilitation", value: "rehabilitation" },
  { label: "Other", value: "other" },
];

// Class category chips — Design.md `badge-secondary` soft semantic pills.
// Categories map onto the brand's four semantic tones (success / warning /
// error / link / neutral) rather than a freeform 8-color rainbow.
const categoryColors: Record<string, string> = {
  cardio:         "bg-error-soft text-error-deep",
  strength:       "bg-link-soft text-link-deep",
  flexibility:    "bg-success/12 text-success",
  mind_body:      "bg-canvas-soft-2 text-foreground",
  dance:          "bg-canvas-soft-2 text-foreground",
  martial_arts:   "bg-warning-soft text-warning-deep",
  rehabilitation: "bg-link-soft text-link-deep",
  other:          "bg-canvas-soft-2 text-muted-foreground",
  // Legacy categories
  yoga:           "bg-canvas-soft-2 text-foreground",
  hiit:           "bg-error-soft text-error-deep",
  pilates:        "bg-success/12 text-success",
  crossfit:       "bg-warning-soft text-warning-deep",
  zumba:          "bg-canvas-soft-2 text-foreground",
  spinning:       "bg-warning-soft text-warning-deep",
  boxing:         "bg-warning-soft text-warning-deep",
};

interface CreateClassForm {
  name: string;
  category: string;
  branch_id: string;
  trainer_id: string;
  room: string;
  capacity: number;
  duration_minutes: number;
  starts_at: string;
  description: string;
}

export default function SchedulePage() {
  const { allowed, checked } = useRequirePermission("classes", "view", "deny");
  const { locked: planLocked } = useEntitlement("class_scheduling");
  const { gymPath, gymSlug } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [showModal, setShowModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string>("");
  const [showHours, setShowHours] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // View preferences (operating hours + slot size), persisted per gym+branch.
  // Start from defaults for SSR-safe first render, then hydrate from storage in
  // an effect (localStorage is browser-only) to avoid a hydration mismatch.
  const prefsKey = prefsStorageKey(gymSlug, activeBranchId);
  const [prefs, setPrefs] = useState<SchedulePrefs>(DEFAULT_PREFS);
  useEffect(() => {
    setPrefs(loadPrefs(prefsKey));
  }, [prefsKey]);

  const savePrefs = (next: SchedulePrefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(prefsKey, JSON.stringify(next));
    } catch {
      /* storage unavailable (private mode) — keep in-memory for this session */
    }
  };

  const { openHour, closeHour, slotMinutes } = prefs;
  const hours = useMemo(
    () =>
      Array.from({ length: Math.max(1, closeHour - openHour) }, (_, i) => openHour + i),
    [openHour, closeHour],
  );

  // Derived grid metrics from the chosen granularity.
  const HOUR_HEIGHT = HOUR_HEIGHT_BY_SLOT[slotMinutes];
  const subSlots = 60 / slotMinutes; // 1 / 2 / 4 click rows per hour

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Scroll to current time on mount + whenever the window/height changes.
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollTo = Math.max(0, (currentHour - openHour - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, [HOUR_HEIGHT, openHour]);

  const { data: classesResponse } = useQuery<{
    data: ClassItem[];
    total: number;
  }>({
    queryKey: ["classes", format(weekStart, "yyyy-MM-dd"), activeBranchId],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("date_from", format(weekStart, "yyyy-MM-dd"));
      params.set("date_to", format(addDays(weekStart, 6), "yyyy-MM-dd"));
      if (activeBranchId) params.set("branch_id", activeBranchId);
      params.set("limit", "200");
      return apiClient.get(`/classes?${params}`);
    },
  });

  const classes = classesResponse?.data;

  // Group classes by day
  const classesByDay = useMemo(() => {
    if (!classes) return {};
    const map: Record<string, ClassItem[]> = {};
    for (const cls of classes) {
      // Bucket by LOCAL date (not the raw UTC slice) so events land in the same
      // day column the grid headers use — both are local time. Slicing the ISO
      // string instead would shift events by a day for non-UTC timezones.
      const dateStr = format(parseISO(cls.starts_at), "yyyy-MM-dd");
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(cls);
    }
    return map;
  }, [classes]);

  const goToToday = () => setCurrentWeek(new Date());

  const openAddModal = (day?: Date, hour?: number, minute = 0) => {
    if (day && hour !== undefined) {
      const dt = set(day, { hours: hour, minutes: minute });
      // Format as datetime-local value: YYYY-MM-DDTHH:mm
      setPrefillDate(format(dt, "yyyy-MM-dd'T'HH:mm"));
    } else {
      setPrefillDate("");
    }
    setShowModal(true);
  };

  const handleClassCreated = () => {
    setShowModal(false);
    queryClient.invalidateQueries({ queryKey: ["classes"] });
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  // Plan-tier lock (show-everything-but-locked): render the page shell + an upsell card
  // instead of the live schedule. Backend stays authoritative — class endpoints 403 regardless.
  if (planLocked) {
    return (
      <AppLayout>
        <div className="flex items-center gap-3 mb-4">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Class Schedule</h1>
        </div>
        <LockedFeatureCard feature="class_scheduling" source="schedule_page" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">Class Schedule</h1>
        </div>
        <button
          onClick={() => openAddModal()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {/* Navigation Bar */}
      <div className="flex items-center justify-between mb-4 bg-card border border-border rounded-lg px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 rounded-md text-sm font-medium border border-border hover:bg-muted text-foreground transition-colors"
          >
            Today
          </button>
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {format(weekStart, "MMMM yyyy")}
        </h2>
        <div className="flex items-center gap-3">
          {/* Slot granularity — controls how finely the grid divides and how
             click-to-create snaps (60 / 30 / 15 min). Persisted per gym. */}
          <div
            className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
            role="group"
            aria-label="Time slot size"
          >
            {SLOT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => savePrefs({ ...prefs, slotMinutes: opt.value })}
                aria-pressed={slotMinutes === opt.value}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  slotMinutes === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Operating-hours editor — gyms set their own open/close window. */}
          <button
            onClick={() => setShowHours(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
            title="Set operating hours"
          >
            <Clock className="w-3.5 h-3.5" />
            {hourLabel(openHour)} – {hourLabel(closeHour)}
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Scrollable area. The day headers live INSIDE this scroll container as
           a sticky row so they share the exact column widths as the time grid —
           otherwise the vertical scrollbar narrows the body and the dates drift
           out of alignment with their columns. */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          {/* Day Headers (sticky) */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border sticky top-0 z-30 bg-card">
            {/* Timezone gutter */}
            <div className="border-r border-border" />
            {days.map((day) => {
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`text-center py-3 border-r border-border last:border-r-0 ${
                    today ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                    {format(day, "EEE")}
                  </div>
                  <div
                    className={`text-lg font-semibold mt-0.5 ${
                      today
                        ? "w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto"
                        : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Time Labels + Grid Lines */}
            <div className="relative">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="relative border-b border-border/50"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground font-mono">
                    {hourLabel(hour)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayClasses = classesByDay[dateStr] || [];
              const today = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`relative border-r border-border/50 last:border-r-0 ${
                    today ? "bg-primary/[0.02]" : ""
                  }`}
                >
                  {/* Sub-slot grid lines + click targets (snap to granularity) */}
                  {hours.map((hour) => (
                    <div key={hour} className="border-b border-border/30">
                      {Array.from({ length: subSlots }).map((_, i) => (
                        <div
                          key={i}
                          className={`hover:bg-canvas-soft cursor-pointer transition-colors ${
                            i > 0 ? "border-t border-dashed border-border/20" : ""
                          }`}
                          style={{ height: HOUR_HEIGHT / subSlots }}
                          onClick={() => openAddModal(day, hour, i * slotMinutes)}
                          title={`Add class at ${formatSlotLabel(hour, i * slotMinutes)}`}
                        />
                      ))}
                    </div>
                  ))}

                  {/* Current Time Indicator */}
                  {today && (
                    <CurrentTimeIndicator
                      hourHeight={HOUR_HEIGHT}
                      openHour={openHour}
                      closeHour={closeHour}
                    />
                  )}

                  {/* Class Events */}
                  {dayClasses.map((cls) => (
                    <ClassEvent
                      key={cls.id}
                      cls={cls}
                      gymPath={gymPath}
                      hourHeight={HOUR_HEIGHT}
                      openHour={openHour}
                      closeHour={closeHour}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Class Modal */}
      {showModal && (
        <AddClassModal
          onClose={() => setShowModal(false)}
          onSuccess={handleClassCreated}
          prefillDate={prefillDate}
          activeBranchId={activeBranchId}
        />
      )}

      {/* Operating-hours & slot settings */}
      {showHours && (
        <HoursSettingsModal
          prefs={prefs}
          scopeLabel={activeBranchId ? "this branch" : "your gym"}
          onClose={() => setShowHours(false)}
          onSave={(next) => {
            savePrefs(next);
            setShowHours(false);
          }}
          onReset={() => {
            savePrefs(DEFAULT_PREFS);
            setShowHours(false);
          }}
        />
      )}
    </AppLayout>
  );
}

// Human-readable label for a slot's start time (used as a click hint tooltip).
function formatSlotLabel(hour: number, minute: number): string {
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const mm = minute.toString().padStart(2, "0");
  return `${h12}:${mm} ${hour < 12 ? "AM" : "PM"}`;
}

// ── Current Time Red Line ──────────────────────────────────────
function CurrentTimeIndicator({
  hourHeight,
  openHour,
  closeHour,
}: {
  hourHeight: number;
  openHour: number;
  closeHour: number;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < openHour || hours >= closeHour) return null;

  const top = (hours - openHour) * hourHeight + (minutes / 60) * hourHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-error -ml-1" />
        <div className="flex-1 h-[2px] bg-error" />
      </div>
    </div>
  );
}

// ── Class Event Block ──────────────────────────────────────────
function ClassEvent({
  cls,
  gymPath,
  hourHeight,
  openHour,
  closeHour,
}: {
  cls: ClassItem;
  gymPath: (path: string) => string;
  hourHeight: number;
  openHour: number;
  closeHour: number;
}) {
  const startDate = parseISO(cls.starts_at);
  const startHour = startDate.getHours();
  const startMin = startDate.getMinutes();

  // Hide classes scheduled outside the gym's configured day window.
  if (startHour < openHour || startHour >= closeHour) return null;

  const top =
    (startHour - openHour) * hourHeight + (startMin / 60) * hourHeight;
  const height = Math.max(
    24,
    (cls.duration_minutes / 60) * hourHeight
  );

  const colorClass =
    categoryColors[cls.category] ||
    "bg-canvas-soft-2 border-primary/40 text-primary";

  return (
    <Link
      href={gymPath(`/classes/${cls.id}`)}
      className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 overflow-hidden z-10 hover:brightness-125 transition-all cursor-pointer ${colorClass}`}
      style={{ top, height: Math.min(height, (closeHour - startHour) * hourHeight - (startMin / 60) * hourHeight) }}
    >
      <p className="text-xs font-semibold truncate leading-tight">
        {cls.name}
      </p>
      {height > 30 && (
        <p className="text-[10px] opacity-80 leading-tight">
          {format(startDate, "h:mm a")} · {cls.duration_minutes}m
        </p>
      )}
      {height > 48 && (
        <div className="flex items-center gap-1 mt-0.5">
          <Users className="w-2.5 h-2.5 opacity-70" />
          <span className="text-[10px] opacity-70">
            {cls.enrollments?.length ?? 0}/{cls.capacity}
          </span>
        </div>
      )}
      {height > 60 && cls.room && (
        <div className="flex items-center gap-1">
          <MapPin className="w-2.5 h-2.5 opacity-70" />
          <span className="text-[10px] opacity-70 truncate">{cls.room}</span>
        </div>
      )}
    </Link>
  );
}

// ── Operating Hours & Slot Settings Modal ──────────────────────
function HoursSettingsModal({
  prefs,
  scopeLabel,
  onClose,
  onSave,
  onReset,
}: {
  prefs: SchedulePrefs;
  scopeLabel: string;
  onClose: () => void;
  onSave: (next: SchedulePrefs) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<SchedulePrefs>(prefs);

  // Open can be 12 AM–11 PM; Close can be 1 AM–12 AM (midnight = 24).
  const openOptions = Array.from({ length: 24 }, (_, h) => ({
    label: hourLabel(h),
    value: String(h),
  }));
  const closeOptions = Array.from({ length: 24 }, (_, i) => {
    const h = i + 1; // 1..24
    return { label: h === 24 ? "12 AM (midnight)" : hourLabel(h), value: String(h) };
  });

  const invalid = draft.closeHour <= draft.openHour;
  const totalHours = draft.closeHour - draft.openHour;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-lg shadow-level-5 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Operating hours</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-[13px] text-muted-foreground">
            Set when {scopeLabel} runs classes. The calendar only shows this
            window, and click-to-create snaps to your chosen slot size. Saved on
            this device.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Opens at"
              value={String(draft.openHour)}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, openHour: Number(v) }))
              }
              options={openOptions}
            />
            <FormSelect
              label="Closes at"
              value={String(draft.closeHour)}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, closeHour: Number(v) }))
              }
              options={closeOptions}
              error={invalid ? "Close must be after open" : undefined}
            />
          </div>

          <FieldWrapper label="Default slot size">
            <div
              className="flex items-center gap-1 rounded-md border border-border p-1"
              role="group"
              aria-label="Default slot size"
            >
              {SLOT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, slotMinutes: opt.value }))
                  }
                  aria-pressed={draft.slotMinutes === opt.value}
                  className={`flex-1 px-2 py-1.5 rounded text-[13px] font-medium transition-colors ${
                    draft.slotMinutes === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FieldWrapper>

          {!invalid && (
            <p className="text-[11px] text-muted-foreground">
              Showing {hourLabel(draft.openHour)} – {hourLabel(draft.closeHour)} ·{" "}
              {totalHours} {totalHours === 1 ? "hour" : "hours"} per day.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={invalid}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex-1"
            >
              Save hours
            </button>
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Class Modal ────────────────────────────────────────────
function AddClassModal({
  onClose,
  onSuccess,
  prefillDate,
  activeBranchId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  prefillDate: string;
  activeBranchId: string | null;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateClassForm>({
    defaultValues: {
      starts_at: prefillDate,
      branch_id: activeBranchId || "",
      duration_minutes: 60,
      capacity: 20,
    },
  });

  const { data: trainers } = useQuery<Staff[]>({
    queryKey: ["trainers"],
    queryFn: () =>
      apiClient
        .get<{ data: Staff[]; total: number }>("/staff", {
          params: { role: "trainer", limit: 100 },
        })
        .then((r) => r.data),
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () =>
      apiClient
        .get<{ data: Branch[] }>("/branches")
        .then((r) => r.data ?? r),
  });

  const mutation = useMutation({
    mutationFn: (data: CreateClassForm) => {
      const startsAt = data.starts_at
        ? new Date(data.starts_at).toISOString()
        : data.starts_at;

      return apiClient.post("/classes", {
        name: data.name,
        category: data.category,
        branch_id: data.branch_id,
        trainer_id: data.trainer_id,
        room: data.room || undefined,
        capacity: Number(data.capacity),
        duration_minutes: Number(data.duration_minutes),
        starts_at: startsAt,
        description: data.description || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Class created successfully");
      onSuccess();
    },
    onError: (err: Error) =>
      toast.error(err.message || "Failed to create class"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-level-5 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Add Class</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="p-6 space-y-4"
        >
          <FormInput
            label="Class Name"
            {...register("name", { required: "Class name is required" })}
            placeholder="e.g. Morning Yoga"
            error={errors.name?.message}
          />

          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="category"
              control={control}
              rules={{ required: "Category is required" }}
              render={({ field }) => (
                <FormSelect
                  label="Category"
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  options={categories}
                  error={errors.category?.message}
                />
              )}
            />
            <Controller
              name="branch_id"
              control={control}
              rules={{ required: "Branch is required" }}
              render={({ field }) => (
                <FormSelect
                  label="Branch"
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  options={
                    branches?.map((b) => ({ label: b.name, value: b.id })) ?? []
                  }
                  error={errors.branch_id?.message}
                />
              )}
            />
          </div>

          <Controller
            name="trainer_id"
            control={control}
            rules={{ required: "Trainer is required" }}
            render={({ field }) => (
              <FormSelect
                label="Trainer"
                value={field.value || ""}
                onValueChange={field.onChange}
                options={
                  trainers?.map((t) => ({
                    label: t.full_name,
                    value: t.id,
                  })) ?? []
                }
                error={errors.trainer_id?.message}
              />
            )}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormInput
              label="Room"
              {...register("room")}
              placeholder="Studio A"
            />
            <FormInput
              label="Capacity"
              type="number"
              {...register("capacity", {
                required: "Required",
                min: { value: 1, message: "Min 1" },
              })}
              error={errors.capacity?.message}
            />
            <FormInput
              label="Duration (min)"
              type="number"
              {...register("duration_minutes", {
                required: "Required",
                min: { value: 15, message: "Min 15" },
              })}
              error={errors.duration_minutes?.message}
            />
          </div>

          <FieldWrapper label="Starts At" error={errors.starts_at?.message}>
            <Input
              type="datetime-local"
              min={new Date().toISOString().slice(0, 16)}
              {...register("starts_at", {
                required: "Start time is required",
                validate: (v) =>
                  new Date(v).getTime() > Date.now() ||
                  "Cannot schedule a class in the past",
              })}
              className="h-9 bg-secondary border-border text-foreground text-[13px] focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </FieldWrapper>

          <FormTextarea
            label="Description"
            {...register("description")}
            placeholder="Class description (optional)"
            rows={2}
          />

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex-1"
            >
              {mutation.isPending ? "Creating..." : "Create Class"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
