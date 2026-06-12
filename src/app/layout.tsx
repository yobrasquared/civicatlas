import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://civicatlas.vercel.app"),
  title: {
    default: "CivicAtlas — See what your government is actually doing",
    template: "%s | CivicAtlas",
  },
  description:
    "A nonpartisan, source-linked map of U.S. government activity. Zoom into your district to see your representatives, live legislation, votes, and new laws — every claim linked to an official source.",
  openGraph: {
    siteName: "CivicAtlas",
    type: "website",
    title: "CivicAtlas — See what your government is actually doing",
    description:
      "A nonpartisan, source-linked map of U.S. government activity: your representatives, live legislation, real votes, and new laws.",
  },
  twitter: { card: "summary" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
