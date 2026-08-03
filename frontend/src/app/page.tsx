import LandingPage from './landing/LandingPage';

/**
 * Public marketing site at the root. `/` is allowlisted in middleware, so this
 * renders for signed-out visitors; the Navbar/CTA link on to /login and
 * /onboarding. (Previously this redirected straight to /login, which left the
 * whole landing page unreachable — `app/landing/` has no page.tsx of its own.)
 */
export default function Home() {
  return <LandingPage />;
}
