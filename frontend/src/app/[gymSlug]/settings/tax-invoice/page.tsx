"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Receipt, Save, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useRequirePermission } from "@/hooks/use-require-permission";

interface AccountOverview {
  studio: { id: string; name: string; state: string | null };
  billing: {
    gstin: string | null;
    gst_state_code: string | null;
    default_hsn: string | null;
    invoice_prefix: string | null;
    invoice_terms: string | null;
  };
}

interface GstForm {
  gstin: string;
  gst_state_code: string;
  default_hsn: string;
  invoice_prefix: string;
  invoice_terms: string;
}

// 2-digit GST state codes (India). Short list for the picker.
const STATE_CODES: Array<{ code: string; label: string }> = [
  { code: "27", label: "27 — Maharashtra" },
  { code: "29", label: "29 — Karnataka" },
  { code: "33", label: "33 — Tamil Nadu" },
  { code: "36", label: "36 — Telangana" },
  { code: "07", label: "07 — Delhi" },
  { code: "06", label: "06 — Haryana" },
  { code: "09", label: "09 — Uttar Pradesh" },
  { code: "24", label: "24 — Gujarat" },
  { code: "19", label: "19 — West Bengal" },
  { code: "32", label: "32 — Kerala" },
];

export default function TaxInvoiceSettingsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const qc = useQueryClient();

  const { data: account, isLoading } = useQuery<AccountOverview>({
    queryKey: ["account-overview"],
    queryFn: () => apiClient.get("/settings/account"),
  });

  const [form, setForm] = useState<GstForm>({
    gstin: "",
    gst_state_code: "",
    default_hsn: "",
    invoice_prefix: "",
    invoice_terms: "",
  });

  useEffect(() => {
    if (account) {
      setForm({
        gstin: account.billing.gstin ?? "",
        gst_state_code: account.billing.gst_state_code ?? "",
        default_hsn: account.billing.default_hsn ?? "",
        invoice_prefix: account.billing.invoice_prefix ?? "",
        invoice_terms: account.billing.invoice_terms ?? "",
      });
    }
  }, [account]);

  const save = useMutation({
    mutationFn: (data: GstForm) => apiClient.patch("/settings/studio", data),
    onSuccess: () => {
      toast.success("Tax-invoice settings saved");
      qc.invalidateQueries({ queryKey: ["account-overview"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="settings" />
      </AppLayout>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // GSTIN sanity: 15 chars when present
    if (form.gstin && form.gstin.length !== 15) {
      toast.error("GSTIN must be exactly 15 characters");
      return;
    }
    save.mutate(form);
  };

  return (
    <AppLayout>
      <Link
        href={gymPath("/settings")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>

      <PageHeader
        title="Tax Invoice (GST)"
        description="Configure GSTIN and tax-invoice defaults. These appear on every member invoice and POS receipt."
      />

      {/* Explainer */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4 flex gap-3">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-[13px] text-muted-foreground leading-relaxed">
          When a <span className="text-foreground font-medium">GSTIN</span> is set, every invoice is labelled
          <span className="text-foreground font-medium"> TAX INVOICE</span> and shows CGST+SGST (intra-state) or
          IGST (inter-state) splits automatically. The
          <span className="text-foreground font-medium"> state code</span> is used to decide intra vs inter-state.
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <section className="rounded-lg border border-border bg-card">
          <header className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Issuer details</h2>
          </header>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">GSTIN</label>
              <input
                value={form.gstin}
                onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                className="w-full font-mono px-3 py-2 rounded-md bg-canvas-soft border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />
              <p className="text-[11px] text-muted-foreground">15-character GST identifier. Leave blank if not GST-registered.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Seller state code</label>
              <select
                value={form.gst_state_code}
                onChange={(e) => setForm((f) => ({ ...f, gst_state_code: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-canvas-soft border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              >
                <option value="">— Select —</option>
                {STATE_CODES.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">First two digits of your GSTIN. Decides CGST+SGST vs IGST.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Default HSN/SAC</label>
              <input
                value={form.default_hsn}
                onChange={(e) => setForm((f) => ({ ...f, default_hsn: e.target.value }))}
                placeholder="999723"
                maxLength={12}
                className="w-full font-mono px-3 py-2 rounded-md bg-canvas-soft border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />
              <p className="text-[11px] text-muted-foreground">SAC 999723 = Fitness/health services. Used when a line has no code.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">Invoice number prefix</label>
              <input
                value={form.invoice_prefix}
                onChange={(e) => setForm((f) => ({ ...f, invoice_prefix: e.target.value.toUpperCase() }))}
                placeholder="INV"
                maxLength={10}
                className="w-full font-mono px-3 py-2 rounded-md bg-canvas-soft border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />
              <p className="text-[11px] text-muted-foreground">Default <span className="font-mono">INV-YYYYMMDD-XXXX</span>.</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <header className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Footer terms</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Free text printed at the bottom of every PDF invoice.</p>
          </header>
          <div className="p-5">
            <textarea
              value={form.invoice_terms}
              onChange={(e) => setForm((f) => ({ ...f, invoice_terms: e.target.value }))}
              placeholder="E.g. Payment is non-refundable. Subject to Mumbai jurisdiction only."
              rows={4}
              className="w-full px-3 py-2 rounded-md bg-canvas-soft border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isLoading}
            />
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending || isLoading} className="bg-primary text-primary-foreground">
            <Save className="h-4 w-4 mr-1.5" />
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
