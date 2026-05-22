"use client";

import React from "react";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import type { Member } from "@/types";
import Link from "next/link";
import { statusToVariant, statusLabels } from "./member-utils";
import { MemberTagManager } from "@/features/tags";

interface MemberHeaderProps {
  member: Member;
  backHref: string;
}

export function MemberHeader({ member, backHref }: MemberHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Link href={backHref}>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </Link>
      <div className="flex items-center gap-4">
        {member.profile_photo_url ? (
          <Image
            src={member.profile_photo_url}
            alt={member.full_name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-full object-cover border-2 border-border"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas-soft-2 text-primary text-lg font-semibold">
            {member.full_name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
        )}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-foreground">
              {member.full_name}
            </h1>
            <StatusBadge
              variant={statusToVariant[member.status]}
              label={statusLabels[member.status]}
            />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {member.member_code}
          </p>
          <div className="mt-1.5">
            <MemberTagManager memberId={member.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
