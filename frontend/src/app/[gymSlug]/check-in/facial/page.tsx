"use client";

import { ArrowLeft, ScanFace } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

export default function FacialCheckInPage() {
  const { gymPath } = useGymSlug();
  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={gymPath("/check-in")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-xl font-semibold text-foreground">Facial Recognition Check-in</h1>
      </div>

      <div className="max-w-md mx-auto rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-4">
        <ScanFace className="h-16 w-16 text-primary" />
        <p className="text-sm text-muted-foreground text-center">Camera access required for facial recognition.</p>
        <p className="text-xs text-muted-foreground text-center">Face recognition models (face-api.js) will be loaded when camera is activated. Position your face in front of the camera for identification.</p>
        <div className="w-full aspect-video rounded-lg bg-background border border-border flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Camera Preview</p>
        </div>
      </div>
    </AppLayout>
  );
}
