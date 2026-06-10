'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMembers } from '@/features/members';
import { useCreateReferral } from '../hooks';

const schema = z.object({
  referred_member_id: z.string().min(1, 'Please select a referred member'),
  reward_type: z.string().optional(),
  reward_value: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referrerMemberId: string;
}

export function CreateReferralDialog({
  open,
  onOpenChange,
  referrerMemberId,
}: CreateReferralDialogProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const createReferral = useCreateReferral(referrerMemberId);

  const { data: membersResponse } = useMembers({
    search: memberSearch || undefined,
    limit: 10,
  });

  const members = (membersResponse?.data ?? []).filter(
    (m) => m.id !== referrerMemberId,
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { referred_member_id: '', reward_type: '', reward_value: '' },
  });

  const selectedMemberId = watch('referred_member_id');
  const selectedMember = members.find((m) => m.id === selectedMemberId);

  const onSubmit = (values: FormValues) => {
    createReferral.mutate(
      {
        referrer_member_id: referrerMemberId,
        referred_member_id: values.referred_member_id,
        reward_type: values.reward_type || undefined,
        reward_value: values.reward_value ? parseFloat(values.reward_value) : undefined,
      },
      {
        onSuccess: () => {
          reset();
          setMemberSearch('');
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Record Referral</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Member Search */}
          <div className="space-y-2">
            <Label className="text-foreground">Referred Member</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            {memberSearch && members.length > 0 && !selectedMember && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setValue('referred_member_id', m.id);
                      setMemberSearch(m.full_name);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft-2 text-primary text-xs font-semibold">
                      {m.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.member_code}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {selectedMember && (
              <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                <span className="font-medium">{selectedMember.full_name}</span>
                <span className="font-mono text-xs text-muted-foreground">{selectedMember.member_code}</span>
                <button
                  type="button"
                  onClick={() => {
                    setValue('referred_member_id', '');
                    setMemberSearch('');
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            )}
            {errors.referred_member_id && (
              <p className="text-xs text-destructive">{errors.referred_member_id.message}</p>
            )}
          </div>

          {/* Reward Type */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Reward Type <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Select
              value={watch('reward_type') || ''}
              onValueChange={(v) => setValue('reward_type', v)}
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Select reward type" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="discount" className="text-foreground focus:bg-muted">Discount</SelectItem>
                <SelectItem value="free_days" className="text-foreground focus:bg-muted">Free Days</SelectItem>
                <SelectItem value="cash" className="text-foreground focus:bg-muted">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reward Value */}
          <div className="space-y-2">
            <Label className="text-foreground">
              Reward Value <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              {...register('reward_value')}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 500 or 30"
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
              disabled={createReferral.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createReferral.isPending ? 'Creating...' : 'Record Referral'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
