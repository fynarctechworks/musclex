"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MemberDocument } from "@/features/documents";

const TYPE_LABELS: Record<string, string> = {
  medical_clearance: "Medical Clearance",
  waiver: "Liability Waiver",
  fitness_assessment: "Fitness Assessment",
  id_proof: "ID Proof",
  other: "Other",
};

function isImage(url: string, name: string | null): boolean {
  const lower = (name || url).toLowerCase();
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp");
}

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: MemberDocument | null;
}

export function DocumentViewer({ open, onOpenChange, document: doc }: DocumentViewerProps) {
  if (!doc) return null;

  const isImg = isImage(doc.file_url, doc.file_name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{doc.file_name || "Document"}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {TYPE_LABELS[doc.document_type] || doc.document_type}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Uploaded {format(parseISO(doc.uploaded_at), "MMM dd, yyyy")}
                </span>
              </div>
              {doc.description && (
                <p className="text-sm text-muted-foreground mt-1">{doc.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-4">
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a
                  href={doc.file_url}
                  download={doc.file_name || "document"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 pb-6">
          {isImg ? (
            <div className="flex items-center justify-center bg-muted rounded-lg overflow-hidden max-h-[60vh]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.file_url}
                alt={doc.file_name || "Document preview"}
                className="max-w-full max-h-[60vh] object-contain"
              />
            </div>
          ) : (
            <div className="bg-muted rounded-lg overflow-hidden" style={{ height: "60vh" }}>
              <iframe
                src={doc.file_url}
                title={doc.file_name || "Document preview"}
                className="w-full h-full border-0"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
