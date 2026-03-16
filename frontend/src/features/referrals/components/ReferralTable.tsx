'use client';

import React from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, CheckCircle, XCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ReferralStatusBadge } from './ReferralStatusBadge';
import { useUpdateReferralStatus } from '../hooks';
import type { MemberReferral } from '../types';

interface ReferralTableProps {
  referrals: MemberReferral[];
  memberId: string;
  /** Which perspective: show who they referred, or who referred them */
  perspective: 'given' | 'received';
}

export function ReferralTable({ referrals, memberId, perspective }: ReferralTableProps) {
  const updateStatus = useUpdateReferralStatus(memberId);

  if (referrals.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No referrals found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-3 pr-4 font-medium text-muted-foreground">
              {perspective === 'given' ? 'Referred Member' : 'Referred By'}
            </th>
            <th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th>
            <th className="pb-3 pr-4 font-medium text-muted-foreground">Reward</th>
            <th className="pb-3 pr-4 font-medium text-muted-foreground">Date</th>
            <th className="pb-3 font-medium text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {referrals.map((ref) => {
            const person = perspective === 'given' ? ref.referred : ref.referrer;
            return (
              <tr key={ref.id} className="hover:bg-muted/50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-semibold">
                      {person?.full_name
                        ?.split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2) ?? '??'}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{person?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs font-mono text-muted-foreground">{person?.member_code ?? ''}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <ReferralStatusBadge status={ref.reward_status} />
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {ref.reward_type ? (
                    <span>
                      {ref.reward_type === 'cash' && '₹'}
                      {ref.reward_value ?? 0}
                      {ref.reward_type === 'free_days' && ' days'}
                      {ref.reward_type === 'discount' && '% off'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-muted-foreground">
                  {format(new Date(ref.created_at), 'dd MMM yyyy')}
                </td>
                <td className="py-3">
                  {ref.reward_status === 'pending' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-border">
                        <DropdownMenuItem
                          onClick={() =>
                            updateStatus.mutate({
                              referralId: ref.id,
                              data: { reward_status: 'awarded' },
                            })
                          }
                          className="text-foreground focus:bg-muted"
                        >
                          <CheckCircle className="mr-2 h-4 w-4 text-success" />
                          Mark Awarded
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            updateStatus.mutate({
                              referralId: ref.id,
                              data: { reward_status: 'expired' },
                            })
                          }
                          className="text-foreground focus:bg-muted"
                        >
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                          Mark Expired
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
