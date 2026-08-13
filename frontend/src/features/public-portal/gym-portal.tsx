"use client";

/**
 * PUBLIC gym portal — the interactive body of /join/[gymSlug].
 * Marketing-flavored (larger type, expressive plan cards) but built on the
 * same Design.md primitives: Geist type scale, ink CTAs, hairline borders.
 */

import { useState } from "react";
import {
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatDuration,
  formatPrice,
  type PublicGymResponse,
  type PublicPlan,
} from "./api";
import { ClassesStrip } from "./classes-strip";
import { CheckoutDialog } from "./checkout-dialog";
import { TrialForm } from "./trial-form";

export function GymPortal({
  slug,
  data,
}: {
  slug: string;
  data: PublicGymResponse;
}) {
  const { gym, branches, plans } = data;
  const [checkoutPlan, setCheckoutPlan] = useState<PublicPlan | null>(null);

  const location = [gym.city, gym.state].filter(Boolean).join(", ");

  return (
    <div className="pb-16">
      {/* ------------------------------------------------ Hero */}
      <section className="flex flex-col items-center pt-16 text-center sm:pt-24">
        {gym.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={gym.logo_url}
            alt={`${gym.name} logo`}
            className="h-16 w-16 rounded-2xl border border-hairline object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-hairline bg-canvas-soft text-2xl font-semibold text-foreground sm:h-20 sm:w-20">
            {gym.name.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {gym.name}
        </h1>
        {gym.tagline && (
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            {gym.tagline}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {location}
            </span>
          )}
          {gym.phone && (
            <a
              href={`tel:${gym.phone}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" /> {gym.phone}
            </a>
          )}
          {gym.email && (
            <a
              href={`mailto:${gym.email}`}
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" /> {gym.email}
            </a>
          )}
          {gym.website && (
            <a
              href={gym.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
        </div>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button size="pill-lg" asChild>
            <a href="#plans">See membership plans</a>
          </Button>
          <Button size="pill-lg" variant="outline" asChild>
            <a href="#trial">Book a free trial</a>
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------ Branches */}
      {branches.length > 0 && (
        <section className="mt-20 sm:mt-28">
          <SectionHeading
            eyebrow="Locations"
            title={branches.length === 1 ? "Our gym" : "Our locations"}
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {branches.map((branch) => (
              <Card key={branch.id} className="border-hairline">
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-foreground">
                    {branch.name}
                  </h3>
                  <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {(branch.address || branch.city) && (
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {[branch.address, branch.city, branch.state]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </p>
                    )}
                    {branch.opening_time && branch.closing_time && (
                      <p className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        {branch.opening_time} – {branch.closing_time}
                      </p>
                    )}
                    {branch.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <a
                          href={`tel:${branch.phone}`}
                          className="hover:text-foreground"
                        >
                          {branch.phone}
                        </a>
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ Plans */}
      <section id="plans" className="mt-20 scroll-mt-8 sm:mt-28">
        <SectionHeading
          eyebrow="Memberships"
          title="Pick your plan"
          body="Pay online and start training today."
        />
        {plans.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Plans aren&apos;t published online yet — contact the gym to join.
          </p>
        ) : (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                branchName={
                  plan.branch_id
                    ? branches.find((b) => b.id === plan.branch_id)?.name ?? null
                    : null
                }
                onJoin={() => setCheckoutPlan(plan)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ Classes */}
      <section className="mt-20 sm:mt-28">
        <SectionHeading
          eyebrow="This week"
          title="Upcoming classes"
          body="A taste of what's on the schedule."
        />
        <ClassesStrip slug={slug} branches={branches} />
      </section>

      {/* ------------------------------------------------ Free trial */}
      <section id="trial" className="mt-20 scroll-mt-8 sm:mt-28">
        <div className="rounded-2xl border border-hairline bg-canvas-soft p-6 sm:p-10">
          <SectionHeading
            eyebrow="Try before you join"
            title="Book a free trial"
            body="Leave your details and the team will confirm your visit."
          />
          <div className="mt-6 max-w-xl">
            <TrialForm slug={slug} branches={branches} />
          </div>
        </div>
      </section>

      {/* Checkout dialog (mounted once, driven by the selected plan) */}
      <CheckoutDialog
        slug={slug}
        gymName={gym.name}
        plan={checkoutPlan}
        branches={branches}
        onClose={() => setCheckoutPlan(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {body && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  branchName,
  onJoin,
}: {
  plan: PublicPlan;
  branchName: string | null;
  onJoin: () => void;
}) {
  const duration = formatDuration(plan.duration_days);

  return (
    <Card className="flex flex-col border-hairline transition-shadow hover:shadow-level-1">
      <CardContent className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-foreground">
            {plan.name}
          </h3>
          {plan.tier && (
            <Badge variant="secondary" className="capitalize">
              {plan.tier}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {formatPrice(plan.price, plan.currency)}
          </span>
          {duration && (
            <span className="text-sm text-muted-foreground">/ {duration}</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {plan.plan_type && <span className="capitalize">{plan.plan_type.replace(/_/g, " ")}</span>}
          {plan.total_classes ? <span>{plan.total_classes} classes</span> : null}
          {branchName && <span>{branchName} only</span>}
        </div>

        {plan.description && (
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {plan.description}
          </p>
        )}

        <div className="mt-6 flex-1" />
        <Button size="md" className="w-full" onClick={onJoin}>
          Join now
        </Button>
      </CardContent>
    </Card>
  );
}
