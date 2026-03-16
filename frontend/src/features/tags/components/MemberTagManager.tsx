'use client';

import React, { useState } from 'react';
import { TagBadge } from './TagBadge';
import { TagSelector } from './TagSelector';
import { CreateTagDialog } from './CreateTagDialog';
import { useMemberTags, useAssignTag, useRemoveTag } from '../hooks';

interface MemberTagManagerProps {
  memberId: string;
}

export function MemberTagManager({ memberId }: MemberTagManagerProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: assignments } = useMemberTags(memberId);
  const assignTag = useAssignTag(memberId);
  const removeTag = useRemoveTag(memberId);

  const assignedTagIds = (assignments ?? []).map((a) => a.tag_id);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(assignments ?? []).map((a) => (
        <TagBadge
          key={a.id}
          name={a.tag.name}
          color={a.tag.color}
          onRemove={() => removeTag.mutate(a.tag_id)}
        />
      ))}
      <TagSelector
        assignedTagIds={assignedTagIds}
        onSelect={(tag) => assignTag.mutate(tag.id)}
        onCreateNew={() => setCreateDialogOpen(true)}
      />
      <CreateTagDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
