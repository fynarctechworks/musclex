"use client";

import { cn } from "@/lib/utils";

type StepStatus = "completed" | "current" | "upcoming";

interface Step {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}

/**
 * Goal Gradient Effect: progress stepper shows how far along
 * a multi-step process the user is, motivating completion.
 * Used for onboarding, multi-step forms, etc.
 */
export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label="Progress">
      {steps.map((step, i) => {
        const status: StepStatus =
          i < currentStep ? "completed" : i === currentStep ? "current" : "upcoming";

        return (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-8 sm:w-12",
                  status === "upcoming" ? "bg-border" : "bg-primary"
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  status === "completed" && "bg-primary text-primary-foreground",
                  status === "current" && "border-2 border-primary text-primary",
                  status === "upcoming" && "border border-border text-muted-foreground"
                )}
              >
                {status === "completed" ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
