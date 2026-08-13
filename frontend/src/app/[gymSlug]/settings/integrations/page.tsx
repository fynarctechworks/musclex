"use client";

import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import {
  FormInput,
  FormTextarea,
  AccessDenied,
  LoadingSkeleton,
  ConfirmDialog,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Mail,
  MessageSquare,
  Phone,
  Bot,
  Check,
  AlertCircle,
  Info,
} from "lucide-react";
import { useRequirePermission } from "@/hooks/use-require-permission";
import {
  useIntegrations,
  useConnectIntegration,
  useUpdateIntegration,
  useToggleIntegration,
  useTestIntegration,
  useDisconnectIntegration,
} from "@/features/integrations/hooks";
import type { IntegrationRow, IntegrationStatus } from "@/features/integrations/api";

// ── Local catalog metadata (icons / labels / field definitions) ──
// Field keys match the backend catalog's config_fields so services that
// read the stored config find the values they expect.

interface CatalogField {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "password" | "textarea";
  optional?: boolean;
}

interface CatalogEntry {
  provider: string;
  name: string;
  description: string;
  icon: typeof CreditCard;
  category: string;
  fields: CatalogField[];
  hint?: string;
}

const catalog: CatalogEntry[] = [
  {
    provider: "razorpay",
    name: "Razorpay",
    description: "Accept payments via UPI, cards, netbanking (India)",
    icon: CreditCard,
    category: "Payments",
    fields: [
      { key: "api_key", label: "Key ID", placeholder: "rzp_live_xxxxxxxxxx" },
      { key: "secret_key", label: "Key Secret", placeholder: "••••••••", type: "password" },
      {
        key: "webhook_secret",
        label: "Webhook Secret",
        placeholder: "••••••••",
        type: "password",
        optional: true,
      },
    ],
  },
  {
    provider: "resend",
    name: "Resend",
    description: "Transactional and marketing emails",
    icon: Mail,
    category: "Messaging",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "re_xxxxxxxxxx", type: "password" },
      { key: "from_email", label: "From Email", placeholder: "noreply@yourgym.com" },
    ],
  },
  {
    provider: "twilio",
    name: "Twilio",
    description: "SMS notifications and alerts",
    icon: Phone,
    category: "Messaging",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxxxx" },
      { key: "auth_token", label: "Auth Token", placeholder: "••••••••", type: "password" },
      { key: "from_number", label: "Phone Number", placeholder: "+1234567890" },
    ],
  },
  {
    provider: "whatsapp",
    name: "Meta WhatsApp",
    description: "WhatsApp Business messaging via Cloud API",
    icon: MessageSquare,
    category: "Messaging",
    fields: [
      { key: "phone_number_id", label: "Phone Number ID", placeholder: "1234567890" },
      { key: "access_token", label: "Access Token", placeholder: "••••••••", type: "password" },
      {
        key: "auto_reply_message",
        label: "Auto-reply message (optional)",
        placeholder: "Thanks for reaching out! Our team will get back to you shortly.",
        type: "textarea",
        optional: true,
      },
    ],
    hint: "Once connected, inbound messages appear in the WhatsApp Inbox and your Phone Number ID is used to route webhooks.",
  },
  {
    provider: "anthropic",
    name: "Anthropic Claude",
    description: "AI-powered advisor and daily briefings",
    icon: Bot,
    category: "AI",
    fields: [
      { key: "api_key", label: "API Key", placeholder: "sk-ant-xxxxxxxxxx", type: "password" },
    ],
  },
];

const categories = Array.from(new Set(catalog.map((c) => c.category)));

function StatusBadge({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case "active":
      return <Badge variant="success" size="sm">Active</Badge>;
    case "error":
      return <Badge variant="destructive" size="sm">Error</Badge>;
    case "pending_setup":
      return <Badge variant="warning" size="sm">Pending setup</Badge>;
    default:
      return <Badge variant="default" size="sm">Inactive</Badge>;
  }
}

