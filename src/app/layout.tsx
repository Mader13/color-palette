import type { Metadata } from "next";
import { Actor, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const actor = Actor({
  variable: "--font-actor",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Image to Color Palette",
  description:
    "Extract color palettes from any image. Drop an image and get dominant colors with HEX codes instantly. All processing happens locally in your browser.",
  keywords: [
    "color palette",
    "image colors",
    "HEX extractor",
    "design tool",
    "color picker",
  ],
  authors: [{ name: "Minti" }],
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body
        className={`${actor.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
