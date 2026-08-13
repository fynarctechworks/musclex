'use client';

import React, { useEffect, useState } from 'react';
import { CalendarDays, Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useMembers } from '@/features/members';
import type { Member } from '@/types';
import { useAssignDietPlan, useAssignWorkoutPlan } from '../hooks';
import type { DietPlan, WorkoutPlan } from '../types';

// ── Shared member picker (same pattern as CreateReferralDialog) ──

function MemberPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: Member | null;
  onSelect: (member: Member) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: membersResponse } = useMembers({
    search: search || undefined,
    limit: 10,
  });
  const members = membersResponse?.data ?? [];

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
        <span className="font-medium">{selected.full_name}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {selected.member_code}
        </span>
        <button
          type="button"
          onClick={() => {
            onClear();
            setSearch('');
          }}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {search && members.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft-2 text-primary text-xs font-semibold">
                {m.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="text-left">
                <p className="font-medium">{m.full_name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {m.member_code}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Assign workout plan (member + one or more dates) ────────────

interface AssignWorkoutPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: WorkoutPlan | null;
}

export function AssignWorkoutPlanDialog({
  open,
  onOpenChange,
  plan,
}: AssignWorkoutPlanDialogProps) {
  const assignMutation = useAssignWorkoutPlan();
  const [member, setMember] = useState<Member | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [dates, setDates] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setMember(null);
      setDateInput('');
      setDates([]);
    }
  }, [open]);

  const addDate = () => {
    if (!dateInput) return;
    if (dates.includes(dateInput)) {
      toast.error('Date already added');
      return;
    }
    setDates([...dates, dateInput].sort());
    setDateInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (!member) {
      toast.error('Select a member');
      return;
    }
    if (dates.length === 0) {
      toast.error('Add at least one date');
      return;
    }
    assignMutation.mutate(
      { id: plan.id, data: { member_id: member.id, dates } },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Assign Workout Plan</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Schedule &quot;{plan?.title}&quot; for a member on one or more dates.
            Dates already assigned are skipped.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Member</Label>
            <MemberPicker
              selected={member}
              onSelect={setMember}
              onClear={() => setMember(null)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Scheduled Dates</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addDate}
                disabled={!dateInput}
              >
                <CalendarDays className="mr-1.5 h-4 w-4" /> Add
              </Button>
            </div>
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dates.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-full bg-canvas-soft-2 px-2.5 py-1 text-xs font-medium text-foreground"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => setDates(dates.filter((x) => x !== d))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${d}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign diet plan (member + starts_on / ends_on / notes) ─────

interface AssignDietPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: DietPlan | null;
}

export function AssignDietPlanDialog({
  open,
  onOpenChange,
  plan,
}: AssignDietPlanDialogProps) {
  const assignMutation = useAssignDietPlan();
  const [member, setMember] = useState<Member | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setMember(null);
      setStartsOn(new Date().toISOString().slice(0, 10));
      setEndsOn('');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    if (!member) {
      toast.error('Select a member');
      return;
    }
    if (!startsOn) {
      toast.error('Start date is required');
      return;
    }
    assignMutation.mutate(
      {
        id: plan.id,
        data: {
          member_id: member.id,
          starts_on: startsOn,
          ends_on: endsOn || undefined,
          notes: notes.trim() || undefined,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Assign Diet Plan</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Assign &quot;{plan?.title}&quot; to a member. If the member already
            has an active diet plan, it will be cancelled and replaced by this
            one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Member</Label>
            <MemberPicker
              selected={member}
              onSelect={setMember}
              onClear={() => setMember(null)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground">Starts On</Label>
              <Input
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">
                Ends On <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="date"
                value={endsOn}
                min={startsOn || undefined}
                onChange={(e) => setEndsOn(e.target.value)}
                className="bg-muted border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the member should know"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {assignMutation.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
