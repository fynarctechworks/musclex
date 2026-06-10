'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-canvas/80 backdrop-blur-lg border-b border-hairline transition-all duration-medium">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-wordmark.png" alt="MuscleX" className="h-7 w-auto" />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            <button onClick={() => scrollTo('features')} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
              Features
            </button>
            <button onClick={() => scrollTo('pricing')} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
              Pricing
            </button>
            <button onClick={() => scrollTo('testimonials')} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
              Testimonials
            </button>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-5 py-2.5 text-sm font-semibold text-on-primary bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-level-3 shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-fast"
            >
              Login
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-medium ease-in-out ${
          menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 py-3 space-y-1 bg-canvas border-t border-hairline">
          <button onClick={() => scrollTo('features')} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
            Features
          </button>
          <button onClick={() => scrollTo('pricing')} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
            Pricing
          </button>
          <button onClick={() => scrollTo('testimonials')} className="block w-full text-left px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-canvas-soft transition-colors">
            Testimonials
          </button>
          <div className="pt-2 border-t border-hairline">
            <Link
              href="/login"
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-on-primary bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
