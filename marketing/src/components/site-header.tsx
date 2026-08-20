'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { primaryNav, productLinks } from '@/lib/site';
import { ArrowNudge, ButtonLink, cx } from './ui';

/**
 * Sticky glass navigation.
 *
 * Transparent over the hero, then it gains a blurred background and a hairline
 * once the page scrolls — so the header never sits as a hard bar across the
 * hero bloom, but stays legible over content further down.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The mobile menu is a full overlay; lock the page behind it.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <header
        className={cx(
          'sticky top-0 z-50 transition-all duration-medium ease-out',
          scrolled || open
            ? 'border-b border-hairline bg-canvas/80 backdrop-blur-xl'
            : 'border-b border-transparent',
        )}
      >
        <div className="container-page">
          <div className="flex h-[72px] items-center justify-between gap-6">
            <Link href="/" className="flex shrink-0 items-center" aria-label="MuscleX home">
              <Image
                src="/brand/logo-wordmark.png"
                alt="MuscleX"
                width={140}
                height={30}
                priority
                className="h-[26px] w-auto"
              />
            </Link>

            <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
              {primaryNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx(
                    'rounded-pill px-3.5 py-2 text-body-sm transition-colors duration-fast',
                    isActive(item.href)
                      ? 'text-text'
                      : 'text-text-3 hover:bg-glass-1 hover:text-text',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <a
                href={productLinks.login}
                className="rounded-pill px-4 py-2 text-body-sm text-text-2 transition-colors duration-fast hover:text-text"
              >
                Log in
              </a>
              <ButtonLink href={productLinks.signup} external variant="accent" size="md">
                Start free
                <ArrowNudge />
              </ButtonLink>
            </div>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="-mr-2 rounded-md p-2 text-text-2 transition-colors duration-fast hover:bg-glass-1 hover:text-text md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/*
        The overlay is a SIBLING of <header>, never a child.

        <header> carries `backdrop-blur-xl` while open, and an element with a
        backdrop-filter becomes the containing block for its fixed-position
        descendants. Nested inside, this overlay resolved `top-[72px] bottom-0`
        against the 72px-tall header instead of the viewport and rendered 1px
        tall — open, focusable, and invisible. Keep it outside the header.
      */}
      {open ? (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-[72px] z-40 overflow-y-auto border-t border-hairline bg-canvas md:hidden"
        >
          <div className="container-page flex flex-col gap-1 py-8">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-3.5 text-[19px] font-medium tracking-[-0.02em] text-text transition-colors duration-fast hover:bg-glass-1"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-8">
              <ButtonLink href={productLinks.signup} external variant="accent" size="lg">
                Start free
                <ArrowNudge />
              </ButtonLink>
              <ButtonLink href={productLinks.login} external variant="glass" size="lg">
                Log in
              </ButtonLink>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
