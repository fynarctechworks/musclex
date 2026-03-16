"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { PageHeader } from "@/components/shared/page-header";
import { apiClient } from "@/lib/api";
import { ClassItem } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Users,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function SchedulePage() {
  const { gymPath } = useGymSlug();
  const [currentWeek, setCurrentWeek] = useState(() => new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: classesResponse } = useQuery<{ data: ClassItem[]; total: number }>({
    queryKey: ["classes", format(weekStart, "yyyy-MM-dd")],
    queryFn: () =>
      apiClient.get(
        `/classes?date_from=${format(weekStart, "yyyy-MM-dd")}&date_to=${format(addDays(weekStart, 6), "yyyy-MM-dd")}`,
      ),
  });

  const classes = classesResponse?.data;

  const getClassesForDay = (date: Date) => {
    if (!classes) return [];
    const dateStr = format(date, "yyyy-MM-dd");
    return classes.filter((cls) => cls.starts_at.startsWith(dateStr));
  };

  return (
    <AppLayout>
      <PageHeader
        title="Class Schedule"
        description="Weekly view of all classes"
        actions={
          <Link
            href={gymPath("/classes/new")}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Class
          </Link>
        }
        className="mb-6"
      />

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentWeek((w) => subWeeks(w, 1))}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {format(weekStart, "MMM d")} -{" "}
          {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </h2>
        <button
          onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayClasses = getClassesForDay(day);
          const isToday =
            format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

          return (
            <div key={day.toISOString()} className="min-h-[200px]">
              <div
                className={`text-center py-2 rounded-t-lg text-sm font-medium ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <div>{format(day, "EEE")}</div>
                <div className="text-lg">{format(day, "d")}</div>
              </div>
              <div className="bg-card border border-border border-t-0 rounded-b-lg p-1 space-y-1 min-h-[160px]">
                {dayClasses.map((cls) => (
                  <Link
                    key={cls.id}
                    href={`/classes/${cls.id}`}
                    className="block p-2 rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                  >
                    <p className="text-xs font-medium text-foreground truncate">
                      {cls.name}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(cls.starts_at), "h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {cls.enrollments?.length ?? 0}/{cls.capacity}
                      </span>
                    </div>
                    {cls.room && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {cls.room}
                        </span>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
