"use client";

import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { StatusBadge, LoadingSkeleton } from "@/components/shared";
import { apiClient } from "@/lib/api";
import { Staff } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Phone, Star, Calendar } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function StaffProfilePage() {
  const { gymPath } = useGymSlug();
  const { id } = useParams<{ id: string }>();

  const { data: staff, isLoading } = useQuery<Staff>({
    queryKey: ["staff", id],
    queryFn: () => apiClient.get(`/staff/${id}`),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <LoadingSkeleton className="h-96" />
      </AppLayout>
    );
  }

  if (!staff) {
    return (
      <AppLayout>
        <p className="text-muted-foreground">Staff member not found</p>
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

      {/* Profile Header */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{staff.full_name}</h1>
            <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full capitalize">
              {staff.role.replace("_", " ")}
            </span>
          </div>
          <StatusBadge status={staff.is_active ? "active" : "inactive"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {staff.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 text-muted-foreground" />
              {staff.phone}
            </div>
          )}
          {staff.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 text-muted-foreground" />
              {staff.email}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Star className="w-4 h-4 text-amber-500" />
            Performance: {staff.performance_score}/100
          </div>
          {staff.joined_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              Joined {format(new Date(staff.joined_at), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </div>

      {/* Specializations */}
      {staff.specializations && staff.specializations.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-3">
            Specializations
          </h2>
          <div className="flex flex-wrap gap-2">
            {staff.specializations.map((spec) => (
              <span
                key={spec}
                className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-base font-semibold text-foreground mb-3">
          Performance Score
        </h2>
        <div className="w-full bg-background rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              staff.performance_score >= 70
                ? "bg-primary"
                : staff.performance_score >= 40
                  ? "bg-amber-500"
                  : "bg-destructive"
            }`}
            style={{ width: `${staff.performance_score}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {staff.performance_score}/100
        </p>
      </div>
    </AppLayout>
  );
}
