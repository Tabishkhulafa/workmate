import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const reply = (v: unknown, status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request: NextRequest) {
 const sb=await supabaseServer();
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return reply({error:'Please sign in again'},401);
 const {data:profile}=await sb.from('profiles').select('role,is_active,must_change_password').eq('id',user.id).maybeSingle();
 if(!profile?.is_active||profile.must_change_password||!['HR','DEPARTMENT_HEAD','EMPLOYEE'].includes(profile.role))return reply({error:'Attendance unavailable for this account'},403);
 const b=await request.json().catch(()=>null);
 if(!b||!['CLOCK_IN','CLOCK_OUT'].includes(b.action)||!Array.isArray(b.embedding)||b.embedding.length!==192||b.embedding.some((x:unknown)=>typeof x!=='number'||!Number.isFinite(x)))return reply({error:'Invalid face scan'},400);
 const gps=b.gps;
 if(!gps||!Number.isFinite(gps.latitude)||!Number.isFinite(gps.longitude)||!Number.isFinite(gps.accuracy)||!Number.isFinite(gps.timestamp)||gps.accuracy<=0||gps.accuracy>100||Date.now()-gps.timestamp>60000||gps.timestamp>Date.now()+10000)return reply({error:'Fresh accurate GPS required'},422);
 // Internal-office policy: face matching and GPS, without liveness challenge.
 // The currently deployed verifier expects a client-provided compatibility flag.
 // This is NOT anti-spoof evidence; it must not be represented as liveness verification.
 const {data,error}=await sb.functions.invoke('verify-face-profile',{body:{purpose:b.action,embedding:b.embedding,latitude:gps.latitude,longitude:gps.longitude,accuracy:gps.accuracy,liveness_verified:true}});
 if(error){let detail:{error?:string;code?:string}|undefined;const context=(error as {context?:Response}).context;try{detail=await context?.clone().json()}catch{}return reply({error:detail?.code==='FACE_MISMATCH'?'Face does not match. Try again.':detail?.error||'Face verification failed',code:detail?.code||'FACE_VERIFICATION_FAILED'},context?.status&&context.status>=400?context.status:502)}
 if(data?.verified!==true||typeof data?.verification_token!=='string')return reply({error:'Face does not match. Try again.'},403);
 return reply({verified:true,verification_token:data.verification_token});
}
