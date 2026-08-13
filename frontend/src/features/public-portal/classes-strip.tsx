"use client";

/**
 * Upcoming-classes strip for the public portal — horizontally scrollable on
 * mobile, with an optional branch filter when the gym has multiple branches.
 */

import { useEffect, useState } from "react";
import { CalendarX2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPublicClasses,
  type PublicBranch,
  type PublicClass,
} from "./api";

const ALL_BRANCHES = "__all__";

export function ClassesStrip({
  slug,
  branches,
}: {
  slug: string;
  branches: PublicBranch[];
}) {
  const [branchId, setBranchId] = useState<string>(ALL_BRANCHES);
  const [classes, setClasses] = useState<PublicClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setClasses(null);
    setError(null);
    getPublicClasses(slug, branchId === ALL_BRANCHES ? undefined : branchId)
      .then((rows) => {
        if (!cancelled) setClasses(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, branchId]);

  return (
    <div className="mt-6">
      {branches.length > 1 && (
        <div className="mb-4 max-w-[240px]">
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger aria-label="Filter classes by branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BRANCHES}>All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error ? (
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the class schedule right now.
        </p>
      ) : classes === null ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-64 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarX2 className="h-4 w-4" />
          No upcoming classes published — check back soon.
        </p>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls }: { cls: PublicClass }) {
  const start = new Date(cls.starts_at);
  const valid = !Number.isNaN(start.getTime());
  const day = valid
    ? new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(start)
    : "";
  const time = valid
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      }).format(start)
    : "";

  return (
    <div className="w-64 shrink-0 rounded-xl border border-hairline bg-canvas p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{cls.name}</h3>
        {cls.category && (
          <Badge variant="secondary" className="shrink-0 capitalize">
            {cls.category}
          </Badge>
        )}
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {day} · {time}
        {cls.duration_minutes ? ` · ${cls.duration_minutes} min` : ""}
      </p>
      {cls.trainer_name && (
        <p className="mt-2 text-xs text-muted-foreground">
          with <span className="text-foreground">{cls.trainer_name}</span>
        </p>
      )}
      {cls.spots_left !== null && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {cls.spots_left > 0 ? `${cls.spots_left} spots left` : "Full"}
        </p>
      )}
    </div>
  );
}
