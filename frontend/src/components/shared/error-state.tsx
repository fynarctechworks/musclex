"use client";

import {
  WifiOff,
  ShieldX,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  variant: "network" | "permission" | "not-found" | "server" | "generic";
  title?: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

const defaults: Record<
  string,
  { icon: LucideIcon; title: string; description: string }
> = {
  network: {
    icon: WifiOff,
    title: "Connection lost",
    description: "Check your internet connection and try again.",
  },
  permission: {
    icon: ShieldX,
    title: "Access denied",
    description:
      "You don't have permission to view this page. Contact your admin.",
  },
  "not-found": {
    icon: AlertTriangle,
    title: "Page not found",
    description: "The page you're looking for doesn't exist or has been moved.",
  },
  server: {
    icon: AlertTriangle,
    title: "Something went wrong",
    description: "We're working on fixing this. Please try again in a moment.",
  },
  generic: {
    icon: AlertTriangle,
    title: "An error occurred",
    description: "Something unexpected happened. Please try again.",
  },
};

export function ErrorState({
  variant,
  title,
  description,
  onRetry,
  onBack,
  className,
}: ErrorStateProps) {
  const config = defaults[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-6 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-soft">
        <Icon className="h-6 w-6 text-error-deep" />
      </div>
      <h2 className="mt-5 text-base font-semibold tracking-[-0.01em] text-foreground">
        {title ?? config.title}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-5">
        {description ?? config.description}
      </p>
      <div className="mt-5 flex items-center gap-2">
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </Button>
        )}
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
