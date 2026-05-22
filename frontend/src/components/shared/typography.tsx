"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Typography primitives — Design.md hierarchy as React components.
 *
 * Use these instead of raw <h1>/<p> with ad-hoc class soup. Every component
 * in this file ties to a token in tailwind.config (fontSize.display-* /
 * body-*), so the brand cannot drift even when consumers omit className.
 */

type AsProp<T extends React.ElementType> = { as?: T };
type PolyProps<T extends React.ElementType, P> = P &
  AsProp<T> &
  Omit<React.ComponentPropsWithoutRef<T>, keyof P | "as">;

interface EyebrowProps {
  className?: string;
  children: React.ReactNode;
}
/** Section eyebrow — Design.md `caption-mono` uppercase tag above headlines. */
export function Eyebrow({ className, children }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

interface DisplayProps {
  className?: string;
  children: React.ReactNode;
}

/** Hero headline — Design.md `display-xl` (48 px / 600 / -2.4 px tracking). */
export function DisplayXL<T extends React.ElementType = "h1">({
  as,
  className,
  children,
  ...rest
}: PolyProps<T, DisplayProps>) {
  const Tag = (as ?? "h1") as React.ElementType;
  return (
    <Tag className={cn("text-display-xl text-foreground", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Section headline — Design.md `display-lg` (32 px / 600 / -1.28 px). */
export function DisplayLG<T extends React.ElementType = "h2">({
  as,
  className,
  children,
  ...rest
}: PolyProps<T, DisplayProps>) {
  const Tag = (as ?? "h2") as React.ElementType;
  return (
    <Tag className={cn("text-display-lg text-foreground", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Card-cluster headline — Design.md `display-md` (24 px / 600 / -0.96 px). */
export function DisplayMD<T extends React.ElementType = "h3">({
  as,
  className,
  children,
  ...rest
}: PolyProps<T, DisplayProps>) {
  const Tag = (as ?? "h3") as React.ElementType;
  return (
    <Tag className={cn("text-display-md text-foreground", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Inline micro-heading — Design.md `display-sm` (20 px / 600 / -0.6 px). */
export function DisplaySM<T extends React.ElementType = "h4">({
  as,
  className,
  children,
  ...rest
}: PolyProps<T, DisplayProps>) {
  const Tag = (as ?? "h4") as React.ElementType;
  return (
    <Tag className={cn("text-display-sm text-foreground", className)} {...rest}>
      {children}
    </Tag>
  );
}

interface BodyProps {
  className?: string;
  children: React.ReactNode;
  muted?: boolean;
}

/** Lead body copy — Design.md `body-lg` (18 px). */
export function BodyLG({ className, children, muted }: BodyProps) {
  return (
    <p
      className={cn(
        "text-body-lg",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Default body copy — Design.md `body-md` (16 px). */
export function BodyMD({ className, children, muted }: BodyProps) {
  return (
    <p
      className={cn(
        "text-body-md",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Secondary body — Design.md `body-sm` (14 px / -0.28 px). */
export function BodySM({ className, children, muted }: BodyProps) {
  return (
    <p
      className={cn(
        "text-body-sm",
        muted ? "text-muted-foreground" : "text-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}

interface CodeProps {
  className?: string;
  children: React.ReactNode;
}
/** Inline code / mono caption — Design.md `code` (13 px Geist Mono). */
export function Code({ className, children }: CodeProps) {
  return (
    <code
      className={cn(
        "font-mono text-[13px] leading-5 text-foreground bg-canvas-soft-2 px-1.5 py-0.5 rounded-sm",
        className
      )}
    >
      {children}
    </code>
  );
}
