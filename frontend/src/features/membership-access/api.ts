import { apiClient } from '@/services/api-client';

export interface MembershipBranchAccess {
  id: string;
  membership_id: string;
  branch_id: string;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
  branch?: { id: string; name: string; city: string | null };
}

export interface MemberTransferLog {
  id: string;
  member_id: string;
  from_branch_id: string;
  to_branch_id: string;
  reason: string | null;
  transferred_by: string | null;
  created_at: string;
}

export interface TransferMemberDto {
  to_branch_id: string;
  reason?: string;
}

export interface GrantTemporaryAccessDto {
  membership_id: string;
  branch_ids: string[];
  expires_at: string;
  reason?: string;
}

export const membershipAccessApi = {
  // Phase 4 — branch transfer
  transferMember: (memberId: string, dto: TransferMemberDto) =>
    apiClient.post<{
      member: { id: string; full_name: string; branch_id: string; member_code: string };
      transfer_log_id: string;
      memberships_extended: number;
    }>(`/members/${memberId}/transfer`, dto),

  listTransfers: (memberId: string) =>
    apiClient.get<MemberTransferLog[]>(`/members/${memberId}/transfers`),

  // Phase 5 — temporary access
  grantTemporary: (memberId: string, dto: GrantTemporaryAccessDto) =>
    apiClient.post<{ grants: MembershipBranchAccess[]; expires_at: string }>(
      `/members/${memberId}/temporary-access`,
      dto,
    ),

  listAccessGrants: (membershipId: string) =>
    apiClient.get<MembershipBranchAccess[]>(
      `/members/memberships/${membershipId}/access`,
    ),

  revokeAccess: (membershipId: string, branchId: string) =>
    apiClient.delete<{ revoked: number }>(
      `/members/memberships/${membershipId}/access/${branchId}`,
    ),
};
