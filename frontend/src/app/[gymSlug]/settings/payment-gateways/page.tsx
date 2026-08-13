"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { FormInput, AccessDenied, LoadingSkeleton } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreditCard, Info, Check } from "lucide-react";
import { toast } from "sonner";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { gatewaysApi } from "@/features/payments/api";

// ── Types ──────────────────────────────────────────────────
// GET /payment-gateways strips secrets: it returns has_* flags (and, on
// newer backends, masked key strings). Tolerate both shapes.
interface GatewayRow {
  id: string;
  gateway_name: string;
  is_active: boolean;
  is_test_mode: boolean;
  api_key?: string | null;
  has_api_key?: boolean;
  has_secret_key?: boolean;
  has_webhook_secret?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface GatewayMeta {
  name: "razorpay" | "stripe";
  label: string;
  description: string;
  keyLabel: string;
  keyPlaceholder: string;
  secretLabel: string;
}

const GATEWAYS: GatewayMeta[] = [
  {
    name: "razorpay",
    label: "Razorpay",
    description: "UPI, cards and netbanking for members in India",
    keyLabel: "Key ID",
    keyPlaceholder: "rzp_live_xxxxxxxxxx",
    secretLabel: "Key secret",
  },
  {
    name: "stripe",
    label: "Stripe",
    description: "Card payments for members worldwide",
    keyLabel: "Publishable key",
    keyPlaceholder: "pk_live_xxxxxxxxxx",
    secretLabel: "Secret key",
  },
];

const GATEWAYS_QUERY_KEY = ["payment-gateways"] as const;

function maskedKey(row: GatewayRow): string {
  if (row.api_key) return row.api_key;
  return row.has_api_key !== false ? "••••••••" : "—";
}

export default function PaymentGatewaysPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: GATEWAYS_QUERY_KEY,
    queryFn: () => gatewaysApi.list() as Promise<GatewayRow[]>,
  });

  // Dialog state — `row` present means edit mode.
  const [dialog, setDialog] = useState<{ meta: GatewayMeta; row?: GatewayRow } | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [testMode, setTestMode] = useState(true);

  const invalidate = () => qc.invalidateQueries({ queryKey: GATEWAYS_QUERY_KEY });

  const create = useMutation({
    mutationFn: gatewaysApi.create,
    onSuccess: () => {
      invalidate();
      toast.success("Gateway configured");
      setDialog(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      gatewaysApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success("Gateway updated");
      setDialog(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      gatewaysApi.update(id, { is_active }),
    onSuccess: (_data, { is_active }) => {
      invalidate();
      toast.success(is_active ? "Gateway activated" : "Gateway deactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openDialog = (meta: GatewayMeta, row?: GatewayRow) => {
    setApiKey("");
    setSecretKey("");
    setWebhookSecret("");
    setTestMode(row ? row.is_test_mode : true);
    setDialog({ meta, row });
  };

  const saving = create.isPending || update.isPending;
  const canSubmit = dialog
    ? dialog.row
      ? true // edit: blank secret fields keep current values
      : apiKey.trim() !== "" && secretKey.trim() !== ""
    : false;

  const submitDialog = () => {
    if (!dialog) return;
    const { meta, row } = dialog;
    if (row) {
      const data: Record<string, unknown> = { is_test_mode: testMode };
      if (apiKey.trim()) data.api_key = apiKey.trim();
      if (secretKey.trim()) data.secret_key = secretKey.trim();
      if (webhookSecret.trim()) data.webhook_secret = webhookSecret.trim();
      update.mutate({ id: row.id, data });
    } else {
      create.mutate({
        gateway_name: meta.name,
        api_key: apiKey.trim(),
        secret_key: secretKey.trim(),
        webhook_secret: webhookSecret.trim() || undefined,
        is_test_mode: testMode,
      });
    }
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Payment Gateways</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the gateway that collects your members&apos; payments
        </p>
      </div>

      {/* ── Explainer callout ─────────────────────────────── */}
      <div className="bg-link-soft border border-link/20 rounded-lg p-4 mb-6 flex items-start gap-3">
        <Info className="w-4 h-4 text-link mt-0.5 shrink-0" />
        <p className="text-sm text-foreground">
          Connect your own Razorpay or Stripe account — member payments are collected
          directly into it. Leave unconfigured to use the platform default.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LoadingSkeleton className="h-44" />
          <LoadingSkeleton className="h-44" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {GATEWAYS.map((meta) => {
            const row = rows.find((r) => r.gateway_name === meta.name);

            return (
              <div
                key={meta.name}
                className="bg-card border border-border rounded-lg p-5"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-muted rounded-lg shrink-0">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          {meta.label}
                        </h3>
                        {row &&
                          (row.is_test_mode ? (
                            <Badge variant="warning" size="sm">Test mode</Badge>
                          ) : (
                            <Badge variant="success" size="sm">Live</Badge>
                          ))}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  {row && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={row.is_active}
                        disabled={toggleActive.isPending}
                        onCheckedChange={(is_active) =>
                          toggleActive.mutate({ id: row.id, is_active })
                        }
                        aria-label={`${meta.label} active`}
                      />
                    </div>
                  )}
                </div>

                {row ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        {meta.keyLabel}:{" "}
                        <span className="font-mono text-foreground">{maskedKey(row)}</span>
                      </span>
                    </div>
                    <button
                      onClick={() => openDialog(meta, row)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors"
                    >
                      Edit configuration
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Not configured — payments fall back to the platform default account.
                    </p>
                    <button
                      onClick={() => openDialog(meta)}
                      className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      Configure
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Configure / Edit dialog ───────────────────────── */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground text-[15px]">
                  {dialog.row
                    ? `Edit ${dialog.meta.label} configuration`
                    : `Configure ${dialog.meta.label}`}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-[13px]">
                  {dialog.row
                    ? "Leave a credential blank to keep its current value."
                    : "Enter the API credentials from your gateway dashboard."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <FormInput
                  label={dialog.meta.keyLabel}
                  placeholder={dialog.meta.keyPlaceholder}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <FormInput
                  label={dialog.meta.secretLabel}
                  type="password"
                  placeholder="••••••••"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                <FormInput
                  label="Webhook secret (optional)"
                  type="password"
                  placeholder="••••••••"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
                <div className="flex items-center justify-between border border-border rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm text-foreground">Test mode</p>
                    <p className="text-xs text-muted-foreground">
                      Use sandbox credentials — no real charges
                    </p>
                  </div>
                  <Switch
                    checked={testMode}
                    onCheckedChange={setTestMode}
                    aria-label="Test mode"
                  />
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Webhook events still use the platform webhook configuration.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={submitDialog}
                  disabled={!canSubmit || saving}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : dialog.row ? "Save changes" : "Save & Configure"}
                </button>
                <button
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
