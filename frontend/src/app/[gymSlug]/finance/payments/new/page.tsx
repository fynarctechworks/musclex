"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import type { Member, MembershipPlan, PaginatedResponse } from "@/lib/types";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface PaymentForm {
  member_id: string;
  plan_id: string;
  amount: string;
  payment_method: string;
  notes: string;
}

export default function RecordPaymentPage() {
  const { gymPath } = useGymSlug();
  const router = useRouter();
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const { register, handleSubmit, setValue } = useForm<PaymentForm>();

  const { data: members } = useQuery({
    queryKey: ["member-search-pay", memberSearch],
    queryFn: () => apiClient.get<PaginatedResponse<Member>>(`/members?search=${memberSearch}&limit=5`),
    enabled: memberSearch.length >= 2,
  });

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => apiClient.get<MembershipPlan[]>("/membership-plans"),
  });

  const mutation = useMutation({
    mutationFn: (data: PaymentForm) => apiClient.post("/payments/cash", data),
    onSuccess: () => { toast.success("Payment recorded"); router.push(gymPath("/finance/payments")); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <Link href={gymPath("/finance/payments")} className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-xl font-semibold text-foreground mb-6">Record Payment</h1>

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="max-w-lg space-y-5">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Search Member</label>
          <Input placeholder="Name or phone..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
            className="bg-background border-border text-foreground" />
          {members?.data?.map((m) => (
            <button type="button" key={m.id} onClick={() => { setSelectedMember(m); setValue("member_id", m.id); setMemberSearch(""); }}
              className="w-full text-left p-2 hover:bg-muted text-sm text-foreground">{m.full_name} ({m.member_code})</button>
          ))}
          {selectedMember && <p className="text-sm text-primary mt-1">Selected: {selectedMember.full_name}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Plan</label>
          <select {...register("plan_id")} className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm">
            <option value="">Select plan</option>
            {(Array.isArray(plans) ? plans : []).map((p) => <option key={p.id} value={p.id}>{p.name} - ₹{Number(p.price)}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Amount</label>
          <Input type="number" {...register("amount", { required: true })} className="bg-background border-border text-foreground" />
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Payment Method</label>
          <select {...register("payment_method", { required: true })} className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground block mb-1">Notes</label>
          <textarea {...register("notes")} rows={3} className="w-full rounded-md border border-border bg-background text-foreground p-2 text-sm" />
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground">Record Payment</Button>
      </form>
    </AppLayout>
  );
}
