"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { FormInput, FormSelect, FormTextarea, FieldWrapper } from "@/components/shared/form-fields";
import { Input } from "@/components/ui/input";
import { useRequirePermission } from "@/hooks/use-require-permission";
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

// Time constants
const START_HOUR = 5; // 5 AM
const END_HOUR = 23; // 11 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const HOUR_HEIGHT = 60; // px per hour

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

const categoryColors: Record<string, string> = {
  cardio: "bg-red-500/20 border-red-500/40 text-red-300",
  strength: "bg-blue-500/20 border-blue-500/40 text-blue-300",
  flexibility: "bg-green-500/20 border-green-500/40 text-green-300",
  mind_body: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  dance: "bg-pink-500/20 border-pink-500/40 text-pink-300",
  martial_arts: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  rehabilitation: "bg-teal-500/20 border-teal-500/40 text-teal-300",
  other: "bg-gray-500/20 border-gray-500/40 text-gray-300",
  // Legacy categories
  yoga: "bg-purple-500/20 border-purple-500/40 text-purple-300",
  hiit: "bg-red-500/20 border-red-500/40 text-red-300",
  pilates: "bg-green-500/20 border-green-500/40 text-green-300",
  crossfit: "bg-orange-500/20 border-orange-500/40 text-orange-300",
  zumba: "bg-pink-500/20 border-pink-500/40 text-pink-300",
  spinning: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
  boxing: "bg-orange-500/20 border-orange-500/40 text-orange-300",
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
  const { gymPath } = useGymSlug();
  const { activeBranchId } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const [showModal, setShowModal] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const scrollTo = Math.max(0, (currentHour - START_HOUR - 1) * HOUR_HEIGHT);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

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
      const dateStr = cls.starts_at.slice(0, 10);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(cls);
    }
    return map;
  }, [classes]);

  const goToToday = () => setCurrentWeek(new Date());

  const openAddModal = (day?: Date, hour?: number) => {
    if (day && hour !== undefined) {
      const dt = set(day, { hours: hour, minutes: 0 });
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
        <div className="text-sm text-muted-foreground">
          {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
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

        {/* Scrollable Time Grid */}
        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Time Labels + Grid Lines */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="relative border-b border-border/50"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2.5 right-2 text-[10px] text-muted-foreground font-mono">
                    {hour === 0
                      ? "12 AM"
                      : hour < 12
                      ? `${hour} AM`
                      : hour === 12
                      ? "12 PM"
                      : `${hour - 12} PM`}
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
                  {/* Hour grid lines + click targets */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border/30 hover:bg-muted/30 cursor-pointer transition-colors"
                      style={{ height: HOUR_HEIGHT }}
                      onClick={() => openAddModal(day, hour)}
                    />
                  ))}

                  {/* Current Time Indicator */}
                  {today && <CurrentTimeIndicator />}

                  {/* Class Events */}
                  {dayClasses.map((cls) => (
                    <ClassEvent key={cls.id} cls={cls} gymPath={gymPath} />
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
    </AppLayout>
  );
}

// ── Current Time Red Line ──────────────────────────────────────
function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < START_HOUR || hours >= END_HOUR) return null;

  const top = (hours - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  );
}

// ── Class Event Block ──────────────────────────────────────────
function ClassEvent({
  cls,
  gymPath,
}: {
  cls: ClassItem;
  gymPath: (path: string) => string;
}) {
  const startDate = parseISO(cls.starts_at);
  const startHour = startDate.getHours();
  const startMin = startDate.getMinutes();

  if (startHour < START_HOUR || startHour >= END_HOUR) return null;

  const top =
    (startHour - START_HOUR) * HOUR_HEIGHT + (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max(
    24,
    (cls.duration_minutes / 60) * HOUR_HEIGHT
  );

  const colorClass =
    categoryColors[cls.category] ||
    "bg-primary/20 border-primary/40 text-primary";

  return (
    <Link
      href={gymPath(`/classes/${cls.id}`)}
      className={`absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 overflow-hidden z-10 hover:brightness-125 transition-all cursor-pointer ${colorClass}`}
      style={{ top, height: Math.min(height, (END_HOUR - startHour) * HOUR_HEIGHT - (startMin / 60) * HOUR_HEIGHT) }}
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
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
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
