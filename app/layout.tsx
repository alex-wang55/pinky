import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth";
import { ToastProvider } from "@/components/ui";

export const metadata: Metadata = {
  title: "Pinky",
  description: "Pinky promise with your friends. Check in every day, be honest, and pay the pot when you slip.",
  appleWebApp: { capable: true, title: "Pinky", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff7f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141015" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
