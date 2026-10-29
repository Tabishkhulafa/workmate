import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles')
    .select('role,is_active,must_change_password').eq('id', user.id).maybeSingle();
  if (!profile?.is_active || profile.must_change_password ||
    !['EMPLOYEE', 'DEPARTMENT_HEAD', 'HR'].includes(profile.role)) {
    return NextResponse.json({ error: 'Account cannot punch' }, { status: 403 });
  }
  const { data, error: statusError } = await supabase.functions.invoke('face-profile-status', {
    body: { employee_id: user.id },
  });
  return NextResponse.json({
    authenticated: true,
    enrolled: statusError ? null : data?.enrolled === true,
    face_verifier_available: false,
    reason: 'Trusted server-verifiable browser liveness has not been integrated. Web biometric punch must remain locked.',
    browser_model_status: 'inference_tested',
    require_https: true,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
