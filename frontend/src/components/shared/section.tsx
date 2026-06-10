"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Eyebrow, DisplayLG } from "./typography";

/**
 * Section & Container — Design.md layout primitives.
 *
 * - <Container/> caps inner width at ~1400 px (Design.md --ds-page-width)
 *   with horizontal gutters of 24 px desktop / 16 px mobile.
 * - <Section/> stacks bands with the brand's generous vertical rhythm.
 * - <SectionHeader/> composes Eyebrow + Title + Lead + optional actions.
 */

interface ContainerProps {
  className?: string;
  children: React.ReactNode;
  /** Narrower content rail (~960 px) — for prose / single-column pages. */
  narrow?: boolean;
}
export function Container({ className, children, narrow }: ContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 lg:px-6",
        narrow ? "max-w-[960px]" : "max-w-[1400px]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface SectionProps {
  className?: string;
  children: React.ReactNode;
  /** Surface tone — defaults to inherited canvas-soft. */
  tone?: "default" | "canvas" | "soft" | "ink";
  /** Vertical padding tier. */
  pad?: "sm" | "md" | "lg" | "xl";
}
export function Section({
  className,
  children,
  tone = "default",
  pad = "md",
}: SectionProps) {
  const toneCls = {
    default: "",
    canvas: "surface-canvas",
    soft: "surface-canvas-soft",
    ink: "surface-ink",
  }[tone];
  const padCls = {
    sm: "py-design-xl",       // 32 px
    md: "py-design-3xl",      // 48 px
    lg: "py-design-4xl",      // 64 px
    xl: "py-design-5xl",      // 96 px
  }[pad];
  return <section className={cn(toneCls, padCls, className)}>{children}</section>;
}

interface SectionHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}
export function SectionHeader({
  eyebrow,
  title,
  lead,
  actions,
  align = "left",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center text-center",
        className
      )}
    >
      <div className={cn("max-w-2xl", align === "center" && "mx-auto")}>
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <DisplayLG>{title}</DisplayLG>
        {lead && (
          <p className="mt-3 text-body-md text-muted-foreground leading-relaxed">
            {lead}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}
