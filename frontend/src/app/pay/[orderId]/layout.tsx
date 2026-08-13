import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay | MuscleX",
  description: "Complete your gym membership payment securely with Razorpay.",
};

/**
 * PUBLIC hosted-checkout layout — no auth store, no admin sidebar/chrome.
 * Members land here from the MuscleX member app (renewal flow) via a
 * `/pay/[orderId]` link opened in the device browser. Mirrors the /join
 * public-portal layout: a clean, centered canvas with a MuscleX footer.
 */
export default function PayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-hairline py-8">
        <div className="mx-auto flex w-full max-w-lg items-center justify-center px-4 sm:px-6">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">MuscleX</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
