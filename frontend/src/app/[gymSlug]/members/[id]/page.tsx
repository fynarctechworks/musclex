"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowLeft,
  RefreshCw,
  Snowflake,
  Pencil,
  UserX,
  UserCheck,
  Sun,
  CreditCard,
  Clock,
  Activity,
  StickyNote,
  Save,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import type { Member, CheckIn, Payment } from "@/lib/types";
import Link from "next/link";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

type MemberStatus = Member["status"];

const statusToVariant: Record<
  MemberStatus,
  "active" | "expiring" | "expired" | "frozen"
> = {
  active: "active",
  expiring_soon: "expiring",
  expired: "expired",
  frozen: "frozen",
  inactive: "expired",
};

const statusLabels: Record<MemberStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  frozen: "Frozen",
  inactive: "Inactive",
};

const paymentStatusVariant: Record<
  Payment["status"],
  "active" | "expiring" | "expired" | "frozen" | "pending"
> = {
  paid: "active",
  pending: "pending",
  partial: "expiring",
  failed: "expired",
  refunded: "frozen",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function MemberProfilePage() {
  const { gymPath } = useGymSlug();
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [unfreezeOpen, setUnfreezeOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [notesEdited, setNotesEdited] = useState(false);
  const [freezeStartDate, setFreezeStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [freezeEndDate, setFreezeEndDate] = useState(format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd"));
  const [renewPlanId, setRenewPlanId] = useState("");
  const [renewPaymentMethod, setRenewPaymentMethod] = useState("cash");

  const memberId = params.id;

  const {
    data: member,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => apiClient.get<Member>(`/members/${memberId}`),
    enabled: !!memberId,
  });

  // Use check_ins and payments embedded in the member response
  const memberWithRelations = member as Member & { check_ins?: CheckIn[]; payments?: Payment[] } | undefined;
  const checkIns = memberWithRelations?.check_ins;
  const payments = memberWithRelations?.payments;

  const { data: plans } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => apiClient.get<{ id: string; name: string; price: number }[]>("/membership-plans"),
    enabled: renewOpen,
  });

  const deactivateMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/members/${memberId}`, { status: "inactive" }),
    onSuccess: () => {
      toast.success("Member deactivated");
      setDeactivateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activateMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/members/${memberId}`, { status: "active" }),
    onSuccess: () => {
      toast.success("Member activated");
      setActivateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const freezeMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/members/${memberId}/freeze`, {
        freeze_start_date: freezeStartDate,
        freeze_end_date: freezeEndDate,
      }),
    onSuccess: () => {
      toast.success("Membership frozen");
      setFreezeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unfreezeMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(`/members/${memberId}`, { status: "active" }),
    onSuccess: () => {
      toast.success("Membership unfrozen");
      setUnfreezeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const renewMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/members/${memberId}/renew`, {
        plan_id: renewPlanId,
        payment_method: renewPaymentMethod,
      }),
    onSuccess: () => {
      toast.success("Membership renewed");
      setRenewOpen(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const notesMutation = useMutation({
    mutationFn: (updatedNotes: string) =>
      apiClient.patch(`/members/${memberId}`, { notes: updatedNotes }),
    onSuccess: () => {
      toast.success("Notes saved");
      setNotesEdited(false);
      queryClient.invalidateQueries({ queryKey: ["member", memberId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <LoadingSkeleton className="h-8 w-64" />
          <LoadingSkeleton className="h-48 w-full" />
          <LoadingSkeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (isError || !member) {
    return (
      <AppLayout>
        <EmptyState
          title="Member not found"
          description="The member you are looking for does not exist or has been removed."
          action={
            <Link href={gymPath("/members")}>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Back to Members
              </Button>
            </Link>
          }
        />
      </AppLayout>
    );
  }

  const activeMembership = member.memberships?.find(
    (m) => m.status === "active" || m.status === "frozen"
  ) || member.memberships?.[0];

  const currentNotes = notes ?? member.notes ?? "";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Link href={gymPath("/members")}>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-4">
              {member.profile_photo_url ? (
                <img
                  src={member.profile_photo_url}
                  alt={member.full_name}
                  className="h-14 w-14 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary text-lg font-bold">
                  {member.full_name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-foreground">
                    {member.full_name}
                  </h1>
                  <StatusBadge
                    variant={statusToVariant[member.status]}
                    label={statusLabels[member.status]}
                  />
                </div>
                <p className="font-mono text-sm text-muted-foreground">
                  {member.member_code}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setRenewOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Renew
            </Button>

            {member.status === "frozen" ? (
              <Button
                variant="ghost"
                onClick={() => setUnfreezeOpen(true)}
                className="text-amber-500 border border-amber-500 hover:bg-amber-500/10"
              >
                <Sun className="mr-2 h-4 w-4" />
                Unfreeze
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setFreezeOpen(true)}
                className="text-primary border border-primary hover:bg-primary/10"
              >
                <Snowflake className="mr-2 h-4 w-4" />
                Freeze
              </Button>
            )}

            <Link href={`/members/${memberId}/edit`}>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>

            {member.status === "inactive" || member.status === "expired" ? (
              <Button
                variant="ghost"
                onClick={() => setActivateOpen(true)}
                className="text-primary hover:text-primary hover:bg-primary/10"
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Activate
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => setDeactivateOpen(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <UserX className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="bg-muted border border-border p-1">
            <TabsTrigger
              value="overview"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Activity className="mr-2 h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Clock className="mr-2 h-4 w-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <StickyNote className="mr-2 h-4 w-4" />
              Notes
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Current Plan */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Current Plan
                </h3>
                {activeMembership ? (
                  <div className="space-y-0">
                    <InfoRow
                      label="Plan Name"
                      value={activeMembership.plan.name}
                    />
                    <InfoRow
                      label="Plan Type"
                      value={
                        activeMembership.plan.plan_type
                          .replace("_", " ")
                          .replace(/\b\w/g, (l) => l.toUpperCase())
                      }
                    />
                    <InfoRow
                      label="Start Date"
                      value={format(
                        new Date(activeMembership.start_date),
                        "MMM dd, yyyy"
                      )}
                    />
                    {activeMembership.end_date && (
                      <InfoRow
                        label="End Date"
                        value={format(
                          new Date(activeMembership.end_date),
                          "MMM dd, yyyy"
                        )}
                      />
                    )}
                    {activeMembership.classes_remaining !== undefined &&
                      activeMembership.classes_remaining !== null && (
                        <InfoRow
                          label="Classes Remaining"
                          value={activeMembership.classes_remaining}
                        />
                      )}
                    <InfoRow
                      label="Price"
                      value={`₹${Number(activeMembership.plan.price).toFixed(2)}`}
                    />
                    <InfoRow
                      label="Status"
                      value={
                        <StatusBadge
                          variant={statusToVariant[member.status]}
                          label={statusLabels[member.status]}
                        />
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No active membership
                  </p>
                )}
              </div>

              {/* Member Details */}
              <div className="rounded-lg border border-border bg-card p-6">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Member Details
                </h3>
                <div className="space-y-0">
                  <InfoRow label="Phone" value={member.phone} />
                  <InfoRow label="Email" value={member.email || "--"} />
                  <InfoRow
                    label="Date of Birth"
                    value={
                      member.date_of_birth
                        ? format(new Date(member.date_of_birth), "MMM dd, yyyy")
                        : "--"
                    }
                  />
                  <InfoRow
                    label="Emergency Contact"
                    value={member.emergency_contact_name || "--"}
                  />
                  <InfoRow
                    label="Emergency Phone"
                    value={member.emergency_contact_phone || "--"}
                  />
                  <InfoRow
                    label="Engagement Score"
                    value={
                      <span
                        className={
                          member.engagement_score >= 70
                            ? "text-primary"
                            : member.engagement_score >= 40
                            ? "text-amber-500"
                            : "text-destructive"
                        }
                      >
                        {member.engagement_score}%
                      </span>
                    }
                  />
                  <InfoRow
                    label="Churn Risk"
                    value={
                      <StatusBadge
                        variant={
                          member.churn_risk === "low"
                            ? "active"
                            : member.churn_risk === "medium"
                            ? "expiring"
                            : "expired"
                        }
                        label={
                          member.churn_risk.charAt(0).toUpperCase() +
                          member.churn_risk.slice(1)
                        }
                      />
                    }
                  />
                  <InfoRow
                    label="Member Since"
                    value={format(
                      new Date(member.created_at),
                      "MMM dd, yyyy"
                    )}
                  />
                </div>
              </div>

              {/* Recent Check-ins */}
              <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  Recent Check-ins
                </h3>
                {checkIns && checkIns.length > 0 ? (
                  <div className="space-y-2">
                    {checkIns.slice(0, 5).map((ci) => (
                      <div
                        key={ci.id}
                        className="flex items-center justify-between py-2.5 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-2 w-2 rounded-full ${
                              ci.status === "success"
                                ? "bg-primary"
                                : ci.status === "pending"
                                ? "bg-amber-500"
                                : "bg-destructive"
                            }`}
                          />
                          <span className="text-sm text-foreground">
                            {format(
                              new Date(ci.checked_in_at),
                              "MMM dd, yyyy - hh:mm a"
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground capitalize">
                            {ci.checkin_method.replace("_", " ")}
                          </span>
                          <StatusBadge
                            variant={
                              ci.status === "success"
                                ? "active"
                                : ci.status === "pending"
                                ? "pending"
                                : "expired"
                            }
                            label={
                              ci.status.charAt(0).toUpperCase() +
                              ci.status.slice(1)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No check-ins recorded yet
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Attendance History
              </h3>
              {checkIns && checkIns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Date & Time
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Method
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Reason
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkIns.map((ci) => (
                        <tr
                          key={ci.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 text-foreground">
                            {format(
                              new Date(ci.checked_in_at),
                              "MMM dd, yyyy - hh:mm a"
                            )}
                          </td>
                          <td className="py-3 text-muted-foreground capitalize">
                            {ci.checkin_method.replace("_", " ")}
                          </td>
                          <td className="py-3">
                            <StatusBadge
                              variant={
                                ci.status === "success"
                                  ? "active"
                                  : ci.status === "pending"
                                  ? "pending"
                                  : "expired"
                              }
                              label={
                                ci.status.charAt(0).toUpperCase() +
                                ci.status.slice(1)
                              }
                            />
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {ci.failure_reason || "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={Clock}
                  title="No attendance records"
                  description="Check-in records will appear here once the member starts checking in."
                />
              )}
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">
                Payment History
              </h3>
              {payments && payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Receipt
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Date
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Amount
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Method
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Invoice
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((pmt) => (
                        <tr
                          key={pmt.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 font-mono text-xs text-primary">
                            {pmt.receipt_number}
                          </td>
                          <td className="py-3 text-foreground">
                            {pmt.paid_at
                              ? format(
                                  new Date(pmt.paid_at),
                                  "MMM dd, yyyy"
                                )
                              : format(
                                  new Date(pmt.created_at),
                                  "MMM dd, yyyy"
                                )}
                          </td>
                          <td className="py-3 font-medium text-foreground">
                            {pmt.currency === "INR" ? "\u20B9" : "$"}
                            {Number(pmt.amount).toFixed(2)}
                          </td>
                          <td className="py-3 text-muted-foreground capitalize">
                            {pmt.payment_method.replace("_", " ")}
                          </td>
                          <td className="py-3">
                            <StatusBadge
                              variant={paymentStatusVariant[pmt.status]}
                              label={
                                pmt.status.charAt(0).toUpperCase() +
                                pmt.status.slice(1)
                              }
                            />
                          </td>
                          <td className="py-3">
                            {pmt.invoice_url ? (
                              <a
                                href={pmt.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={CreditCard}
                  title="No payment records"
                  description="Payment history will appear here once the member makes a payment."
                />
              )}
            </div>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">
                  Notes
                </h3>
                {notesEdited && (
                  <Button
                    onClick={() => notesMutation.mutate(currentNotes)}
                    disabled={notesMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {notesMutation.isPending ? "Saving..." : "Save Notes"}
                  </Button>
                )}
              </div>
              <Textarea
                value={currentNotes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesEdited(true);
                }}
                placeholder="Add notes about this member..."
                className="min-h-[200px] bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Deactivate Dialog */}
      <ConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deactivate Member"
        description={`Are you sure you want to deactivate ${member.full_name}? They will no longer be able to check in or access the gym.`}
        confirmLabel="Deactivate"
        variant="danger"
        onConfirm={() => deactivateMutation.mutate()}
        loading={deactivateMutation.isPending}
      />

      {/* Activate Dialog */}
      <ConfirmDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        title="Activate Member"
        description={`Are you sure you want to reactivate ${member.full_name}? They will be able to check in and access the gym again.`}
        confirmLabel="Activate"
        variant="default"
        onConfirm={() => activateMutation.mutate()}
        loading={activateMutation.isPending}
      />

      {/* Unfreeze Dialog */}
      <ConfirmDialog
        open={unfreezeOpen}
        onOpenChange={setUnfreezeOpen}
        title="Unfreeze Membership"
        description={`Are you sure you want to unfreeze ${member.full_name}'s membership? Their membership will become active again.`}
        confirmLabel="Unfreeze"
        variant="default"
        onConfirm={() => unfreezeMutation.mutate()}
        loading={unfreezeMutation.isPending}
      />

      {/* Freeze Dialog */}
      {freezeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-1">Freeze Membership</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select the freeze period for {member.full_name}.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Freeze Start Date</label>
                <input
                  type="date"
                  value={freezeStartDate}
                  onChange={(e) => setFreezeStartDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Freeze End Date</label>
                <input
                  type="date"
                  value={freezeEndDate}
                  onChange={(e) => setFreezeEndDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setFreezeOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={() => freezeMutation.mutate()}
                disabled={freezeMutation.isPending || !freezeStartDate || !freezeEndDate}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Snowflake className="mr-2 h-4 w-4" />
                {freezeMutation.isPending ? "Freezing..." : "Freeze"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Dialog */}
      {renewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 className="text-base font-semibold text-foreground mb-1">Renew Membership</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select a plan and payment method to renew {member.full_name}&apos;s membership.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Membership Plan *</label>
                <select
                  value={renewPlanId}
                  onChange={(e) => setRenewPlanId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="">Select a plan...</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Payment Method *</label>
                <select
                  value={renewPaymentMethod}
                  onChange={(e) => setRenewPaymentMethod(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRenewOpen(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button
                onClick={() => renewMutation.mutate()}
                disabled={renewMutation.isPending || !renewPlanId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {renewMutation.isPending ? "Renewing..." : "Renew"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