export default function IntegrationsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");

  const { data: rows = [], isLoading } = useIntegrations();
  const byProvider = useMemo(() => {
    const map = new Map<string, IntegrationRow>();
    for (const row of rows) map.set(row.provider, row);
    return map;
  }, [rows]);

  const connect = useConnectIntegration();
  const update = useUpdateIntegration();
  const toggle = useToggleIntegration();
  const test = useTestIntegration();
  const disconnect = useDisconnectIntegration();

  // Connect/Edit dialog state — `row` present means edit mode.
  const [dialog, setDialog] = useState<{ entry: CatalogEntry; row?: IntegrationRow } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationRow | null>(null);

  const openDialog = (entry: CatalogEntry, row?: IntegrationRow) => {
    setValues({});
    setDialog({ entry, row });
  };

  const requiredFilled = dialog
    ? dialog.entry.fields.every((f) => f.optional || (values[f.key] ?? "").trim() !== "")
    : false;

  const submitDialog = () => {
    if (!dialog) return;
    const { entry, row } = dialog;
    const config: Record<string, string> = {};
    for (const field of entry.fields) {
      const v = (values[field.key] ?? "").trim();
      if (v !== "") config[field.key] = v;
    }
    if (row) {
      update.mutate(
        { id: row.id, data: { config } },
        { onSuccess: () => setDialog(null) },
      );
    } else {
      connect.mutate(
        { provider: entry.provider, display_name: entry.name, config },
        { onSuccess: () => setDialog(null) },
      );
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
        <h1 className="text-xl font-semibold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect third-party services to your studio
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <LoadingSkeleton className="h-20" />
          <LoadingSkeleton className="h-20" />
          <LoadingSkeleton className="h-20" />
        </div>
      ) : (
        categories.map((category) => (
          <div key={category} className="mb-6">
            <h2 className="text-base font-semibold text-foreground mb-3">{category}</h2>
            <div className="space-y-3">
              {catalog
                .filter((c) => c.category === category)
                .map((entry) => {
                  const Icon = entry.icon;
                  const row = byProvider.get(entry.provider);

                  return (
                    <div
                      key={entry.provider}
                      className="bg-card border border-border rounded-lg overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-4 p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-muted rounded-lg shrink-0">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-foreground">
                                {entry.name}
                              </h3>
                              {row && <StatusBadge status={row.status} />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.description}
                            </p>
                          </div>
                        </div>

                        {row ? (
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Check className="w-3 h-3" /> Connected
                            </span>
                            <Switch
                              checked={row.is_enabled}
                              disabled={toggle.isPending}
                              onCheckedChange={(enabled) =>
                                toggle.mutate({ id: row.id, enabled })
                              }
                              aria-label={`${entry.name} enabled`}
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => openDialog(entry)}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
                          >
                            Connect
                          </button>
                        )}
                      </div>

                      {row && (
                        <div className="border-t border-border px-4 py-3 space-y-2">
                          {row.status === "error" && row.error_message && (
                            <p className="flex items-start gap-1.5 text-xs text-error">
                              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              {row.error_message}
                            </p>
                          )}
                          {entry.hint && (
                            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                              {entry.hint}
                            </p>
                          )}
                          {row.last_synced_at && (
                            <p className="text-xs text-muted-foreground">
                              Last synced {new Date(row.last_synced_at).toLocaleString()}
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => openDialog(entry, row)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground border border-border hover:bg-muted transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => test.mutate(row.id)}
                              disabled={test.isPending}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-foreground border border-border hover:bg-muted transition-colors disabled:opacity-50"
                            >
                              {test.isPending ? "Testing..." : "Test"}
                            </button>
                            <button
                              onClick={() => setDisconnectTarget(row)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-error border border-error/30 hover:bg-error/10 transition-colors"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))
      )}

      {/* ── Connect / Edit dialog ─────────────────────────── */}
      <Dialog open={!!dialog} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-md">
          {dialog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground text-[15px]">
                  {dialog.row ? `Edit ${dialog.entry.name}` : `Connect ${dialog.entry.name}`}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-[13px]">
                  {dialog.row
                    ? "Stored credentials are masked and cannot be partially kept — re-enter all credentials to update."
                    : dialog.entry.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {dialog.entry.fields.map((field) =>
                  field.type === "textarea" ? (
                    <FormTextarea
                      key={field.key}
                      label={field.label}
                      placeholder={field.placeholder}
                      rows={3}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <FormInput
                      key={field.key}
                      label={field.optional ? `${field.label} (optional)` : field.label}
                      type={field.type || "text"}
                      placeholder={field.placeholder}
                      value={values[field.key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  ),
                )}
                {dialog.entry.hint && (
                  <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {dialog.entry.hint}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={submitDialog}
                  disabled={!requiredFilled || connect.isPending || update.isPending}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {connect.isPending || update.isPending
                    ? "Saving..."
                    : dialog.row
                      ? "Update Credentials"
                      : "Save & Connect"}
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

      {/* ── Disconnect confirmation ───────────────────────── */}
      <ConfirmDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        title={`Disconnect ${disconnectTarget?.display_name ?? "integration"}?`}
        description="This removes the stored credentials and stops all activity for this integration. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnect.isPending}
        onConfirm={() => {
          if (!disconnectTarget) return;
          disconnect.mutate(disconnectTarget.id, {
            onSuccess: () => setDisconnectTarget(null),
          });
        }}
      />
    </AppLayout>
  );
}
