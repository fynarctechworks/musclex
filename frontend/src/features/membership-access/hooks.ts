import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  membershipAccessApi,
  type GrantTemporaryAccessDto,
  type TransferMemberDto,
} from './api';
import { queryKeys } from '@/services/query-client';

const accessKeys = {
  transfers: (memberId: string) => ['member-transfers', memberId] as const,
  grants: (membershipId: string) => ['membership-access', membershipId] as const,
};

export function useTransferMember(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: TransferMemberDto) =>
      membershipAccessApi.transferMember(memberId, dto),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.members.detail(memberId) });
      qc.invalidateQueries({ queryKey: queryKeys.members.all });
      qc.invalidateQueries({ queryKey: accessKeys.transfers(memberId) });
      const extended = result.memberships_extended;
      toast.success(
        extended > 0
          ? `Member transferred. ${extended} active membership(s) extended to the new branch.`
          : 'Member transferred.',
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTransferHistory(memberId: string) {
  return useQuery({
    queryKey: accessKeys.transfers(memberId),
    queryFn: () => membershipAccessApi.listTransfers(memberId),
    enabled: !!memberId,
  });
}

export function useAccessGrants(membershipId: string | null) {
  return useQuery({
    queryKey: accessKeys.grants(membershipId ?? ''),
    queryFn: () => membershipAccessApi.listAccessGrants(membershipId!),
    enabled: !!membershipId,
  });
}

export function useGrantTemporaryAccess(memberId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: GrantTemporaryAccessDto) =>
      membershipAccessApi.grantTemporary(memberId, dto),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: accessKeys.grants(variables.membership_id) });
      toast.success('Temporary access granted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeAccess(membershipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (branchId: string) =>
      membershipAccessApi.revokeAccess(membershipId, branchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: accessKeys.grants(membershipId) });
      toast.success('Access revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
