import { NextResponse } from 'next/server';

// Routes that don't need login
const PUBLIC = ['/login', '/api/auth/login'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const token = request.cookies.get('cr_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) throw new Error('bad token');

    const secret = process.env.SESSION_SECRET || 'fallback';
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) throw new Error('invalid sig');

    const data = JSON.parse(atob(payloadB64));
    if (data.exp < Date.now()) throw new Error('expired');

    // Attach user info to headers for pages to read
    const res = NextResponse.next();
    res.headers.set('x-user', data.username);
    res.headers.set('x-role', data.role);
    return res;
  } catch {
    const res = NextResponse.redirect(new URL('/login', request.url));
    res.cookies.delete('cr_session');
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
