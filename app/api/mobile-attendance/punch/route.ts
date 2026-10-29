import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
});

/** Only forwards a verification token issued by the face-verification service.
 * This endpoint NEVER accepts client-supplied liveness scores, images, or success flags.
 * The upstream must consume the single-use token and persist the attendance record.
 */
export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in required', attendance_recorded: false }, 401);

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('role,is_active,must_change_password').eq('id', user.id).maybeSingle();
  if (profileError || !profile?.is_active || profile.must_change_password ||
    !['EMPLOYEE', 'DEPARTMENT_HEAD', 'HR'].includes(profile.role)) {
    return json({ error: 'This account cannot mark attendance', attendance_recorded: false }, 403);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Invalid request', attendance_recorded: false }, 400);
  const input = body as Record<string, unknown>;
  const action = input.action;
  const token = input.verification_token;
  // Require a fresh, accurate location for the final attendance write.
  const gps = input.gps as Record<string, unknown> | undefined;
  const latitude = gps?.latitude;
  const longitude = gps?.longitude;
  const accuracy = gps?.accuracy;
  const timestamp = gps?.timestamp;
  const fresh = typeof timestamp === 'number' && Number.isFinite(timestamp) &&
    timestamp <= Date.now() + 10000 && Date.now() - timestamp <= 60000;
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000 ||
      !fresh) {
    return json({ error: 'Fresh precise GPS required; acquire location again', attendance_recorded: false }, 422);
  }

  if (action !== 'CLOCK_IN' && action !== 'CLOCK_OUT') return json({ error: 'Invalid action', attendance_recorded: false }, 400);
  if (typeof token !== 'string' || token.length < 20 || token.length > 512 || !/^[a-zA-Z0-9._-]+$/.test(token)) {
    return json({ error: 'Valid server-issued face verification token required', attendance_recorded: false }, 400);
  }

  // Upstream validates token ownership, action, expiry, face evidence, GPS/geofence and replay protection.
  const { data, error } = await supabase.functions.invoke('attendance-action', {
    body: { action, method: 'FACE', verification_token: token, latitude, longitude, accuracy },
  });
  if (error) {
    let message = 'Face attendance could not be recorded';
    try {
      const detail = await error.context?.json?.();
      if (typeof detail?.error === 'string') message = detail.error;
    } catch { /* Don't leak unexpected errors. */ }
    return json({ error: message, attendance_recorded: false }, 400);
  }

  // Do not tell an employee their punch succeeded merely because HTTP returned 200.
  const result = data as { success?: unknown; action?: unknown; method?: unknown;
    attendance?: { id?: unknown } | null; error?: unknown } | null;
  if (!result || result.success !== true || result.action !== action ||
      result.method !== 'FACE' || !result.attendance ||
      typeof result.attendance.id !== 'string') {
    return json({ error: 'Attendance save could not be confirmed. Refresh attendance history before retrying.',
      attendance_recorded: false }, 502);
  }
  return json({ attendance_recorded: true, action, attendance_id: result.attendance.id });
}
