export interface MemberTag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  created_at: string;
  _count?: {
    assignments: number;
  };
}

export interface MemberTagAssignment {
  id: string;
  member_id: string;
  tag_id: string;
  created_at: string;
  tag: MemberTag;
}

export interface CreateTagPayload {
  name: string;
  color?: string;
  description?: string;
}
