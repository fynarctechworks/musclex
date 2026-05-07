"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { CheckCircle, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

interface InviteInfo {
  email: string;
  role_name: string;
  studio_name: string;
  studio_logo?: string;
  status: string;
  is_expired: boolean;
  expires_at: string;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: invite, isLoading, error } = useQuery<InviteInfo>({
    queryKey: ["invite", token],
    queryFn: () => apiClient.get(`/staff-invites/${token}`),
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiClient.post("/staff-invites/accept", {
        token,
        password,
        full_name: fullName || undefined,
      }),
    onSuccess: () => {
      toast.success("Account created! Redirecting to login...");
      setTimeout(() => router.push("/login"), 2000);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    acceptMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Invalid Invite
          </h1>
          <p className="text-sm text-muted-foreground">
            This invite link is invalid or has been revoked. Please contact your
            admin for a new invite.
          </p>
        </div>
      </div>
    );
  }

  if (invite.status !== "pending" || invite.is_expired) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {invite.is_expired ? "Invite Expired" : "Invite Already Used"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {invite.is_expired
              ? "This invite has expired. Ask your admin to resend it."
              : `This invite has already been ${invite.status}.`}
          </p>
        </div>
      </div>
    );
  }

  if (acceptMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-xl p-8 max-w-md text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Account Created!
          </h1>
          <p className="text-sm text-muted-foreground">
            Redirecting you to the login page...
          </p>
        </div>
      </div>
    );
  }

  const roleDisplay = invite.role_name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full">
        {invite.studio_logo && (
          <img
            src={invite.studio_logo}
            alt={invite.studio_name}
            className="h-12 mx-auto mb-4 rounded"
          />
        )}
        <h1 className="text-xl font-semibold text-foreground text-center mb-1">
          Join {invite.studio_name}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          You&apos;ve been invited as <strong className="text-foreground">{roleDisplay}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              type="email"
              value={invite.email}
              disabled
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Set Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-muted-foreground hover:text-foreground"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={acceptMutation.isPending}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {acceptMutation.isPending ? "Creating Account..." : "Accept Invite & Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
