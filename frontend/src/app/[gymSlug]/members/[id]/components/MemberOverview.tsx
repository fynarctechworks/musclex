"use client";

import React, { lazy, Suspense, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Scale, QrCode, Download, Gift, Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useProgressSummary } from "@/features/progress";
import { useEnsureMemberCode } from "@/features/member-referrals";
import type { Member, CheckIn } from "@/types";
import { statusToVariant, statusLabels } from "./member-utils";
import { MemberFitnessProfile } from "./MemberFitnessProfile";
import { resolvePlanPrice, planHasBranchPricing } from "@/lib/plan-pricing";

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

function MemberReferralCodeCard({
  memberId,
  code,
  memberName,
}: {
  memberId: string;
  code: string | null | undefined;
  memberName: string;
}) {
  const [copied, setCopied] = useState(false);
  const ensureCode = useEnsureMemberCode();

  if (!code) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
              <Gift className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Referral Code</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                No code yet — generate one to start tracking referrals from this member.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => ensureCode.mutate(memberId)}
            disabled={ensureCode.isPending}
          >
            {ensureCode.isPending ? "Generating…" : "Generate code"}
          </Button>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Referral code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const text = `Join us at the gym! Use ${memberName}'s referral code: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Gym referral", text });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Share text copied to clipboard");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Referral Code</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share this code with friends to earn rewards.
          </p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-canvas-soft-2 flex items-center justify-center">
          <Gift className="h-5 w-5 text-primary" />
        </div>
      </div>

      <div className="flex items-center gap-3 bg-canvas-soft rounded-lg px-4 py-3">
        <span className="font-mono text-xl font-semibold tracking-[0.2em] text-foreground flex-1">
          {code}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Copy referral code"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Share referral code"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
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
      {/* Referral Code — spans both columns */}
      <div className="lg:col-span-2">
        <MemberReferralCodeCard
          memberId={member.id}
          code={member.referral_code}
          memberName={member.full_name}
        />
      </div>

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
                // Use branch-aware pricing so per-branch overrides are reflected.
                const price = resolvePlanPrice(
                  activeMembership.plan,
                  activeMembership.branch_id,
                );
                const label = `₹${price.toFixed(2)}`;
                return planHasBranchPricing(activeMembership.plan) ? (
                  <span title="Branch-specific pricing applied">
                    {label}
                    <span className="ml-1 text-xs text-muted-foreground">
                      (this branch)
                    </span>
                  </span>
                ) : (
                  label
                );
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
            label="Gender"
            value={
              member.gender
                ? member.gender
                    .replace(/[_-]+/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())
                : "--"
            }
          />
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
                    ? "text-warning"
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

      {/* Fitness Profile (member-app onboarding data) */}
      <MemberFitnessProfile member={member} />

      {/* QR Code Card */}
      {member.qr_code && (
        <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 w-full">
            <QrCode className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold text-foreground">Member QR Code</h3>
          </div>
          <div className="bg-canvas p-3 rounded-lg">
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
                <span className="text-success font-medium">✓ Active — scan to check in</span>
              ) : (
                <span className="text-warning font-medium">⚠ No active plan — check-in blocked</span>
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
                        ? "bg-warning"
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
                    <TrendingUp className="h-4 w-4 text-warning" />
                  ) : null}
                  <span className={`text-lg font-semibold ${progress.changes.weight <= 0 ? "text-success" : "text-warning"}`}>
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
