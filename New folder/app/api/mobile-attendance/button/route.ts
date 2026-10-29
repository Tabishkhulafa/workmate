import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const reply = (status: number, data: Record<string, unknown>) => NextResponse.json(data, {status, headers:{'Cache-Control':'no-store'}});
type Grant = {id:string;valid_from:string;expires_at:string;revoked_at:string|null};
export async function POST(request: NextRequest) {
  try {
    const supabase = await supabaseServer();
    const {data:{user},error:authError} = await supabase.auth.getUser();
    if (authError || !user) return reply(401,{error:'Please sign in'});
    const {data:profile,error:profileError} = await supabase.from('profiles').select('id,role,is_active,must_change_password').eq('id',user.id).maybeSingle();
    if (profileError || !profile?.is_active || profile.must_change_password || !['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(profile.role)) return reply(403,{error:'This account cannot punch attendance'});
    const body = await request.json().catch(()=>null);
    const action = body?.action;
    if (!['STATUS','CLOCK_IN','CLOCK_OUT'].includes(action)) return reply(400,{error:'Invalid attendance action'});
    const {data:permissionData,error:permissionError} = await supabase.functions.invoke('manage-button-attendance',{body:{action:'status',employee_id:user.id}});
    if (permissionError) return reply(502,{error:'Unable to verify temporary attendance permission'});
    const now = Date.now();
    const grants = (permissionData?.permissions ?? []) as Grant[];
    const active = grants.find(p=>p.revoked_at===null && Number.isFinite(Date.parse(p.valid_from)) && Number.isFinite(Date.parse(p.expires_at)) && Date.parse(p.valid_from)<=now && Date.parse(p.expires_at)>now);
    if (action==='STATUS') return reply(200,{active:!!active,expires_at:active?.expires_at??null});
    if (!active) return reply(403,{error:'HR-approved temporary Button Attendance permission required'});
    const latitude=body?.latitude, longitude=body?.longitude, accuracy=body?.accuracy, capturedAt=body?.captured_at;
    if (typeof latitude!=='number'||!Number.isFinite(latitude)||latitude< -90||latitude>90 || typeof longitude!=='number'||!Number.isFinite(longitude)||longitude< -180||longitude>180 || typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000) return reply(400,{error:'Valid GPS coordinates and accuracy required'});
    if (typeof capturedAt!=='number' || !Number.isFinite(capturedAt) || Math.abs(now-capturedAt)>30000) return reply(400,{error:'GPS reading expired. Acquire a fresh location.'});
    // attendance-action v8 also independently enforces the same permission at Supabase.
    const {data:punch,error:punchError} = await supabase.functions.invoke('attendance-action',{body:{action,method:'NORMAL',latitude,longitude,accuracy,location_address:''}});
    if (punchError) {
      let message=punchError.message || 'Attendance was not recorded';
      const context=(punchError as {context?:Response}).context;
      if (context && typeof context.json==='function') try {const payload=await context.json() as {error?:string};message=payload.error??message;}catch{}
      return reply(context?.status && context.status>=400?context.status:502,{error:message});
    }
    if (punch?.success !== true) return reply(502,{error:String(punch?.error??'Could not confirm attendance was recorded')});
    return reply(200,{success:true,result:punch});
  } catch(error) {
    console.error('button attendance route',error instanceof Error?error.message:'unknown');
    return reply(500,{error:'Unable to process attendance. No success confirmation was received.'});
  }
}
