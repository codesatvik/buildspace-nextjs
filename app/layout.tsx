import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";

const inter = Inter({subsets:['latin']});


export const metadata: Metadata = {
  title: "Buildspace",
  description: "learn by building",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full", "antialiased",)}
    >
        <body className={ inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
