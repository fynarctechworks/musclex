"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, PageHeader , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff, Branch } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft, Clock, LogIn, LogOut, Plus, UserCheck,
} from "lucide-react";
import Link from "next/link";
import { useRequirePermission } from "@/hooks/use-require-permission";

interface AttendanceRecord {
  id: string;
  staff_id: string;
  branch_id: string;
  check_in_time: string;
  check_out_time?: string;
  method: "biometric" | "qr" | "manual" | "mobile";
  notes?: string;
  created_at: string;
  branch?: { id: string; name: string; code?: string };
}

export default function AttendancePage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const { user, activeBranchId } = useAuthStore();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner" || user?.role === "brand_owner";
  const isManager = user?.role === "manager" || user?.role === "branch_manager";
  const canManage = isOwner || isManager;

  // Filters
  const [selectedStaff, setSelectedStaff] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [dateRange, setDateRange] = useState({
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(new Date(), "yyyy-MM-dd"),
  });

  // Check-in form
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [checkInData, setCheckInData] = useState({
    staff_id: "",
    branch_id: "",
    method: "manual" as string,
    notes: "",
  });

  // Queries — filtered by active branch when set
  const { data: staffList } = useQuery<{ data: Staff[] }>({
    queryKey: ["staff-list-for-attendance", activeBranchId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (activeBranchId) params.set("branch_id", activeBranchId);
      return apiClient.get(`/staff?${params}`);
    },
  });

  const { data: branches } = useQuery<Branch[]>({
    queryKey: ["branches"],
    queryFn: () => apiClient.get("/branches"),
  });

  // Find the logged-in user's own staff record
  const myStaffRecord = staffList?.data?.find((s) => s.user_id === user?.id);

  // Non-owners only see their own attendance
  const effectiveStaff = canManage ? selectedStaff : (myStaffRecord?.id || "");
  // Branch filter: use local override, then nav selector
  const effectiveBranch = selectedBranch !== "all" ? selectedBranch : activeBranchId || "";

  const { data: attendanceData, isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["staff-attendance", effectiveStaff, effectiveBranch, dateRange],
    queryFn: () => {
      if (!effectiveStaff) return Promise.resolve([]);
      const params = new URLSearchParams();
      if (dateRange.start_date) params.set("start_date", dateRange.start_date);
      if (dateRange.end_date) params.set("end_date", dateRange.end_date);
      if (effectiveBranch) params.set("branch_id", effectiveBranch);
      return apiClient.get(`/staff/${effectiveStaff}/attendance?${params}`);
    },
    enabled: !!effectiveStaff,
  });

  // Mutations
  const checkInMutation = useMutation({
    mutationFn: (data: typeof checkInData) =>
      apiClient.post("/staff/attendance/check-in", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance"] });
      toast.success("Staff checked in successfully");
      setShowCheckIn(false);
      setCheckInData({ staff_id: "", branch_id: "", method: "manual", notes: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: (attendanceId: string) =>
      apiClient.patch(`/staff/attendance/${attendanceId}/check-out`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-attendance"] });
      toast.success("Staff checked out successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCheckIn() {
    const staffId = canManage ? checkInData.staff_id : (myStaffRecord?.id || "");
    if (!staffId || !checkInData.branch_id) {
      toast.error("Please select staff and branch");
      return;
    }
    checkInMutation.mutate({ ...checkInData, staff_id: staffId });
  }

  function getWorkDuration(checkIn: string, checkOut?: string) {
    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  }

  // Count today's active (no checkout) records
  const activeCount = attendanceData?.filter((r) => !r.check_out_time).length ?? 0;


  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="staff" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/staff")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Staff
      </Link>

      <PageHeader
        title="Staff Attendance"
        description="Track check-ins and check-outs for your team"
        actions={
          <button
            onClick={() => setShowCheckIn(!showCheckIn)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Record Check-In
          </button>
        }
        className="mb-6"
      />

      {/* Quick Check-In Form */}
      {showCheckIn && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Record Staff Check-In</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Staff Member *</label>
              {canManage ? (
                <select
                  value={checkInData.staff_id}
                  onChange={(e) => setCheckInData({ ...checkInData, staff_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                >
                  <option value="">Select staff...</option>
                  {staffList?.data?.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                  {myStaffRecord?.full_name || user?.full_name || "You"}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Branch *</label>
              <select
                value={checkInData.branch_id}
                onChange={(e) => setCheckInData({ ...checkInData, branch_id: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              >
                <option value="">Select branch...</option>
                {branches?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Method</label>
              <select
                value={checkInData.method}
                onChange={(e) => setCheckInData({ ...checkInData, method: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              >
                <option value="manual">Manual</option>
                <option value="biometric">Biometric</option>
                <option value="qr">QR Code</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <input
                type="text"
                value={checkInData.notes}
                onChange={(e) => setCheckInData({ ...checkInData, notes: e.target.value })}
                placeholder="Optional"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCheckIn}
              disabled={checkInMutation.isPending}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {checkInMutation.isPending ? "Checking in..." : "Check In"}
            </button>
            <button
              onClick={() => setShowCheckIn(false)}
              className="border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          {canManage ? (
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
            >
              <option value="">Select Staff to View...</option>
              {staffList?.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          ) : (
            <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
              {myStaffRecord?.full_name || user?.full_name || "You"}
            </div>
          )}
        </div>
        {branches && branches.length > 1 && (
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <input
          type="date"
          value={dateRange.start_date}
          onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
        />
        <span className="text-muted-foreground self-center text-sm">to</span>
        <input
          type="date"
          value={dateRange.end_date}
          onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
        />
      </div>

      {/* Content */}
      {!effectiveStaff ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <UserCheck className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground">Select a staff member to view their attendance records</p>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : (
        <>
          {/* Summary Cards */}
          {attendanceData && attendanceData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Total Records</p>
                <p className="text-xl font-semibold text-foreground mt-1">{attendanceData.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Currently Active</p>
                <p className="text-xl font-semibold text-green-400 mt-1">{activeCount}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-xl font-semibold text-foreground mt-1">
                  {attendanceData.filter((r) => r.check_out_time).length}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">Avg Duration</p>
                <p className="text-xl font-semibold text-foreground mt-1">
                  {(() => {
                    const completed = attendanceData.filter((r) => r.check_out_time);
                    if (completed.length === 0) return "—";
                    const totalMs = completed.reduce((sum, r) => {
                      return sum + (new Date(r.check_out_time!).getTime() - new Date(r.check_in_time).getTime());
                    }, 0);
                    const avgHours = Math.round((totalMs / completed.length / 3600000) * 10) / 10;
                    return `${avgHours}h`;
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Attendance Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Check In</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Check Out</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Duration</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData && attendanceData.length > 0 ? (
                  attendanceData.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm text-foreground">
                        {format(new Date(record.check_in_time), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-1.5">
                          <LogIn className="w-3.5 h-3.5 text-green-400" />
                          {format(new Date(record.check_in_time), "hh:mm a")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.check_out_time ? (
                          <div className="flex items-center gap-1.5">
                            <LogOut className="w-3.5 h-3.5 text-red-400" />
                            {format(new Date(record.check_out_time), "hh:mm a")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          {getWorkDuration(record.check_in_time, record.check_out_time)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {record.branch?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-muted text-foreground text-xs rounded capitalize">
                          {record.method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {record.check_out_time ? (
                          <StatusBadge status="active" label="completed" />
                        ) : (
                          <StatusBadge status="pending" label="active" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!record.check_out_time && (
                          <button
                            onClick={() => checkOutMutation.mutate(record.id)}
                            disabled={checkOutMutation.isPending}
                            className="flex items-center gap-1 bg-destructive/10 text-destructive px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-destructive/20 disabled:opacity-50 transition-colors"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            Check Out
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No attendance records found for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
