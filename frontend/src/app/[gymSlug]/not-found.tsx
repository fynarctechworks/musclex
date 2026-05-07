"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GymNotFound() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.gymSlug as string) || "";

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border">
        <Compass className="h-8 w-8 text-primary" />
      </div>

      <p className="mb-2 text-6xl font-black tracking-tight text-primary">
        404
      </p>

      <h1 className="mb-2 text-xl font-semibold text-foreground">
        We couldn&apos;t find that page
      </h1>
      <p className="mb-8 max-w-sm text-[13px] text-muted-foreground">
        The page you tried to open doesn&apos;t exist in this workspace. It may
        have been moved, renamed, or never created.
      </p>

      <div className="flex flex-col sm:flex-row gap-2.5">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Go back
        </Button>
        <Link href={slug ? `/${slug}/dashboard` : "/workspace-select"}>
          <Button className="bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4 mr-1.5" /> Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
