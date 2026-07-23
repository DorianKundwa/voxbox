import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "VoxBox — AI Vocal Chain Matching",
  description:
    "Analyze any professionally mixed vocal and automatically build an effect chain that transforms your dry vocal to match that sound. Powered by AI.",
  keywords: ["vocal chain", "AI audio", "DSP", "mixing", "vocal processing", "EQ", "compressor"],
  openGraph: {
    title: "VoxBox — AI Vocal Chain Matching",
    description: "Upload a reference vocal. VoxBox AI builds the chain.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
