import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";

// Design.md font stack: Geist (proprietary) → Inter substitute with geometric
// stylistic sets (ss01/ss02). The brand's display ceiling is weight 600, but
// 700/800 stay loaded for legacy `font-semibold` usage during migration.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Geist Mono substitute per Design.md: JetBrains Mono at 12-13 px for
// technical labels, terminal mockups, and section eyebrows.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MuscleX",
  description: "AI-powered gym management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(inter.variable, jetbrainsMono.variable)}>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
