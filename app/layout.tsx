import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { Header } from "@/components/shared/Header";

const shareTitle = "FLS Transport | Yard Management";
const shareDescription = "Yard management, container inspections, and yard entry and exit tracking by FLS Transport.";
const shareImage = "/brand/fls-transport-square-v4.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://yard-management-blond.vercel.app"),
  title: shareTitle,
  description: shareDescription,
  applicationName: "FLS Yard Management",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "FLS Transport",
    title: shareTitle,
    description: shareDescription,
    images: [{
      url: shareImage,
      width: 1200,
      height: 1200,
      type: "image/png",
      alt: "FLS Transport logo",
    }],
  },
  twitter: {
    card: "summary",
    title: shareTitle,
    description: shareDescription,
    images: [shareImage],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DockMgmt",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased">
        <AppProviders>
          <div className="min-h-screen bg-gray-50">
            <Header />
            <main className="container mx-auto p-4">
              {children}
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
