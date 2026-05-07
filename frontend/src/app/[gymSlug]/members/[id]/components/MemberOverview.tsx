"use client";

import React, { lazy, Suspense } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Scale, QrCode, Download } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { useProgressSummary } from "@/features/progress";
import type { Member, CheckIn } from "@/types";
import { statusToVariant, statusLabels } from "./member-utils";

// Lazy-load QR to avoid SSR issues
const QRCodeSVG = lazy(() => import("qrcode.react").then(m => ({ default: m.QRCodeSVG })));

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

interface MemberOverviewProps {
  member: Member;
  checkIns?: CheckIn[];
}

export function MemberOverview({ member, checkIns }: MemberOverviewProps) {
  const { data: progress } = useProgressSummary(member.id);

  const activeMembership =
    member.memberships?.find(
      (m) => m.status === "active" || m.status === "frozen"
    ) || member.memberships?.[0];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Current Plan */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground mb-4">
          Current Plan
        </h3>
        {activeMembership ? (
          <div className="space-y-0">
            <InfoRow label="Plan Name" value={activeMembership.plan.name} />
            <InfoRow
              label="Plan Type"
              value={activeMembership.plan.plan_type
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase())}
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
              value={(() => {
                const raw = activeMembership.plan.price as unknown;
                const n =
                  typeof raw === "number"
                    ? raw
                    : typeof raw === "string"
                      ? Number(raw)
                      : Number((raw as { toString?: () => string })?.toString?.() ?? NaN);
                return Number.isFinite(n) ? `₹${n.toFixed(2)}` : "—";
              })()}
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
          <p className="text-sm text-muted-foreground">No active membership</p>
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
            value={format(new Date(member.created_at), "MMM dd, yyyy")}
          />
        </div>
      </div>

      {/* QR Code Card */}
      {member.qr_code && (
        <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 w-full">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Member QR Code</h3>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <Suspense fallback={<div className="h-40 w-40 bg-muted animate-pulse rounded" />}>
              <QRCodeSVG
                value={member.qr_code}
                size={160}
                level="M"
                includeMargin={false}
              />
            </Suspense>
          </div>
          <div className="text-center">
            <p className="text-xs font-mono text-muted-foreground">{member.member_code}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeMembership?.status === "active" ? (
                <span className="text-green-500 font-medium">✓ Active — scan to check in</span>
              ) : (
                <span className="text-amber-500 font-medium">⚠ No active plan — check-in blocked</span>
              )}
            </p>
          </div>
        </div>
      )}

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
                      ci.status.charAt(0).toUpperCase() + ci.status.slice(1)
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

      {/* Progress Snapshot */}
      {progress && progress.latest && (
        <div className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Scale className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Progress Snapshot</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Latest Weight</p>
              <p className="text-lg font-semibold text-foreground">
                {progress.latest.weight !== null ? `${Number(progress.latest.weight).toFixed(1)} kg` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Body Fat</p>
              <p className="text-lg font-semibold text-foreground">
                {progress.latest.body_fat !== null ? `${Number(progress.latest.body_fat).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Weight Change</p>
              {progress.changes?.weight !== null && progress.changes?.weight !== undefined ? (
                <div className="flex items-center gap-1">
                  {progress.changes.weight < 0 ? (
                    <TrendingDown className="h-4 w-4 text-success" />
                  ) : progress.changes.weight > 0 ? (
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                  ) : null}
                  <span className={`text-lg font-semibold ${progress.changes.weight <= 0 ? "text-success" : "text-amber-400"}`}>
                    {progress.changes.weight > 0 ? "+" : ""}{Number(progress.changes.weight).toFixed(1)} kg
                  </span>
                </div>
              ) : (
                <p className="text-lg font-semibold text-muted-foreground">—</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Last Measured</p>
              <p className="text-sm font-medium text-foreground">
                {formatDistanceToNow(new Date(progress.latest.recorded_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
