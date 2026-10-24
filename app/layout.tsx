import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import { QueryProvider } from "@/components/providers/query-provider";

const inter = Inter({subsets:['latin']});

export const metadata: Metadata = {
  title: "Buildspace",
  description: "learn by building",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased",)}
    >
        <body className={ inter.className}><QueryProvider>{children}</QueryProvider></body>
      </html>
    </ClerkProvider>
  );
}
