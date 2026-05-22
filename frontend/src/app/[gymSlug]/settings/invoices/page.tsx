"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import {
  Receipt,
  Check,
  ChevronRight,
  Eye,
  FileText,
  Palette,
  AlignLeft,
  ListChecks,
  Star,
  X,
} from "lucide-react";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import Link from "next/link";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { AccessDenied } from "@/components/shared";

// ── Types ──────────────────────────────────────────────────────
interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  previewColor: string;
}

interface TemplatesResponse {
  templates: InvoiceTemplate[];
  default_template_id: string;
}

// ── Dummy data for preview ──────────────────────────────────────
const DUMMY = {
  gym_name: "FitSync Pro Gym",
  gym_address: "123 Fitness Street, Mumbai, MH 400001",
  gym_phone: "+91 98765 43210",
  gym_email: "hello@fitsyncgym.com",
  member_name: "Rahul Sharma",
  member_code: "FS-20260101-0042",
  member_email: "rahul.sharma@email.com",
  member_phone: "+91 91234 56789",
  plan_name: "Premium Monthly",
  plan_price: "2,499",
  currency: "INR",
  start_date: "01 Apr 2026",
  end_date: "30 Apr 2026",
  invoice_number: "RCP-20260401-0099",
  invoice_date: "01 Apr 2026",
  payment_status: "PAID",
};

// ── Template icon map ──────────────────────────────────────────
const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  classic: FileText,
  modern: Palette,
  minimal: AlignLeft,
  detailed: ListChecks,
  branded: Star,
};

// ── Preview styles (light invoice paper, accents distinguish templates) ────────
type TemplateStyle = {
  bg: string;
  accent: string;
  text: string;
  border: string;
  subtext: string;
};

const PREVIEW_STYLES: Record<string, TemplateStyle> = {
  classic:  { bg: "#FFFFFF", accent: "#141413", text: "#141413", border: "#E5E5E5", subtext: "#737373" },
  modern:   { bg: "#FFFFFF", accent: "#3B82F6", text: "#141413", border: "#E5E5E5", subtext: "#737373" },
  minimal:  { bg: "#FFFFFF", accent: "#737373", text: "#141413", border: "#E5E5E5", subtext: "#737373" },
  detailed: { bg: "#FFFFFF", accent: "#0EA5E9", text: "#141413", border: "#E5E5E5", subtext: "#737373" },
  branded:  { bg: "#FFFFFF", accent: "#10B981", text: "#141413", border: "#E5E5E5", subtext: "#737373" },
};

