'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCreateReferralProgram } from '@/features/marketing';

const schema = z.object({
  program_name: z.string().min(1, 'Program name is required'),
  reward_type: z.enum(['discount', 'free_days', 'cash', 'free_class']),
  reward_value: z.string().min(1, 'Reward value is required'),
  min_referrals: z.string().optional(),
  max_rewards: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProgramDialog({ open, onOpenChange }: CreateProgramDialogProps) {
  const createProgram = useCreateReferralProgram();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      program_name: '',
      reward_type: 'discount',
      reward_value: '',
      min_referrals: '1',
      max_rewards: '',
      start_date: '',
      end_date: '',
    },
  });

  const onSubmit = (values: FormValues) => {
    createProgram.mutate(
      {
        program_name: values.program_name,
        reward_type: values.reward_type,
        reward_value: parseFloat(values.reward_value),
        min_referrals: values.min_referrals ? parseInt(values.min_referrals) : undefined,
        max_rewards: values.max_rewards ? parseInt(values.max_rewards) : undefined,
        start_date: values.start_date || undefined,
        end_date: values.end_date || undefined,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">Create Referral Program</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Program Name</Label>
            <Input
              {...register('program_name')}
              placeholder="e.g. Refer & Earn 2026"
              className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
            />
            {errors.program_name && (
              <p className="text-xs text-destructive">{errors.program_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Reward Type</Label>
              <Select
                value={watch('reward_type')}
                onValueChange={(v) =>
                  setValue('reward_type', v as FormValues['reward_type'])
                }
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="discount" className="text-foreground focus:bg-muted">Discount (%)</SelectItem>
                  <SelectItem value="free_days" className="text-foreground focus:bg-muted">Free Days</SelectItem>
                  <SelectItem value="cash" className="text-foreground focus:bg-muted">Cash (₹)</SelectItem>
                  <SelectItem value="free_class" className="text-foreground focus:bg-muted">Free Class</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Reward Value</Label>
              <Input
                {...register('reward_value')}
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
              {errors.reward_value && (
                <p className="text-xs text-destructive">{errors.reward_value.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Min Referrals</Label>
              <Input
                {...register('min_referrals')}
                type="number"
                min="1"
                placeholder="1"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">
                Max Rewards <span className="text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                {...register('max_rewards')}
                type="number"
                min="1"
                placeholder="Unlimited"
                className="bg-muted border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">
                Start Date <span className="text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                {...register('start_date')}
                type="date"
                className="bg-muted border-border text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">
                End Date <span className="text-muted-foreground">(opt.)</span>
              </Label>
              <Input
                {...register('end_date')}
                type="date"
                className="bg-muted border-border text-foreground"
              />
            </div>
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
              disabled={createProgram.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {createProgram.isPending ? 'Creating...' : 'Create Program'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
