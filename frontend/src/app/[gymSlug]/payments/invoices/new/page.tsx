"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { AccessDenied, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRequirePermission } from "@/hooks/use-require-permission";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";
import { useCurrency } from "@/lib/hooks/use-currency";
import { apiClient } from "@/lib/api";
import { useCreateInvoice } from "@/features/payments";
import type { Member, MembershipPlan, PaginatedResponse } from "@/lib/types";
import { toast } from "sonner";

type ItemType = "membership" | "class" | "personal_training" | "product";

interface LineItem {
  item_type: ItemType;
  description: string;
  quantity: number;
  unit_price: number;
}

const ITEM_TYPES: { value: ItemType; label: string }[] = [
  { value: "membership", label: "Membership" },
  { value: "class", label: "Class" },
  { value: "personal_training", label: "Personal Training" },
  { value: "product", label: "Product" },
];

export default function NewInvoicePage() {
  const { allowed, checked } = useRequirePermission("payments", "create", "deny");
  const { gymPath } = useGymSlug();
  const CURRENCY_SYMBOL = useCurrency();
  const router = useRouter();

  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { item_type: "membership", description: "", quantity: 1, unit_price: 0 },
  ]);

  const { data: members } = useQuery({
    queryKey: ["member-search-invoice", memberSearch],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Member>>(
        `/members?search=${memberSearch}&limit=5`,
      ),
    enabled: memberSearch.length >= 2,
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const createInvoice = useCreateInvoice();

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { item_type: "product", description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      toast.error("Please select a member");
      return;
    }
    if (items.length === 0 || items.some((i) => !i.description || i.unit_price <= 0)) {
      toast.error("Each line item needs a description and price");
      return;
    }
    createInvoice.mutate(
      {
        branch_id: selectedMember.branch_id!,
        member_id: selectedMember.id,
        items: items.map((i) => ({
          item_type: i.item_type,
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        due_date: dueDate || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          router.push(gymPath("/payments/invoices"));
        },
      },
    );
  };

  if (checked && !allowed) {
    return (
      <AppLayout>
        <AccessDenied module="payments" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Link
        href={gymPath("/payments/invoices")}
        className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Invoices
      </Link>

      <PageHeader
        title="Create Invoice"
        description="Issue a new invoice to a member"
      />

      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6 mt-6">
        {/* Member */}
        <div className="rounded-xl border border-border bg-card p-5">
          <label className="text-sm font-medium text-foreground block mb-2">
            Member
          </label>
          <Input
            placeholder="Search by name or phone..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="bg-background border-border text-foreground"
          />
          {members?.data?.length ? (
            <div className="mt-2 rounded-md border border-border overflow-hidden">
              {members.data.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => {
                    setSelectedMember(m);
                    setMemberSearch("");
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm text-foreground border-b border-border last:border-0"
                >
                  {m.full_name}{" "}
                  <span className="text-muted-foreground">({m.member_code})</span>
                </button>
              ))}
            </div>
          ) : null}
          {selectedMember && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-primary/10 border border-primary/20 px-3 py-2">
              <span className="text-sm text-primary font-medium">
                {selectedMember.full_name}
              </span>
              <span className="text-xs text-muted-foreground">
                ({selectedMember.member_code})
              </span>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Line Items</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addItem}
              className="text-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add item
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-start rounded-lg border border-border p-3"
              >
                <div className="col-span-3">
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Type
                  </label>
                  <select
                    value={item.item_type}
                    onChange={(e) =>
                      updateItem(idx, { item_type: e.target.value as ItemType })
                    }
                    className="w-full rounded-md border border-border bg-background text-foreground p-2 text-[13px]"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-5">
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Description
                  </label>
                  {item.item_type === "membership" ? (
                    <select
                      value={item.description}
                      onChange={(e) => {
                        const plan = (plans || []).find(
                          (p) => p.name === e.target.value,
                        );
                        updateItem(idx, {
                          description: e.target.value,
                          unit_price: plan ? Number(plan.price) : item.unit_price,
                        });
                      }}
                      className="w-full rounded-md border border-border bg-background text-foreground p-2 text-[13px]"
                    >
                      <option value="">Select plan…</option>
                      {(plans || []).map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={item.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="bg-background border-border text-foreground h-9 text-[13px]"
                    />
                  )}
                </div>

                <div className="col-span-1">
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Qty
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, { quantity: Number(e.target.value) })
                    }
                    className="bg-background border-border text-foreground h-9 text-[13px]"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    Price ({CURRENCY_SYMBOL})
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateItem(idx, { unit_price: Number(e.target.value) })
                    }
                    className="bg-background border-border text-foreground h-9 text-[13px]"
                  />
                </div>

                <div className="col-span-1 pt-5 flex justify-end">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end items-center gap-4 mt-4 pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-base font-semibold text-foreground">
              {CURRENCY_SYMBOL}
              {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Due Date (optional)
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-background border-border text-foreground"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground block mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm"
              placeholder="Internal notes or invoice memo"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={createInvoice.isPending}
            className="bg-primary text-primary-foreground"
          >
            {createInvoice.isPending ? "Creating…" : "Create Invoice"}
          </Button>
          <Link href={gymPath("/payments/invoices")}>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </AppLayout>
  );
}
