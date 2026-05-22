"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Building2,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  completed: boolean;
}

interface SetupChecklistProps {
  gymPath: (path: string) => string;
  hasMembers: boolean;
  hasBranches: boolean;
  hasPlans: boolean;
  hasGymSetup: boolean;
}

export function SetupChecklist({
  gymPath,
  hasMembers,
  hasBranches,
  hasPlans,
  hasGymSetup,
}: SetupChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const items: ChecklistItem[] = [
    {
      id: "branch",
      label: "Set up your branch",
      description: "Configure your gym location with address and hours",
      href: gymPath("/branches"),
      icon: Building2,
      completed: hasBranches,
    },
    {
      id: "plans",
      label: "Create membership plans",
      description: "Define pricing tiers for your members",
      href: gymPath("/memberships/plans"),
      icon: CreditCard,
      completed: hasPlans,
    },
    {
      id: "members",
      label: "Add your first member",
      description: "Register a member or import from a spreadsheet",
      href: gymPath("/members/new"),
      icon: Users,
      completed: hasMembers,
    },
    {
      id: "gym_setup",
      label: "Gym setup",
      description: "Add your logo, address, phone & contact details",
      href: gymPath("/settings/profile"),
      icon: SettingsIcon,
      completed: hasGymSetup,
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const allDone = completedCount === items.length;
  const progress = Math.round((completedCount / items.length) * 100);

  if (dismissed || allDone) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            Getting Started
          </h2>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{items.length} completed
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-canvas-soft hover:text-foreground transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-canvas-soft hover:text-foreground transition-colors"
            aria-label="Dismiss checklist"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-primary rounded-full transition-all duration-slow"
          style={{ width: `${progress}%` }}
        />
      </div>

      {expanded && (
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                item.completed
                  ? "opacity-60"
                  : "hover:bg-canvas-soft/60"
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  item.completed
                    ? "text-primary/60"
                    : "text-muted-foreground"
                )}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    item.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  )}
                >
                  {item.label}
                </p>
                {!item.completed && (
                  <p className="text-[11px] text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
