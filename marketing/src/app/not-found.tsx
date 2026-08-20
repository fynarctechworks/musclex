import Link from 'next/link';
import { ArrowNudge, ButtonLink, HeroBackdrop } from '@/components/ui';
import { primaryNav, routes } from '@/lib/site';

export default function NotFound() {
  return (
    <section className="relative overflow-hidden py-32 sm:py-40">
      <HeroBackdrop />
      <div className="container-page relative">
        <div className="mx-auto flex max-w-[600px] flex-col items-center gap-6 text-center">
          <p className="eyebrow">404</p>
          <h1 className="text-[40px] leading-[1.06] tracking-[-0.04em] sm:text-[52px]">
            That page <span className="text-gradient">isn&rsquo;t here.</span>
          </h1>
          <p className="text-lead text-text-2">
            The link may be out of date, or the page may have moved. Here is where
            everything lives.
          </p>

          <ul className="flex flex-wrap justify-center gap-2">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="glass glass-hover inline-flex rounded-pill px-4 py-2 text-body-sm text-text-2 transition-colors duration-fast hover:text-text"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-2">
            <ButtonLink href={routes.home} variant="accent" size="lg">
              Back to home
              <ArrowNudge />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
