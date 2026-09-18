import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Community Board",
  description:
    "Create a space for your group in seconds. Share one link. Anyone can participate.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
