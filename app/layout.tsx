
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bajkowa kuchnia - System zarządzania",
  description: "Bajkowa kuchnia - nowoczesny system zarządzania kuchnią i magazynem",
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Bajkowa kuchnia - System zarządzania",
    description: "Nowoczesny system zarządzania kuchnią i magazynem",
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
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-7 h-7">
                    <ellipse cx="50" cy="62" rx="28" ry="7" fill="white" opacity="0.95"/>
                    <path d="M 30 62 Q 28 45, 35 40 Q 38 35, 43 38 Q 45 30, 50 28 Q 55 30, 57 38 Q 62 35, 65 40 Q 72 45, 70 62 Z" 
                          fill="white" opacity="0.95"/>
                    <ellipse cx="50" cy="62" rx="26" ry="5" fill="#FFE5D9" opacity="0.6"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-orange-600">Bajkowa kuchnia</h1>
                  <p className="text-xs text-gray-500">System zarządzania</p>
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
              <p className="font-medium text-orange-600">Bajkowa kuchnia</p>
              <p className="mt-1 text-xs text-gray-500">Wersja {APP_VERSION}</p>
            </div>
          </div>
        </footer>
        <Toaster
          position="top-center"
          expand={true}
          richColors
          closeButton
          toastOptions={{
            style: {
              maxWidth: '90vw',
              width: 'auto',
            },
          }}
          visibleToasts={3}
        />
      </body>
    </html>
  );
}
