"use client";

import React, { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { CheckInResponse } from "../types";

interface CheckinResultProps {
  result: CheckInResponse;
  onDismiss: () => void;
}

export function CheckinResult({ result, onDismiss }: CheckinResultProps) {
  // Auto-dismiss after 4 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (result.success) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      >
        <div
          className="w-full max-w-sm rounded-2xl border-2 border-green-500/50 bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">
            Check-In Successful
          </h2>
          {result.member_name && (
            <p className="text-lg font-medium text-foreground mb-1">
              {result.member_name}
            </p>
          )}
          {result.membership_status && (
            <p className="text-sm text-muted-foreground capitalize">
              {result.membership_status.replace("_", " ")} Membership
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Tap anywhere to dismiss
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-red-500/50 bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-red-500/20 flex items-center justify-center">
          <XCircle className="h-12 w-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-1">
          Check-In Denied
        </h2>
        <p className="text-base text-red-400 capitalize">
          {result.failure_reason
            ? result.failure_reason.replace(/_/g, " ")
            : result.message || "Could not complete check-in"}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Tap anywhere to dismiss
        </p>
      </div>
    </div>
  );
}
