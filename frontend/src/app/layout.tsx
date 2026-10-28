import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Trip On Himalaya CRM",
  description: "CRM for Trip On Himalaya — Himalayan trekking, adventure tours and pilgrimages",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}