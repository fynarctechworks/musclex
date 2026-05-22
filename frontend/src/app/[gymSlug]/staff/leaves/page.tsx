"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, PageHeader, ConfirmDialog , AccessDenied } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff, Branch } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import {
  CalendarOff, Plus, Check, X, Clock, ArrowLeft,
  ChevronLeft, ChevronRight, Mail,
} from "lucide-react";
import Link from "next/link";
import { useRequirePermission } from "@/hooks/use-require-permission";

interface LeaveRequest {
  id: string;
  staff_id: string;
  leave_type: "sick" | "vacation" | "personal" | "unpaid";
  start_date: string;
  end_date: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_notes?: string;
  created_at: string;
  staff?: { id: string; full_name: string; employee_code?: string; role?: string };
  reviewer?: { id: string; full_name: string };
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "Sick Leave",
  vacation: "Vacation",
  personal: "Personal",
  unpaid: "Unpaid Leave",
};

const STATUS_MAP: Record<string, string> = {
  pending: "pending",
  approved: "active",
  rejected: "expired",
  cancelled: "inactive",
};

export default function LeavesPage() {
  const { allowed, checked } = useRequirePermission("staff", "view", "deny");
  const { gymPath } = useGymSlug();
  const { user, activeBranchId } = useAuthStore();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner" || user?.role === "brand_owner";
  const isManager = user?.role === "manager" || user?.role === "branch_manager";
  const canReview = isOwner || isManager;

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Fetch staff list — filtered by active branch when set
  const { data: staffList } = useQuery<{ data: Staff[] }>({
    queryKey: ["staff-list-for-leaves", activeBranchId],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "200" });
      if (activeBranchId) params.set("branch_id", activeBranchId);
      return apiClient.get(`/staff?${params}`);
    },
  });

  // Find the logged-in user's own staff record
  const myStaffRecord = staffList?.data?.find((s) => s.user_id === user?.id);

  // New request form — non-owners can only apply for themselves
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    staff_id: "",
    leave_type: "sick",
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [notifyTo, setNotifyTo] = useState<string[]>([]);
  const [notifyCc, setNotifyCc] = useState<string[]>([]);

  // Review dialog
  const [reviewTarget, setReviewTarget] = useState<{ id: string; action: "approved" | "rejected" } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // For non-owners: auto-filter to own leaves, auto-fill staff_id
  const effectiveStaffFilter = canReview ? staffFilter : (myStaffRecord?.id || "");
  // Branch filter from nav selector
  const effectiveBranch = activeBranchId || "";

  const { data: leavesData, isLoading } = useQuery<{ data: LeaveRequest[]; total: number }>({
    queryKey: ["staff-leaves", statusFilter, effectiveStaffFilter, effectiveBranch, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (effectiveStaffFilter) params.set("staff_id", effectiveStaffFilter);
      if (effectiveBranch) params.set("branch_id", effectiveBranch);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return apiClient.get(`/staff/leaves?${params}`);
    },
  });

  const totalPages = Math.ceil((leavesData?.total ?? 0) / limit);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: typeof formData & { notify_to?: string[]; notify_cc?: string[] }) =>
      apiClient.post("/staff/leaves", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-leaves"] });
      toast.success("Leave request submitted & notifications sent");
      setShowForm(false);
      setFormData({ staff_id: "", leave_type: "sick", start_date: "", end_date: "", reason: "" });
      setNotifyTo([]);
      setNotifyCc([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, reviewer_notes }: { id: string; status: string; reviewer_notes?: string }) =>
      apiClient.patch(`/staff/leaves/${id}/review`, { status, reviewer_notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-leaves"] });
      toast.success("Leave request updated");
      setReviewTarget(null);
      setReviewNotes("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/staff/leaves/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-leaves"] });
      toast.success("Leave request cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmitLeave() {
    const staffId = canReview ? formData.staff_id : (myStaffRecord?.id || "");
    if (!staffId || !formData.start_date || !formData.end_date) {
      toast.error("Please fill in all required fields");
      return;
    }
    createMutation.mutate({
      ...formData,
      staff_id: staffId,
      notify_to: notifyTo.length > 0 ? notifyTo : undefined,
      notify_cc: notifyCc.length > 0 ? notifyCc : undefined,
    });
  }

  function toggleStaffInList(staffId: string, list: string[], setList: (v: string[]) => void) {
    if (list.includes(staffId)) {
      setList(list.filter((id) => id !== staffId));
    } else {
      setList([...list, staffId]);
    }
  }

  function handleReview() {
    if (!reviewTarget) return;
    reviewMutation.mutate({
      id: reviewTarget.id,
      status: reviewTarget.action,
      reviewer_notes: reviewNotes || undefined,
    });
  }

  function getDayCount(start: string, end: string) {
    return differenceInDays(new Date(end), new Date(start)) + 1;
  }


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
        title="Leave Management"
        description="Manage staff leave requests and approvals"
        actions={
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Leave Request
          </button>
        }
        className="mb-6"
      />

      {/* New Leave Request Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Submit Leave Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canReview ? (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Staff Member *</label>
                <select
                  value={formData.staff_id}
                  onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
                >
                  <option value="">Select staff...</option>
                  {staffList?.data?.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Applying For</label>
                <div className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                  {myStaffRecord?.full_name || user?.full_name || "You"}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Leave Type *</label>
              <select
                value={formData.leave_type}
                onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              >
                <option value="sick">Sick Leave</option>
                <option value="vacation">Vacation</option>
                <option value="personal">Personal</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Reason</label>
              <input
                type="text"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Optional reason for leave"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Notify To / CC */}
          <div className="mt-4 border border-border rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Send Notification To</h4>

            {/* TO */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> To (primary recipients — approvers)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {staffList?.data?.filter((s) => s.id !== formData.staff_id).map((s) => {
                  const selected = notifyTo.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        // If selecting in To, remove from CC
                        if (!selected) setNotifyCc((cc) => cc.filter((id) => id !== s.id));
                        toggleStaffInList(s.id, notifyTo, setNotifyTo);
                      }}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        selected
                          ? "bg-canvas-soft-2 text-primary border-primary/40"
                          : "bg-background text-muted-foreground border-border hover:border-primary/30"
                      }`}
                    >
                      {s.full_name}
                      <span className="ml-1 text-[10px] opacity-60 capitalize">({s.role.replace("_", " ")})</span>
                    </button>
                  );
                })}
              </div>
              {notifyTo.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">Click to select who should review this request</p>
              )}
            </div>

            {/* CC */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3" /> CC (just notified, no action needed)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {staffList?.data?.filter((s) => s.id !== formData.staff_id && !notifyTo.includes(s.id)).map((s) => {
                  const selected = notifyCc.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStaffInList(s.id, notifyCc, setNotifyCc)}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        selected
                          ? "bg-warning/20 text-warning border-warning/30"
                          : "bg-background text-muted-foreground border-border hover:border-warning/30"
                      }`}
                    >
                      {s.full_name}
                      <span className="ml-1 text-[10px] opacity-60 capitalize">({s.role.replace("_", " ")})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {(notifyTo.length > 0 || notifyCc.length > 0) && (
              <div className="text-[11px] text-muted-foreground pt-1 border-t border-border">
                {notifyTo.length > 0 && (
                  <span className="text-primary">To: {notifyTo.map((id) => staffList?.data?.find((s) => s.id === id)?.full_name).join(", ")}</span>
                )}
                {notifyTo.length > 0 && notifyCc.length > 0 && <span className="mx-2">|</span>}
                {notifyCc.length > 0 && (
                  <span className="text-warning">CC: {notifyCc.map((id) => staffList?.data?.find((s) => s.id === id)?.full_name).join(", ")}</span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSubmitLeave}
              disabled={createMutation.isPending}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? "Submitting..." : "Submit Request"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {canReview && staffList?.data && staffList.data.length > 0 && (
          <select
            value={staffFilter}
            onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
            className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none"
          >
            <option value="">All Staff</option>
            {staffList.data.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Leave Requests Table */}
      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : (
        <>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Staff</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Dates</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Days</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Reason</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Reviewed By</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leavesData?.data && leavesData.data.length > 0 ? (
                  leavesData.data.map((leave) => (
                    <tr key={leave.id} className="border-b border-border last:border-0 hover:bg-canvas-soft">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-foreground font-medium">{leave.staff?.full_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{leave.staff?.role?.replace("_", " ")}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-canvas-soft-2 text-primary text-xs rounded-full">
                          {LEAVE_TYPE_LABELS[leave.leave_type] || leave.leave_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {format(new Date(leave.start_date), "MMM d")} — {format(new Date(leave.end_date), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground font-medium">
                        {getDayCount(leave.start_date, leave.end_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px] truncate">
                        {leave.reason || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={STATUS_MAP[leave.status] || leave.status} label={leave.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {leave.reviewer?.full_name || "—"}
                        {leave.reviewer_notes && (
                          <p className="text-xs text-muted-foreground/70 truncate max-w-[120px]" title={leave.reviewer_notes}>
                            {leave.reviewer_notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {leave.status === "pending" && canReview && (
                            <>
                              <button
                                onClick={() => setReviewTarget({ id: leave.id, action: "approved" })}
                                className="p-1.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setReviewTarget({ id: leave.id, action: "rejected" })}
                                className="p-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {leave.status === "pending" && leave.staff_id === myStaffRecord?.id && (
                            <button
                              onClick={() => cancelMutation.mutate(leave.id)}
                              disabled={cancelMutation.isPending}
                              className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-canvas-soft-2 transition-colors"
                              title="Cancel"
                            >
                              <CalendarOff className="w-4 h-4" />
                            </button>
                          )}
                          {leave.status !== "pending" && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No leave requests found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">{leavesData?.total ?? 0} requests</p>
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

      {/* Review Dialog */}
      {reviewTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">
              {reviewTarget.action === "approved" ? "Approve" : "Reject"} Leave Request
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {reviewTarget.action === "approved"
                ? "This will approve the leave request and notify the staff member."
                : "This will reject the leave request. You can add a note explaining why."}
            </p>
            <div className="mb-4">
              <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder={reviewTarget.action === "rejected" ? "Reason for rejection..." : "Any additional notes..."}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setReviewTarget(null); setReviewNotes(""); }}
                className="border border-border text-muted-foreground px-4 py-2 rounded-lg text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={reviewMutation.isPending}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                  reviewTarget.action === "approved"
                    ? "bg-success text-on-primary hover:bg-success"
                    : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                }`}
              >
                {reviewMutation.isPending
                  ? "Processing..."
                  : reviewTarget.action === "approved" ? "Approve" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
