import { Check } from 'lucide-react';
import { ArrowNudge, BandGlow, ButtonLink } from './ui';
import { productLinks, routes } from '@/lib/site';

/** The closing conversion band, shared by every page. */
export function FinalCta({
  title = 'Start running your gym the smart way.',
  lead = 'Set up your studio, bring your members across and turn on check-in, all in an afternoon.',
}: {
  title?: string;
  lead?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-canvas-deep py-24 sm:py-32">
      <BandGlow />
      <div className="container-page relative">
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-7 text-center">
          <h2 className="text-[36px] leading-[1.06] tracking-[-0.04em] sm:text-[52px] lg:text-display-2">
            {title}
          </h2>
          <p className="max-w-[560px] text-lead text-text-2">{lead}</p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href={productLinks.signup} external variant="accent" size="lg">
              Start free
              <ArrowNudge />
            </ButtonLink>
            <ButtonLink href={routes.contact} variant="glass" size="lg">
              Talk to us
            </ButtonLink>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {['Free plan', 'No card required', 'Cancel anytime'].map((item) => (
              <li key={item} className="flex items-center gap-1.5 text-caption text-text-3">
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
