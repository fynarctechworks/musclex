"use client";

import React, { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Eye, Trash2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";
import type { MemberDocument } from "@/features/documents";

const TYPE_LABELS: Record<string, string> = {
  medical_clearance: "Medical",
  waiver: "Waiver",
  fitness_assessment: "Assessment",
  id_proof: "ID Proof",
  other: "Other",
};

function ExpiryBadge({ expiresAt }: { expiresAt: string | null }) {
  if (!expiresAt) return <span className="text-muted-foreground">—</span>;

  const days = differenceInDays(parseISO(expiresAt), new Date());

  if (days < 0) {
    return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
  }
  if (days <= 30) {
    return (
      <Badge className="bg-warning/20 text-warning text-[10px]">
        {days}d left
      </Badge>
    );
  }
  return (
    <span className="text-sm text-muted-foreground">
      {format(parseISO(expiresAt), "MMM dd, yyyy")}
    </span>
  );
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentTableProps {
  documents?: MemberDocument[];
  loading?: boolean;
  onView?: (doc: MemberDocument) => void;
  onDelete?: (docId: string) => void;
  deleteLoading?: boolean;
  className?: string;
}

export function DocumentTable({
  documents,
  loading,
  onView,
  onDelete,
  deleteLoading,
  className,
}: DocumentTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-canvas-soft rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-6", className)}>
        <EmptyState
          icon={FileText}
          title="No documents uploaded"
          description="Upload waivers, medical clearances, ID proofs and more."
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["File Name", "Type", "Size", "Uploaded", "Expires", ""].map((h) => (
                <th
                  key={h}
                  className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap px-2 first:pl-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-border last:border-0">
                <td className="py-3 px-2 first:pl-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-foreground truncate max-w-[200px]">
                        {doc.file_name || "Untitled"}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-2">
                  <Badge variant="outline" className="text-xs">
                    {TYPE_LABELS[doc.document_type] || doc.document_type}
                  </Badge>
                </td>
                <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                  {formatFileSize(doc.file_size)}
                </td>
                <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                  {format(parseISO(doc.uploaded_at), "MMM dd, yyyy")}
                </td>
                <td className="py-3 px-2 whitespace-nowrap">
                  <ExpiryBadge expiresAt={doc.expires_at} />
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1">
                    {onView && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onView(doc)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      asChild
                    >
                      <a
                        href={doc.file_url}
                        download={doc.file_name || "document"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(doc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteId && onDelete) {
            onDelete(deleteId);
            setDeleteId(null);
          }
        }}
        loading={deleteLoading}
      />
    </div>
  );
}
