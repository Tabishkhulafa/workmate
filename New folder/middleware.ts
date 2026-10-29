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
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };
