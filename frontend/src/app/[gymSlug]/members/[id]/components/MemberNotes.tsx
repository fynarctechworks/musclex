"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSaveMemberNotes } from "@/features/members";

interface MemberNotesProps {
  memberId: string;
  initialNotes: string;
}

export function MemberNotes({ memberId, initialNotes }: MemberNotesProps) {
  const [notes, setNotes] = useState<string | null>(null);
  const [edited, setEdited] = useState(false);
  const notesMutation = useSaveMemberNotes(memberId);

  const currentNotes = notes ?? initialNotes;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-foreground">Notes</h3>
        {edited && (
          <Button
            onClick={() => notesMutation.mutate(currentNotes)}
            disabled={notesMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="mr-2 h-4 w-4" />
            {notesMutation.isPending ? "Saving..." : "Save Notes"}
          </Button>
        )}
      </div>
      <Textarea
        value={currentNotes}
        onChange={(e) => {
          setNotes(e.target.value);
          setEdited(true);
        }}
        placeholder="Add notes about this member..."
        className="min-h-[200px] bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
      />
    </div>
  );
}
