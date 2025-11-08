import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://thequestsapp.com"),
  title: "Quests - Turn Goals into Shared Adventures",
  description: "The social habit tracker that makes self-improvement fun. Join friends in daily challenges, earn rewards, and build better habits together.",
  openGraph: {
    type: "website",
    url: "https://thequestsapp.com/",
    title: "Quests - Turn Goals into Shared Adventures",
    description: "The social habit tracker that makes self-improvement fun.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Quests App",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quests - Turn Goals into Shared Adventures",
    description: "The social habit tracker that makes self-improvement fun.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3366CC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
