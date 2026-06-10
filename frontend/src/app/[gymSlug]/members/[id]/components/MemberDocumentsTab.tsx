"use client";

import React, { useState, useMemo } from "react";
import { Plus, Search, AlertTriangle } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "@/features/documents";
import type { MemberDocument, CreateDocumentPayload } from "@/features/documents";
import {
  DocumentTable,
  UploadDocumentDialog,
  DocumentViewer,
} from "@/features/documents/components";

interface MemberDocumentsTabProps {
  memberId: string;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "waiver", label: "Waiver" },
  { value: "medical_clearance", label: "Medical" },
  { value: "fitness_assessment", label: "Assessment" },
  { value: "id_proof", label: "ID Proof" },
  { value: "other", label: "Other" },
] as const;

export function MemberDocumentsTab({ memberId }: MemberDocumentsTabProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<MemberDocument | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: documents, isLoading } = useDocuments(memberId);
  const uploadMutation = useUploadDocument(memberId);
  const deleteMutation = useDeleteDocument(memberId);

  // Expiring documents alert
  const expiringCount = useMemo(() => {
    if (!documents) return 0;
    return documents.filter((d) => {
      if (!d.expires_at) return false;
      const days = differenceInDays(parseISO(d.expires_at), new Date());
      return days >= 0 && days <= 30;
    }).length;
  }, [documents]);

  // Filtered documents
  const filtered = useMemo(() => {
    if (!documents) return undefined;
    let result = documents;
    if (typeFilter !== "all") {
      result = result.filter((d) => d.document_type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.file_name || "").toLowerCase().includes(q) ||
          (d.description || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, typeFilter, search]);

  return (
    <div className="space-y-4">
      {/* Expiring documents alert */}
      {expiringCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-sm text-warning-deep">
            {expiringCount} document{expiringCount > 1 ? "s" : ""} expiring within 30 days
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-muted border-border"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px] bg-muted border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Table */}
      <DocumentTable
        documents={filtered}
        loading={isLoading}
        onView={(doc) => setViewDoc(doc)}
        onDelete={(id) => deleteMutation.mutate(id)}
        deleteLoading={deleteMutation.isPending}
      />

      {/* Dialogs */}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSubmit={(data) =>
          uploadMutation.mutate(data as CreateDocumentPayload, {
            onSuccess: () => setUploadOpen(false),
          })
        }
        loading={uploadMutation.isPending}
      />

      <DocumentViewer
        open={!!viewDoc}
        onOpenChange={(open) => !open && setViewDoc(null)}
        document={viewDoc}
      />
    </div>
  );
}
