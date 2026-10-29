import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';

function extractMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  for (const k of ['error', 'message', 'msg']) {
    if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const { supabase, profile } = await requireAdmin();
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const role = String(body.role || 'EMPLOYEE');
  if (!['EMPLOYEE','DEPARTMENT_HEAD','HR','SUPER_ADMIN'].includes(role)) return NextResponse.json({error:'Invalid role'}, {status:400});
  if (profile.role === 'HR' && ['HR','SUPER_ADMIN'].includes(role)) return NextResponse.json({error:'Not permitted'}, {status:403});
  const phone=String(body.phone||'').trim();
  const email=String(body.email||'').trim();
  const privateDetails=(body.private_details&&typeof body.private_details==='object'&&!Array.isArray(body.private_details)?body.private_details:{}) as Record<string,unknown>;
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return NextResponse.json({error:'Enter a valid employee email address.'},{status:400});
  if(phone&&!/^\d{10}$/.test(phone))return NextResponse.json({error:'Employee mobile must have exactly 10 digits.'},{status:400});
  for(const field of ['emergency_contact_1_phone','emergency_contact_2_phone']){
   const number=String(privateDetails[field]||'').trim();
   if(number&&!/^\d{10}$/.test(number))return NextResponse.json({error:`${field.replaceAll('_',' ')} must have exactly 10 digits.`},{status:400});
  }
  const password=String(body.password||'');
  if (!/^\d{10}$/.test(phone) && !String(body.email||'').trim()) return NextResponse.json({error:'Email or 10-digit phone required'},{status:400});
  if (password.length<6) return NextResponse.json({error:'Initial password too short'}, {status:400});
  const {data,error}=await supabase.functions.invoke('create-employee',{body});
  if (error || extractMessage(data) || data?.success === false) {
    let reason=extractMessage(data);
    let httpStatus: number|undefined;
    const context = error && typeof error === 'object' && 'context' in error ? error.context : undefined;
    if (context instanceof Response) {
      httpStatus=context.status;
      try {
        const raw=await context.clone().text();
        try {reason ||= extractMessage(JSON.parse(raw));} catch {reason ||= raw.slice(0,250);}
      } catch { /* context may be consumed */ }
    }
    reason = reason || error?.message || 'Employee creation failed';
    const rateLimited = httpStatus===429 || /rate.?limit|too many requests|email rate limit/i.test(reason ?? '');
    return NextResponse.json({error:reason,upstream_status:httpStatus,rate_limited:rateLimited}, {status:rateLimited?429:422});
  }
  return NextResponse.json({success:true,data});
}