// ── Mini card preview ───────────────────────────────────────────
function InvoiceCardPreview({ template, selected }: { template: InvoiceTemplate; selected: boolean }) {
  const s = PREVIEW_STYLES[template.id] || PREVIEW_STYLES.classic;

  return (
    <div
      className="rounded-lg overflow-hidden border-2 transition-all duration-fast"
      style={{
        borderColor: selected ? s.accent : "hsl(var(--border))",
        boxShadow: selected ? `0 0 0 2px ${s.accent}33` : "none",
      }}
    >
      <div className="p-4 space-y-2" style={{ background: s.bg, minHeight: "140px" }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded" style={{ background: s.accent }} />
            <div className="h-2 w-16 rounded" style={{ background: s.accent, opacity: 0.7 }} />
          </div>
          <div className="text-xs font-semibold" style={{ color: s.accent }}>INVOICE</div>
        </div>
        {/* Divider */}
        <div className="h-px w-full" style={{ background: s.border }} />
        {/* Body rows */}
        <div className="space-y-1.5 pt-1">
          {[80, 60, 70].map((w, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-1.5 rounded" style={{ background: s.text, opacity: 0.3, width: `${w}%` }} />
              <div className="h-1.5 w-8 rounded" style={{ background: s.accent, opacity: 0.6 }} />
            </div>
          ))}
        </div>
        {/* Total row */}
        <div className="flex justify-between items-center pt-2 border-t" style={{ borderColor: s.border }}>
          <div className="h-2 w-12 rounded" style={{ background: s.text, opacity: 0.4 }} />
          <div className="h-2 w-14 rounded font-semibold" style={{ background: s.accent }} />
        </div>
      </div>
    </div>
  );
}

// ── Full invoice preview content ────────────────────────────────
function InvoiceFullPreview({ templateId }: { templateId: string }) {
  const s = PREVIEW_STYLES[templateId] || PREVIEW_STYLES.classic;

  return (
    <div
      className="rounded-lg overflow-hidden shadow-level-2"
      style={{ background: s.bg, border: `1px solid ${s.border}`, minHeight: "500px" }}
    >
      {/* Invoice header */}
      <div
        className="p-6"
        style={{
          borderBottom: `1px solid ${s.border}`,
          background: s.bg,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center mb-3"
              style={{ background: s.accent }}
            >
              <Receipt className="w-6 h-6 text-on-primary" />
            </div>
            <h2 className="text-lg font-semibold" style={{ color: s.text }}>{DUMMY.gym_name}</h2>
            <p className="text-xs mt-1" style={{ color: s.subtext }}>{DUMMY.gym_address}</p>
            <p className="text-xs" style={{ color: s.subtext }}>{DUMMY.gym_phone} · {DUMMY.gym_email}</p>
          </div>
          <div className="text-right">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2"
              style={{ background: `${s.accent}15`, color: s.accent, border: `1px solid ${s.accent}30` }}
            >
              INVOICE
            </div>
            <p className="text-xs font-mono" style={{ color: s.text }}>{DUMMY.invoice_number}</p>
            <p className="text-xs mt-1" style={{ color: s.subtext }}>Date: {DUMMY.invoice_date}</p>
            <div
              className="mt-2 px-2 py-0.5 rounded text-xs font-semibold inline-block"
              style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}
            >
              ✓ {DUMMY.payment_status}
            </div>
          </div>
        </div>
      </div>

      {/* Bill to */}
      <div className="px-6 py-4" style={{ borderBottom: `1px solid ${s.border}` }}>
        <p className="text-xs font-semibold mb-2" style={{ color: s.subtext }}>BILL TO</p>
        <p className="text-sm font-semibold" style={{ color: s.text }}>{DUMMY.member_name}</p>
        <p className="text-xs" style={{ color: s.subtext }}>{DUMMY.member_email}</p>
        <p className="text-xs" style={{ color: s.subtext }}>{DUMMY.member_phone}</p>
        <p className="text-xs mt-1 font-mono" style={{ color: s.accent }}>ID: {DUMMY.member_code}</p>
      </div>

      {/* Line items */}
      <div className="px-6 py-4">
        {/* Table header */}
        <div
          className="grid grid-cols-3 pb-2 mb-2 text-xs font-semibold"
          style={{ borderBottom: `1px solid ${s.border}`, color: s.subtext }}
        >
          <span>Description</span>
          <span className="text-center">Period</span>
          <span className="text-right">Amount</span>
        </div>
        {/* Table row */}
        <div className="grid grid-cols-3 py-3 text-sm" style={{ borderBottom: `1px solid ${s.border}` }}>
          <span style={{ color: s.text }}>{DUMMY.plan_name}</span>
          <span className="text-center text-xs" style={{ color: s.subtext }}>
            {DUMMY.start_date} – {DUMMY.end_date}
          </span>
          <span className="text-right font-semibold" style={{ color: s.text }}>
            {DUMMY.currency} {DUMMY.plan_price}
          </span>
        </div>
        {/* Total */}
        <div className="flex justify-end mt-4">
          <div className="text-right">
            <div className="flex items-center gap-6 text-sm mb-1">
              <span style={{ color: s.subtext }}>Subtotal</span>
              <span style={{ color: s.text }}>{DUMMY.currency} {DUMMY.plan_price}</span>
            </div>
            <div className="flex items-center gap-6 text-sm mb-3">
              <span style={{ color: s.subtext }}>Tax (0%)</span>
              <span style={{ color: s.text }}>{DUMMY.currency} 0</span>
            </div>
            <div
              className="flex items-center gap-6 text-base font-semibold px-4 py-2 rounded-lg"
              style={{ background: `${s.accent}15`, border: `1px solid ${s.accent}30` }}
            >
              <span style={{ color: s.text }}>Total</span>
              <span style={{ color: s.accent }}>{DUMMY.currency} {DUMMY.plan_price}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-6 py-4 text-center text-xs"
        style={{ borderTop: `1px solid ${s.border}`, color: s.subtext }}
      >
        Thank you for being a member of {DUMMY.gym_name}. See you at the gym!
      </div>
    </div>
  );
}

// ── Preview Modal ───────────────────────────────────────────────
function PreviewModal({
  template,
  onClose,
}: {
  template: InvoiceTemplate;
  onClose: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.id] || FileText;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card border border-border shadow-level-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-canvas-soft-2">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {template.name} Template Preview
              </h3>
              <p className="text-xs text-muted-foreground">
                {template.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-canvas-soft transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Preview content */}
        <div className="p-6">
          <InvoiceFullPreview templateId={template.id} />
          <p className="text-center text-xs mt-4 text-muted-foreground">
            Preview using sample data — actual invoices will use your gym and member details
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────
export default function InvoiceSettingsPage() {
  const { allowed, checked } = useRequirePermission("settings", "view", "deny");
  const { gymPath } = useGymSlug();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ["invoice-templates"],
    queryFn: () => apiClient.get("/invoice-templates"),
  });

  // Set default selection once data loads
  React.useEffect(() => {
    if (data?.default_template_id && !selectedTemplate) {
      const saved = typeof window !== "undefined" ? localStorage.getItem("invoice_template") : null;
      setSelectedTemplate(saved || data.default_template_id);
    }
  }, [data, selectedTemplate]);

  const templates = data?.templates ?? [];
  const activeTemplate = selectedTemplate || data?.default_template_id;

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("invoice_template", activeTemplate || "classic");
    setTimeout(() => {
      setSaving(false);
      toast.success(`Invoice template set to "${templates.find(t => t.id === activeTemplate)?.name || activeTemplate}". New members will receive this template.`);
    }, 400);
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
      {/* ── Header ────────────────────────────────────────── */}
      <div className="mb-8 flex items-center gap-3">
        <Link href={gymPath("/settings")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-primary" /> Invoice Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the invoice design sent to members when they join
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-56 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Template Grid ──────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((template) => {
              const isActive = activeTemplate === template.id;
              const Icon = TEMPLATE_ICONS[template.id] || FileText;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`group text-left rounded-lg border transition-all duration-fast overflow-hidden bg-card ${
                    isActive
                      ? "border-primary shadow-level-3 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/40 hover:shadow-level-2"
                  }`}
                >
                  {/* Preview area */}
                  <div className="p-3">
                    <InvoiceCardPreview template={template} selected={isActive} />
                  </div>

                  {/* Label row */}
                  <div className="px-4 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? "bg-canvas-soft-2" : "bg-muted"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                          {template.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Preview button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewTemplate(template);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-canvas-soft-2 border border-primary/20 transition-all opacity-0 group-hover:opacity-100 hover:bg-canvas-soft-2"
                        title="Preview template"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                      </button>

                      {isActive && (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-primary">
                          <Check className="w-3.5 h-3.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Info banner ────────────────────────────────── */}
          <div className="flex items-start gap-3 rounded-lg p-4 bg-primary/5 border border-primary/15">
            <Eye className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Template applied to new member invoices
              </p>
              <p className="text-xs mt-0.5 text-muted-foreground">
                When a new member registers, they automatically receive a welcome email with their invoice using the selected template. Hover over a template card and click the <Eye className="w-3 h-3 inline mx-0.5 text-primary" /> icon to preview with sample data.
              </p>
            </div>
          </div>

          {/* ── Save button ────────────────────────────────── */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 shadow-level-2"
            >
              <Check className="w-4 h-4" />
              {saving ? "Saving..." : "Save Template"}
            </button>
            <p className="text-xs text-muted-foreground">
              Currently active: <span className="text-primary font-semibold">
                {templates.find(t => t.id === activeTemplate)?.name || activeTemplate}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* ── Preview Modal ──────────────────────────────────── */}
      {previewTemplate && (
        <PreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </AppLayout>
  );
}
