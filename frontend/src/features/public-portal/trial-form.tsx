"use client";

/**
 * "Book a free trial" lead form — posts intent:'trial' to the public leads
 * endpoint. Rate-limited server-side (~5/min) → 429 gets a friendly message.
 */

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPublicLead, type PublicBranch } from "./api";

export function TrialForm({
  slug,
  branches,
}: {
  slug: string;
  branches: PublicBranch[];
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState<string>(
    branches.length === 1 ? branches[0].id : ""
  );
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      setError("Please fill in your name and phone number.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await createPublicLead(slug, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        branch_id: branchId || undefined,
        preferred_date: preferredDate || undefined,
        notes: notes.trim() || undefined,
        intent: "trial",
      });
      setDone(true);
      toast.success(res.message || "Trial booked — the gym will confirm shortly.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-hairline bg-canvas p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            You&apos;re booked in!
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The team will reach out on your phone to confirm your free trial
            visit. See you at the gym.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trial-name">Full name *</Label>
          <Input
            id="trial-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trial-phone">Phone *</Label>
          <Input
            id="trial-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="trial-email">Email (optional)</Label>
          <Input
            id="trial-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trial-date">Preferred date (optional)</Label>
          <Input
            id="trial-date"
            type="date"
            min={today}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
        </div>
      </div>

      {branches.length > 1 && (
        <div className="space-y-1.5">
          <Label>Branch (optional)</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger aria-label="Choose a branch">
              <SelectValue placeholder="Choose a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="trial-notes">Anything we should know? (optional)</Label>
        <Textarea
          id="trial-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Goals, injuries, preferred time of day…"
          rows={3}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? "Booking…" : "Book my free trial"}
      </Button>
    </form>
  );
}
