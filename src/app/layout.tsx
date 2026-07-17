import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wanosend — Email Sender Platform",
  description: "Send campaigns, manage contacts, and track delivery.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
