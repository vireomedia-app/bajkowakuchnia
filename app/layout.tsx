
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System zarządzania kuchnią i magazynem - W małej kuchni",
  description: "System zarządzania kuchnią i magazynem dla firmy W małej kuchni",
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "System zarządzania kuchnią i magazynem - W małej kuchni",
    description: "System zarządzania kuchnią i magazynem",
    images: ['/og-image.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className="antialiased bg-gradient-to-br from-blue-50 via-white to-gray-50 min-h-screen"
      >
        <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm shadow-sm">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">WMK</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">System zarządzania</h1>
                  <p className="text-sm text-gray-600">kuchnią i magazynem</p>
                </div>
              </Link>
            </div>
          </div>
        </header>
        <main className="container mx-auto max-w-6xl px-4 py-8">
          {children}
        </main>
        <footer className="border-t bg-white/50 backdrop-blur-sm mt-12">
          <div className="container mx-auto max-w-6xl px-4 py-4">
            <div className="text-center text-sm text-gray-600">
              <p>System zarządzania kuchnią i magazynem - W małej kuchni</p>
              <p className="mt-1 text-xs text-gray-500">Wersja {APP_VERSION}</p>
            </div>
          </div>
        </footer>
        <Toaster
          position="top-right"
          expand={false}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
