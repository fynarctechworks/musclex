"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Search, UserCheck, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api-client";
import type { Member } from "@/types";

interface CheckinSearchProps {
  branchId: string;
  isPending: boolean;
  onSubmit: (data: { member_id: string; branch_id: string; checkin_method: string }) => void;
}

export function CheckinSearch({ branchId, isPending, onSubmit }: CheckinSearchProps) {
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: results } = useQuery({
    queryKey: ["member-search-checkin", search],
    queryFn: () =>
      apiClient.get<{ data: Member[]; total: number }>(
        `/members?search=${encodeURIComponent(search)}&limit=8`
      ),
    enabled: search.length >= 2,
  });

  const handleSelect = useCallback((member: Member) => {
    setSelectedMember(member);
    setSearch(member.full_name);
  }, []);

  const handleCheckIn = useCallback(() => {
    if (!selectedMember) return;
    onSubmit({
      member_id: selectedMember.id,
      branch_id: branchId,
      checkin_method: "manual",
    });
  }, [selectedMember, branchId, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && selectedMember) {
        e.preventDefault();
        handleCheckIn();
      }
      if (e.key === "Escape") {
        setSelectedMember(null);
        setSearch("");
        inputRef.current?.focus();
      }
    },
    [selectedMember, handleCheckIn]
  );

  const wasPending = useRef(false);
  useEffect(() => {
    // Auto-reset after check-in completes (isPending goes true → false)
    if (wasPending.current && !isPending) {
      setSearch("");
      setSelectedMember(null);
      inputRef.current?.focus();
    }
    wasPending.current = isPending;
  }, [isPending]);

  const members = results?.data ?? [];
  const showDropdown = search.length >= 2 && !selectedMember && members.length > 0;

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search member name, phone, or ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (selectedMember) setSelectedMember(null);
          }}
          className="pl-12 h-14 text-lg bg-muted border-border focus:border-primary"
          autoFocus
        />
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && (
        <div className="rounded-xl border border-border bg-card shadow-lg max-h-[320px] overflow-y-auto">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSelect(m)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border last:border-b-0"
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {m.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.member_code} &bull; {m.phone}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                m.status === "active" ? "bg-green-500/10 text-green-500" :
                m.status === "expiring_soon" ? "bg-yellow-500/10 text-yellow-500" :
                "bg-red-500/10 text-red-500"
              }`}>
                {m.status.replace("_", " ")}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected Member - Big Check-In Button */}
      {selectedMember && (
        <div className="rounded-xl border-2 border-primary bg-card p-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
              {selectedMember.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{selectedMember.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedMember.member_code}</p>
            </div>
          </div>
          <Button
            onClick={handleCheckIn}
            disabled={isPending}
            className="w-full h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <UserCheck className="h-5 w-5 mr-2" />
            )}
            {isPending ? "Checking In..." : "Check In"}
          </Button>
        </div>
      )}

      {/* No results */}
      {search.length >= 2 && !selectedMember && members.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No members found for &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  );
}
