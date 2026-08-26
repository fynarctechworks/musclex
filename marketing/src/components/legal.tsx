import { AlertTriangle } from 'lucide-react';
import { cx } from './ui';

/**
 * Shared chrome for the /legal/* documents.
 *
 * IMPORTANT: the documents in this folder are DRAFTS — structurally complete
 * and honest about how the product works, but not reviewed by a lawyer. The
 * banner below says so on the page itself. Do not remove it until counsel has
 * reviewed and approved the final text, and do not treat these as enforceable
 * terms in the meantime.
 */

export function LegalPage({
  title,
  updated,
  intro,
  /**
   * Show the "pending legal review" banner. Defaults to true, because the
   * terms and refund policy have not been through counsel and saying so is the
   * honest thing to do.
   *
   * The privacy policy sets it false: it is the URL given to Apple and Google
   * as the app's privacy policy, and a banner declaring the document "not a
   * binding agreement" undermines the one thing the stores require it to be.
   */
  draft = true,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="bg-canvas pb-28 pt-16 sm:pt-20">
      <div className="container-page">
        <div className="mx-auto max-w-[760px]">
          <p className="eyebrow">legal</p>
          <h1 className="mt-4 text-[36px] leading-[1.06] tracking-[-0.04em] sm:text-[48px]">
            {title}
          </h1>
          <p className="mt-4 text-caption text-text-4">Last updated: {updated}</p>
          <p className="mt-8 text-lead text-text-2">{intro}</p>

          {draft ? (
            <div className="glass mt-10 flex gap-4 rounded-lg p-6">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <p className="text-body-sm text-text-3">
                <strong className="font-semibold text-text">Draft: pending legal review.</strong>{' '}
                This document describes how MuscleX is intended to operate and has not yet
                been reviewed by qualified counsel. It is not a binding agreement in its
                current form. Please have it reviewed for your jurisdiction before relying
                on it.
              </p>
            </div>
          ) : null}

          <div className="mt-16 flex flex-col gap-12">{children}</div>
        </div>
      </div>
    </article>
  );
}

export function LegalSection({
  heading,
  children,
  className,
}: {
  heading: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('flex flex-col gap-4', className)}>
      <h2 className="text-title">{heading}</h2>
      <div className="flex flex-col gap-4 text-body text-text-2 [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-4 [&_strong]:text-text">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3.5">
          <span className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
