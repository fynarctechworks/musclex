"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, ArrowLeft, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied } from "@/components/shared/access-denied";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { toast } from "sonner";
import Link from "next/link";

interface Member {
  id: string;
  full_name: string;
  member_code: string;
  phone: string;
  branch_id: string;
  branch?: { id: string; name: string };
}

interface MembershipPlan {
  id: string;
  name: string;
  plan_type: string;
  price: number;
}

export default function AddFamilyMemberPage() {
  const { allowed, checked } = useRequirePermission("members", "create", "deny");
  const params = useParams();
  const router = useRouter();
  const { gymPath } = useGymSlug();
  const memberId = params.id as string;
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [maxMembers, setMaxMembers] = useState(4);

  // Load primary member info
  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ["member", memberId],
    queryFn: () => apiClient.get<Member>(`/members/${memberId}`),
    enabled: !!memberId,
  });

  // Load family plans for the member's branch
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["plans", "family", member?.branch_id],
    queryFn: () =>
      apiClient.get<MembershipPlan[]>("/membership-plans", {
        params: { branch_id: member?.branch_id, plan_type: "family" },
      }),
    enabled: !!member?.branch_id,
  });

  const familyPlans = plans ?? [];

  const { mutate: createFamilyMembership, isPending } = useMutation({
    mutationFn: () =>
      apiClient.post("/family-memberships", {
        primary_member_id: memberId,
        plan_id: selectedPlanId,
        branch_id: member!.branch_id,
        max_members: maxMembers,
      }),
    onSuccess: () => {
      toast.success("Family membership created successfully");
      router.push(gymPath(`/members/${memberId}`));
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create family membership");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
      toast.error("Please select a family plan");
      return;
    }
    createFamilyMembership();
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="members" />
      </AppLayout>
    );
  }

  if (memberLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">Member not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Add Family Membership"
        description={`Setting up family plan for ${member.full_name}`}
        actions={
          <Link href={gymPath(`/members/${memberId}`)}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to Member
            </Button>
          </Link>
        }
      />

      <div className="max-w-lg mt-6">
        {/* Primary member card */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <p className="text-xs text-muted-foreground mb-1">Primary Member</p>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {member.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-foreground">{member.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {member.member_code} · {member.branch?.name}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Plan selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Family Plan <span className="text-danger">*</span>
            </label>
            {plansLoading ? (
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            ) : familyPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 px-4 rounded-lg border border-border bg-card">
                No family plans available for this branch. Create a family plan first in Settings → Plans.
              </p>
            ) : (
              <div className="space-y-2">
                {familyPlans.map((plan) => (
                  <label
                    key={plan.id}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlanId === plan.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={selectedPlanId === plan.id}
                        onChange={() => setSelectedPlanId(plan.id)}
                        className="accent-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{plan.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{plan.plan_type.replace("_", " ")}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      ₹{Number(plan.price).toLocaleString()}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Max members */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Maximum Family Members (2–10)
            </label>
            <input
              type="number"
              min={2}
              max={10}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending || !selectedPlanId || familyPlans.length === 0}
            className="w-full h-12 bg-primary text-primary-foreground"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            {isPending ? "Creating..." : "Create Family Membership"}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
