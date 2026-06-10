"use client";

import React, { useEffect, useState } from "react";
import { Download, Loader2, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchBlob } from "@/services/api-client";
import { toast } from "sonner";

/**
 * Generic PDF viewer modal. Fetches a server-rendered PDF (with the user's
 * JWT) as a Blob and feeds the object URL into an <iframe>.
 *
 * Reused across:
 *   - Subscription invoices (settings page)
 *   - Member payment receipts (member detail page)
 *
 * Why a Blob + object URL instead of a direct iframe src:
 *   - Iframes cannot send Authorization headers, but every API call here
 *     requires a JWT. Fetching as a Blob keeps auth in JS.
 *   - Object URLs are revoked on close so the PDF doesn't linger in memory.
 */
export interface PdfViewerModalProps {
  /** Title shown in the modal header — e.g. "Invoice INV-…" or "Receipt RCP-…" */
  title: string;
  /** Subtitle under the title — e.g. "PDF preview" */
  subtitle?: string;
  /** URL relative to the API host (e.g. "/api/v1/payments/<id>/pdf"). */
  previewUrl: string;
  /** URL used when the user clicks the Download button (usually with ?download=1). */
  downloadUrl: string;
  /** Suggested filename when the user downloads. */
  downloadFilename: string;
  onClose: () => void;
}

export function PdfViewerModal({
  title,
  subtitle = "PDF preview",
  previewUrl,
  downloadUrl,
  downloadFilename,
  onClose,
}: PdfViewerModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let revoked = false;
    let createdUrl: string | null = null;
    setLoading(true);
    setError(null);
    fetchBlob(previewUrl)
      .then((blob) => {
        if (revoked) return;
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (revoked) return;
        setError(err.message || "Couldn't load PDF.");
        setLoading(false);
      });
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [previewUrl]);

  // ESC closes the viewer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const blob = await fetchBlob(downloadUrl);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't download PDF.",
      );
    }
  };

  // Append PDF.js view params so the embedded viewer fits-width and hides
  // its toolbar (we provide our own controls). Browsers that don't honor
  // these (older Firefox) simply ignore the hash.
  const iframeSrc = blobUrl ? `${blobUrl}#toolbar=0&navpanes=0&view=FitH` : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-foreground/60 backdrop-blur-sm animate-in fade-in-0"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl h-[92vh] sm:h-[88vh] rounded-xl bg-card border border-border shadow-level-5 flex flex-col overflow-hidden animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {title}
              </p>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download
            </Button>
            <button
              onClick={onClose}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-canvas-soft transition-colors"
              aria-label="Close preview"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </header>
        <div className="flex-1 bg-[#525659] overflow-hidden relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas-soft text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="mt-3 text-sm">Rendering…</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-canvas-soft text-error p-6 text-center">
              <p className="text-sm font-medium">{error}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          ) : iframeSrc ? (
            <iframe
              title={title}
              src={iframeSrc}
              className="absolute inset-0 w-full h-full border-0"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
