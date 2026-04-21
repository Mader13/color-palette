import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chromatic — Image to Color Palette",
  description:
    "Extract beautiful color palettes from any image. Drop an image and get dominant colors with HEX codes instantly. All processing happens locally in your browser.",
  keywords: [
    "color palette",
    "image colors",
    "HEX extractor",
    "design tool",
    "color picker",
  ],
  authors: [{ name: "Chromatic" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="icon" href="./icon.png" type="image/png" />
        <link rel="shortcut icon" href="./icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="./icon.png" type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
