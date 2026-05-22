"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton, AccessDenied } from "@/components/shared";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { apiClient } from "@/lib/api";
import { ClassItem, ClassEnrollment } from "@/lib/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Users,
  MapPin,
  Calendar,
  UserPlus,
  Phone,
  Hash,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

type EnrollMode = "member_code" | "phone";

export default function ClassDetailPage() {
  const { allowed, checked } = useRequirePermission("classes", "view", "deny");
  const { gymPath } = useGymSlug();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [enrollInput, setEnrollInput] = useState("");
  const [enrollMode, setEnrollMode] = useState<EnrollMode>("member_code");

  const { data: classItem, isLoading } = useQuery<ClassItem>({
    queryKey: ["class", id],
    queryFn: () => apiClient.get(`/classes/${id}`),
  });

  const enrollMutation = useMutation({
    mutationFn: (member_id: string) =>
      apiClient.post(`/classes/${id}/enroll`, { member_id }),
    onSuccess: (data: any) => {
      toast.success(data?.message || "Member enrolled");
      setEnrollInput("");
      queryClient.invalidateQueries({ queryKey: ["class", id] });
    },
    onError: (err: Error) => toast.error(err.message || "Enrollment failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (member_id: string) =>
      apiClient.post(`/classes/${id}/cancel-enrollment`, { member_id }),
    onSuccess: () => {
      toast.success("Enrollment cancelled");
      queryClient.invalidateQueries({ queryKey: ["class", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleEnroll = () => {
    const value = enrollInput.trim();
    if (!value) return;
    // Send the raw value — backend resolves by UUID, member_code, or phone
    enrollMutation.mutate(value);
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="classes" />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSkeleton className="h-96" />
      </AppLayout>
    );
  }

  if (!classItem) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Class not found</p>
      </AppLayout>
    );
  }

  const enrolled =
    classItem.enrollments?.filter((e) => e.status === "enrolled") ?? [];
  const waitlisted =
    classItem.enrollments?.filter((e) => e.status === "waitlisted") ?? [];

  return (
    <AppLayout>
      <Link
        href={gymPath("/schedule")}
        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Schedule
      </Link>

      {/* Class Header */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {classItem.name}
            </h1>
            <span className="inline-block mt-1 px-2 py-0.5 bg-canvas-soft-2 text-primary text-xs rounded-full">
              {classItem.category}
            </span>
          </div>
          <StatusBadge status={classItem.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            {format(new Date(classItem.starts_at), "MMM d, yyyy")}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {format(new Date(classItem.starts_at), "h:mm a")} (
            {classItem.duration_minutes}min)
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4 text-muted-foreground" />
            {enrolled.length}/{classItem.capacity} enrolled
          </div>
          {classItem.room && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              {classItem.room}
            </div>
          )}
        </div>

        {classItem.trainer && (
          <div className="mt-3 text-sm text-muted-foreground">
            Trainer:{" "}
            <span className="text-foreground">
              {classItem.trainer.full_name}
            </span>
          </div>
        )}
      </div>

      {/* Enroll Member */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Enroll Member
        </h2>

        {/* Mode Toggle */}
        <div className="flex gap-1 mb-3 bg-muted rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => {
              setEnrollMode("member_code");
              setEnrollInput("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              enrollMode === "member_code"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            Member Code
          </button>
          <button
            type="button"
            onClick={() => {
              setEnrollMode("phone");
              setEnrollInput("");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              enrollMode === "phone"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            Phone Number
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type={enrollMode === "phone" ? "tel" : "text"}
            value={enrollInput}
            onChange={(e) => setEnrollInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEnroll()}
            placeholder={
              enrollMode === "member_code"
                ? "e.g. FS-20260416-0001"
                : "e.g. 9876543210"
            }
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />
          <button
            onClick={handleEnroll}
            disabled={!enrollInput.trim() || enrollMutation.isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {enrollMutation.isPending ? "Enrolling..." : "Enroll"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Enter a member code (FS-XXXXXXXX-XXXX) or mobile number to enroll
        </p>
      </div>

      {/* Enrolled Members */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Enrolled ({enrolled.length})
        </h2>
        {enrolled.length > 0 ? (
          <div className="space-y-2">
            {enrolled.map((enrollment: ClassEnrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm text-foreground">
                    {enrollment.member?.full_name ?? enrollment.member_id}
                  </p>
                  {enrollment.member?.member_code && (
                    <p className="text-xs text-muted-foreground">
                      {enrollment.member.member_code}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => cancelMutation.mutate(enrollment.member_id)}
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No enrolled members</p>
        )}
      </div>

      {/* Waitlist */}
      {waitlisted.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-base font-semibold text-foreground mb-3">
            Waitlist ({waitlisted.length})
          </h2>
          <div className="space-y-2">
            {waitlisted.map((enrollment: ClassEnrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div>
                  <p className="text-sm text-foreground">
                    {enrollment.member?.full_name ?? enrollment.member_id}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Position #{enrollment.waitlist_position}
                  </p>
                </div>
                <button
                  onClick={() => cancelMutation.mutate(enrollment.member_id)}
                  className="text-xs text-destructive hover:text-destructive/80"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
