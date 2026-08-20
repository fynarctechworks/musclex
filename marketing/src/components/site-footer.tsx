import Link from 'next/link';
import Image from 'next/image';
import { contactEmail, footerNav } from '@/lib/site';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hairline bg-canvas-deep">
      <div className="container-page py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div className="flex flex-col gap-5">
            <Link href="/" className="w-fit" aria-label="MuscleX home">
              <Image
                src="/brand/logo-wordmark.png"
                alt="MuscleX"
                width={140}
                height={30}
                className="h-[26px] w-auto"
              />
            </Link>
            <p className="max-w-[300px] text-body-sm text-text-3">
              The operating system for fitness businesses. Memberships, check-in,
              payments, staff and member engagement in one system.
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="w-fit text-body-sm text-text-2 transition-colors duration-fast hover:text-text"
            >
              {contactEmail}
            </a>
          </div>

          {footerNav.map((column) => (
            <div key={column.title} className="flex flex-col gap-4">
              <h2 className="eyebrow">{column.title}</h2>
              <ul className="flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-body-sm text-text-3 transition-colors duration-fast hover:text-text"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-body-sm text-text-3 transition-colors duration-fast hover:text-text"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-hairline pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-caption text-text-4">© {year} MuscleX. All rights reserved.</p>
          <p className="text-caption text-text-4">
            Built with{' '}
            <span role="img" aria-label="love">
              ❤️
            </span>{' '}
            for fitness businesses from FYNARCTECHWORKS PVT LTD
          </p>
        </div>
      </div>
    </footer>
  );
}
