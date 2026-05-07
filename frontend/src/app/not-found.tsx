"use client";

import Link from "next/link";
import { LayoutDashboard, ArrowLeft, Home } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const studio = useAuthStore((s) => s.studio);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const activeSlug = useWorkspaceStore((s) => s.activeSlug);
  const router = useRouter();

  const dashboardHref = (() => {
    const slug = studio?.slug || activeSlug;
    if (slug) return `/${slug}/dashboard`;
    if (isAuthenticated) return "/workspace-select";
    return "/login";
  })();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 text-center"
      style={{ background: "#0D1B2A", color: "#FFFFFF" }}
    >
      {/* Logo mark */}
      <div
        className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl"
        style={{ background: "#1E3450", border: "1px solid #2A4A6A", boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}
      >
        <Home className="h-9 w-9" style={{ color: "#4A9FD4" }} />
      </div>

      {/* Error code */}
      <p
        className="mb-2 text-8xl font-black tracking-tight"
        style={{ color: "#4A9FD4", textShadow: "0 0 40px rgba(74,159,212,0.3)" }}
      >
        404
      </p>

      <h1 className="mb-3 text-2xl font-bold" style={{ color: "#FFFFFF" }}>
        Page not found
      </h1>
      <p className="mb-10 max-w-sm text-sm leading-relaxed" style={{ color: "#B0C8E0" }}>
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-80"
          style={{ background: "#1E3450", border: "1px solid #2A4A6A", color: "#B0C8E0" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all hover:opacity-90"
          style={{ background: "#4A9FD4", color: "#FFFFFF", boxShadow: "0 4px 12px rgba(74,159,212,0.3)" }}
        >
          <LayoutDashboard className="h-4 w-4" />
          Go to Dashboard
        </Link>
      </div>

      {/* Subtle divider */}
      <div className="mt-12 flex items-center gap-4" style={{ color: "#2A4A6A" }}>
        <div className="h-px w-20" style={{ background: "#2A4A6A" }} />
        <span className="text-xs" style={{ color: "#5A7A9A" }}>FitSync Pro</span>
        <div className="h-px w-20" style={{ background: "#2A4A6A" }} />
      </div>
    </div>
  );
}
