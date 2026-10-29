import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

type CookieBatch = { name: string; value: string; options?: CookieOptions }[];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Work Mate server configuration is missing. Configure Supabase URL and anon key in Vercel.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(values: CookieBatch) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
    return response;
  } catch (error) {
    console.error('Work Mate middleware auth refresh failed', error instanceof Error ? error.message : 'Unknown');
    // Do not discard the user session or pretend login succeeded on connection failure.
    return NextResponse.json({ error: 'Authentication service temporarily unavailable. Try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
// PUBLIC, STATIC assets never need an auth session refresh. In particular, the
// face model and ONNX WebAssembly files would otherwise incur a Supabase auth
// request on every cold model load. API route handlers already call
// authenticated Supabase helpers and can refresh cookies themselves, so
// middleware authentication here would duplicate their network work.
// Server Component page navigation stays in scope for session refresh.
export const config = {
  matcher: [
    '/((?!api/|login$|forgot-password$|_next/|models/|ort/|vendor/|favicon\\.ico$|manifest\\.webmanifest$|workmate-sw\\.js$|workmate-icon\\.svg$|workmate-employee-import-template\\.csv$).*)',
  ],
};
