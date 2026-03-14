"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff, Branch, PaginatedResponse } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { Plus, BarChart3, ChevronLeft, ChevronRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function StaffPage() {
  const { gymPath } = useGymSlug();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const { hasPermission } = useAuthStore();

  const canCreate = hasPermission("staff", "create");

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Staff>>({
    queryKey: ["staff", search, roleFilter, branchFilter, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (branchFilter) params.set("branch_id", branchFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return apiClient.get(`/staff?${params}`);
    },
  });

  const totalPages = Math.ceil((data?.total ?? 0) / limit);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={gymPath("/staff/analytics")}
            className="border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </Link>
          {canCreate && (
            <Link
              href={gymPath("/staff/new")}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search staff..."
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none w-64"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
        >
          <option value="">All Roles</option>
          <option value="owner">Owner</option>
          <option value="manager">Manager</option>
          <option value="trainer">Trainer</option>
          <option value="front_desk">Front Desk</option>
        </select>
        {branches && branches.length > 1 && (
          <select
            value={branchFilter}
            onChange={(e) => {
              setBranchFilter(e.target.value);
              setPage(1);
            }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Branches</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Specializations</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.data && data.data.length > 0 ? (
                  data.data.map((staff) => (
                    <tr key={staff.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/staff/${staff.id}`} className="text-sm text-primary hover:text-primary/80 font-medium">
                          {staff.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground capitalize">{staff.role.replace("_", " ")}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{staff.phone}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {staff.branch_ids?.map((bid) => {
                            const b = branches?.find((br) => br.id === bid);
                            return b ? (
                              <span key={bid} className="flex items-center gap-1 px-1.5 py-0.5 bg-muted text-foreground text-xs rounded">
                                <Building2 className="w-3 h-3" />
                                {b.name}
                              </span>
                            ) : null;
                          })}
                          {(!staff.branch_ids || staff.branch_ids.length === 0) && (
                            <span className="text-xs text-muted-foreground">All</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {staff.specializations?.slice(0, 2).map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                              {s}
                            </span>
                          ))}
                          {(staff.specializations?.length ?? 0) > 2 && (
                            <span className="text-xs text-muted-foreground">+{staff.specializations.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={staff.is_active ? "active" : "inactive"} /></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No staff members found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{data?.total ?? 0} staff members</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
