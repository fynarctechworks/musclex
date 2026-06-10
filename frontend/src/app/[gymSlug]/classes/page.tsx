"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, PageHeader, AccessDenied } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useClasses } from "@/features/classes/hooks";
import { useAuthStore } from "@/stores/auth-store";
import { Plus, Users, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import type { ClassItem } from "@/types";

export default function ClassesPage() {
  const { allowed, checked } = useRequirePermission("classes", "view", "deny");
  const { gymPath } = useGymSlug();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const { hasPermission, activeBranchId } = useAuthStore();

  const canCreate = hasPermission("classes", "create");

  const { data, isLoading } = useClasses({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    branch_id: activeBranchId || undefined,
    page,
    limit,
  });

  const response = data as { data?: ClassItem[]; total?: number } | undefined;
  const allClasses: ClassItem[] = response?.data ?? [];
  const filteredClasses = debouncedSearch
    ? allClasses.filter((c) =>
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : allClasses;
  const classes = filteredClasses;
  const total = response?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Classes"
        description="Manage group classes and sessions"
        actions={
          canCreate ? (
            <Link
              href={gymPath("/classes/new")}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Class
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mt-6 mb-4">
        <input
          type="text"
          placeholder="Search classes..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="bg-background border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
        >
          <option value="">All Categories</option>
          <option value="yoga">Yoga</option>
          <option value="hiit">HIIT</option>
          <option value="strength">Strength</option>
          <option value="cardio">Cardio</option>
          <option value="dance">Dance</option>
          <option value="pilates">Pilates</option>
          <option value="crossfit">CrossFit</option>
          <option value="martial_arts">Martial Arts</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Classes Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-level-2 shadow-black/5">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-12" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No classes found. {canCreate ? "Create your first class to get started." : ""}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-3 font-medium">Class Name</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Trainer</th>
                <th className="px-6 py-3 font-medium">Capacity</th>
                <th className="px-6 py-3 font-medium">Duration</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((cls) => (
                <tr key={cls.id} className="hover:bg-canvas-soft transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={gymPath(`/classes/${cls.id}`)}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {cls.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 capitalize text-muted-foreground">
                    {cls.category?.replace("_", " ") || "—"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {cls.trainer?.full_name || "Unassigned"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {cls.enrollments?.length ?? 0}/{cls.capacity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {cls.duration_minutes}m
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={cls.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-canvas-soft disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-muted-foreground px-2">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-canvas-soft disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
