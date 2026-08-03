"use client";

import { Suspense, lazy, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QrCode, Printer, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

const QRCodeSVG = lazy(() =>
  import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
);

interface QrTokenResponse {
  member_id: string;
  member_code: string;
  qr_version: number;
  token: string;
  kind: "static";
}

interface MemberIdCardProps {
  memberId: string;
  memberName: string;
  memberCode: string;
  gymName?: string;
  isActive: boolean;
  canRegenerate: boolean;
}

/**
 * Printable member ID card backed by the SIGNED QR token.
 *
 * The old card rendered `member.qr_code` — the raw DB string — which is not
 * what the scanner verifies. This fetches the HMAC-signed token from
 * `/check-ins/qr/members/:id` so the printed card matches what the member app
 * shows and what the turnstile accepts, and it honours `qr_version` so
 * regenerating actually invalidates old cards.
 */
export function MemberIdCard({
  memberId,
  memberName,
  memberCode,
  gymName,
  isActive,
  canRegenerate,
}: MemberIdCardProps) {
  const qc = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [confirmingRegen, setConfirmingRegen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["member-qr", memberId],
    queryFn: () => apiClient.get<QrTokenResponse>(`/check-ins/qr/members/${memberId}`),
  });

  const regenerate = useMutation({
    mutationFn: () =>
      apiClient.post<QrTokenResponse & { message: string }>(
        `/check-ins/qr/members/${memberId}/regenerate`,
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["member-qr", memberId] });
      setConfirmingRegen(false);
      toast.success(res.message ?? "QR regenerated — old cards no longer work.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /** Print just the card, via a scoped print stylesheet on a cloned node. */
  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open("", "_blank", "width=420,height=620");
    if (!win) {
      toast.error("Allow pop-ups to print the ID card.");
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Member ID — ${memberCode}</title>
      <style>
        body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px;
               display: flex; justify-content: center; }
        .card { width: 320px; border: 1px solid #d4d4d8; border-radius: 12px; padding: 20px;
                text-align: center; }
        .gym { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #71717a; }
        .name { font-size: 18px; font-weight: 600; margin: 8px 0 2px; }
        .code { font-family: ui-monospace, monospace; font-size: 12px; color: #71717a; }
        svg { margin: 16px auto 8px; display: block; }
        .hint { font-size: 11px; color: #a1a1aa; margin-top: 8px; }
        @media print { body { padding: 0; } }
      </style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center gap-4">
      <div className="flex items-center gap-2 w-full">
        <QrCode className="h-4 w-4 text-primary" />
        <h3 className="text-base font-semibold text-foreground">Member ID Card</h3>
      </div>

      {isLoading ? (
        <div className="h-40 w-40 bg-muted animate-pulse rounded" />
      ) : isError || !data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Couldn&apos;t load the signed QR token.
        </p>
      ) : (
        <>
          {/* This subtree is what gets printed */}
          <div ref={printRef}>
            <div className="card bg-canvas p-4 rounded-lg text-center">
              {gymName && <p className="gym">{gymName}</p>}
              <p className="name">{memberName}</p>
              <p className="code">{memberCode}</p>
              <Suspense
                fallback={<div className="h-40 w-40 bg-muted animate-pulse rounded mx-auto" />}
              >
                <QRCodeSVG value={data.token} size={160} level="M" includeMargin={false} />
              </Suspense>
              <p className="hint">Scan at the front desk to check in</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {isActive ? (
                <span className="text-success font-medium">✓ Active — scan to check in</span>
              ) : (
                <span className="text-warning font-medium">⚠ No active plan — check-in blocked</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Signed token · version {data.qr_version}
            </p>
          </div>

          <div className="flex gap-2 w-full">
            <Button variant="outline" size="sm" className="flex-1" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5 mr-1.5" /> Print card
            </Button>
            {canRegenerate && (
              <Button
                variant={confirmingRegen ? "destructive" : "outline"}
                size="sm"
                className="flex-1"
                disabled={regenerate.isPending}
                onClick={() =>
                  confirmingRegen ? regenerate.mutate() : setConfirmingRegen(true)
                }
              >
                {regenerate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                )}
                {confirmingRegen ? "Confirm — invalidates old cards" : "Regenerate"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
