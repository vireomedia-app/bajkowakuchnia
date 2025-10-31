
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ścieżki publiczne (dostępne bez logowania)
  const publicPaths = [
    '/login', 
    '/reset-password',
    '/api/auth/login', 
    '/api/auth/reset-password',
    '/api/auth/request-reset'
  ];
  
  // Sprawdź czy ścieżka jest publiczna
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Sprawdź czy użytkownik jest zalogowany
  const authSession = request.cookies.get('auth_session');

  if (!authSession || !authSession.value) {
    // Przekieruj do strony logowania
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|logo.png|og-image.png|robots.txt).*)',
  ],
};
