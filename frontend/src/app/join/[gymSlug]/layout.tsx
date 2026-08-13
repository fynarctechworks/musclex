import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join | MuscleX",
  description: "Join your gym — memberships, classes and free trials.",
};

/**
 * PUBLIC portal layout — no auth store, no admin sidebar/chrome.
 * Prospects land here from a gym's marketing link; keep it a clean,
 * centered marketing canvas with a gym-agnostic footer.
 */
export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-hairline py-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">MuscleX</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
