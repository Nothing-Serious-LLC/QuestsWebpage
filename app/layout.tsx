import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://thequestsapp.com"),
  title: "Quests - Social Wellness Challenge App",
  description: "The social-wellness challenge app. Challenge yourself. Improve together. Join friends in daily wellness challenges and build better habits.",
  openGraph: {
    type: "website",
    url: "https://thequestsapp.com/",
    title: "Quests - Social Wellness Challenge App",
    description: "The social-wellness challenge app. Challenge yourself. Improve together.",
    images: [
      {
        url: "/og-image.png",
        width: 692,
        height: 1500,
        alt: "Quests App social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quests - Social Wellness Challenge App",
    description: "The social-wellness challenge app. Challenge yourself. Improve together.",
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
  themeColor: "#3354ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  );
}
